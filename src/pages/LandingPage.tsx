import { Background } from "../components/Background";
import { Navbar } from "../components/Navbar";
import { Hero } from "../components/Hero";
import { ValueProp } from "../components/ValueProp";
import { Proof } from "../components/Proof";
import { CTA } from "../components/CTA";

export default function LandingPage() {
  return (
    <div className="min-h-screen font-sans selection:bg-primary selection:text-primary-foreground">
      <Background />
      <Navbar />
      <main>
        <Hero />
        <ValueProp />
        <Proof />
        <CTA />
      </main>
    </div>
  );
}
