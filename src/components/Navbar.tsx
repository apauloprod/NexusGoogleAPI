import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const Navbar = () => {
  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md border-b border-white/5"
    >
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center">
          <div className="h-4 w-4 bg-black rounded-sm" />
        </div>
        <span className="text-xl font-bold tracking-tighter">NEXUS</span>
      </div>
      
      <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
        <a href="#solutions" className="hover:text-white transition-colors">Solutions</a>
        <a href="#analytics" className="hover:text-white transition-colors">Analytics</a>
        <a href="#proof" className="hover:text-white transition-colors">Proof</a>
        <a href="#contact" className="hover:text-white transition-colors">Contact</a>
      </div>

      <div className="flex items-center gap-4">
        <Link to="/dashboard">
          <Button variant="ghost" className="text-sm font-medium hover:bg-white/5">Log in</Button>
        </Link>
        <Link to="/dashboard">
          <Button className="bg-white text-black hover:bg-white/90 rounded-full px-6">Get Started</Button>
        </Link>
      </div>
    </motion.nav>
  );
};
