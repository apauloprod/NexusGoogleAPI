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
import { Plus, Trash2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, doc, updateDoc, getDoc, limit, where, onSnapshot, Timestamp } from "firebase/firestore";
import { useState, useEffect, useMemo, useContext } from "react";
import { format } from "date-fns";
import { AuthContext } from "../../App";

import { ClientSearchSelect } from "../ClientSearchSelect";

const invoiceSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
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
  const { user, currentUserData, impersonatedUser } = useContext(AuthContext);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [customTasks, setCustomTasks] = useState<any[]>([]);
  const [businessSettings, setBusinessSettings] = useState<any>(null);

  useEffect(() => {
    if (!currentUserData?.businessId && !impersonatedUser?.businessId) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;
    const unsub = onSnapshot(query(collection(db, "customTasks"), where("businessId", "==", businessId)), (snap) => {
      setCustomTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [currentUserData?.businessId, impersonatedUser?.businessId]);

  useEffect(() => {
    const fetchBusinessSettings = async () => {
      if (!currentUserData?.businessId && !impersonatedUser?.businessId) return;
      const businessId = impersonatedUser?.businessId || currentUserData.businessId;
      const snap = await getDoc(doc(db, "users", businessId));
      if (snap.exists()) {
        setBusinessSettings(snap.data());
      }
    };
    fetchBusinessSettings();
  }, [currentUserData?.businessId, impersonatedUser?.businessId]);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: {
      clientId: initialData?.clientId || "",
      invoiceNumber: initialData?.invoiceNumber || "",
      items: initialData?.items ? initialData.items.map((i: any) => ({
        description: i.description || "",
        price: i.price || i.unitPrice || 0
      })) : [{ description: "", price: 0 }],
      dueDate: initialData?.dueDate ? (typeof initialData.dueDate.toDate === 'function' ? initialData.dueDate.toDate().toISOString().split('T')[0] : initialData.dueDate.split('T')[0]) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: initialData?.notes || "",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        clientId: initialData.clientId || "",
        invoiceNumber: initialData.invoiceNumber || "",
        items: initialData.items ? initialData.items.map((i: any) => ({
          description: i.description || "",
          price: i.price || i.unitPrice || 0
        })) : [{ description: "", price: 0 }],
        dueDate: initialData.dueDate ? (typeof initialData.dueDate.toDate === 'function' ? initialData.dueDate.toDate().toISOString().split('T')[0] : initialData.dueDate.split('T')[0]) : new Date().toISOString().split('T')[0],
        notes: initialData.notes || "",
      });
    }
  }, [initialData]);

  useEffect(() => {
    if (!initialData?.id && !form.getValues("invoiceNumber") && (currentUserData?.businessId || impersonatedUser?.businessId)) {
      const fetchLatestInvoiceNumber = async () => {
        try {
          const businessId = impersonatedUser?.businessId || currentUserData.businessId;
          const q = query(
            collection(db, "invoices"), 
            where("businessId", "==", businessId),
            orderBy("invoiceNumber", "desc"), 
            limit(1)
          );
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
  }, [initialData, currentUserData?.businessId]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch("items");
  const total = useMemo(() => {
    return (watchItems || []).reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  }, [watchItems]);

  async function onSubmit(values: InvoiceFormValues) {
    if (!currentUserData?.businessId && !impersonatedUser?.businessId) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    setIsSubmitting(true);
    try {
      const clientDoc = await getDoc(doc(db, "clients", values.clientId));
      const clientName = clientDoc.exists() ? clientDoc.data().name : "Unknown Client";
      const clientEmail = clientDoc.exists() ? clientDoc.data().email : null;
      let invoiceId = initialData?.id;
      
      const invoiceData = {
        ...values,
        businessId,
        clientName,
        total,
        businessName: businessSettings?.businessName || "",
        businessLogo: businessSettings?.businessLogo || "",
        dueDate: Timestamp.fromDate(new Date(values.dueDate)),
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
      }

      // Send Email with PDF
      if (clientEmail) {
        try {
          await fetch(`/api/send-invoice`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoice: { id: invoiceId, ...invoiceData, dueDate: values.dueDate },
              clientEmail: clientEmail,
              appUrl: window.location.origin,
            }),
          });
        } catch (emailErr) {
          console.error("Failed to send invoice email:", emailErr);
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
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client</FormLabel>
                <FormControl>
                  <ClientSearchSelect 
                    onValueChange={field.onChange}
                    value={field.value}
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
                  <Input {...field} readOnly className="bg-white/5 border-white/10" />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <FormLabel>Services / Items</FormLabel>
            <div className="flex gap-2">
              {customTasks.length > 0 && (
                <Select onValueChange={(val) => {
                  const task = customTasks.find(t => t.id === val);
                  if (task) append({ description: task.name, price: task.defaultPrice });
                }}>
                  <SelectTrigger className="h-8 w-[150px] bg-white/5 border-white/10 text-[10px] uppercase font-bold">
                    <SelectValue placeholder="Quick Add" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10">
                    {customTasks.map(task => (
                      <SelectItem key={task.id} value={task.id}>{task.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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

          <div className="flex justify-end pt-2 border-t border-white/5">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Invoice Amount</p>
              <p className="text-xl font-bold text-emerald-400">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
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
              <FormLabel>Additional Notes</FormLabel>
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

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" className="bg-white text-black hover:bg-white/90" disabled={isSubmitting}>
            {isSubmitting ? "Processing..." : (initialData?.id ? "Update Invoice" : "Create Invoice")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
