import React, { useState } from "react";
import { 
  Settings as SettingsIcon,
  User,
  Bell,
  Lock,
  Database,
  Globe,
  Palette,
  Shield,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { db } from "../../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const Settings = () => {
  const [isSeeding, setIsSeeding] = useState(false);

  const seedData = async () => {
    setIsSeeding(true);
    try {
      // Seed Clients
      const clientRef = await addDoc(collection(db, "clients"), {
        name: "Acme Corp",
        company: "Acme Corporation",
        email: "contact@acme.com",
        phone: "+1 (555) 123-4567",
        address: "123 Innovation Way, San Francisco, CA",
        jobsCount: 2,
        createdAt: serverTimestamp()
      });

      // Seed Requests
      await addDoc(collection(db, "requests"), {
        name: "Jane Smith",
        email: "jane@example.com",
        phone: "+1 (555) 987-6543",
        address: "456 Oak St, Austin, TX",
        services: ["AI Implementation", "Data Strategy"],
        status: "pending",
        createdAt: serverTimestamp()
      });

      // Seed Quotes
      await addDoc(collection(db, "quotes"), {
        clientName: "Acme Corp",
        clientId: clientRef.id,
        quoteNumber: "Q-1001",
        total: 12500.00,
        status: "sent",
        items: [
          { description: "Data Strategy Consultation", price: 2500 },
          { description: "AI Model Implementation", price: 10000 }
        ],
        createdAt: serverTimestamp()
      });

      // Seed Jobs
      await addDoc(collection(db, "jobs"), {
        title: "Q3 Data Infrastructure",
        clientName: "Acme Corp",
        clientId: clientRef.id,
        status: "active",
        notesCount: 5,
        photosCount: 12,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Seed Invoices
      await addDoc(collection(db, "invoices"), {
        clientName: "Acme Corp",
        clientId: clientRef.id,
        invoiceNumber: "INV-2001",
        total: 5000.00,
        paidAmount: 0,
        status: "sent",
        dueDate: serverTimestamp(), // Should be future but this is just seed
        createdAt: serverTimestamp()
      });

      // Seed Payments
      await addDoc(collection(db, "payments"), {
        clientName: "Acme Corp",
        clientId: clientRef.id,
        invoiceNumber: "INV-1998",
        amount: 2500.00,
        method: "Credit Card",
        createdAt: serverTimestamp()
      });

      // Seed Visits (for Schedule)
      await addDoc(collection(db, "visits"), {
        title: "On-site Strategy Meeting",
        clientName: "Acme Corp",
        address: "123 Innovation Way, San Francisco, CA",
        scheduledAt: serverTimestamp(),
        status: "scheduled",
        createdAt: serverTimestamp()
      });

      // Success feedback
      console.log("Sample data seeded successfully!");
    } catch (error) {
      console.error("Error seeding data:", error);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tighter mb-2">Settings</h1>
        <p className="text-muted-foreground text-lg">Manage your business profile, team, and application preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Nav */}
        <div className="space-y-1">
          {[
            { icon: User, label: "Profile", active: true },
            { icon: Bell, label: "Notifications" },
            { icon: Lock, label: "Security" },
            { icon: Database, label: "Data & Backup" },
            { icon: Globe, label: "Integrations" },
            { icon: Palette, label: "Appearance" },
          ].map((item, i) => (
            <Button 
              key={i} 
              variant="ghost" 
              className={`w-full justify-start gap-3 h-11 px-4 rounded-xl ${
                item.active ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          ))}
        </div>

        {/* Content */}
        <div className="md:col-span-3 space-y-12">
          {/* Profile Section */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <User className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold">Business Profile</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input defaultValue="Nexus Analytics" className="bg-white/5 border-white/10 rounded-xl h-12" />
              </div>
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input defaultValue="owner@nexus.com" className="bg-white/5 border-white/10 rounded-xl h-12" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Business Address</Label>
                <Input defaultValue="123 Data Drive, Tech City, TC 12345" className="bg-white/5 border-white/10 rounded-xl h-12" />
              </div>
            </div>
            
            <Button className="mt-8 bg-white text-black hover:bg-white/90 rounded-xl px-8 h-12 font-bold">
              Save Changes
            </Button>
          </section>

          <Separator className="bg-white/5" />

          {/* Developer/Admin Section */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Zap className="h-5 w-5 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold">Developer Tools</h2>
            </div>
            
            <div className="glass p-8 rounded-3xl border-white/5">
              <h3 className="text-lg font-bold mb-2">Seed Sample Data</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Populate your database with sample clients, requests, quotes, and jobs to test the dashboard functionality.
              </p>
              <Button 
                onClick={seedData} 
                disabled={isSeeding}
                className={`rounded-xl px-8 h-12 font-bold gap-2 transition-all ${
                  isSeeding 
                    ? "bg-white/10 text-muted-foreground" 
                    : "bg-emerald-500 text-white hover:bg-emerald-600"
                }`}
              >
                <Database className="h-4 w-4" />
                {isSeeding ? "Seeding Database..." : "Seed Sample Data"}
              </Button>
              {isSeeding && (
                <p className="text-xs text-emerald-500 mt-2 animate-pulse">
                  Connecting to Firestore and creating collections...
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
