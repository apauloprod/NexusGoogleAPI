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

const paymentSchema = z.object({
  invoiceId: z.string().min(1, "Please select an invoice"),
  amount: z.coerce.number().min(0.01, "Amount must be at least 0.01"),
  method: z.string().min(1, "Please select a payment method"),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface PaymentFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PaymentForm({ onSuccess, onCancel }: PaymentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        // Fetch only unpaid or partially paid invoices
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
    defaultValues: {
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
      
      // 1. Record the payment
      await addDoc(collection(db, "payments"), {
        ...values,
        clientName: selectedInvoice?.clientName || "Unknown Client",
        invoiceNumber: selectedInvoice?.invoiceNumber || "Unknown",
        status: "success",
        createdAt: serverTimestamp(),
      });

      // 2. Update the invoice paid amount and status
      const invoiceRef = doc(db, "invoices", values.invoiceId);
      const newPaidAmount = (selectedInvoice?.paidAmount || 0) + values.amount;
      const isPaid = newPaidAmount >= (selectedInvoice?.total || 0);

      await updateDoc(invoiceRef, {
        paidAmount: increment(values.amount),
        status: isPaid ? "paid" : "sent",
        updatedAt: serverTimestamp(),
      });

      form.reset();
      onSuccess?.();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "payments");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="invoiceId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Invoice</FormLabel>
              <Select onValueChange={(value) => {
                field.onChange(value);
                const inv = invoices.find(i => i.id === value);
                if (inv) {
                  const balance = (inv.total || 0) - (inv.paidAmount || 0);
                  form.setValue("amount", balance > 0 ? balance : 0);
                }
              }} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue placeholder="Select an invoice" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-black border-white/10">
                  {invoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      #{inv.invoiceNumber} - {inv.clientName} (${((inv.total || 0) - (inv.paidAmount || 0)).toLocaleString()} balance)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" className="bg-white text-black hover:bg-white/90" disabled={isSubmitting}>
            {isSubmitting ? "Processing..." : "Record Payment"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
