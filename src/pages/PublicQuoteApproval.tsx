import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, FileText, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

export default function PublicQuoteApproval() {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'pending' | 'approved' | 'error'>('pending');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuote() {
      if (!quoteId) return;
      try {
        const quoteRef = doc(db, "quotes", quoteId);
        const quoteSnap = await getDoc(quoteRef);
        if (quoteSnap.exists()) {
          const data = quoteSnap.data();
          setQuote({ id: quoteSnap.id, ...data });
          if (data.status === 'approved') {
            setStatus('approved');
          }
        } else {
          setError("Quote not found.");
          setStatus('error');
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load quote.");
        setStatus('error');
      } finally {
        setLoading(false);
      }
    }
    fetchQuote();
  }, [quoteId]);

  const handleApprove = async () => {
    if (!quote || !quoteId) return;

    if (quote.paymentRequired) {
      const amountToPay = quote.depositAmount > 0 ? quote.depositAmount : quote.total;
      navigate(`/pay?type=quote&id=${quoteId}&amount=${amountToPay}`);
      return;
    }

    setLoading(true);
    try {
      // 1. Update Quote Status
      const quoteRef = doc(db, "quotes", quoteId);
      await updateDoc(quoteRef, {
        status: "approved",
        updatedAt: serverTimestamp(),
      });

      // Handle address formatting
      let clientAddress = "";
      if (quote?.address) {
        if (typeof quote.address === 'string') {
          clientAddress = quote.address;
        } else {
          const { street = "", city = "", state = "", zip = "" } = quote.address;
          clientAddress = [street, city, state, zip].filter(Boolean).join(", ");
        }
      } else if (quote.clientAddress) {
        clientAddress = quote.clientAddress;
      }

      // 2. Create Job automatically
      await addDoc(collection(db, "jobs"), {
        title: `Job from Quote #${quote.quoteNumber}`,
        clientId: quote.clientId,
        clientName: quote.clientName,
        clientPhone: quote.clientPhone || "",
        clientAddress: clientAddress,
        businessId: quote.businessId,
        status: "active",
        notes: quote.notes || "",
        quoteId: quoteId,
        quoteNumber: quote.quoteNumber,
        items: quote.items || [],
        total: quote.total,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. Update Client Status
      const clientRef = doc(db, "clients", quote.clientId);
      await updateDoc(clientRef, {
        status: "active",
        updatedAt: serverTimestamp(),
      });

      setStatus('approved');
    } catch (err) {
      console.error(err);
      setError("Failed to approve quote.");
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !quote) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <p className="text-muted-foreground font-medium">Loading quote details...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full glass p-8 rounded-[2.5rem] border-white/5 text-center">
          <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-8">{error}</p>
          <Button variant="outline" className="w-full border-white/10" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'approved') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass p-10 rounded-[3rem] border-white/5 text-center"
        >
          <div className="h-20 w-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4 tracking-tighter">Quote Approved!</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Thank you for approving Quote <span className="text-white font-bold">#{quote?.quoteNumber}</span>. 
            We've scheduled the work and will be in touch shortly.
          </p>
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-left mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Total Amount</span>
              <span className="text-lg font-bold text-white">${quote?.total?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Status</span>
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Confirmed</Badge>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">You can close this window now.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px] uppercase tracking-widest">Quote Approval</Badge>
              <span className="text-muted-foreground text-sm">#{quote?.quoteNumber}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter">Review Your Quote</h1>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-sm">Amount Due</p>
            <p className="text-3xl font-bold">${quote?.total?.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="md:col-span-2 space-y-6">
            <div className="glass p-8 rounded-[2rem] border-white/5">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Service Details
              </h2>
              <div className="space-y-4">
                {quote?.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start py-4 border-b border-white/5 last:border-0">
                    <div>
                      <p className="font-medium text-lg">{item.description}</p>
                    </div>
                    <p className="font-bold text-lg">${item.price?.toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-8 border-t border-white/10 flex justify-between items-center">
                <span className="text-xl font-bold">Total</span>
                <span className="text-3xl font-bold text-white">${quote?.total?.toLocaleString()}</span>
              </div>
            </div>

            {quote?.notes && (
              <div className="glass p-8 rounded-[2rem] border-white/5">
                <h2 className="text-xl font-bold mb-4">Notes & Terms</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="glass p-8 rounded-[2rem] border-white/5 sticky top-8">
              <h2 className="text-xl font-bold mb-6">Action Required</h2>
              <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                {quote?.paymentRequired 
                  ? `To approve this quote, a ${quote.depositAmount > 0 ? `deposit of $${quote.depositAmount.toLocaleString()}` : 'full payment of $' + quote.total?.toLocaleString()} is required.`
                  : 'Please review the details of your quote. By clicking "Approve Quote", you agree to the terms and services listed.'}
              </p>
              <Button 
                className="w-full h-14 rounded-2xl bg-white text-black hover:bg-white/90 font-bold text-lg shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all active:scale-95"
                onClick={handleApprove}
                disabled={loading}
              >
                {loading ? "Processing..." : (quote?.paymentRequired ? "Review & Pay" : "Approve Quote")}
              </Button>
              <p className="text-center mt-4 text-[10px] text-muted-foreground uppercase tracking-widest">
                Secure Approval Powered by CRM
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
