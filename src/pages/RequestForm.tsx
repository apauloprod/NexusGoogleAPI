import { useState } from "react";
import { motion } from "motion/react";
import { useForm } from "react-hook-form";
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
  CheckCircle2
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
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function RequestForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      services: [] as string[],
      availability: "",
      notes: "",
    }
  });

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const path = 'requests';
      await addDoc(collection(db, path), {
        ...data,
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
            Request a Quote
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Tell us about your project and we'll provide a custom data-driven 
            solution tailored to your business needs.
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
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="+1 (555) 000-0000" className="pl-10 bg-white/5 border-white/10 rounded-xl h-12" {...field} />
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
                      <FormLabel className="text-white">Business Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="123 Business St, City" className="pl-10 bg-white/5 border-white/10 rounded-xl h-12" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <Label className="text-white">Services Required</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {["Data Strategy", "AI Implementation", "Advanced Analytics", "Custom Dashboards"].map((service) => (
                    <div 
                      key={service} 
                      className="flex items-center space-x-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-colors cursor-pointer"
                      onClick={() => toggleService(service)}
                    >
                      <Checkbox 
                        id={service} 
                        checked={form.watch("services").includes(service)}
                        onCheckedChange={() => toggleService(service)}
                      />
                      <label htmlFor={service} className="text-sm font-medium leading-none cursor-pointer">
                        {service}
                      </label>
                    </div>
                  ))}
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
