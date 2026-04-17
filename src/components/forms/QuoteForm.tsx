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
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, doc, updateDoc, getDoc, Timestamp, limit, where, onSnapshot } from "firebase/firestore";
import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";

import { ClientSearchSelect } from "../ClientSearchSelect";

const quoteSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  quoteNumber: z.string().min(1, "Quote number is required"),
  validUntil: z.string().optional(),
  issuedBy: z.string().optional(),
  clientContact: z.string().optional(),
  workStartDate: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.coerce.number().min(1, "Qty must be at least 1"),
    unit: z.string().default("h"),
    unitPrice: z.coerce.number().min(0, "Price must be positive"),
    vatRate: z.coerce.number().min(0).default(20),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
  // Scheduling fields
  scheduledAt: z.string().optional(),
  duration: z.string().optional(),
});

type QuoteFormValues = z.infer<typeof quoteSchema>;

interface QuoteFormProps {
  initialData?: any;
  onSuccess?: () => void;
  onCancel?: () => void;
}

import { SchedulePicker } from "../SchedulePicker";



export function QuoteForm({ initialData, onSuccess, onCancel }: QuoteFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [customTasks, setCustomTasks] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "customTasks"), (snap) => {
      setCustomTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const form = useForm({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      clientId: initialData?.clientId || "",
      quoteNumber: initialData?.quoteNumber || "",
      validUntil: initialData?.validUntil || "",
      issuedBy: initialData?.issuedBy || "",
      clientContact: initialData?.clientContact || "",
      workStartDate: initialData?.workStartDate || "",
      items: initialData?.items || [{ description: "", quantity: 1, unit: "h", unitPrice: 0, vatRate: 20 }],
      notes: initialData?.notes || "",
      scheduledAt: initialData?.scheduledAt 
        ? (typeof initialData.scheduledAt === 'string' ? initialData.scheduledAt : initialData.scheduledAt.toDate().toISOString())
        : (initialData?.scheduledDate && initialData?.scheduledTime ? new Date(`${initialData.scheduledDate}T${initialData.scheduledTime}`).toISOString() : ""),
      duration: initialData?.duration || "1h",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        clientId: initialData.clientId || "",
        quoteNumber: initialData.quoteNumber || "",
        validUntil: initialData.validUntil || "",
        issuedBy: initialData.issuedBy || "",
        clientContact: initialData.clientContact || "",
        workStartDate: initialData.workStartDate || "",
        items: initialData.items || [{ description: "", quantity: 1, unit: "h", unitPrice: 0, vatRate: 20 }],
        notes: initialData.notes || "",
        scheduledAt: initialData.scheduledAt 
          ? (typeof initialData.scheduledAt === 'string' ? initialData.scheduledAt : initialData.scheduledAt.toDate().toISOString())
          : (initialData.scheduledDate && initialData.scheduledTime ? new Date(`${initialData.scheduledDate}T${initialData.scheduledTime}`).toISOString() : ""),
        duration: initialData.duration || "1h",
      });
    }
  }, [initialData, form]);

  useEffect(() => {
    if (!initialData?.id && !form.getValues("quoteNumber")) {
      const fetchLatestQuoteNumber = async () => {
        try {
          const q = query(collection(db, "quotes"), orderBy("quoteNumber", "desc"), limit(1));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const latestQuote = snapshot.docs[0].data();
            const latestStr = latestQuote.quoteNumber || "";
            const match = latestStr.match(/\d+/);
            const latestNumber = match ? parseInt(match[0]) : 0;
            const nextNumber = `Q-${(latestNumber + 1).toString().padStart(4, '0')}`;
            form.setValue("quoteNumber", nextNumber);
          } else {
            form.setValue("quoteNumber", "Q-0001");
          }
        } catch (error) {
          console.error("Error fetching latest quote number:", error);
          form.setValue("quoteNumber", "Q-0001");
        }
      };
      fetchLatestQuoteNumber();
    }
  }, [initialData, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

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
      // Find the admin user (apauloprod@gmail.com which is the owner)
      const q = query(collection(db, "users"), where("role", "==", "admin"), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setBusinessSettings(snap.docs[0].data());
      }
    };
    fetchBusinessSettings();
  }, []);

  async function onSubmit(values: QuoteFormValues) {
    setIsSubmitting(true);
    try {
      const clientDoc = await getDoc(doc(db, "clients", values.clientId));
      const clientName = clientDoc.exists() ? clientDoc.data().name : "Unknown Client";
      let quoteId = initialData?.id;
      
      const fullBusinessDetails = businessSettings?.address 
        ? `${businessSettings.address.street}\n${businessSettings.address.city}${businessSettings.address.postcode ? `, ${businessSettings.address.postcode}` : ""}\n${businessSettings.address.country}${businessSettings.businessDetails ? `\n\n${businessSettings.businessDetails}` : ""}`
        : (businessSettings?.businessDetails || "");

      const quoteData = {
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
        businessDetails: fullBusinessDetails,
        businessLogo: businessSettings?.businessLogo || "",
        updatedAt: serverTimestamp(),
      };

      if (quoteId) {
        const quoteRef = doc(db, "quotes", quoteId);
        await updateDoc(quoteRef, quoteData);
      } else {
        const docRef = await addDoc(collection(db, "quotes"), {
          ...quoteData,
          status: "sent",
          createdAt: serverTimestamp(),
        });
        quoteId = docRef.id;
      }

      // Send Email with PDF (for both new and updated quotes)
      const clientData = clientDoc.exists() ? clientDoc.data() : null;
      if (clientData?.email) {
        try {
          const response = await fetch(`/api/send-quote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quote: { id: quoteId, ...quoteData },
              clientEmail: clientData.email,
              appUrl: window.location.origin,
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Email API error:", response.status, errorData);
            setEmailError(`Failed to send email (Status ${response.status}). Check your RESEND_API_KEY.`);
            setIsSubmitting(false);
            return;
          } else {
            console.log("Quote email sent successfully");
          }
        } catch (emailErr) {
          console.error("Failed to send quote email:", emailErr);
          setEmailError("Network error. Make sure the backend server is running.");
          setIsSubmitting(false);
          return;
        }
      }

      // Handle scheduling
      if (values.scheduledAt) {
        const scheduledDate = new Date(values.scheduledAt);
        // Create or update associated visit
        await addDoc(collection(db, "visits"), {
          clientId: values.clientId,
          clientName,
          title: `Quote ${values.quoteNumber} Visit`,
          scheduledAt: Timestamp.fromDate(scheduledDate),
          duration: values.duration || "1h",
          status: "pending", // Always pending when created from quote
          quoteId: quoteId,
          createdAt: serverTimestamp(),
        });
      }

      form.reset();
      onSuccess?.();
    } catch (error) {
      handleFirestoreError(error, initialData?.id ? OperationType.UPDATE : OperationType.CREATE, "quotes");
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
            <h1 className="text-6xl font-bold tracking-tighter text-cyan-400">Quote</h1>
            <div className="space-y-1">
              <p className="text-xl font-bold text-white">{businessSettings?.businessName || "Your Company Name"}</p>
              <div className="text-sm text-muted-foreground whitespace-pre-line">
                {businessSettings?.address ? (
                  <>
                    <p>{businessSettings.address.street}</p>
                    <p>{businessSettings.address.city}{businessSettings.address.postcode ? `, ${businessSettings.address.postcode}` : ""}</p>
                    <p>{businessSettings.address.country}</p>
                  </>
                ) : (
                  <p>{businessSettings?.businessDetails || "77 Hammersmith Road, West Kensington\nLondon, W14 0QH"}</p>
                )}
                {businessSettings?.address && businessSettings?.businessDetails && (
                  <p className="mt-2 pt-2 border-t border-white/5">{businessSettings.businessDetails}</p>
                )}
              </div>
            </div>
          </div>
          <div className="h-32 w-32 rounded-full bg-orange-400 flex items-center justify-center text-white font-bold text-xl overflow-hidden">
            {businessSettings?.businessLogo ? (
              <img src={businessSettings.businessLogo} className="h-full w-full object-contain p-4" referrerPolicy="no-referrer" />
            ) : (
              "Logo"
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg font-bold text-white">To</FormLabel>
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
          </div>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="quoteNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Quote Reference</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly className="bg-white/5 border-white/10 h-10 rounded-xl" />
                  </FormControl>
                </FormItem>
              )}
            />
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
            <FormLabel>Line Items</FormLabel>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="h-8 border-white/10 hover:bg-white/5"
              onClick={() => append({ description: "", quantity: 1, unit: "h", unitPrice: 0, vatRate: 20 })}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Item
            </Button>
          </div>
          
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="p-6 rounded-[1.5rem] bg-white/5 border border-white/5 space-y-4 group hover:border-white/10 transition-colors">
                <div className="flex flex-col md:flex-row gap-4 items-start w-full">
                  <div className="flex-[2] space-y-2 w-full">
                    {customTasks.length > 0 && (
                      <Select onValueChange={(v) => {
                        const task = customTasks.find(t => t.id === v);
                        if (task) {
                          form.setValue(`items.${index}.description`, task.name);
                          form.setValue(`items.${index}.unitPrice`, task.defaultPrice);
                        }
                      }}>
                        <SelectTrigger className="bg-white/5 border-white/10 h-8 text-[10px] uppercase">
                          <SelectValue placeholder="Quick Add Task" />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-white/10">
                          {customTasks.map(task => (
                            <SelectItem key={task.id} value={task.id}>{task.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Description</FormLabel>
                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input placeholder="Service or product description..." {...field} className="bg-white/5 border-white/10 h-10 rounded-xl" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex gap-4 w-full md:w-auto items-end">
                    <div className="flex-1 md:w-32">
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Price</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input type="number" {...field} className="bg-white/5 border-white/10 h-10 rounded-xl pl-6" />
                                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20 text-[10px] font-bold">$</div>
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="w-20">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Qty</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} className="bg-white/5 border-white/10 h-10 rounded-xl text-center" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    {fields.length > 1 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-white/5">
            <div className="space-y-1 text-right">
              <div className="flex justify-between gap-8 text-2xl pt-2">
                <span className="font-bold text-white tracking-tighter">Total</span>
                <span className="font-black text-emerald-400 tracking-tighter">${totals.totalHT.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Terms, conditions, or extra info..." 
                  {...field} 
                  className="bg-white/5 border-white/10 min-h-[80px]" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3 pt-2 border-t border-white/5">
          <FormLabel className="text-white/50 text-xs uppercase font-bold tracking-wider">Scheduling (Optional)</FormLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="scheduledAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date & Time</FormLabel>
                  <FormControl>
                    <SchedulePicker 
                      value={field.value} 
                      onChange={field.onChange} 
                      placeholder="Select a time slot..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-black border-white/10">
                      <SelectItem value="30m">30 mins</SelectItem>
                      <SelectItem value="1h">1 hour</SelectItem>
                      <SelectItem value="2h">2 hours</SelectItem>
                      <SelectItem value="4h">4 hours</SelectItem>
                      <SelectItem value="8h">Full day</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-8 pb-12">
          {emailError && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium text-center">
              {emailError}
            </div>
          )}
          <div className="flex justify-end gap-4">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onCancel} 
              disabled={isSubmitting}
              className="h-12 px-8 rounded-xl hover:bg-white/5 font-bold"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-white text-black hover:bg-white/90 h-12 px-12 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-white/10" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (initialData?.id ? "Updating..." : "Creating...") : (initialData?.id ? "Create Quote" : "Create Quote")}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
