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
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, doc, updateDoc, getDoc, limit, where } from "firebase/firestore";
import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";

import { ClientSearchSelect } from "../ClientSearchSelect";

const invoiceSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  issuedBy: z.string().optional(),
  clientContact: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.coerce.number().min(1, "Qty must be at least 1"),
    unit: z.string().default("h"),
    unitPrice: z.coerce.number().min(0, "Price must be positive"),
    vatRate: z.coerce.number().min(0).default(20),
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
      issuedBy: "",
      clientContact: "",
      items: [{ description: "", quantity: 1, unit: "h", unitPrice: 0, vatRate: 20 }],
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

  // Automatically update totals when items change
  const watchItems = form.watch("items");
  const totals = useMemo(() => {
    const itemsWithTotals = (watchItems || []).map(item => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const vatRate = Number(item.vatRate) || 0;
      const ht = quantity * unitPrice;
      const vat = ht * (vatRate / 100);
      return { ht, vat, ttc: ht + vat };
    });

    return {
      totalHT: itemsWithTotals.reduce((sum, i) => sum + i.ht, 0),
      totalVAT: itemsWithTotals.reduce((sum, i) => sum + i.vat, 0),
      totalTTC: itemsWithTotals.reduce((sum, i) => sum + i.ttc, 0),
    };
  }, [watchItems]);

  const [businessSettings, setBusinessSettings] = useState<any>(null);

  useEffect(() => {
    const fetchBusinessSettings = async () => {
      const q = query(collection(db, "users"), where("role", "==", "admin"), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setBusinessSettings(snap.docs[0].data());
      }
    };
    fetchBusinessSettings();
  }, []);

  async function onSubmit(values: InvoiceFormValues) {
    setIsSubmitting(true);
    setEmailError(null);
    try {
      const clientDoc = await getDoc(doc(db, "clients", values.clientId));
      const clientData = clientDoc.exists() ? clientDoc.data() : null;
      const clientName = clientData?.name || "Unknown Client";

      let invoiceId = initialData?.id;
      
      // Data for Firestore (with Timestamps)
      const firestoreData = {
        ...values,
        clientName,
        items: values.items.map(item => {
          const quantity = Number(item.quantity) || 0;
          const unitPrice = Number(item.unitPrice) || 0;
          const vatRate = Number(item.vatRate) || 0;
          const ht = quantity * unitPrice;
          const vat = ht * (vatRate / 100);
          return {
            ...item,
            vatAmount: vat,
            total: ht + vat
          };
        }),
        ...totals,
        businessName: businessSettings?.businessName || "",
        businessDetails: businessSettings?.businessDetails || "",
        businessLogo: businessSettings?.businessLogo || "",
        dueDate: new Date(values.dueDate),
        updatedAt: serverTimestamp(),
      };

      // Data for API (clean JSON)
      const apiData = {
        ...values,
        clientName,
        items: values.items.map(item => {
          const quantity = Number(item.quantity) || 0;
          const unitPrice = Number(item.unitPrice) || 0;
          const vatRate = Number(item.vatRate) || 0;
          const ht = quantity * unitPrice;
          const vat = ht * (vatRate / 100);
          return {
            ...item,
            vatAmount: vat,
            total: ht + vat
          };
        }),
        ...totals,
        businessName: businessSettings?.businessName || "",
        businessDetails: businessSettings?.businessDetails || "",
        businessLogo: businessSettings?.businessLogo || "",
        dueDate: values.dueDate, // Keep as string for API
      };

      if (invoiceId) {
        const invoiceRef = doc(db, "invoices", invoiceId);
        await updateDoc(invoiceRef, firestoreData);
      } else {
        const docRef = await addDoc(collection(db, "invoices"), {
          ...firestoreData,
          status: "sent",
          paidAmount: 0,
          createdAt: serverTimestamp(),
        });
        invoiceId = docRef.id;
      }

      // Send Email with PDF (for both new and updated invoices)
      if (clientData?.email) {
        try {
          const response = await fetch(`/api/send-invoice`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoice: { id: invoiceId, ...apiData },
              clientEmail: clientData.email,
              appUrl: window.location.origin,
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Invoice Email API error:", response.status, errorData);
            setEmailError(`Failed to send email (Status ${response.status}). Check your RESEND_API_KEY.`);
            setIsSubmitting(false);
            return; 
          }
        } catch (emailErr) {
          console.error("Failed to send invoice email:", emailErr);
          setEmailError("Network error. Make sure the backend server is running.");
          setIsSubmitting(false);
          return;
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Header Section */}
        <div className="flex justify-between items-start border-b border-white/10 pb-8">
          <div className="space-y-4">
            <h1 className="text-6xl font-bold tracking-tighter text-cyan-400">Invoice</h1>
            <div className="space-y-1">
              <p className="text-xl font-bold text-white">{businessSettings?.businessName || "Your Company Name"}</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {businessSettings?.businessDetails || "77 Hammersmith Road, West Kensington\nLondon, W14 0QH\nPhone: 0208 668 381"}
              </p>
            </div>
          </div>
          <div className="h-32 w-32 rounded-full bg-orange-400 flex items-center justify-center text-white font-bold text-xl overflow-hidden">
            {businessSettings?.businessLogo ? (
              <img src={businessSettings.businessLogo} className="h-full w-full object-contain p-4" />
            ) : (
              "Logo"
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2">To</h3>
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
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
          </div>
          <div className="glass p-6 rounded-[2rem] border-white/5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="invoiceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Invoice Reference</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-white/5 border-white/10 h-8 text-sm" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Invoice Date</FormLabel>
                <Input value={format(new Date(), "dd.MM.yyyy")} disabled className="bg-white/5 border-white/10 h-8 text-sm" />
              </FormItem>
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="bg-white/5 border-white/10 h-8 text-sm" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="issuedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Issued By</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-white/5 border-white/10 h-8 text-sm" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Client Contact</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-white/5 border-white/10 h-8 text-sm" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg font-bold text-white">Additional information</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Add any additional instructions or terms here." 
                  {...field} 
                  className="bg-white/5 border-white/10 min-h-[80px] rounded-2xl" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <FormLabel>Services / Items</FormLabel>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="h-8 border-white/10 hover:bg-white/5"
              onClick={() => append({ description: "", quantity: 1, unit: "h", unitPrice: 0, vatRate: 20 })}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Service
            </Button>
          </div>
          
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                <div className="flex gap-2 items-start">
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Qty</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} className="bg-white/5 border-white/10 h-8" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`items.${index}.unit`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Unit</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="h, pcs..." className="bg-white/5 border-white/10 h-8" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`items.${index}.unitPrice`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Price</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} className="bg-white/5 border-white/10 h-8" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`items.${index}.vatRate`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">VAT%</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} className="bg-white/5 border-white/10 h-8" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

          <div className="flex justify-end pt-4 border-t border-white/5">
            <div className="space-y-1 text-right">
              <div className="flex justify-between gap-8 text-sm">
                <span className="text-muted-foreground">Total HT:</span>
                <span className="font-bold">${totals.totalHT.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between gap-8 text-sm">
                <span className="text-muted-foreground">Total TVA:</span>
                <span className="font-bold">${totals.totalVAT.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between gap-8 text-lg pt-2 border-t border-white/10">
                <span className="font-bold text-white">Total TTC:</span>
                <span className="font-bold text-emerald-400">${totals.totalTTC.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
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
