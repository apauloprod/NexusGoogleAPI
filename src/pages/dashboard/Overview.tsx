import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { 
  MessageSquare, 
  CheckSquare, 
  FileText, 
  CreditCard,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Users
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, where, Timestamp, orderBy } from "firebase/firestore";
import { AuthContext } from "../../App";

export default function Overview() {
  const { user, currentUserData, impersonatedUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    pendingRequests: 0,
    activeJobs: 0,
    unpaidInvoices: 0,
    revenueMTD: 0,
    projectedRevenueMTD: 0
  });
  const [loading, setLoading] = useState(true);

  const ensureDate = (val: any) => {
    if (!val) return null;
    if (val.toDate && typeof val.toDate === 'function') return val.toDate();
    if (val instanceof Date) return val;
    if (typeof val === 'string' || typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  useEffect(() => {
    if (!user || (!currentUserData?.businessId && !impersonatedUser?.businessId)) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Listen to requests
    const qRequests = query(collection(db, "requests"), where("businessId", "==", businessId));
    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      const pending = snapshot.docs.filter(doc => doc.data().status === "pending").length;
      setStats(prev => ({ ...prev, pendingRequests: pending }));
    });

    // Listen to jobs for active count and projected revenue
    const qJobs = query(collection(db, "jobs"), where("businessId", "==", businessId));
    const unsubJobs = onSnapshot(qJobs, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      const active = docs.filter(job => job.status === "active").length;
      
      const projected = docs
        .filter(job => {
          if (job.status === "cancelled") return false;
          const createdAt = ensureDate(job.createdAt);
          return createdAt && createdAt >= firstDayOfMonth;
        })
        .reduce((sum, job) => sum + (job.total || 0), 0);

      setStats(prev => ({ ...prev, activeJobs: active, projectedRevenueMTD: projected }));
      setLoading(false);
    });

    // Listen to invoices for actual revenue and unpaid
    const qInvoices = query(collection(db, "invoices"), where("businessId", "==", businessId));
    const unsubInvoices = onSnapshot(qInvoices, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      const unpaid = docs.filter(doc => doc.status !== "paid").length;
      
      // Actual Revenue: Paid invoices
      const revenue = docs.reduce((sum, inv) => {
        // use paidAmount, or sum totals of paid invoices
        // If it's a paid or partially paid invoice, we add the paidAmount.
        return sum + (Number(inv.paidAmount) || 0);
      }, 0);

      setStats(prev => ({ ...prev, unpaidInvoices: unpaid, revenueMTD: revenue }));
    });

    return () => {
      unsubRequests();
      unsubJobs();
      unsubInvoices();
    };
  }, [user, currentUserData?.businessId, impersonatedUser?.businessId]);

  const role = impersonatedUser?.role || currentUserData?.role || 'team';
  const isAdmin = role === 'admin' || role === 'super-admin';
  const isManager = role === 'manager';
  const isManagerOrAdmin = isAdmin || isManager;

  const statCards = [
    { 
      label: "Pending Requests", 
      value: stats.pendingRequests.toString(), 
      icon: MessageSquare, 
      color: "text-blue-400",
      path: "/dashboard/requests",
      adminOnly: true
    },
    { 
      label: "Actual Revenue (ytd)", 
      value: `$${stats.revenueMTD.toLocaleString()}`, 
      icon: CreditCard, 
      color: "text-purple-400",
      path: "/dashboard/payments",
      adminOnly: true
    },
    { 
      label: "Unpaid Invoices", 
      value: stats.unpaidInvoices.toString(), 
      icon: TrendingUp, 
      color: "text-amber-400",
      path: "/dashboard/invoices",
      adminOnly: true
    },
    { 
      label: "Active Jobs", 
      value: stats.activeJobs.toString(), 
      icon: CheckSquare, 
      color: "text-emerald-400",
      path: "/dashboard/jobs",
      adminOnly: false
    },
  ].filter(card => !card.adminOnly || isManagerOrAdmin);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Welcome back, {impersonatedUser?.displayName || currentUserData?.displayName || "User"}</h1>
          <p className="text-muted-foreground">{isManagerOrAdmin ? "Here's what's happening with your business today." : "Here's your schedule and ongoing work overview."}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground glass px-4 py-2 rounded-xl border-white/5">
          <Clock className="h-4 w-4" />
          <span>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {statCards.map((stat, i) => (
          <button 
            key={i} 
            onClick={() => navigate(stat.path)}
            className="p-6 rounded-2xl glass border-white/5 hover:border-white/20 hover:bg-white/5 transition-all text-left group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +12%
              </span>
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-3xl font-bold tracking-tight">{loading ? "..." : stat.value}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {isManagerOrAdmin ? (
            <div className="p-8 rounded-[2rem] glass border-white/5 relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-2">Business Growth</h3>
                <p className="text-muted-foreground mb-8 text-sm">Your revenue is up 15% compared to last month.</p>
                <div className="h-64 flex items-end gap-2">
                  {[40, 60, 45, 90, 65, 80, 100].map((height, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                      <div 
                        className="w-full bg-gradient-to-t from-white/5 to-white/20 rounded-t-lg transition-all duration-500 group-hover:to-white/40" 
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Day {i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 bg-white/5 rounded-full blur-3xl" />
            </div>
          ) : (
            <div className="p-8 rounded-[2rem] glass border-white/5">
              <h3 className="text-xl font-bold mb-4">Your Recent Activity</h3>
              <p className="text-muted-foreground text-sm">Stay on top of your assigned tasks and updates.</p>
              {/* Could add a list of recently updated jobs for the user here */}
              <div className="mt-8 h-48 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center opacity-50">
                <Clock className="h-8 w-8 mb-4" />
                <p className="text-sm">Activity feed coming soon</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-2xl glass border-white/5">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={() => navigate("/dashboard/schedule")}
                className="w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left text-sm font-medium flex items-center justify-between group"
              >
                View Schedule
                <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all" />
              </button>
              {isManagerOrAdmin && (
                <>
                  <button 
                    onClick={() => navigate("/dashboard/clients")}
                    className="w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left text-sm font-medium flex items-center justify-between group"
                  >
                    Manage Clients
                    <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                  <button 
                    onClick={() => navigate("/dashboard/marketing")}
                    className="w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left text-sm font-medium flex items-center justify-between group"
                  >
                    AI Marketing
                    <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white relative overflow-hidden group">
            <div className="relative z-10">
              <h3 className="font-bold mb-1">Pro Tip</h3>
              <p className="text-xs opacity-90 leading-relaxed">
                Use the AI Marketing tool to generate montages of your completed jobs and share them on social media to attract more clients.
              </p>
              <button 
                onClick={() => navigate("/dashboard/marketing")}
                className="mt-4 text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                Try it now
              </button>
            </div>
            <Sparkles className="absolute bottom-[-10px] right-[-10px] h-24 w-24 opacity-20 rotate-12 group-hover:rotate-0 transition-transform duration-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

const Sparkles = ({ className }: { className?: string }) => (
  <svg 
    className={className}
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);
