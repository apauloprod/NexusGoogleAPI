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
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from "firebase/firestore";
import { useState, useEffect } from "react";

const jobSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  clientId: z.string().min(1, "Please select a client"),
  status: z.string().min(1, "Please select a status"),
  notes: z.string().optional(),
});

type JobFormValues = z.infer<typeof jobSchema>;

interface JobFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function JobForm({ onSuccess, onCancel }: JobFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    async function fetchClients() {
      try {
        const q = query(collection(db, "clients"), orderBy("name", "asc"));
        const snapshot = await getDocs(q);
        setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching clients:", error);
      }
    }
    fetchClients();
  }, []);

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: "",
      clientId: "",
      status: "active",
      notes: "",
    },
  });

  async function onSubmit(values: JobFormValues) {
    setIsSubmitting(true);
    try {
      const selectedClient = clients.find(c => c.id === values.clientId);
      await addDoc(collection(db, "jobs"), {
        ...values,
        clientName: selectedClient?.name || "Unknown Client",
        notesCount: values.notes ? 1 : 0,
        photosCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      form.reset();
      onSuccess?.();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "jobs");
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
              <FormLabel>Job Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Q4 Data Migration" {...field} className="bg-white/5 border-white/10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-black border-white/10">
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Initial Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-black border-white/10">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
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
              <FormLabel>Initial Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Scope of work, requirements, etc..." 
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
            {isSubmitting ? "Creating..." : "Create Job"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
