import { motion } from "motion/react";
import { ContactForm } from "./ContactForm";

export const CTA = () => {
  return (
    <section id="contact" className="py-32 px-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] bg-primary/20 blur-[150px] rounded-full -z-10" />
      
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 leading-[0.9]"
          >
            Experience the <br className="hidden md:block" />
            <span className="text-white">Nexus Advantage</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-xl mx-auto"
          >
            Ready to streamline your business? Send us an inquiry below and 
            we'll help you unlock exponential growth.
          </motion.p>
        </div>

        <ContactForm />
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
