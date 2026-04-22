import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc, increment, getDocs, query, where, deleteDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreditCard, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export default function PublicPayment() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const success = searchParams.get("success");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [amount, setAmount] = useState<string>("");

  useEffect(() => {
    if (!id || !type) return;

    const fetchData = async () => {
      try {
        const collectionName = type === "quote" ? "quotes" : "invoices";
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const docData = docSnap.data();
          setData(docData);
          setAmount(docData.total.toString());
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, type]);

  useEffect(() => {
    if (success && id && type && data) {
      const recordPayment = async () => {
        try {
          // Record the payment in Firestore
          await addDoc(collection(db, "payments"), {
            invoiceId: type === "invoice" ? id : "",
            quoteId: type === "quote" ? id : "",
            amount: parseFloat(amount),
            method: "Stripe",
            clientName: data.clientName,
            invoiceNumber: data.invoiceNumber || data.quoteNumber || "Unknown",
            status: "success",
            createdAt: serverTimestamp(),
          });

          if (type === "invoice") {
            const invoiceRef = doc(db, "invoices", id);
            const newPaidAmount = (data.paidAmount || 0) + parseFloat(amount);
            const isPaid = newPaidAmount >= (data.total || 0);
            await updateDoc(invoiceRef, {
              paidAmount: increment(parseFloat(amount)),
              status: isPaid ? "paid" : "sent",
              updatedAt: serverTimestamp(),
            });
          } else if (type === "quote") {
            const quoteRef = doc(db, "quotes", id);
            await updateDoc(quoteRef, {
              status: "approved",
              updatedAt: serverTimestamp(),
            });

            // Handle address formatting
            let clientAddress = "";
            if (data?.address) {
              if (typeof data.address === 'string') {
                clientAddress = data.address;
              } else {
                const { street = "", city = "", state = "", zip = "" } = data.address;
                clientAddress = [street, city, state, zip].filter(Boolean).join(", ");
              }
            } else if (data.clientAddress) {
              clientAddress = data.clientAddress;
            }

            // Create Job automatically after successful payment
            await addDoc(collection(db, "jobs"), {
              title: `Job from Quote #${data.quoteNumber}`,
              clientId: data.clientId,
              clientName: data.clientName,
              clientPhone: data.clientPhone || "",
              clientAddress: clientAddress,
              businessId: data.businessId,
              status: "active",
              notes: data.notes || "",
              quoteId: id,
              quoteNumber: data.quoteNumber,
              items: data.items || [],
              total: data.total,
              scheduledAt: data.scheduledAt || null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            // Cleanup visits if quote
            if (data.visitId) {
              try {
                await deleteDoc(doc(db, "visits", data.visitId));
              } catch (err) {
                console.error("Visit cleanup error:", err);
              }
            } else {
              try {
                const visitsRef = collection(db, "visits");
                const vq = query(visitsRef, where("quoteId", "==", id));
                const vSnap = await getDocs(vq);
                for (const d of vSnap.docs) {
                  await deleteDoc(doc(db, "visits", d.id));
                }
              } catch (err) {
                console.error("Visits cleanup error:", err);
              }
            }

            // Update client status
            const clientRef = doc(db, "clients", data.clientId);
            await updateDoc(clientRef, {
              status: "active",
              updatedAt: serverTimestamp(),
            });
          }
        } catch (error) {
          console.error("Error recording payment:", error);
        }
      };
      recordPayment();
    }
  }, [success, id, type, data]);

  const handlePayment = async () => {
    setProcessing(true);
    try {
      const response = await fetch(`/api/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          currency: "usd",
          description: `${type === "quote" ? "Quote" : "Invoice"} #${data.quoteNumber || data.invoiceNumber}`,
          metadata: {
            type,
            id,
            clientName: data.clientName,
          },
          successUrl: `${window.location.origin}/#/pay?success=true&type=${type}&id=${id}`,
          cancelUrl: window.location.href,
        }),
      });

      const session = await response.json();
      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error(session.error || "Failed to create checkout session");
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      alert(error.message);
    } finally {
      setProcessing(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-black border-white/10 text-white rounded-[2rem] overflow-hidden">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="h-20 w-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <h1 className="text-3xl font-bold tracking-tighter mb-2">Payment Successful!</h1>
            <p className="text-muted-foreground mb-8">
              Thank you for your payment. Your records have been updated.
            </p>
            <Button 
              className="w-full bg-white text-black hover:bg-white/90 rounded-xl h-12 font-bold"
              onClick={() => window.close()}
            >
              Close Window
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-white animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white">
        <p>Invalid payment link or document not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <Card className="w-full max-w-md bg-black border-white/10 text-white rounded-[2rem] overflow-hidden">
        <CardHeader className="pt-10 pb-6 text-center">
          {data?.businessLogo ? (
            <div className="mx-auto mb-6 h-16 w-32 flex items-center justify-center">
               <img src={data.businessLogo} alt="Business Logo" className="h-full object-contain" referrerPolicy="no-referrer" />
            </div>
          ) : (
            <div className="h-12 w-12 bg-white/5 rounded-xl flex items-center justify-center mx-auto mb-4">
              <CreditCard className="h-6 w-6 text-white" />
            </div>
          )}
          <CardTitle className="text-2xl font-bold tracking-tighter">
            Pay {type === "quote" ? "Quote" : "Invoice"}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            #{data.quoteNumber || data.invoiceNumber} for {data.clientName}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-10 space-y-6">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Total Amount</span>
              <span className="text-xl font-bold">${data.total.toLocaleString()}</span>
            </div>
            <Separator className="my-4 bg-white/5" />
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Amount to Pay
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input 
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 bg-white/5 border-white/10 rounded-xl h-12 focus:ring-white/20"
                />
              </div>
            </div>
          </div>

          <Button 
            className="w-full bg-white text-black hover:bg-white/90 rounded-xl h-14 text-lg font-bold gap-3"
            onClick={handlePayment}
            disabled={processing}
          >
            {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
            Pay with Stripe
          </Button>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            Secure Payment Powered by Stripe
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const Separator = ({ className }: { className?: string }) => (
  <div className={`h-px w-full ${className}`} />
);
