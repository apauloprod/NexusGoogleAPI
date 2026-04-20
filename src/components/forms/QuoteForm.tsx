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
import { useState, useEffect, useMemo, useContext } from "react";
import { format } from "date-fns";
import { AuthContext } from "../../App";

import { ClientSearchSelect } from "../ClientSearchSelect";

const quoteSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  quoteNumber: z.string().min(1, "Quote number is required"),
  items: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    price: z.coerce.number().min(0, "Price must be positive"),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
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

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema) as any,
    defaultValues: {
      clientId: initialData?.clientId || "",
      quoteNumber: initialData?.quoteNumber || "",
      items: initialData?.items ? initialData.items.map((i: any) => ({
        description: i.description || "",
        price: i.price || i.unitPrice || 0
      })) : [{ description: "", price: 0 }],
      notes: initialData?.notes || "",
      scheduledAt: initialData?.scheduledAt 
        ? (typeof initialData.scheduledAt === 'string' ? initialData.scheduledAt : initialData.scheduledAt.toDate().toISOString())
        : "",
      duration: initialData?.duration || "1h",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        clientId: initialData.clientId || "",
        quoteNumber: initialData.quoteNumber || "",
        items: initialData.items ? initialData.items.map((i: any) => ({
          description: i.description || "",
          price: i.price || i.unitPrice || 0
        })) : [{ description: "", price: 0 }],
        notes: initialData.notes || "",
        scheduledAt: initialData.scheduledAt 
          ? (typeof initialData.scheduledAt === 'string' ? initialData.scheduledAt : initialData.scheduledAt.toDate().toISOString())
          : "",
        duration: initialData.duration || "1h",
      });
    }
  }, [initialData]);

  useEffect(() => {
    if (!initialData?.id && !form.getValues("quoteNumber") && (currentUserData?.businessId || impersonatedUser?.businessId)) {
      const fetchLatestQuoteNumber = async () => {
        try {
          const businessId = impersonatedUser?.businessId || currentUserData.businessId;
          const q = query(
            collection(db, "quotes"), 
            where("businessId", "==", businessId),
            orderBy("quoteNumber", "desc"), 
            limit(1)
          );
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
  }, [initialData, currentUserData?.businessId]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch("items");
  const total = useMemo(() => {
    return (watchItems || []).reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  }, [watchItems]);

  async function onSubmit(values: QuoteFormValues) {
    if (!currentUserData?.businessId && !impersonatedUser?.businessId) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    setIsSubmitting(true);
    try {
      const clientDoc = await getDoc(doc(db, "clients", values.clientId));
      const clientName = clientDoc.exists() ? clientDoc.data().name : "Unknown Client";
      const clientEmail = clientDoc.exists() ? clientDoc.data().email : null;
      let quoteId = initialData?.id;
      
      const quoteData = {
        ...values,
        businessId,
        clientName,
        total,
        businessName: businessSettings?.businessName || "",
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

      // Send Email with PDF
      if (clientEmail) {
        try {
          await fetch(`/api/send-quote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quote: { id: quoteId, ...quoteData },
              clientEmail: clientEmail,
              appUrl: window.location.origin,
            }),
          });
        } catch (emailErr) {
          console.error("Failed to send quote email:", emailErr);
        }
      }

      // Handle scheduling
      if (values.scheduledAt) {
        const scheduledDate = new Date(values.scheduledAt);
        await addDoc(collection(db, "visits"), {
          clientId: values.clientId,
          clientName,
          businessId,
          title: `Quote ${values.quoteNumber} Visit`,
          scheduledAt: Timestamp.fromDate(scheduledDate),
          duration: values.duration || "1h",
          status: "pending",
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
            name="quoteNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quote Number</FormLabel>
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
              <p className="text-sm text-muted-foreground">Total Quote Amount</p>
              <p className="text-xl font-bold text-emerald-400">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="scheduledAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Scheduled Date & Time (Optional)</FormLabel>
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

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Notes</FormLabel>
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

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" className="bg-white text-black hover:bg-white/90" disabled={isSubmitting}>
            {isSubmitting ? "Processing..." : (initialData?.id ? "Update Quote" : "Create Quote")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
