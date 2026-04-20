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
import { Plus, Trash2, Search } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../App";
import { ClientSearchSelect } from "../ClientSearchSelect";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddressAutocomplete } from "../AddressAutocomplete";
import { PhoneInput } from "../ui/PhoneInput";
import { validatePhoneNumber } from "../../lib/phone";

const requestSchema = z.object({
  clientId: z.string().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().refine(validatePhoneNumber, "Phone number must be 10 digits"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    price: z.coerce.number(),
  })).min(1, "Please add at least one service"),
  notes: z.string().optional(),
});

type RequestFormValues = z.infer<typeof requestSchema>;

interface RequestFormProps {
  initialData?: RequestFormValues & { id: string };
  onSuccess?: () => void;
  onCancel?: () => void;
  onConvertToQuote?: (request: any) => void;
}

export function RequestFormInternal({ initialData, onSuccess, onCancel, onConvertToQuote }: RequestFormProps) {
  const { currentUserData, impersonatedUser } = useContext(AuthContext);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientType, setClientType] = useState<"new" | "existing">(initialData?.clientId ? "existing" : "new");
  const [customTasks, setCustomTasks] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUserData?.businessId && !impersonatedUser?.businessId) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    const unsub = onSnapshot(query(collection(db, "customTasks"), where("businessId", "==", businessId)), (snap) => {
      setCustomTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [currentUserData?.businessId, impersonatedUser?.businessId]);

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema) as any,
    defaultValues: {
      clientId: initialData?.clientId || "",
      name: initialData?.name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      address: initialData?.address || "",
      city: initialData?.city || "",
      state: initialData?.state || "",
      zip: initialData?.zip || "",
      items: (initialData?.items as any[]) || [{ description: "", price: 0 }],
      notes: initialData?.notes || "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const selectedClientId = form.watch("clientId");

  useEffect(() => {
    if (selectedClientId && clientType === "existing") {
      const fetchClient = async () => {
        const clientDoc = await getDoc(doc(db, "clients", selectedClientId));
        if (clientDoc.exists()) {
          const data = clientDoc.data();
          form.setValue("name", data.name);
          form.setValue("email", data.email);
          form.setValue("phone", data.phone);
          form.setValue("address", data.address);
          form.setValue("city", data.city || "");
          form.setValue("state", data.state || "");
          form.setValue("zip", data.zip || "");
        }
      };
      fetchClient();
    }
  }, [selectedClientId, clientType, form]);

  async function onSubmit(values: RequestFormValues) {
    if (!currentUserData?.businessId && !impersonatedUser?.businessId) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    setIsSubmitting(true);
    try {
      let finalClientId = values.clientId;

      // If it's a new client or no clientId provided, create a new client
      if (clientType === "new" || !finalClientId) {
        const clientRef = await addDoc(collection(db, "clients"), {
          name: values.name,
          email: values.email,
          phone: values.phone,
          address: values.address,
          city: values.city || "",
          state: values.state || "",
          zip: values.zip || "",
          status: "potential", // New clients from requests are potential
          businessId,
          createdAt: serverTimestamp(),
        });
        finalClientId = clientRef.id;
      }

      const requestData = {
        ...values,
        clientId: finalClientId,
        businessId,
        updatedAt: serverTimestamp(),
      };

      if (initialData?.id) {
        const requestRef = doc(db, "requests", initialData.id);
        await updateDoc(requestRef, requestData);
      } else {
        await addDoc(collection(db, "requests"), {
          ...requestData,
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
        <div className="space-y-4">
          <Tabs value={clientType} onValueChange={(v) => setClientType(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-white/5">
              <TabsTrigger value="new">New Client</TabsTrigger>
              <TabsTrigger value="existing">Existing Client</TabsTrigger>
            </TabsList>
          </Tabs>

          {clientType === "existing" && (
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Client</FormLabel>
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
          )}
        </div>

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
                  <PhoneInput {...field} />
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
                <FormLabel>Street Address</FormLabel>
                <FormControl>
                  <AddressAutocomplete 
                    value={field.value} 
                    onChange={field.onChange}
                    onAddressSelect={(data) => {
                      if (data.street) form.setValue("address", data.street);
                      if (data.city) form.setValue("city", data.city);
                      if (data.state) form.setValue("state", data.state);
                      if (data.zip) form.setValue("zip", data.zip);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="City" {...field} className="bg-white/5 border-white/10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Input placeholder="State" {...field} className="bg-white/5 border-white/10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="zip"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zip Code</FormLabel>
                <FormControl>
                  <Input placeholder="Zip" {...field} className="bg-white/5 border-white/10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <FormLabel>Services Requested</FormLabel>
            <div className="flex gap-2">
              {customTasks.length > 0 && (
                <Select onValueChange={(val) => {
                  const task = customTasks.find(t => t.id === val);
                  if (task) append({ description: task.name, price: task.defaultPrice });
                }}>
                  <SelectTrigger className="h-8 w-[150px] bg-white/5 border-white/10 text-[10px] uppercase font-bold">
                    <SelectValue placeholder="Quick Add" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10 text-white">
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
                          <Input 
                            placeholder="Service description" 
                            {...field} 
                            className="bg-white/5 border-white/10" 
                          />
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
          <FormMessage>{form.formState.errors.items?.message}</FormMessage>
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

        <div className="flex justify-between items-center pt-4">
          <div>
            {initialData && onConvertToQuote && (
              <Button 
                type="button" 
                variant="outline" 
                className="border-white/10 hover:bg-white/5 text-blue-400"
                onClick={() => onConvertToQuote(initialData)}
              >
                Convert to Quote
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="bg-white text-black hover:bg-white/90" disabled={isSubmitting}>
              {isSubmitting ? (initialData?.id ? "Updating..." : "Creating...") : (initialData?.id ? "Update Request" : "Create Request")}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
