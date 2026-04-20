import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar as CalendarIcon, 
  Clock, 
  Wrench, 
  Upload,
  Send,
  CheckCircle2,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Background } from "../components/Background";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import { PhoneInput } from "../components/ui/PhoneInput";
import { validatePhoneNumber } from "../lib/phone";

import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const requestSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().refine(validatePhoneNumber, "Phone number must be at least 10 digits"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  services: z.array(z.string()),
  availability: z.string().optional(),
  notes: z.string().optional(),
});

type RequestFormValues = z.infer<typeof requestSchema>;

export default function RequestForm() {
  const [searchParams] = useSearchParams();
  const businessId = searchParams.get("biz");
  
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customTasks, setCustomTasks] = useState<any[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(!!businessId);

  useEffect(() => {
    if (!businessId) return;

    const fetchBusinessData = async () => {
      try {
        // Fetch business name
        const bizDoc = await getDoc(doc(db, "users", businessId));
        if (bizDoc.exists()) {
          setBusinessName(bizDoc.data().businessName || "Service Request");
        }

        // Fetch custom tasks
        const q = query(collection(db, "customTasks"), where("businessId", "==", businessId));
        const snap = await getDocs(q);
        setCustomTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching business data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBusinessData();
  }, [businessId]);

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      services: [],
      availability: "",
      notes: "",
    }
  });

  const onSubmit = async (data: RequestFormValues) => {
    if (!businessId) {
      alert("Invalid request link. businessId is missing.");
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "requests"), {
        ...data,
        businessId,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setIsSubmitted(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'requests');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleService = (service: string) => {
    const current = form.getValues("services");
    if (current.includes(service)) {
      form.setValue("services", current.filter(s => s !== service));
    } else {
      form.setValue("services", [...current, service]);
    }
  };

  if (!businessId && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Background />
        <div className="max-w-md w-full glass p-12 rounded-[3rem] border-white/10 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold tracking-tighter mb-4">Invalid Link</h2>
          <p className="text-muted-foreground mb-8">
            This request form link is invalid or incomplete.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Background />
        <div className="animate-spin h-8 w-8 border-2 border-white/20 border-t-white rounded-full" />
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Background />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full glass p-12 rounded-[3rem] border-white/10 text-center"
        >
          <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
            <CheckCircle2 className="h-10 w-10 text-black" />
          </div>
          <h2 className="text-4xl font-bold tracking-tighter mb-4">Request Sent!</h2>
          <p className="text-muted-foreground mb-8">
            Thank you for your interest. We've received your request and will get back to you with a quote shortly.
          </p>
          <Button 
            onClick={() => setIsSubmitted(false)}
            className="bg-white text-black hover:bg-white/90 rounded-full px-8"
          >
            Send Another Request
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-20 px-6 relative">
      <Background />
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 text-gradient">
            {businessName || "Request a Quote"}
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Tell us about your project and we'll provide a custom 
            solution tailored to your specific needs.
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="glass p-8 md:p-12 rounded-[3rem] border-white/10"
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Full Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="John Doe" className="pl-10 bg-white/5 border-white/10 rounded-xl h-12" {...field} />
                        </div>
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
                      <FormLabel className="text-white">Email Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="john@example.com" className="pl-10 bg-white/5 border-white/10 rounded-xl h-12" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Phone Number</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                          <PhoneInput 
                            {...field} 
                            className="pl-10 h-12 rounded-xl"
                          />
                        </div>
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
                      <FormLabel className="text-white">Street Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                          <AddressAutocomplete 
                            value={field.value} 
                            onChange={field.onChange}
                            onAddressSelect={(data) => {
                              if (data.street) form.setValue("address", data.street);
                              if (data.city) form.setValue("city", data.city);
                              if (data.state) form.setValue("state", data.state);
                              if (data.zip) form.setValue("zip", data.zip);
                            }}
                            placeholder="123 Business St"
                            className="pl-10 h-12 rounded-xl"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" className="bg-white/5 border-white/10 rounded-xl h-12" {...field} />
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
                      <FormLabel className="text-white">State</FormLabel>
                      <FormControl>
                        <Input placeholder="State" className="bg-white/5 border-white/10 rounded-xl h-12" {...field} />
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
                      <FormLabel className="text-white">Zip Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Zip" className="bg-white/5 border-white/10 rounded-xl h-12" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <Label className="text-white">Services Required</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {customTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 italic">No predefined services listed.</p>
                  ) : (
                    customTasks.map((task) => (
                      <div 
                        key={task.id} 
                        className="flex items-center space-x-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-colors cursor-pointer"
                        onClick={() => toggleService(task.name)}
                      >
                        <Checkbox 
                          id={task.id} 
                          checked={form.watch("services").includes(task.name)}
                          onCheckedChange={() => toggleService(task.name)}
                        />
                        <label htmlFor={task.id} className="text-sm font-medium leading-none cursor-pointer">
                          {task.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="availability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Availability for Consultation</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="e.g. Next Tuesday, 2pm" className="pl-10 bg-white/5 border-white/10 rounded-xl h-12" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <Label className="text-white">Upload Project Brief / Images</Label>
                  <div className="h-12 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center gap-2 text-muted-foreground hover:border-white/20 transition-colors cursor-pointer bg-white/5">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">Click to upload files</span>
                  </div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Tell us more about your specific challenges..." 
                        className="bg-white/5 border-white/10 rounded-xl min-h-[120px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-white text-black hover:bg-white/90 rounded-full h-14 text-lg font-bold group disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit Request"}
                {!isSubmitting && <Send className="ml-2 h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
              </Button>
            </form>
          </Form>
        </motion.div>
      </div>
    </div>
  );
}
