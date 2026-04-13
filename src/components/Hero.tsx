import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export const Hero = () => {
  return (
    <section className="relative pt-32 pb-20 px-6 flex flex-col items-center text-center overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-primary mb-8"
      >
        <Sparkles className="h-3 w-3" />
        <span>Trusted by 500+ forward-thinking companies</span>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-5xl md:text-8xl font-bold tracking-tighter leading-[0.9] mb-8 max-w-4xl text-gradient"
      >
        Scale your business with <br className="hidden md:block" />
        <span className="text-white">Data-Driven AI</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-12 leading-relaxed"
      >
        We help ambitious agencies and enterprises implement proven AI systems 
        and advanced analytics to unlock exponential growth.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <Link to="/dashboard">
          <Button size="lg" className="bg-white text-black hover:bg-white/90 rounded-full px-8 h-14 text-lg font-medium group">
            Start Scaling Now
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
        <Link to="/dashboard">
          <Button size="lg" variant="outline" className="rounded-full px-8 h-14 text-lg font-medium border-white/10 hover:bg-white/5">
            View Case Studies
          </Button>
        </Link>
      </motion.div>

      {/* Abstract Parallax Shapes */}
      <motion.div
        animate={{ 
          rotate: 360,
          y: [0, -20, 0]
        }}
        transition={{ 
          rotate: { duration: 20, repeat: Infinity, ease: "linear" },
          y: { duration: 5, repeat: Infinity, ease: "easeInOut" }
        }}
        className="absolute -bottom-20 -left-20 w-64 h-64 border border-white/5 rounded-full pointer-events-none"
      />
      <motion.div
        animate={{ 
          rotate: -360,
          y: [0, 20, 0]
        }}
        transition={{ 
          rotate: { duration: 25, repeat: Infinity, ease: "linear" },
          y: { duration: 6, repeat: Infinity, ease: "easeInOut" }
        }}
        className="absolute top-40 -right-20 w-96 h-96 border border-white/5 rounded-[40%] pointer-events-none"
      />
    </section>
  );
};
