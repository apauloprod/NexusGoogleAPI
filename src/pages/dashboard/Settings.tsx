import React, { useState, useEffect, useContext } from "react";
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
  UserPlus,
  DollarSign,
  Building2,
  Image as ImageIcon,
  Plus,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, addDoc, serverTimestamp, query, onSnapshot, doc, updateDoc, deleteDoc, getDoc, where, orderBy, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase";
import { AuthContext } from "../../App";
import { format } from "date-fns";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const Settings = () => {
  const { user, impersonatedUser } = useContext(AuthContext);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [customTasks, setCustomTasks] = useState<any[]>([]);
  const [newTask, setNewTask] = useState({ name: "", description: "", defaultPrice: 0 });
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [memberDetails, setMemberDetails] = useState<{timesheets: any[], jobs: any[]}>({timesheets: [], jobs: []});

  const [businessData, setBusinessData] = useState({
    businessName: "",
    businessDetails: "",
    businessLogo: "",
    hourlyRate: 0,
    jobVisibility: "all" as "all" | "own",
    address: {
      street: "",
      city: "",
      postcode: "",
      country: ""
    }
  });

  useEffect(() => {
    if (!user) return;
    
    // Get current user role
    const unsubRole = onSnapshot(doc(db, "users", user.uid), (snap) => {
      setCurrentUserData(snap.data());
    });

    // Fetch custom tasks
    const unsubTasks = onSnapshot(collection(db, "customTasks"), (snap) => {
      setCustomTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch business data
    const unsubBusiness = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBusinessData({
          businessName: data.businessName || "",
          businessDetails: data.businessDetails || "",
          businessLogo: data.businessLogo || "",
          hourlyRate: data.hourlyRate || 0,
          jobVisibility: data.jobVisibility || "all",
          address: data.address || { street: "", city: "", postcode: "", country: "" }
        });
      }
    });

    // Fetch team members
    const q = query(collection(db, "users"));
    const unsubTeam = onSnapshot(q, (snap) => {
      setTeamMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubRole();
      unsubTasks();
      unsubBusiness();
      unsubTeam();
    };
  }, [user]);

  const role = impersonatedUser?.role || currentUserData?.role || 'team';
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isManagerOrAdmin = isAdmin || isManager;

  useEffect(() => {
    if (!isManagerOrAdmin && activeTab === "profile") {
      setActiveTab("team"); // Redirect from profile if not admin/manager
    }
  }, [isManagerOrAdmin, activeTab]);

  const addCustomTask = async () => {
    if (!newTask.name) return;
    try {
      await addDoc(collection(db, "customTasks"), {
        ...newTask,
        createdAt: serverTimestamp()
      });
      setNewTask({ name: "", description: "", defaultPrice: 0 });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "customTasks");
    }
  };

  const deleteCustomTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, "customTasks", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "customTasks");
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `logos/${user.uid}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setBusinessData(prev => ({ ...prev, businessLogo: url }));
      await updateDoc(doc(db, "users", user.uid), { businessLogo: url });
    } catch (error) {
      console.error("Error uploading logo:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const fetchMemberDetails = async (member: any) => {
    setSelectedMember(member);
    
    // Fetch timesheets
    const tsQuery = query(
      collection(db, "timesheets"), 
      where("userId", "==", member.id),
      orderBy("startTime", "desc")
    );
    const tsSnap = await getDocs(tsQuery);
    const timesheets = tsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch jobs
    const jobsQuery = query(
      collection(db, "jobs"),
      where("assignedTeam", "array-contains", member.id),
      orderBy("createdAt", "desc")
    );
    const jobsSnap = await getDocs(jobsQuery);
    const jobs = jobsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    setMemberDetails({ timesheets, jobs });
  };

  const handleSaveBusiness = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        ...businessData,
        updatedAt: serverTimestamp()
      });
      alert("Settings saved successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "users");
    }
  };

  const addTeamMember = async () => {
    if (!newMemberEmail || !newMemberName) return;
    try {
      await addDoc(collection(db, "users"), {
        email: newMemberEmail,
        displayName: newMemberName,
        role: "team",
        hourlyRate: 25, // Default rate
        createdAt: serverTimestamp()
      });
      setNewMemberEmail("");
      setNewMemberName("");
    } catch (error) {
      console.error("Error adding team member:", error);
    }
  };

  const updateMemberRate = async (userId: string, rate: number) => {
    try {
      await updateDoc(doc(db, "users", userId), { hourlyRate: rate });
    } catch (error) {
      console.error("Error updating rate:", error);
    }
  };

  const updateRole = async (userId: string, role: "admin" | "manager" | "team") => {
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
            { id: "profile", icon: Building2, label: "Business Profile", managerAllowed: true },
            { id: "team", icon: Users, label: "Team Management", managerAllowed: true },
            { id: "tasks", icon: Zap, label: "Custom Tasks", managerAllowed: true },
            { id: "data", icon: Database, label: "Data & Backup", managerAllowed: false },
          ].filter(item => item.managerAllowed || isAdmin).map((item) => (
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
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold">Business Profile</h2>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Business Name</Label>
                    <Input 
                      value={businessData.businessName}
                      onChange={e => setBusinessData({...businessData, businessName: e.target.value})}
                      placeholder="Nexus Analytics" 
                      className="bg-white/5 border-white/10 rounded-xl h-12" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hourly Rate ($/hr)</Label>
                    <Input 
                      type="number"
                      value={businessData.hourlyRate}
                      onChange={e => setBusinessData({...businessData, hourlyRate: parseFloat(e.target.value)})}
                      className="bg-white/5 border-white/10 rounded-xl h-12" 
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Business Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-24 w-24 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden bg-white/5 relative group">
                      {businessData.businessLogo ? (
                        <>
                          <img src={businessData.businessLogo} alt="Logo" referrerPolicy="no-referrer" className="h-full w-full object-contain p-2" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Label htmlFor="logo-upload" className="cursor-pointer text-xs font-bold text-white">Change</Label>
                          </div>
                        </>
                      ) : (
                        <Label htmlFor="logo-upload" className="cursor-pointer flex flex-col items-center gap-2 text-muted-foreground hover:text-white transition-colors">
                          <ImageIcon className="h-6 w-6" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Upload</span>
                        </Label>
                      )}
                      <Input 
                        id="logo-upload" 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleLogoUpload}
                        disabled={isUploading}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-bold">Company Logo</p>
                      <p className="text-xs text-muted-foreground">Recommended size: 512x512px. PNG or JPG.</p>
                      {isUploading && <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse">Uploading...</Badge>}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Business Address</Label>
                  <div className="grid grid-cols-1 gap-4">
                    <Input 
                      value={businessData.address.street}
                      onChange={e => setBusinessData({
                        ...businessData, 
                        address: { ...businessData.address, street: e.target.value }
                      })}
                      placeholder="Street Address" 
                      className="bg-white/5 border-white/10 rounded-xl h-12" 
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Input 
                        value={businessData.address.city}
                        onChange={e => setBusinessData({
                          ...businessData, 
                          address: { ...businessData.address, city: e.target.value }
                        })}
                        placeholder="City" 
                        className="bg-white/5 border-white/10 rounded-xl h-12" 
                      />
                      <Input 
                        value={businessData.address.postcode}
                        onChange={e => setBusinessData({
                          ...businessData, 
                          address: { ...businessData.address, postcode: e.target.value }
                        })}
                        placeholder="Postcode" 
                        className="bg-white/5 border-white/10 rounded-xl h-12" 
                      />
                    </div>
                    <Input 
                      value={businessData.address.country}
                      onChange={e => setBusinessData({
                        ...businessData, 
                        address: { ...businessData.address, country: e.target.value }
                      })}
                      placeholder="Country" 
                      className="bg-white/5 border-white/10 rounded-xl h-12" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Additional Business Details (Displayed on PDF)</Label>
                  <Textarea 
                    value={businessData.businessDetails}
                    onChange={e => setBusinessData({...businessData, businessDetails: e.target.value})}
                    placeholder="Enter registration numbers, VAT info, etc..."
                    className="bg-white/5 border-white/10 rounded-xl min-h-[100px]" 
                  />
                  <p className="text-xs text-muted-foreground">This information will be displayed alongside your name on invoices and quotes.</p>
                </div>

                {isManagerOrAdmin && (
                  <div className="space-y-2">
                    <Label>Job Visibility (For Team Members)</Label>
                    <Select 
                      value={businessData.jobVisibility} 
                      onValueChange={(v: any) => setBusinessData({...businessData, jobVisibility: v})}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 rounded-xl h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-black border-white/10">
                        <SelectItem value="all">Team members can see ALL jobs</SelectItem>
                        <SelectItem value="own">Team members can ONLY see their assigned jobs</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Controls what team members see in the Jobs and Schedule pages.</p>
                  </div>
                )}
              </div>
              
              {isManagerOrAdmin && (
                <Button 
                  onClick={handleSaveBusiness}
                  className="mt-8 bg-white text-black hover:bg-white/90 rounded-xl px-8 h-12 font-bold"
                >
                  Save Changes
                </Button>
              )}
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
                              <img src={member.photoURL} referrerPolicy="no-referrer" className="h-full w-full rounded-full object-cover" />
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
                          <div className="flex flex-col items-end gap-1">
                            <Badge className={
                              member.role === 'admin' ? "bg-purple-500/10 text-purple-500" : 
                              member.role === 'manager' ? "bg-cyan-500/10 text-cyan-500" :
                              "bg-blue-500/10 text-blue-500"
                            }>
                              {member.role === 'admin' ? 'Admin' : member.role === 'manager' ? 'Manager' : 'Team Member'}
                            </Badge>
                            {isManagerOrAdmin && (
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3 text-emerald-400" />
                                <Input 
                                  type="number"
                                  value={member.hourlyRate || 0}
                                  onChange={e => updateMemberRate(member.id, parseFloat(e.target.value))}
                                  className="h-6 w-16 bg-transparent border-none text-xs font-bold text-emerald-400 p-0 text-right focus-visible:ring-0"
                                />
                                <span className="text-[10px] text-muted-foreground">/hr</span>
                              </div>
                            )}
                          </div>
                          {isManagerOrAdmin && (
                            <div className="flex items-center gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-white"
                                    onClick={() => fetchMemberDetails(member)}
                                  >
                                    <ShieldCheck className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] max-h-[80vh] overflow-y-auto rounded-[2rem]">
                                  <DialogHeader>
                                    <DialogTitle className="text-2xl font-bold tracking-tighter flex items-center gap-3">
                                      <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                                        {selectedMember?.photoURL ? <img src={selectedMember.photoURL} referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <User className="h-5 w-5" />}
                                      </div>
                                      {selectedMember?.displayName || selectedMember?.email}
                                    </DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-6 pt-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="glass p-4 rounded-2xl border-white/5">
                                        <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Role</p>
                                        <p className="font-bold capitalize">{selectedMember?.role}</p>
                                      </div>
                                      <div className="glass p-4 rounded-2xl border-white/5">
                                        <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Hourly Rate</p>
                                        <p className="font-bold text-emerald-400">${selectedMember?.hourlyRate}/hr</p>
                                      </div>
                                    </div>

                                    <div className="space-y-4">
                                      <h4 className="font-bold flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-blue-400" />
                                        Recent Timesheets
                                      </h4>
                                      <div className="space-y-2">
                                        {memberDetails.timesheets.length === 0 ? (
                                          <p className="text-sm text-muted-foreground">No timesheets found.</p>
                                        ) : (
                                          memberDetails.timesheets.slice(0, 5).map(ts => (
                                            <div key={ts.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex justify-between items-center">
                                              <div>
                                                <p className="text-sm font-bold">{format(ts.startTime.toDate(), "MMM d, yyyy")}</p>
                                                <p className="text-xs text-muted-foreground">{ts.duration ? `${Math.floor(ts.duration/60)}h ${ts.duration%60}m` : "Running"}</p>
                                              </div>
                                              <Badge variant="outline" className="text-[10px] capitalize">{ts.submissionStatus}</Badge>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>

                                    <div className="space-y-4">
                                      <h4 className="font-bold flex items-center gap-2">
                                        <Plus className="h-4 w-4 text-emerald-400" />
                                        Assigned Jobs
                                      </h4>
                                      <div className="space-y-2">
                                        {memberDetails.jobs.length === 0 ? (
                                          <p className="text-sm text-muted-foreground">No jobs assigned.</p>
                                        ) : (
                                          memberDetails.jobs.slice(0, 5).map(job => (
                                            <div key={job.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex justify-between items-center">
                                              <div>
                                                <p className="text-sm font-bold">{job.title}</p>
                                                <p className="text-xs text-muted-foreground">{job.clientName}</p>
                                              </div>
                                              <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 capitalize">{job.status}</Badge>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>

                                      <div className="pt-6 border-t border-white/5 flex flex-wrap gap-2">
                                        <Button 
                                          variant="outline" 
                                          className="flex-1 bg-white/5 border-white/10"
                                          onClick={() => updateRole(selectedMember?.id, 'admin')}
                                          disabled={selectedMember?.role === 'admin' || (!isAdmin && selectedMember?.role !== 'admin')}
                                        >
                                          Make Owner
                                        </Button>
                                        <Button 
                                          variant="outline" 
                                          className="flex-1 bg-white/5 border-white/10"
                                          onClick={() => updateRole(selectedMember?.id, 'manager')}
                                          disabled={selectedMember?.role === 'manager'}
                                        >
                                          Make Manager
                                        </Button>
                                        <Button 
                                          variant="outline" 
                                          className="flex-1 bg-white/5 border-white/10"
                                          onClick={() => updateRole(selectedMember?.id, 'team')}
                                          disabled={selectedMember?.role === 'team'}
                                        >
                                          Make Staff
                                        </Button>
                                      </div>
                                      <div className="pt-2 flex gap-3">
                                        <Button 
                                          variant="destructive" 
                                          className="flex-1"
                                          onClick={() => removeMember(selectedMember?.id)}
                                          disabled={!isAdmin && selectedMember?.role === 'admin'}
                                        >
                                          Remove Member
                                        </Button>
                                      </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-red-400"
                                onClick={() => removeMember(member.id)}
                                disabled={!isAdmin && member.role === 'admin'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === "tasks" && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-bold">Custom Tasks</h2>
              </div>
              
              <div className="glass p-8 rounded-3xl border-white/5 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Task Name</Label>
                    <Input 
                      placeholder="e.g. Lawn Mowing" 
                      value={newTask.name}
                      onChange={(e) => setNewTask({...newTask, name: e.target.value})}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Price</Label>
                    <Input 
                      type="number"
                      placeholder="0.00" 
                      value={newTask.defaultPrice}
                      onChange={(e) => setNewTask({...newTask, defaultPrice: parseFloat(e.target.value) || 0})}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label>Description</Label>
                    <Textarea 
                      placeholder="Brief description of the task..." 
                      value={newTask.description}
                      onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                </div>
                <Button onClick={addCustomTask} className="bg-white text-black hover:bg-white/90 rounded-xl gap-2 font-bold">
                  <Plus className="h-4 w-4" />
                  Add Task
                </Button>

                <div className="pt-8 border-t border-white/5">
                  <h3 className="text-lg font-bold mb-4">Existing Tasks</h3>
                  <div className="grid gap-4">
                    {customTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No custom tasks added yet.</p>
                    ) : (
                      customTasks.map((task) => (
                        <div key={task.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                          <div>
                            <p className="font-bold">{task.name}</p>
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                            <p className="text-xs text-emerald-400 mt-1 font-bold">${task.defaultPrice.toFixed(2)}</p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => deleteCustomTask(task.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
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
              
              <div className="glass p-8 rounded-3xl border-white/5 space-y-8">
                <div className="pt-8 border-t border-white/5">
                  <h3 className="text-lg font-bold mb-2 text-white">Seed Sample Data</h3>
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
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
