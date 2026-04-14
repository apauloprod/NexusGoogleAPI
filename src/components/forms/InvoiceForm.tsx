import { useForm, useFieldArray } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, doc, updateDoc, getDoc, limit } from "firebase/firestore";
import { useState, useEffect } from "react";

import { ClientSearchSelect } from "../ClientSearchSelect";

const invoiceSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  total: z.coerce.number().min(0, "Total must be positive"),
  items: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    price: z.coerce.number().min(0, "Price must be positive"),
  })),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

interface InvoiceFormProps {
  initialData?: any;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function InvoiceForm({ initialData, onSuccess, onCancel }: InvoiceFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(invoiceSchema),
    defaultValues: initialData || {
      clientId: "",
      invoiceNumber: "",
      total: 0,
      items: [{ description: "", price: 0 }],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "",
    },
  });

  useEffect(() => {
    if (!initialData?.id && !form.getValues("invoiceNumber")) {
      const fetchLatestInvoiceNumber = async () => {
        try {
          const q = query(collection(db, "invoices"), orderBy("invoiceNumber", "desc"), limit(1));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const latestInvoice = snapshot.docs[0].data();
            const latestStr = latestInvoice.invoiceNumber || "";
            const match = latestStr.match(/\d+/);
            const latestNumber = match ? parseInt(match[0]) : 0;
            const nextNumber = `INV-${(latestNumber + 1).toString().padStart(4, '0')}`;
            form.setValue("invoiceNumber", nextNumber);
          } else {
            form.setValue("invoiceNumber", "INV-0001");
          }
        } catch (error) {
          console.error("Error fetching latest invoice number:", error);
          form.setValue("invoiceNumber", "INV-0001");
        }
      };
      fetchLatestInvoiceNumber();
    }
  }, [initialData, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Automatically update total when items change
  const watchItems = form.watch("items");
  useEffect(() => {
    const total = watchItems?.reduce((sum, item) => sum + (Number(item.price) || 0), 0) || 0;
    form.setValue("total", total);
  }, [watchItems, form]);

  async function onSubmit(values: InvoiceFormValues) {
    setIsSubmitting(true);
    setEmailError(null);
    try {
      const clientDoc = await getDoc(doc(db, "clients", values.clientId));
      const clientName = clientDoc.exists() ? clientDoc.data().name : "Unknown Client";
      const clientData = clientDoc.exists() ? clientDoc.data() : null;

      let invoiceId = initialData?.id;
      const invoiceData = {
        ...values,
        clientName,
        dueDate: new Date(values.dueDate),
        updatedAt: serverTimestamp(),
      };

      if (invoiceId) {
        const invoiceRef = doc(db, "invoices", invoiceId);
        await updateDoc(invoiceRef, invoiceData);
      } else {
        const docRef = await addDoc(collection(db, "invoices"), {
          ...invoiceData,
          status: "sent",
          paidAmount: 0,
          createdAt: serverTimestamp(),
        });
        invoiceId = docRef.id;

        // Send Email with PDF
        if (clientData?.email) {
          try {
            const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
            
            // Check if we are on a known static host
            if (window.location.hostname.includes("github.io") && !import.meta.env.VITE_API_URL) {
              const msg = "Email feature requires a backend. GitHub Pages is static-only. Please use the .run.app URL provided in AI Studio.";
              console.error(msg);
              setEmailError(msg);
              setIsSubmitting(false);
              return;
            }

            const response = await fetch(`${apiUrl}/api/send-invoice`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                invoice: { id: invoiceId, ...invoiceData },
                clientEmail: clientData.email,
                appUrl: window.location.origin,
              }),
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              console.error("Invoice Email API error:", response.status, errorData);
              setEmailError(`Failed to send email (Status ${response.status}). Check your RESEND_API_KEY.`);
            } else {
              console.log("Invoice email sent successfully");
            }
          } catch (emailErr) {
            console.error("Failed to send invoice email:", emailErr);
            setEmailError("Network error. Make sure the backend server is running.");
          }
        }
      }
      form.reset();
      onSuccess?.();
    } catch (error) {
      handleFirestoreError(error, initialData?.id ? OperationType.UPDATE : OperationType.CREATE, "invoices");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client</FormLabel>
                <FormControl>
                  <ClientSearchSelect 
                    value={field.value} 
                    onValueChange={field.onChange} 
                    placeholder="Search for a client..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="invoiceNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Invoice Number</FormLabel>
                <FormControl>
                  <Input {...field} className="bg-white/5 border-white/10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <FormLabel>Services / Items</FormLabel>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="h-8 border-white/10 hover:bg-white/5"
              onClick={() => append({ description: "", price: 0 })}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Service
            </Button>
          </div>
          
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-start">
                <div className="flex-1">
                  <FormField
                    control={form.control}
                    name={`items.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Service description" {...field} className="bg-white/5 border-white/10" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="w-32">
                  <FormField
                    control={form.control}
                    name={`items.${index}.price`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="number" placeholder="Price" {...field} className="bg-white/5 border-white/10" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {fields.length > 1 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

          <div className="flex justify-end pt-2 border-t border-white/5">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-xl font-bold text-white">${watchItems?.reduce((sum, item) => sum + (Number(item.price) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className="bg-white/5 border-white/10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Payment instructions, late fees, etc..." 
                  {...field} 
                  className="bg-white/5 border-white/10 min-h-[80px]" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-3 pt-4">
          {emailError && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium text-center">
              {emailError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="bg-white text-black hover:bg-white/90" disabled={isSubmitting}>
              {isSubmitting ? (initialData?.id ? "Updating..." : "Creating...") : (initialData?.id ? "Update Invoice" : "Create Invoice")}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
