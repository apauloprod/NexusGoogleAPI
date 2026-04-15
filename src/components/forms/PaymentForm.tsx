import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, doc, updateDoc, increment } from "firebase/firestore";
import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, CreditCard as StripeIcon, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const paymentSchema = z.object({
  invoiceId: z.string().min(1, "Please select an invoice"),
  amount: z.coerce.number().min(0.01, "Amount must be at least 0.01"),
  method: z.string().min(1, "Please select a payment method"),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface PaymentFormProps {
  initialData?: PaymentFormValues & { id: string };
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PaymentForm({ initialData, onSuccess, onCancel }: PaymentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const q = query(collection(db, "invoices"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching invoices:", error);
      }
    }
    fetchInvoices();
  }, []);

  const form = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: initialData || {
      invoiceId: "",
      amount: 0,
      method: "Credit Card",
      notes: "",
    },
  });

  async function onSubmit(values: PaymentFormValues) {
    setIsSubmitting(true);
    try {
      const selectedInvoice = invoices.find(i => i.id === values.invoiceId);
      
      if (initialData?.id) {
        const paymentRef = doc(db, "payments", initialData.id);
        await updateDoc(paymentRef, {
          ...values,
          updatedAt: serverTimestamp(),
        });

        if (values.amount !== initialData.amount) {
          const invoiceRef = doc(db, "invoices", values.invoiceId);
          const diff = values.amount - initialData.amount;
          await updateDoc(invoiceRef, {
            paidAmount: increment(diff),
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        await addDoc(collection(db, "payments"), {
          ...values,
          clientName: selectedInvoice?.clientName || "Unknown Client",
          invoiceNumber: selectedInvoice?.invoiceNumber || "Unknown",
          status: "success",
          createdAt: serverTimestamp(),
        });

        const invoiceRef = doc(db, "invoices", values.invoiceId);
        const newPaidAmount = (selectedInvoice?.paidAmount || 0) + values.amount;
        const isPaid = newPaidAmount >= (selectedInvoice?.total || 0);

        await updateDoc(invoiceRef, {
          paidAmount: increment(values.amount),
          status: isPaid ? "paid" : "sent",
          updatedAt: serverTimestamp(),
        });
      }

      form.reset();
      onSuccess?.();
    } catch (error) {
      handleFirestoreError(error, initialData?.id ? OperationType.UPDATE : OperationType.CREATE, "payments");
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleStripePayment = async () => {
    const values = form.getValues();
    const amount = Number(values.amount);
    if (!values.invoiceId || isNaN(amount) || amount <= 0) {
      alert("Please select an invoice and enter a valid amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedInvoice = invoices.find(i => i.id === values.invoiceId);
      const response = await fetch(`/api/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount,
          currency: "usd",
          description: `Invoice #${selectedInvoice?.invoiceNumber}`,
          metadata: {
            type: "invoice",
            id: values.invoiceId,
            clientName: selectedInvoice?.clientName,
          },
          successUrl: `${window.location.origin}/#/dashboard/payments?success=true`,
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
      console.error("Stripe error:", error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="invoiceId"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Invoice</FormLabel>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className={cn(
                        "w-full justify-between bg-white/5 border-white/10 hover:bg-white/10 text-white font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value
                        ? (() => {
                            const inv = invoices.find((i) => i.id === field.value);
                            return inv ? `#${inv.invoiceNumber} - ${inv.clientName}` : "Select invoice";
                          })()
                        : "Select invoice"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-black border-white/10">
                  <Command className="bg-transparent">
                    <CommandInput placeholder="Search invoice or client..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>No invoice found.</CommandEmpty>
                      <CommandGroup>
                        {invoices.map((inv) => (
                          <CommandItem
                            key={inv.id}
                            value={`${inv.invoiceNumber} ${inv.clientName}`}
                            onSelect={() => {
                              field.onChange(inv.id);
                              const balance = (inv.total || 0) - (inv.paidAmount || 0);
                              form.setValue("amount", balance > 0 ? balance : 0);
                              setOpen(false);
                            }}
                            className="text-white hover:bg-white/10 cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                field.value === inv.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>#{inv.invoiceNumber} - {inv.clientName}</span>
                              <span className="text-[10px] text-muted-foreground">
                                Balance: ${((inv.total || 0) - (inv.paidAmount || 0)).toLocaleString()}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Amount ($)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} className="bg-white/5 border-white/10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Method</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-black border-white/10">
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Check">Check</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="bg-white text-black hover:bg-white/90" disabled={isSubmitting}>
              {isSubmitting ? (initialData?.id ? "Updating..." : "Processing...") : (initialData?.id ? "Update Payment" : "Record Manually")}
            </Button>
          </div>
          
          {!initialData?.id && (
            <>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-black px-2 text-muted-foreground">Or process online</span>
                </div>
              </div>
              
              <Button 
                type="button"
                variant="outline"
                className="w-full border-white/10 hover:bg-white/5 gap-2 h-12 font-bold"
                onClick={handleStripePayment}
                disabled={isSubmitting}
              >
                <StripeIcon className="h-4 w-4" />
                Process with Stripe
              </Button>
            </>
          )}
        </div>
      </form>
    </Form>
  );
}
