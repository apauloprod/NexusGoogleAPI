import React, { useState, useEffect, useContext } from "react";
import { 
  Plus, 
  Clock,
  Calendar,
  User as UserIcon,
  ArrowUpRight,
  Play,
  Square,
  History,
  CheckCircle2,
  AlertCircle,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db, auth, handleFirestoreError, OperationType } from "../../firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  Timestamp,
  getDoc
} from "firebase/firestore";
import { AuthContext } from "../../App";
import { format, differenceInMinutes } from "date-fns";

const Timesheets = () => {
  const { user } = useContext(AuthContext);
  const [entries, setEntries] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState<number>(0);

  useEffect(() => {
    if (!user) return;

    // Get user role and hourly rate
    const unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserRole(data.role);
        setHourlyRate(data.hourlyRate || 0);
      }
    });

    // Get timesheets
    let q = query(collection(db, "timesheets"), orderBy("startTime", "desc"));
    
    // If not admin, only see own timesheets
    // Note: We'll handle filtering in the rules, but also in the query for better UX
    // However, if we want admin to see ALL, we need to check role first.
    // Since we don't know role immediately, we'll subscribe to all if admin, or filtered if team.
    
    const unsubTimesheets = onSnapshot(doc(db, "users", user.uid), (userSnap) => {
      const role = userSnap.data()?.role;
      let finalQuery = query(collection(db, "timesheets"), orderBy("startTime", "desc"));
      
      if (role !== 'admin') {
        finalQuery = query(
          collection(db, "timesheets"), 
          where("userId", "==", user.uid),
          orderBy("startTime", "desc")
        );
      }

      const unsub = onSnapshot(finalQuery, (snap) => {
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setEntries(docs);
        setActiveEntry(docs.find((d: any) => d.status === 'active'));
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, "timesheets");
      });

      return unsub;
    });

    return () => {
      unsubUser();
      unsubTimesheets();
    };
  }, [user]);

  const handleClockIn = async () => {
    if (!user) return;
    try {
      await addDoc(collection(db, "timesheets"), {
        userId: user.uid,
        userName: user.displayName,
        startTime: serverTimestamp(),
        status: "active",
        submissionStatus: "draft",
        rate: hourlyRate
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "timesheets");
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;
    try {
      const endTime = new Date();
      const startTime = activeEntry.startTime.toDate();
      const durationMinutes = differenceInMinutes(endTime, startTime);
      const totalCost = (durationMinutes / 60) * (activeEntry.rate || hourlyRate);

      await updateDoc(doc(db, "timesheets", activeEntry.id), {
        endTime: Timestamp.fromDate(endTime),
        duration: durationMinutes,
        totalCost: totalCost,
        status: "completed"
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "timesheets");
    }
  };

  const handleSubmit = async (id: string, type: 'daily' | 'weekly') => {
    try {
      await updateDoc(doc(db, "timesheets", id), {
        submissionStatus: "submitted",
        submissionType: type
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "timesheets");
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, "timesheets", id), {
        submissionStatus: "approved"
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "timesheets");
    }
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  if (loading) return <div className="p-8">Loading timesheets...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Timesheets</h1>
          <p className="text-muted-foreground">
            {userRole === 'admin' 
              ? "Manage team hours and approve labor costs." 
              : "Track your work hours and submit for approval."}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            onClick={activeEntry ? handleClockOut : handleClockIn}
            className={`rounded-xl px-8 h-12 font-bold gap-2 transition-all duration-300 ${
              activeEntry 
                ? "bg-destructive text-white hover:bg-destructive/90 shadow-[0_0_20px_rgba(239,68,68,0.2)]" 
                : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            }`}
          >
            {activeEntry ? (
              <><Square className="h-4 w-4" /> Clock Out</>
            ) : (
              <><Play className="h-4 w-4" /> Clock In</>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Recent Entries</h2>
            <div className="flex gap-2">
               {userRole === 'admin' && (
                 <Badge variant="outline" className="bg-white/5 border-white/10">Admin View</Badge>
               )}
            </div>
          </div>
          
          {entries.length === 0 ? (
            <div className="glass p-12 rounded-3xl border-white/5 text-center text-muted-foreground">
              No timesheet entries found.
            </div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="p-6 rounded-2xl glass border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                <div className="flex items-center gap-6">
                  <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <UserIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-lg">{entry.userName}</h3>
                      {entry.status === 'active' && (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 animate-pulse">
                          Live
                        </Badge>
                      )}
                      <Badge variant="outline" className={`
                        ${entry.submissionStatus === 'approved' ? 'text-emerald-500 border-emerald-500/20' : 
                          entry.submissionStatus === 'submitted' ? 'text-blue-400 border-blue-400/20' : 
                          'text-muted-foreground border-white/10'}
                      `}>
                        {entry.submissionStatus}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {entry.startTime?.toDate() ? format(entry.startTime.toDate(), "MMM d, yyyy HH:mm") : "..."}
                      {entry.endTime && ` - ${format(entry.endTime.toDate(), "HH:mm")}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">
                      {entry.duration ? formatDuration(entry.duration) : "Running..."}
                    </p>
                    {userRole === 'admin' && entry.totalCost && (
                      <p className="text-xs text-emerald-400 font-bold mt-1">
                        ${entry.totalCost.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {userRole === 'team' && entry.status === 'completed' && entry.submissionStatus === 'draft' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleSubmit(entry.id, 'daily')} className="text-xs h-8">Daily</Button>
                        <Button size="sm" variant="outline" onClick={() => handleSubmit(entry.id, 'weekly')} className="text-xs h-8">Weekly</Button>
                      </div>
                    )}
                    {userRole === 'admin' && entry.submissionStatus === 'submitted' && (
                      <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white h-8" onClick={() => handleApprove(entry.id)}>
                        Approve
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold">Summary</h2>
          <div className="glass p-6 rounded-3xl border-white/5 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium">Total Hours (MTD)</span>
              </div>
              <span className="font-bold">
                {formatDuration(entries.reduce((sum, e) => sum + (e.duration || 0), 0))}
              </span>
            </div>
            {userRole === 'admin' && (
              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total Labor Cost</span>
                  <span className="text-lg font-bold text-emerald-400">
                    ${entries.reduce((sum, e) => sum + (e.totalCost || 0), 0).toFixed(2)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">Calculated based on individual team member hourly rates.</p>
              </div>
            )}
            <Button variant="outline" className="w-full border-white/10 hover:bg-white/5 rounded-xl">
              Export Report
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timesheets;
