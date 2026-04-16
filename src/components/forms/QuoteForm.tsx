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
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, doc, updateDoc, getDoc, Timestamp, limit, where } from "firebase/firestore";
import { useState, useEffect } from "react";

import { ClientSearchSelect } from "../ClientSearchSelect";

const quoteSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  quoteNumber: z.string().min(1, "Quote number is required"),
  items: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    price: z.coerce.number().min(0, "Price must be positive"),
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

  const form = useForm({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      clientId: initialData?.clientId || "",
      quoteNumber: initialData?.quoteNumber || "",
      items: initialData?.items || [{ description: "", price: 0 }],
      notes: initialData?.notes || "",
      scheduledAt: initialData?.scheduledAt 
        ? (typeof initialData.scheduledAt === 'string' ? initialData.scheduledAt : initialData.scheduledAt.toDate().toISOString())
        : (initialData?.scheduledDate && initialData?.scheduledTime ? new Date(`${initialData.scheduledDate}T${initialData.scheduledTime}`).toISOString() : ""),
      duration: initialData?.duration || "1h",
    },
  });

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
  const total = watchItems?.reduce((sum, item) => sum + (Number(item.price) || 0), 0) || 0;

  const [businessSettings, setBusinessSettings] = useState<any>(null);

  useEffect(() => {
    const fetchBusinessSettings = async () => {
      // Find the admin user (apauloprod@gmail.com)
      // In a real app, we'd have a specific settings doc, but here we use the admin user doc
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
      
      const quoteData = {
        ...values,
        clientName,
        total,
        businessName: businessSettings?.businessName || "",
        businessDetails: businessSettings?.businessDetails || "",
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
            name="quoteNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quote Number</FormLabel>
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
            <FormLabel>Line Items</FormLabel>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="h-8 border-white/10 hover:bg-white/5"
              onClick={() => append({ description: "", price: 0 })}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Item
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
                          <Input placeholder="Description" {...field} className="bg-white/5 border-white/10" />
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
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-xl font-bold text-white">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
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
              {isSubmitting ? (initialData?.id ? "Updating..." : "Creating...") : (initialData?.id ? "Update Quote" : "Create Quote")}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
