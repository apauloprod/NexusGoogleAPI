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
import { db, handleFirestoreError, OperationType, auth } from "../../firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, doc, updateDoc, getDoc, Timestamp } from "firebase/firestore";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

import { ClientSearchSelect } from "../ClientSearchSelect";

const jobSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  clientId: z.string().min(1, "Please select a client"),
  status: z.string().min(1, "Please select a status"),
  items: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    price: z.coerce.number().min(0, "Price must be positive"),
  })),
  notes: z.string().optional(),
  scheduledAt: z.string().optional(),
  duration: z.string().optional(),
  assignedTeam: z.array(z.string()).optional(),
});

type JobFormValues = z.infer<typeof jobSchema>;

interface JobFormProps {
  initialData?: any;
  onSuccess?: () => void;
  onCancel?: () => void;
}

import { SchedulePicker } from "../SchedulePicker";

export function JobForm({ initialData, onSuccess, onCancel }: JobFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableTeam, setAvailableTeam] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, "users"));
    getDocs(q).then(snap => {
      setAvailableTeam(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const form = useForm({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: initialData?.title || "",
      clientId: initialData?.clientId || "",
      status: initialData?.status || "active",
      items: initialData?.items || [{ description: "", price: 0 }],
      notes: initialData?.notes || "",
      scheduledAt: initialData?.scheduledAt 
        ? (typeof initialData.scheduledAt === 'string' ? initialData.scheduledAt : initialData.scheduledAt.toDate().toISOString())
        : "",
      duration: initialData?.duration || "1h",
      assignedTeam: initialData?.assignedTeam || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch("items");
  const total = watchItems?.reduce((sum, item) => sum + (Number(item.price) || 0), 0) || 0;

  async function onSubmit(values: JobFormValues) {
    setIsSubmitting(true);
    try {
      const clientDoc = await getDoc(doc(db, "clients", values.clientId));
      const clientName = clientDoc.exists() ? clientDoc.data().name : "Unknown Client";
      
      const jobData = {
        ...values,
        clientName,
        total,
        scheduledAt: values.scheduledAt ? Timestamp.fromDate(new Date(values.scheduledAt)) : null,
        updatedAt: serverTimestamp(),
      };

      if (initialData?.id) {
        const jobRef = doc(db, "jobs", initialData.id);
        await updateDoc(jobRef, jobData);
        
        // Log activity
        await addDoc(collection(db, "activities"), {
          description: `Updated job: ${values.title}`,
          userName: auth.currentUser?.displayName || "User",
          userId: auth.currentUser?.uid,
          createdAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "jobs"), {
          ...jobData,
          notesCount: values.notes ? 1 : 0,
          photosCount: 0,
          createdAt: serverTimestamp(),
        });

        // Log activity
        await addDoc(collection(db, "activities"), {
          description: `Created new job: ${values.title}`,
          userName: auth.currentUser?.displayName || "User",
          userId: auth.currentUser?.uid,
          createdAt: serverTimestamp()
        });

        // Update client status to active
        const clientRef = doc(db, "clients", values.clientId);
        await updateDoc(clientRef, {
          status: "active",
          updatedAt: serverTimestamp(),
        });
      }
      form.reset();
      onSuccess?.();
    } catch (error) {
      handleFirestoreError(error, initialData?.id ? OperationType.UPDATE : OperationType.CREATE, "jobs");
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
            name="scheduledAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Scheduled Date & Time</FormLabel>
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
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
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
                  placeholder="Scope of work, requirements, etc..." 
                  {...field} 
                  className="bg-white/5 border-white/10 min-h-[100px]" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3">
          <FormLabel>Assign Team Members</FormLabel>
          <div className="grid grid-cols-2 gap-2">
            {availableTeam.map((member) => (
              <Button
                key={member.id}
                type="button"
                variant="outline"
                className={cn(
                  "justify-start gap-2 h-10 border-white/10",
                  form.watch("assignedTeam")?.includes(member.id) 
                    ? "bg-blue-500/20 border-blue-500/50 text-blue-400" 
                    : "bg-white/5 hover:bg-white/10"
                )}
                onClick={() => {
                  const current = form.getValues("assignedTeam") || [];
                  if (current.includes(member.id)) {
                    form.setValue("assignedTeam", current.filter(id => id !== member.id));
                  } else {
                    form.setValue("assignedTeam", [...current, member.id]);
                  }
                }}
              >
                <div className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                  {member.photoURL ? <img src={member.photoURL} className="h-full w-full object-cover" /> : <Plus className="h-3 w-3" />}
                </div>
                <span className="text-xs truncate">{member.displayName || member.email}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" className="bg-white text-black hover:bg-white/90" disabled={isSubmitting}>
            {isSubmitting ? (initialData?.id ? "Updating..." : "Creating...") : (initialData?.id ? "Update Job" : "Create Job")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
