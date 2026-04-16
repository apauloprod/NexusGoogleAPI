import React, { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Calendar, 
  CreditCard, 
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
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { db, auth, signInWithGoogle, logout, handleFirestoreError, OperationType } from "../firebase";
import { collection, onSnapshot, query, orderBy, limit, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
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
  logout 
}: any) => (
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
        <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
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
        <SidebarItem 
          icon={Clock} 
          label="Timesheets" 
          to="/dashboard/timesheets" 
          active={location.pathname === "/dashboard/timesheets"} 
        />
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
          {user?.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || ""} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-5 w-5 text-white/50" />
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-sm font-bold text-white truncate">{user?.displayName || "User"}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
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

export default function Dashboard() {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeForm, setActiveForm] = useState<"client" | "visit" | "request" | "quote" | "job" | "invoice" | "payment" | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "team" | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch or initialize user role
    const userRef = doc(db, "users", user.uid);
    const unsubUser = onSnapshot(userRef, async (snap) => {
      if (snap.exists()) {
        setUserRole(snap.data().role || "team");
      } else {
        // First time login - if it's the owner email, make admin
        const role = user.email === "apauloprod@gmail.com" ? "admin" : "team";
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: role,
          createdAt: serverTimestamp()
        });
        setUserRole(role);
      }
    });

    // Fetch recent activities
    const q = query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(10));
    const unsubActivities = onSnapshot(q, (snap) => {
      setActivities(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubUser();
      unsubActivities();
    };
  }, [user]);

  const menuItems = useMemo(() => {
    const baseItems = [
      { icon: LayoutDashboard, label: "Home", to: "/dashboard" },
      { icon: Calendar, label: "Schedule", to: "/dashboard/schedule" },
      { icon: CheckSquare, label: "Jobs", to: "/dashboard/jobs" },
      { icon: MessageSquare, label: "Messages", to: "/dashboard/messages" },
    ];

    if (userRole === "admin") {
      return [
        ...baseItems,
        { icon: Users, label: "Clients", to: "/dashboard/clients" },
        { icon: FileText, label: "Requests", to: "/dashboard/requests" },
        { icon: FileText, label: "Quotes", to: "/dashboard/quotes" },
        { icon: FileText, label: "Invoices", to: "/dashboard/invoices" },
        { icon: CreditCard, label: "Payments", to: "/dashboard/payments" },
        { icon: Sparkles, label: "Marketing", to: "/dashboard/marketing" },
      ];
    }

    return baseItems;
  }, [userRole]);

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
      <div className="hidden lg:block">
        <Sidebar 
          createDialogOpen={createDialogOpen}
          setCreateDialogOpen={setCreateDialogOpen}
          activeForm={activeForm}
          setActiveForm={setActiveForm}
          menuItems={menuItems}
          location={location}
          user={user}
          logout={logout}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
