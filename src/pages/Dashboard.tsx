import React, { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Calendar, 
  CreditCard, 
  DollarSign,
  Settings, 
  Plus, 
  Search, 
  Bell, 
  Menu,
  MessageSquare,
  Clock,
  CheckSquare,
  Image as ImageIcon,
  MoreVertical,
  ArrowUpRight,
  User as UserIcon,
  Mail,
  MapPin,
  LogIn,
  Sparkles,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { db, auth, signInWithGoogle, logout, handleFirestoreError, OperationType } from "../firebase";
import { collection, onSnapshot, query, orderBy, limit, doc, getDoc, updateDoc, setDoc, serverTimestamp, where, getDocs, deleteDoc } from "firebase/firestore";
import { AuthContext } from "../App";
import { useContext, useMemo } from "react";

import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClientForm } from "../components/forms/ClientForm";
import { VisitForm } from "../components/forms/VisitForm";
import { RequestFormInternal } from "../components/forms/RequestFormInternal";
import { QuoteForm } from "../components/forms/QuoteForm";
import { JobForm } from "../components/forms/JobForm";
import { InvoiceForm } from "../components/forms/InvoiceForm";
import { PaymentForm } from "../components/forms/PaymentForm";

// Import Dashboard Components
import Requests from "./dashboard/Requests";
import Quotes from "./dashboard/Quotes";
import Schedule from "./dashboard/Schedule";
import Invoices from "./dashboard/Invoices";
import Payments from "./dashboard/Payments";
import Jobs from "./dashboard/Jobs";
import Clients from "./dashboard/Clients";
import Messages from "./dashboard/Messages";
import SettingsPage from "./dashboard/Settings";
import Timesheets from "./dashboard/Timesheets";
import Marketing from "./dashboard/Marketing";
import Overview from "./dashboard/Overview";
import Expenses from "./dashboard/Expenses";
import AdminControl from "./dashboard/AdminControl";
import Team from "./dashboard/Team";

interface SidebarItemProps {
  icon: any;
  label: string;
  to: string;
  active: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, to, active }) => (
  <Link to={to}>
    <Button 
      variant="ghost" 
      className={`w-full justify-start gap-3 h-11 px-4 rounded-xl transition-all duration-200 ${
        active 
          ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]" 
          : "text-muted-foreground hover:text-white hover:bg-white/5"
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? "text-white" : "text-muted-foreground"}`} />
      <span className="font-medium">{label}</span>
    </Button>
  </Link>
);

