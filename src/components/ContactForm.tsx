import React, { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Check, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const ContactForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    interested_in: "",
    notes: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.error("Please provide at least a name and email.");
      return;
    }

    setIsSubmitting(true);
    try {
      // The server webhook already handles request creation and email notification
      const response = await fetch('/api/webhook/leads/nexus-crm-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.name,
          email: formData.email,
          phone: formData.phone,
          interested_in: formData.interested_in,
          notes: formData.notes,
          _direct_email: "apauloprod@gmail.com" // Special flag for our server logic
        })
      });

      if (!response.ok) throw new Error("Webhook failed");

      setIsSuccess(true);
      toast.success("Thank you! We'll be in touch shortly.");
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass p-12 rounded-[3rem] border-white/10 text-center max-w-xl mx-auto"
      >
        <div className="h-20 w-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6 text-emerald-500">
          <Check className="h-10 w-10" />
        </div>
        <h3 className="text-3xl font-bold mb-4 tracking-tighter">Inquiry Received</h3>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Thank you for reaching out. A specialist from Nexus CRM will review your inquiry 
          and get back to you within 24 hours.
        </p>
        <Button 
          variant="outline" 
          className="rounded-full px-8 h-12 border-white/10"
          onClick={() => setIsSuccess(false)}
        >
          Send Another Inquiry
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="glass p-8 md:p-12 rounded-[3rem] border-white/10 max-w-2xl mx-auto relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-10">
        <Sparkles className="h-24 w-24" />
      </div>
      
      <div className="relative z-10">
        <h2 className="text-3xl font-bold tracking-tighter mb-2">Get Started Today</h2>
        <p className="text-muted-foreground mb-8">Fill out the form below and we'll reach out to start your scaling journey.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Full Name</label>
              <Input 
                required
                placeholder="John Doe"
                className="h-12 bg-white/5 border-white/10 rounded-2xl px-6 focus:bg-white/10 transition-colors"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Email address</label>
              <Input 
                required
                type="email"
                placeholder="john@example.com"
                className="h-12 bg-white/5 border-white/10 rounded-2xl px-6 focus:bg-white/10 transition-colors"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Phone (Optional)</label>
              <Input 
                placeholder="+1 (555) 000-0000"
                className="h-12 bg-white/5 border-white/10 rounded-2xl px-6 focus:bg-white/10 transition-colors"
                value={formData.phone}
                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Interested In</label>
              <Input 
                placeholder="Nexus for Agency"
                className="h-12 bg-white/5 border-white/10 rounded-2xl px-6 focus:bg-white/10 transition-colors"
                value={formData.interested_in}
                onChange={e => setFormData(prev => ({ ...prev, interested_in: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Notes / Message</label>
            <Textarea 
              placeholder="Tell us about your business goals..."
              className="min-h-[120px] bg-white/5 border-white/10 rounded-[2rem] px-6 py-4 focus:bg-white/10 transition-colors"
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          
          <Button 
            type="submit"
            disabled={isSubmitting}
            className="w-full h-14 rounded-full bg-white text-black hover:bg-white/90 text-lg font-bold group mt-4 shadow-xl"
          >
            {isSubmitting ? "Submitting..." : "Send Inquiry"}
            <Send className="ml-2 h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </Button>
        </form>
      </div>
    </div>
  );
};
