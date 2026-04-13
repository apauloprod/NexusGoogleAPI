import { motion } from "motion/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Quote } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Jenkins",
    role: "CEO at TechFlow",
    content: "Nexus transformed our data strategy. We saw a 40% increase in operational efficiency within the first three months.",
    avatar: "https://picsum.photos/seed/sarah/100/100"
  },
  {
    name: "Marcus Chen",
    role: "Head of Growth at ScaleUp",
    content: "The AI systems implemented by the Nexus team are truly world-class. They've become an integral part of our scaling engine.",
    avatar: "https://picsum.photos/seed/marcus/100/100"
  },
  {
    name: "Elena Rodriguez",
    role: "CTO at DataSphere",
    content: "Finally, an agency that understands both the technical depth of AI and the business reality of scaling. Highly recommended.",
    avatar: "https://picsum.photos/seed/elena/100/100"
  }
];

const logos = ["Vercel", "Stripe", "OpenAI", "Anthropic", "Linear", "Raycast"];

export const Proof = () => {
  return (
    <section id="proof" className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-primary mb-4">Trusted by Industry Leaders</h2>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
            {logos.map((logo, i) => (
              <span key={i} className="text-2xl font-bold tracking-tighter">{logo}</span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative p-8 rounded-3xl glass border-white/5"
            >
              <Quote className="absolute top-6 right-8 h-8 w-8 text-white/10" />
              <p className="text-lg mb-8 leading-relaxed italic text-white/90">
                "{t.content}"
              </p>
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 border border-white/10">
                  <AvatarImage src={t.avatar} referrerPolicy="no-referrer" />
                  <AvatarFallback>{t.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-bold text-sm">{t.name}</h4>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
