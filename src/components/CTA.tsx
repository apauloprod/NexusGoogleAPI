import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const CTA = () => {
  return (
    <section id="contact" className="py-32 px-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] bg-primary/20 blur-[150px] rounded-full -z-10" />
      
      <div className="max-w-4xl mx-auto text-center glass p-12 md:p-20 rounded-[4rem] border-white/10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl md:text-6xl font-bold tracking-tighter mb-8 leading-[0.9]"
        >
          Ready to unlock your <br />
          business's full potential?
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-lg md:text-xl text-muted-foreground mb-12 max-w-xl mx-auto"
        >
          Join the elite group of companies using Nexus to drive their 
          next phase of growth.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          <Button size="lg" className="bg-white text-black hover:bg-white/90 rounded-full px-10 h-16 text-xl font-bold group">
            Get Started Today
            <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
          </Button>
          <p className="mt-6 text-sm text-muted-foreground">
            No credit card required. Free consultation included.
          </p>
        </motion.div>
      </div>

      {/* Footer-ish info */}
      <div className="mt-32 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 text-sm text-muted-foreground max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-white flex items-center justify-center">
            <div className="h-3 w-3 bg-black rounded-[1px]" />
          </div>
          <span className="font-bold text-white">NEXUS</span>
        </div>
        <div className="flex gap-8">
          <a href="#" className="hover:text-white transition-colors">Twitter</a>
          <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
          <a href="#" className="hover:text-white transition-colors">GitHub</a>
        </div>
        <p>© 2026 Nexus Analytics Inc. All rights reserved.</p>
      </div>
    </section>
  );
};
