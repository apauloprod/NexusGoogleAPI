import { motion } from "motion/react";

export const Background = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-background">
      {/* Animated Gradients */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 50, 0],
          y: [0, 30, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute -top-[10%] -left-[10%] h-[60%] w-[60%] rounded-full bg-primary/20 blur-[120px]"
      />
      <motion.div
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.4, 0.2],
          x: [0, -50, 0],
          y: [0, -30, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute top-[20%] -right-[10%] h-[50%] w-[50%] rounded-full bg-blue-500/10 blur-[100px]"
      />
      
      {/* Grid Shimmer */}
      <div className="absolute inset-0 grid-background shimmer-grid opacity-20" />
      
      {/* Particle Drift (Simplified with CSS/Motion) */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * 100 + "%", 
              y: Math.random() * 100 + "%",
              opacity: Math.random() * 0.5
            }}
            animate={{
              y: ["-10%", "110%"],
              opacity: [0, 0.5, 0]
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              ease: "linear",
              delay: Math.random() * 10
            }}
            className="absolute h-1 w-1 rounded-full bg-white"
          />
        ))}
      </div>

      {/* Beam Texture */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 h-full w-[1px] bg-gradient-to-b from-transparent via-white/20 to-transparent animate-[beam_8s_infinite]" />
        <div className="absolute top-0 left-2/4 h-full w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent animate-[beam_12s_infinite_2s]" />
        <div className="absolute top-0 left-3/4 h-full w-[1px] bg-gradient-to-b from-transparent via-white/20 to-transparent animate-[beam_10s_infinite_4s]" />
      </div>
    </div>
  );
};
