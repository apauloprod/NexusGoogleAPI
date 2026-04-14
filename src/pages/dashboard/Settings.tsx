import React, { useState, useEffect } from "react";
import { 
  Settings as SettingsIcon,
  User,
  Bell,
  Lock,
  Database,
  Globe,
  Palette,
  Shield,
  Zap,
  Users,
  Mail,
  Trash2,
  ShieldCheck,
  UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, addDoc, serverTimestamp, query, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";

const Settings = () => {
  const [isSeeding, setIsSeeding] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberName, setNewMemberName] = useState("");

  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsub = onSnapshot(q, (snap) => {
      setTeamMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const addTeamMember = async () => {
    if (!newMemberEmail || !newMemberName) return;
    try {
      await addDoc(collection(db, "users"), {
        email: newMemberEmail,
        displayName: newMemberName,
        role: "team",
        createdAt: serverTimestamp()
      });
      setNewMemberEmail("");
      setNewMemberName("");
    } catch (error) {
      console.error("Error adding team member:", error);
    }
  };

  const updateRole = async (userId: string, role: "admin" | "team") => {
    try {
      await updateDoc(doc(db, "users", userId), { role });
    } catch (error) {
      console.error("Error updating role:", error);
    }
  };

  const removeMember = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this team member?")) return;
    try {
      await deleteDoc(doc(db, "users", userId));
    } catch (error) {
      console.error("Error removing member:", error);
    }
  };

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
            { id: "profile", icon: User, label: "Profile" },
            { id: "team", icon: Users, label: "Team Management" },
            { id: "notifications", icon: Bell, label: "Notifications" },
            { id: "security", icon: Lock, label: "Security" },
            { id: "data", icon: Database, label: "Data & Backup" },
          ].map((item) => (
            <Button 
              key={item.id} 
              variant="ghost" 
              onClick={() => setActiveTab(item.id)}
              className={`w-full justify-start gap-3 h-11 px-4 rounded-xl ${
                activeTab === item.id ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          ))}
        </div>

        {/* Content */}
        <div className="md:col-span-3 space-y-12">
          {activeTab === "profile" && (
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
          )}

          {activeTab === "team" && (
            <section className="space-y-8">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <h2 className="text-2xl font-bold">Team Management</h2>
                </div>

                <div className="glass p-6 rounded-3xl border-white/5 mb-8">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Add Team Member
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input 
                        placeholder="John Doe" 
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        className="bg-white/5 border-white/10" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email Address</Label>
                      <Input 
                        placeholder="john@example.com" 
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        className="bg-white/5 border-white/10" 
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={addTeamMember}
                    className="bg-white text-black hover:bg-white/90 rounded-xl font-bold"
                  >
                    Send Invite
                  </Button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold px-2">Current Members</h3>
                  <div className="grid gap-3">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="p-4 rounded-2xl glass border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                            {member.photoURL ? (
                              <img src={member.photoURL} className="h-full w-full rounded-full object-cover" />
                            ) : (
                              <User className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{member.displayName || "Pending Invite"}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge className={member.role === 'admin' ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500"}>
                            {member.role === 'admin' ? 'Admin' : 'Team Member'}
                          </Badge>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-white"
                              onClick={() => updateRole(member.id, member.role === 'admin' ? 'team' : 'admin')}
                            >
                              <ShieldCheck className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-red-400"
                              onClick={() => removeMember(member.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === "data" && (
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
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
