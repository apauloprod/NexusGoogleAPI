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
import { Checkbox } from "@/components/ui/checkbox";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { useState } from "react";

const requestSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  services: z.array(z.string()).min(1, "Please select at least one service"),
  notes: z.string().optional(),
});

type RequestFormValues = z.infer<typeof requestSchema>;

interface RequestFormProps {
  initialData?: RequestFormValues & { id: string };
  onSuccess?: () => void;
  onCancel?: () => void;
}

const AVAILABLE_SERVICES = ["Data Strategy", "AI Implementation", "Advanced Analytics", "Custom Dashboards"];

export function RequestFormInternal({ initialData, onSuccess, onCancel }: RequestFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: initialData || {
      name: "",
      email: "",
      phone: "",
      address: "",
      services: [],
      notes: "",
    },
  });

  async function onSubmit(values: RequestFormValues) {
    setIsSubmitting(true);
    try {
      if (initialData?.id) {
        const requestRef = doc(db, "requests", initialData.id);
        await updateDoc(requestRef, {
          ...values,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "requests"), {
          ...values,
          status: "pending",
          createdAt: serverTimestamp(),
        });
      }
      form.reset();
      onSuccess?.();
    } catch (error) {
      handleFirestoreError(error, initialData?.id ? OperationType.UPDATE : OperationType.CREATE, "requests");
    } finally {
      setIsSubmitting(false);
    }
  }

  const toggleService = (service: string) => {
    const current = form.getValues("services");
    if (current.includes(service)) {
      form.setValue("services", current.filter(s => s !== service));
    } else {
      form.setValue("services", [...current, service]);
    }
    form.trigger("services");
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} className="bg-white/5 border-white/10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="john@example.com" {...field} className="bg-white/5 border-white/10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="+1 (555) 000-0000" {...field} className="bg-white/5 border-white/10" />
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
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input placeholder="123 Main St, City, State" {...field} className="bg-white/5 border-white/10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2">
          <FormLabel>Services Requested</FormLabel>
          <div className="grid grid-cols-2 gap-2">
            {AVAILABLE_SERVICES.map((service) => (
              <div 
                key={service} 
                className="flex items-center space-x-2 p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 cursor-pointer"
                onClick={() => toggleService(service)}
              >
                <Checkbox 
                  checked={form.watch("services").includes(service)}
                  onCheckedChange={() => toggleService(service)}
                />
                <span className="text-sm">{service}</span>
              </div>
            ))}
          </div>
          <FormMessage>{form.formState.errors.services?.message}</FormMessage>
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Details</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Notes about the request..." 
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
            {isSubmitting ? (initialData?.id ? "Updating..." : "Creating...") : (initialData?.id ? "Update Request" : "Create Request")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
