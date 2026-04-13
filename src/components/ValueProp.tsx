import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Cpu, Zap, ShieldCheck } from "lucide-react";

const features = [
  {
    title: "Advanced Analytics",
    description: "Deep-dive into your data with custom-built models that reveal hidden opportunities for growth.",
    icon: BarChart3,
    color: "text-blue-400"
  },
  {
    title: "Proven AI Systems",
    description: "Implement battle-tested AI workflows that automate complex tasks and scale your operations.",
    icon: Cpu,
    color: "text-purple-400"
  },
  {
    title: "Data-Driven Strategy",
    description: "Stop guessing. Our strategies are backed by hard data and predictive modeling.",
    icon: Zap,
    color: "text-amber-400"
  },
  {
    title: "Enterprise Security",
    description: "Your data is your most valuable asset. We ensure it's protected with world-class security protocols.",
    icon: ShieldCheck,
    color: "text-emerald-400"
  }
];

export const ValueProp = () => {
  return (
    <section id="solutions" className="py-24 px-6 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tighter mb-4">
          Everything you need to <br className="hidden md:block" />
          dominate your market.
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          We combine cutting-edge technology with deep industry expertise to deliver 
          results that actually move the needle.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -5 }}
            className="group"
          >
            <Card className="h-full glass border-white/5 hover:border-white/20 transition-all duration-300">
              <CardHeader>
                <div className={`mb-4 p-3 rounded-xl bg-white/5 w-fit group-hover:scale-110 transition-transform duration-300 ${feature.color}`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl font-bold tracking-tight">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
