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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, doc, updateDoc, getDoc } from "firebase/firestore";
import { useState, useEffect } from "react";

const visitSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  clientId: z.string().min(1, "Please select a client"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  scheduledAt: z.string().min(1, "Please select a date and time"),
  notes: z.string().optional(),
});

type VisitFormValues = z.infer<typeof visitSchema>;

interface VisitFormProps {
  initialData?: VisitFormValues & { id: string };
  onSuccess?: () => void;
  onCancel?: () => void;
}

import { ClientSearchSelect } from "../ClientSearchSelect";

export function VisitForm({ initialData, onSuccess, onCancel }: VisitFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // We still need to fetch clients if we want to auto-fill the address
    // but ClientSearchSelect handles its own fetching.
    // To auto-fill address, we can listen to clientId changes.
  }, []);

  const form = useForm<VisitFormValues>({
    resolver: zodResolver(visitSchema),
    defaultValues: initialData || {
      title: "",
      clientId: "",
      address: "",
      scheduledAt: "",
      notes: "",
    },
  });

  const selectedClientId = form.watch("clientId");

  useEffect(() => {
    if (selectedClientId) {
      const fetchClient = async () => {
        const clientDoc = await getDoc(doc(db, "clients", selectedClientId));
        if (clientDoc.exists()) {
          const data = clientDoc.data();
          if (data.address && !form.getValues("address")) {
            form.setValue("address", data.address);
          }
        }
      };
      fetchClient();
    }
  }, [selectedClientId, form]);

  async function onSubmit(values: VisitFormValues) {
    setIsSubmitting(true);
    try {
      const clientDoc = await getDoc(doc(db, "clients", values.clientId));
      const clientName = clientDoc.exists() ? clientDoc.data().name : "Unknown Client";

      if (initialData?.id) {
        const visitRef = doc(db, "visits", initialData.id);
        await updateDoc(visitRef, {
          ...values,
          clientName,
          scheduledAt: new Date(values.scheduledAt),
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "visits"), {
          ...values,
          clientName,
          status: "scheduled",
          scheduledAt: new Date(values.scheduledAt),
          createdAt: serverTimestamp(),
        });
      }
      form.reset();
      onSuccess?.();
    } catch (error) {
      handleFirestoreError(error, initialData?.id ? OperationType.UPDATE : OperationType.CREATE, "visits");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Visit Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. On-site Consultation" {...field} className="bg-white/5 border-white/10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location Address</FormLabel>
              <FormControl>
                <Input placeholder="123 Main St, City, State" {...field} className="bg-white/5 border-white/10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="scheduledAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Scheduled Date & Time</FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} className="bg-white/5 border-white/10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Any specific instructions for this visit..." 
                  {...field} 
                  className="bg-white/5 border-white/10 min-h-[100px]" 
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
            {isSubmitting ? (initialData?.id ? "Updating..." : "Scheduling...") : (initialData?.id ? "Update Visit" : "Schedule Visit")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