const Sidebar = ({ 
  createDialogOpen, 
  setCreateDialogOpen, 
  activeForm, 
  setActiveForm, 
  menuItems, 
  location, 
  user, 
  logout,
  userRole,
  currentUserData,
  impersonatedUser
}: any) => {
  const displayName = impersonatedUser?.displayName || currentUserData?.displayName || user?.displayName || "User";
  const email = impersonatedUser?.email || currentUserData?.email || user?.email;
  const photoURL = impersonatedUser?.photoURL || currentUserData?.photoURL || user?.photoURL;
  const displayRole = impersonatedUser?.role || userRole;

  return (
    <div className="flex flex-col h-full bg-black border-r border-white/5 w-64">
      <div className="p-6 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center">
          <div className="h-4 w-4 bg-black rounded-sm" />
        </div>
        <span className="text-xl font-bold tracking-tighter text-white">NEXUS</span>
      </div>

      <div className="px-4 mb-6">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full bg-white text-black hover:bg-white/90 rounded-xl h-11 gap-2 font-bold">
            <Plus className="h-5 w-5" />
            Create New
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-black border-white/10 text-white sm:max-w-[1000px] w-[95vw] rounded-[2rem] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="p-6 pb-2">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold tracking-tighter">
                {activeForm === "client" ? "Add New Client" : 
                 activeForm === "visit" ? "Schedule New Visit" : 
                 activeForm === "request" ? "Create New Request" : 
                 activeForm === "quote" ? "Create New Quote" :
                 activeForm === "job" ? "Create New Job" :
                 activeForm === "invoice" ? "Create New Invoice" :
                 activeForm === "payment" ? "Record Payment" :
                 "What would you like to create?"}
              </DialogTitle>
            </DialogHeader>
          </div>
          
          <ScrollArea className="flex-1 px-6 pb-6">
            {!activeForm ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                <Button 
                  variant="outline" 
                  className="flex flex-col h-24 gap-2 border-white/10 hover:bg-white/5 rounded-2xl"
                  onClick={() => setActiveForm("client")}
                >
                  <Users className="h-6 w-6" />
                  <span className="text-xs">Client</span>
                </Button>
                
                {displayRole !== 'team' && (
                  <>
                    <Button 
                      variant="outline" 
                      className="flex flex-col h-24 gap-2 border-white/10 hover:bg-white/5 rounded-2xl"
                      onClick={() => setActiveForm("visit")}
                    >
                      <Calendar className="h-6 w-6" />
                      <span className="text-xs">Visit</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex flex-col h-24 gap-2 border-white/10 hover:bg-white/5 rounded-2xl"
                      onClick={() => setActiveForm("request")}
                    >
                      <FileText className="h-6 w-6" />
                      <span className="text-xs">Request</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex flex-col h-24 gap-2 border-white/10 hover:bg-white/5 rounded-2xl"
                      onClick={() => setActiveForm("quote")}
                    >
                      <FileText className="h-6 w-6 text-blue-400" />
                      <span className="text-xs">Quote</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex flex-col h-24 gap-2 border-white/10 hover:bg-white/5 rounded-2xl"
                      onClick={() => setActiveForm("job")}
                    >
                      <CheckSquare className="h-6 w-6 text-emerald-400" />
                      <span className="text-xs">Job</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex flex-col h-24 gap-2 border-white/10 hover:bg-white/5 rounded-2xl"
                      onClick={() => setActiveForm("invoice")}
                    >
                      <FileText className="h-6 w-6 text-amber-400" />
                      <span className="text-xs">Invoice</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex flex-col h-24 gap-2 border-white/10 hover:bg-white/5 rounded-2xl"
                      onClick={() => setActiveForm("payment")}
                    >
                      <CreditCard className="h-6 w-6 text-purple-400" />
                      <span className="text-xs">Payment</span>
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="pt-4">
                {activeForm === "client" && (
                  <ClientForm 
                    onSuccess={() => {
                      setCreateDialogOpen(false);
                      setActiveForm(null);
                    }} 
                    onCancel={() => setActiveForm(null)}
                  />
                )}
                {activeForm === "visit" && (
                  <VisitForm 
                    onSuccess={() => {
                      setCreateDialogOpen(false);
                      setActiveForm(null);
                    }} 
                    onCancel={() => setActiveForm(null)}
                  />
                )}
                {activeForm === "request" && (
                  <RequestFormInternal 
                    onSuccess={() => {
                      setCreateDialogOpen(false);
                      setActiveForm(null);
                    }} 
                    onCancel={() => setActiveForm(null)}
                  />
                )}
                {activeForm === "quote" && (
                  <QuoteForm 
                    onSuccess={() => {
                      setCreateDialogOpen(false);
                      setActiveForm(null);
                    }} 
                    onCancel={() => setActiveForm(null)}
                  />
                )}
                {activeForm === "job" && (
                  <JobForm 
                    onSuccess={() => {
                      setCreateDialogOpen(false);
                      setActiveForm(null);
                    }} 
                    onCancel={() => setActiveForm(null)}
                  />
                )}
                {activeForm === "invoice" && (
                  <InvoiceForm 
                    onSuccess={() => {
                      setCreateDialogOpen(false);
                      setActiveForm(null);
                    }} 
                    onCancel={() => setActiveForm(null)}
                  />
                )}
                {activeForm === "payment" && (
                  <PaymentForm 
                    onSuccess={() => {
                      setCreateDialogOpen(false);
                      setActiveForm(null);
                    }} 
                    onCancel={() => setActiveForm(null)}
                  />
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>

    <ScrollArea className="flex-1 px-2">
      <div className="space-y-1">
        {menuItems.map((item: any) => (
          <SidebarItem 
            key={item.to}
            icon={item.icon}
            label={item.label}
            to={item.to}
            active={location.pathname === item.to}
          />
        ))}
      </div>
      
      <Separator className="my-6 bg-white/5 mx-4" />
      
      <div className="space-y-1">
        {userRole === "super-admin" && (
          <SidebarItem 
            icon={Shield} 
            label="Super Admin" 
            to="/dashboard/admin" 
            active={location.pathname === "/dashboard/admin"} 
          />
        )}
        {(userRole === 'admin' || userRole === 'manager' || userRole === 'super-admin' || currentUserData?.permissions?.page_timesheets) && (
          <SidebarItem 
            icon={Clock} 
            label="Timesheets" 
            to="/dashboard/timesheets" 
            active={location.pathname === "/dashboard/timesheets"} 
          />
        )}
        {(userRole === 'admin' || userRole === 'manager' || userRole === 'super-admin') && (
          <SidebarItem 
            icon={Users} 
            label="Team" 
            to="/dashboard/team" 
            active={location.pathname === "/dashboard/team"} 
          />
        )}
        <SidebarItem 
          icon={Settings} 
          label="Settings" 
          to="/dashboard/settings" 
          active={location.pathname === "/dashboard/settings"} 
        />
      </div>
    </ScrollArea>

    <div className="p-4 border-t border-white/5">
      <div className="flex items-center gap-3 px-2 mb-4">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
          {photoURL ? (
            <img src={photoURL} alt={displayName} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-5 w-5 text-white/50" />
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-sm font-bold text-white truncate">{displayName}</p>
          <p className="text-[10px] text-muted-foreground truncate uppercase tracking-wider font-bold mb-0.5">
            {displayRole === 'super-admin' ? 'System Admin' : displayRole === 'admin' ? 'Business Owner' : displayRole}
          </p>
          <p className="text-[10px] text-muted-foreground truncate opacity-50">{email}</p>
        </div>
      </div>
      <Button 
        variant="ghost" 
        onClick={logout}
        className="w-full justify-start gap-3 h-11 px-4 rounded-xl text-muted-foreground hover:text-red-400 hover:bg-red-400/5 transition-colors"
      >
        <LogIn className="h-5 w-5 rotate-180" />
        <span className="font-medium">Log out</span>
      </Button>
    </div>
  </div>
  );
};

export default function Dashboard() {
  const { user, loading, currentUserData, impersonatedUser, setImpersonatedUser } = useContext(AuthContext);
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeForm, setActiveForm] = useState<"client" | "visit" | "request" | "quote" | "job" | "invoice" | "payment" | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "manager" | "team" | "super-admin" | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activities, setActivities] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;

    // Initialize businessId and role correctly
    const checkUser = async () => {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      
      if (!snap.exists()) {
        // Check if user was invited (invited docs have email but no uid yet or different doc ID)
        // Actually, invited users are currently created with random doc IDs.
        // We search by email to see if they were pre-invited.
        const inviteQuery = query(collection(db, "users"), where("email", "==", user.email));
        const inviteSnap = await getDocs(inviteQuery);
        
        const isSuperAdmin = user.email === "apauloprod@gmail.com";

        if (!inviteSnap.empty) {
          // User was invited. Claim the record by copying data to a doc with their real UID.
          // This ensures AuthContext.currentUserData (based on snap(doc(users, uid))) works.
          const inviteDoc = inviteSnap.docs[0];
          const inviteData = inviteDoc.data();
          
          await setDoc(userRef, {
            ...inviteData,
            uid: user.uid,
            displayName: user.displayName || inviteData.displayName,
            photoURL: user.photoURL,
            updatedAt: serverTimestamp(),
            // Ensure businessId exists
            businessId: inviteData.businessId || user.uid
          });
          
          // Delete the temporary invite doc if it wasn't already the UID doc
          if (inviteDoc.id !== user.uid) {
            await deleteDoc(inviteDoc.ref);
          }
        } else {
          // New independent business owner
          await setDoc(userRef, {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: isSuperAdmin ? "admin" : "admin", // New users starting out are admins of their own business
            businessId: user.uid, // Their own business
            createdAt: serverTimestamp()
          });
        }
      } else if (!snap.data().businessId) {
        // Legacy support: add businessId if missing
        await updateDoc(userRef, { businessId: user.uid });
      }
    };
    checkUser();
  }, [user]);

  useEffect(() => {
    if (!user || (!currentUserData?.businessId && !impersonatedUser?.businessId)) return;

    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    // Fetch team members or admins for impersonation
    let teamQuery;
    const isSuperAdmin = user?.email === "apauloprod@gmail.com";
    
    if (isSuperAdmin) {
      // Super admin can see ALL users in the system to impersonate anyone
      teamQuery = query(collection(db, "users"), limit(200));
    } else {
      // Regular view shows team for that business
      teamQuery = query(collection(db, "users"), where("businessId", "==", businessId));
    }

    const unsubTeam = onSnapshot(teamQuery, (snap) => {
      setTeamMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Handle role (impersonation or real)
    let role = impersonatedUser ? impersonatedUser.role : (currentUserData?.role || "team");
    
    // Explicitly set super-admin if email matches AND not impersonating or impersonating the super admin email
    if (isSuperAdmin && !impersonatedUser) {
      role = "super-admin";
    }
    
    setUserRole(role as any);

    // Fetch recent activities for this business
    const activitiesQuery = query(
      collection(db, "activities"), 
      where("businessId", "==", businessId),
      orderBy("createdAt", "desc"), 
      limit(10)
    );
    const unsubActivities = onSnapshot(activitiesQuery, (snap) => {
      setActivities(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      if (error.code === 'failed-precondition') {
        console.warn("Index required for activities businessId filtering.");
      }
    });

    return () => {
      unsubTeam();
      unsubActivities();
    };
  }, [user, currentUserData, impersonatedUser]);

  const menuItems = useMemo(() => {
    const permissions = impersonatedUser?.permissions || currentUserData?.permissions || {};
    const isAdminOrManager = userRole === "admin" || userRole === "manager" || userRole === "super-admin";

    const baseItems = [
      { icon: LayoutDashboard, label: "Home", to: "/dashboard" },
      { icon: Calendar, label: "Schedule", to: "/dashboard/schedule", permission: 'page_schedule' },
      { icon: CheckSquare, label: "Jobs", to: "/dashboard/jobs", permission: 'page_jobs' },
      { icon: MessageSquare, label: "Messages", to: "/dashboard/messages", permission: 'page_messages' },
    ];

    const adminItems = [
      { icon: Users, label: "Clients", to: "/dashboard/clients", permission: 'page_clients' },
      { icon: FileText, label: "Requests", to: "/dashboard/requests", permission: 'page_requests' },
      { icon: FileText, label: "Quotes", to: "/dashboard/quotes", permission: 'page_quotes' },
      { icon: FileText, label: "Invoices", to: "/dashboard/invoices", permission: 'page_invoices' },
      { icon: CreditCard, label: "Payments", to: "/dashboard/payments", permission: 'page_payments' },
      { icon: DollarSign, label: "Expenses", to: "/dashboard/expenses", permission: 'page_expenses' },
      { icon: Sparkles, label: "Marketing", to: "/dashboard/marketing", permission: 'page_marketing' },
    ];

    if (isAdminOrManager) {
      return [...baseItems, ...adminItems].filter((item, index, self) => 
        index === self.findIndex((t) => t.to === item.to)
      );
    }

    return [...baseItems, ...adminItems].filter(item => {
      if (item.label === "Home") return true;
      return permissions[item.permission || ""];
    }).filter((item, index, self) => 
      index === self.findIndex((t) => t.to === item.to)
    );
  }, [userRole, currentUserData?.permissions]);

  if (loading) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="h-16 w-16 rounded-2xl bg-white flex items-center justify-center mb-8">
          <div className="h-8 w-8 bg-black rounded-lg" />
        </div>
        <h1 className="text-3xl font-bold tracking-tighter mb-4">Welcome to Nexus</h1>
        <p className="text-muted-foreground max-w-md mb-8">
          Please log in with your authorized Google account to access your business dashboard.
        </p>
        <Button 
          onClick={signInWithGoogle}
          size="lg" 
          className="bg-white text-black hover:bg-white/90 rounded-xl px-8 h-14 text-lg font-bold gap-3"
        >
          <LogIn className="h-5 w-5" />
          Log in with Google
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Desktop Sidebar */}
        <div className="hidden lg:block h-full">
          <Sidebar 
            createDialogOpen={createDialogOpen}
            setCreateDialogOpen={setCreateDialogOpen}
            activeForm={activeForm}
            setActiveForm={setActiveForm}
            menuItems={menuItems}
            location={location}
            user={user}
            logout={logout}
            userRole={userRole}
            currentUserData={currentUserData}
            impersonatedUser={impersonatedUser}
          />
        </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {impersonatedUser && (
          <div className="bg-cyan-500/10 border-b border-cyan-500/20 px-6 py-2 flex items-center justify-between text-cyan-400">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Shield className="h-4 w-4" />
              <span>Currently impersonating UID: <strong>{impersonatedUser.uid}</strong> ({impersonatedUser.role})</span>
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-7 text-xs hover:bg-cyan-500/20 text-cyan-400 font-bold"
              onClick={() => setImpersonatedUser(null)}
            >
              Stop Impersonating
            </Button>
          </div>
        )}
        {/* Top Nav */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/50 backdrop-blur-xl z-10">
          <div className="flex items-center gap-4 flex-1">
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden text-white">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-black border-r border-white/5">
                <Sidebar 
                  createDialogOpen={createDialogOpen}
                  setCreateDialogOpen={setCreateDialogOpen}
                  activeForm={activeForm}
                  setActiveForm={setActiveForm}
                  menuItems={menuItems}
                  location={location}
                  user={user}
                  logout={logout}
                  userRole={userRole}
                  currentUserData={currentUserData}
                  impersonatedUser={impersonatedUser}
                />
              </SheetContent>
            </Sheet>
            
            <div className="relative max-w-md w-full hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search clients, jobs, invoices..." 
                className="pl-10 bg-white/5 border-white/10 rounded-xl h-10 focus:ring-white/20"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user.email === "apauloprod@gmail.com" && (
              <div className="flex items-center gap-2">
                <Select 
                  value={impersonatedUser?.uid || "original"} 
                  onValueChange={(v) => {
                    if (v === "original") {
                      setImpersonatedUser(null);
                    } else {
                      const member = teamMembers.find(m => m.id === v);
                      if (member) {
                        setImpersonatedUser({ 
                          uid: member.id, 
                          role: member.role,
                          businessId: member.businessId || member.id,
                          displayName: member.displayName || member.email,
                          permissions: member.permissions || {}
                        });
                      }
                    }
                  }}
                >
                  <SelectTrigger className="w-[180px] bg-white/5 border-white/10 rounded-xl h-10 text-[10px] uppercase font-black tracking-tighter">
                    <SelectValue placeholder="Test as Business" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10 max-h-[400px]">
                    <SelectItem value="original" className="font-bold">Original: Super Admin</SelectItem>
                    <Separator className="my-2 bg-white/5" />
                    {teamMembers.filter(m => m.id !== user.uid).map(member => (
                      <SelectItem key={member.id} value={member.id} className="text-[10px] uppercase">
                        {member.businessName ? `${member.businessName} - ` : ""}
                        {member.displayName || member.email.split('@')[0]} 
                        <span className="ml-1 opacity-50">({member.role})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {impersonatedUser && (
                  <Badge variant="outline" className="bg-cyan-500/10 text-cyan-500 border-cyan-500/20 animate-pulse text-[8px] uppercase">
                    Impersonating
                  </Badge>
                )}
              </div>
            )}
            <Button 
              variant="outline" 
              className="hidden md:flex bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl h-10 gap-2 font-bold"
            >
              <Clock className="h-4 w-4" />
              Clock In
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-white rounded-full border-2 border-black" />
            </Button>
            <Separator orientation="vertical" className="h-6 bg-white/5" />
            <div className="flex items-center gap-2 px-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto bg-[#050505]">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/quotes" element={<Quotes />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/timesheets" element={<Timesheets />} />
            <Route path="/marketing" element={<Marketing />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/team" element={<Team />} />
            <Route path="/admin" element={<AdminControl />} />
          </Routes>
        </main>
      </div>

      {/* Right Panel (Contextual) */}
      <div className="hidden xl:block w-80 border-l border-white/5 bg-black p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-white">Recent Activity</h3>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">View All</Button>
        </div>
        <div className="space-y-6">
          {activities.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No recent activity</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex gap-4">
                <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activity.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • by {activity.userName}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
