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
  MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";

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

export default function Dashboard() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const menuItems = [
    { icon: LayoutDashboard, label: "Home", to: "/dashboard" },
    { icon: Calendar, label: "Schedule", to: "/dashboard/schedule" },
    { icon: Users, label: "Clients", to: "/dashboard/clients" },
    { icon: FileText, label: "Requests", to: "/dashboard/requests" },
    { icon: MessageSquare, label: "Messages", to: "/dashboard/messages" },
    { icon: FileText, label: "Quotes", to: "/dashboard/quotes" },
    { icon: CheckSquare, label: "Jobs", to: "/dashboard/jobs" },
    { icon: FileText, label: "Invoices", to: "/dashboard/invoices" },
    { icon: CreditCard, label: "Payments", to: "/dashboard/payments" },
  ];

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-black border-r border-white/5 w-64">
      <div className="p-6 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center">
          <div className="h-4 w-4 bg-black rounded-sm" />
        </div>
        <span className="text-xl font-bold tracking-tighter text-white">NEXUS</span>
      </div>

      <div className="px-4 mb-6">
        <Button className="w-full bg-white text-black hover:bg-white/90 rounded-xl h-11 gap-2 font-bold">
          <Plus className="h-5 w-5" />
          Create New
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1">
          {menuItems.map((item) => (
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
        <div className="flex items-center gap-3 px-2">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/10" />
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold text-white truncate">Business Owner</p>
            <p className="text-xs text-muted-foreground truncate">owner@nexus.com</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
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
                <Sidebar />
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
              <span className="text-sm font-medium text-muted-foreground">08:45 AM</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto bg-[#050505]">
          <Routes>
            <Route path="/" element={<div className="p-8">
              <h1 className="text-3xl font-bold tracking-tighter mb-8">Welcome back, Owner</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Pending Requests", value: "12", icon: MessageSquare },
                  { label: "Active Jobs", value: "24", icon: CheckSquare },
                  { label: "Unpaid Invoices", value: "8", icon: FileText },
                  { label: "Revenue (MTD)", value: "$12,450", icon: CreditCard },
                ].map((stat, i) => (
                  <div key={i} className="p-6 rounded-2xl glass border-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <stat.icon className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs font-bold text-primary">+12%</span>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>} />
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
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Job #1204 marked complete</p>
                <p className="text-xs text-muted-foreground mt-1">2 hours ago • by John Doe</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
