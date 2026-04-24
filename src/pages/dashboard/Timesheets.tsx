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
  DollarSign,
  Trash2,
  Edit2
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
  getDoc,
  deleteDoc
} from "firebase/firestore";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuthContext } from "../../App";
import { format, differenceInMinutes, addDays, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";

const Timesheets = () => {
  const { user, currentUserData, impersonatedUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [entries, setEntries] = useState<any[]>([]);
  // ... rest of state
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [manualEntry, setManualEntry] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    duration: 0,
    startTime: "09:00",
    endTime: "17:00",
    useTimes: true,
    type: "daily", // daily or weekly
    weeklyEntries: [
      { day: "Monday", duration: 0, startTime: "09:00", endTime: "17:00", active: true },
      { day: "Tuesday", duration: 0, startTime: "09:00", endTime: "17:00", active: true },
      { day: "Wednesday", duration: 0, startTime: "09:00", endTime: "17:00", active: true },
      { day: "Thursday", duration: 0, startTime: "09:00", endTime: "17:00", active: true },
      { day: "Friday", duration: 0, startTime: "09:00", endTime: "17:00", active: true },
      { day: "Saturday", duration: 0, startTime: "09:00", endTime: "17:00", active: false },
      { day: "Sunday", duration: 0, startTime: "09:00", endTime: "17:00", active: false },
    ],
    notes: "",
    userId: ""
  });

  const role = (impersonatedUser?.role || currentUserData?.role || 'team') as "admin" | "manager" | "team" | "super-admin";
  const isManagerOrAdmin = role === 'admin' || role === 'manager' || role === 'super-admin';
  
  const permissions = impersonatedUser?.permissions || currentUserData?.permissions || {};
  const hasAccess = isManagerOrAdmin || permissions.page_timesheets;

  useEffect(() => {
    if (!hasAccess && currentUserData && !loading) {
      navigate("/dashboard");
    }
  }, [hasAccess, navigate, currentUserData, loading]);

  useEffect(() => {
    if (!user || (!currentUserData?.businessId && !impersonatedUser?.businessId)) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;
    const targetUid = impersonatedUser?.uid || user.uid;

    setUserRole(role);
    setHourlyRate(currentUserData.hourlyRate || 0);

    // Fetch team members for this business
    if (role === 'admin' || role === 'manager' || role === 'super-admin') {
      const qTeam = query(
        collection(db, "users"), 
        where("businessId", "==", businessId),
        where("email", "!=", "apauloprod@gmail.com")
      );
      onSnapshot(qTeam, (teamSnap) => {
        setTeamMembers(teamSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    // Get timesheets for this business
    let finalQuery = query(
      collection(db, "timesheets"), 
      where("businessId", "==", businessId),
      orderBy("startTime", "desc")
    );
    
    if (role === 'team') {
      finalQuery = query(
        collection(db, "timesheets"), 
        where("businessId", "==", businessId),
        where("userId", "==", targetUid),
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

    return () => unsub();
  }, [user, currentUserData, impersonatedUser]);

  const handleClockIn = async () => {
    if (!user || (!currentUserData?.businessId && !impersonatedUser?.businessId)) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;
    const targetUid = impersonatedUser?.uid || user.uid;
    const targetName = impersonatedUser?.displayName || user.displayName;

    try {
      await addDoc(collection(db, "timesheets"), {
        userId: targetUid,
        userName: targetName,
        businessId: businessId,
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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this timesheet entry?")) return;
    try {
      await deleteDoc(doc(db, "timesheets", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "timesheets");
    }
  };

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setManualEntry({
      date: format(entry.startTime.toDate(), "yyyy-MM-dd"),
      duration: entry.duration || 0,
      startTime: format(entry.startTime.toDate(), "HH:mm"),
      endTime: entry.endTime ? format(entry.endTime.toDate(), "HH:mm") : format(new Date(), "HH:mm"),
      useTimes: !!entry.endTime,
      type: "daily",
      weeklyEntries: [],
      notes: entry.notes || "",
      userId: entry.userId
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingEntry) return;
    try {
      let finalDuration = manualEntry.duration;
      let finalStart = new Date(manualEntry.date + "T" + manualEntry.startTime);
      let finalEnd = new Date(manualEntry.date + "T" + manualEntry.endTime);

      if (manualEntry.useTimes) {
        finalDuration = differenceInMinutes(finalEnd, finalStart);
      } else {
        finalStart = new Date(manualEntry.date + "T09:00:00");
        finalEnd = new Date(finalStart.getTime() + manualEntry.duration * 60 * 1000);
      }

      const rate = editingEntry.rate || hourlyRate;
      const totalCost = (finalDuration / 60) * rate;

      await updateDoc(doc(db, "timesheets", editingEntry.id), {
        startTime: Timestamp.fromDate(finalStart),
        endTime: Timestamp.fromDate(finalEnd),
        duration: finalDuration,
        totalCost,
        notes: manualEntry.notes,
        updatedAt: serverTimestamp()
      });

      setIsEditDialogOpen(false);
      setEditingEntry(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "timesheets");
    }
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const handleManualSubmit = async () => {
    if (!user || (!currentUserData?.businessId && !impersonatedUser?.businessId)) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;
    try {
      const isPrivileged = userRole === 'admin' || userRole === 'manager' || userRole === 'super-admin';
      const targetUserId = (isPrivileged && manualEntry.userId) ? manualEntry.userId : (impersonatedUser?.uid || user.uid);
      const targetUserDoc = await getDoc(doc(db, "users", targetUserId));
      const targetUserData = targetUserDoc.exists() ? targetUserDoc.data() : {};
      const rate = targetUserData.hourlyRate || 0;

      if (manualEntry.type === 'daily') {
        let finalDuration = manualEntry.duration;
        let finalStart = new Date(manualEntry.date + "T" + manualEntry.startTime);
        let finalEnd = new Date(manualEntry.date + "T" + manualEntry.endTime);

        if (manualEntry.useTimes) {
          finalDuration = differenceInMinutes(finalEnd, finalStart);
        } else {
          // If just duration, assume 9 AM start
          finalStart = new Date(manualEntry.date + "T09:00:00");
          finalEnd = new Date(finalStart.getTime() + manualEntry.duration * 60 * 1000);
        }

        const totalCost = (finalDuration / 60) * rate;

        await addDoc(collection(db, "timesheets"), {
          userId: targetUserId,
          userName: targetUserData.displayName || targetUserData.email || "Unknown",
          businessId: businessId,
          startTime: Timestamp.fromDate(finalStart),
          endTime: Timestamp.fromDate(finalEnd),
          duration: finalDuration,
          totalCost,
          submissionStatus: 'submitted',
          submissionType: 'daily',
          notes: manualEntry.notes,
          status: 'completed',
          rate: rate,
          createdAt: serverTimestamp()
        });
      }
 else {
        // Weekly
        const baseDate = parseISO(manualEntry.date);
        for (let i = 0; i < 7; i++) {
          const dayEntry = manualEntry.weeklyEntries[i];
          if (!dayEntry.active) continue;
          
          const actualDate = addDays(baseDate, i);
          const dateStr = format(actualDate, "yyyy-MM-dd");
          
          let dayDuration = dayEntry.duration;
          let dayStart = new Date(dateStr + "T" + dayEntry.startTime);
          let dayEnd = new Date(dateStr + "T" + dayEntry.endTime);

          if (manualEntry.useTimes) {
            dayDuration = differenceInMinutes(dayEnd, dayStart);
          } else {
            dayStart = new Date(dateStr + "T09:00:00");
            dayEnd = new Date(dayStart.getTime() + dayEntry.duration * 60 * 1000);
          }

          if (dayDuration <= 0) continue;

          const totalCost = (dayDuration / 60) * rate;

          await addDoc(collection(db, "timesheets"), {
            userId: targetUserId,
            userName: targetUserData.displayName || targetUserData.email || "Unknown",
            businessId: businessId,
            startTime: Timestamp.fromDate(dayStart),
            endTime: Timestamp.fromDate(dayEnd),
            duration: dayDuration,
            totalCost,
            submissionStatus: 'submitted',
            submissionType: 'weekly',
            notes: manualEntry.notes,
            status: 'completed',
            rate: rate,
            createdAt: serverTimestamp()
          });
        }
      }

      setIsManualDialogOpen(false);
      setManualEntry({
        date: format(new Date(), "yyyy-MM-dd"),
        duration: 0,
        startTime: "09:00",
        endTime: "17:00",
        useTimes: true,
        type: "daily",
        weeklyEntries: [
          { day: "Monday", duration: 0, startTime: "09:00", endTime: "17:00", active: true },
          { day: "Tuesday", duration: 0, startTime: "09:00", endTime: "17:00", active: true },
          { day: "Wednesday", duration: 0, startTime: "09:00", endTime: "17:00", active: true },
          { day: "Thursday", duration: 0, startTime: "09:00", endTime: "17:00", active: true },
          { day: "Friday", duration: 0, startTime: "09:00", endTime: "17:00", active: true },
          { day: "Saturday", duration: 0, startTime: "09:00", endTime: "17:00", active: false },
          { day: "Sunday", duration: 0, startTime: "09:00", endTime: "17:00", active: false },
        ],
        notes: "",
        userId: ""
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "timesheets");
    }
  };

  if (loading) return <div className="p-8">Loading timesheets...</div>;

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter text-white flex items-center gap-3">
            <Clock className="h-10 w-10 text-blue-500" />
            Timesheets
          </h1>
          <p className="text-muted-foreground mt-1">
            {(userRole === 'admin' || userRole === 'super-admin') 
              ? "Manage team hours and approve labor costs." 
              : "Track your work hours and submit for approval."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isManagerOrAdmin && (
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-emerald-500 hover:bg-emerald-600 font-bold gap-2 text-white border-transparent">
                  <DollarSign className="h-4 w-4" />
                  Run Payroll
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-black border-white/10 text-white rounded-[2rem] sm:max-w-[700px] max-h-[90vh] overflow-y-auto custom-scrollbar">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold tracking-tighter">Run Payroll</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 pt-4">
                  <p className="text-sm text-muted-foreground">Select unpaid timesheets to mark as paid. Ensure you have transferred the funds to their respective payment methods.</p>
                  
                  {teamMembers.map(member => {
                    const memberEntries = entries.filter(e => e.userId === member.id && !e.paid && e.status !== "active");
                    if (memberEntries.length === 0) return null;
                    
                    const totalDuration = memberEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
                    const totalHours = totalDuration / 60;
                    const amountOwed = totalHours * (member.hourlyRate || 0);

                    return (
                        <div key={member.id} className="p-4 rounded-2xl bg-white/5 border border-white/5">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg">{member.displayName || member.email}</h3>
                                    <p className="text-xs text-muted-foreground">Rate: ${member.hourlyRate || 0}/hr</p>
                                    <p className="text-xs text-muted-foreground">Payment Info: {member.paymentEmail || member.paymentNotes || 'Not set'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-xl text-emerald-400">${amountOwed.toFixed(2)}</p>
                                    <p className="text-xs text-muted-foreground">{totalHours.toFixed(1)} hrs total</p>
                                </div>
                            </div>
                            <div className="space-y-2 mb-4">
                                {memberEntries.map(entry => (
                                    <div key={entry.id} className="flex justify-between text-xs p-2 bg-black/40 rounded-lg">
                                        <span>{format(typeof entry.startTime === "string" ? parseISO(entry.startTime) : entry.startTime?.toDate() || new Date(), "MMM d, yyyy")}</span>
                                        <span>{(entry.duration / 60).toFixed(1)} hrs</span>
                                    </div>
                                ))}
                            </div>
                            <Button 
                                onClick={async () => {
                                    try {
                                        for (const entry of memberEntries) {
                                            await updateDoc(doc(db, "timesheets", entry.id), { paid: true });
                                        }
                                        
                                        const businessId = impersonatedUser?.businessId || currentUserData?.businessId;
                                        
                                        // Create expense record
                                        await addDoc(collection(db, "expenses"), {
                                          businessId: businessId,
                                          date: serverTimestamp(),
                                          category: "Payroll",
                                          description: `Payroll for ${member.displayName || member.email} (${totalHours.toFixed(1)} hrs)`,
                                          amount: amountOwed,
                                          vendor: member.displayName || member.email,
                                          status: "paid",
                                          receiptUrl: "",
                                          createdAt: serverTimestamp()
                                        });

                                        alert("Timesheets marked as paid for " + (member.displayName || member.email));
                                    } catch (err) {
                                        console.error(err);
                                    }
                                }} 
                                className="w-full bg-white text-black font-bold"
                            >
                                Mark {memberEntries.length} Entries as Paid
                            </Button>
                        </div>
                    );
                  })}
                  {entries.filter(e => !e.paid && e.status !== "active" && teamMembers.find(m => m.id === e.userId)).length === 0 && (
                      <div className="text-center p-8 text-muted-foreground">No unpaid timesheets to process.</div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="glass border-white/10 gap-2">
                <Plus className="h-4 w-4" />
                Manual Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black border-white/10 text-white rounded-[2rem] sm:max-w-[500px] max-h-[90vh] overflow-y-auto custom-scrollbar">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold tracking-tighter">Manual Timesheet Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {(userRole === 'admin' || userRole === 'manager' || userRole === 'super-admin') && (
                  <div className="space-y-2">
                    <Label>Team Member</Label>
                    <Select value={manualEntry.userId} onValueChange={(v) => setManualEntry({...manualEntry, userId: v})}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                      <SelectContent className="bg-black border-white/10">
                        {teamMembers.map(member => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.displayName || member.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>Entry Type</Label>
                    <Select value={manualEntry.type} onValueChange={(v) => setManualEntry({...manualEntry, type: v as any})}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-black border-white/10">
                        <SelectItem value="daily">Daily Entry</SelectItem>
                        <SelectItem value="weekly">Weekly Entry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>Input Mode</Label>
                    <Select value={manualEntry.useTimes ? "times" : "duration"} onValueChange={(v) => setManualEntry({...manualEntry, useTimes: v === "times"})}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-black border-white/10">
                        <SelectItem value="times">Start & End Time</SelectItem>
                        <SelectItem value="duration">Just Duration</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{manualEntry.type === 'weekly' ? 'Week Starting Date' : 'Date'}</Label>
                  <Input 
                    type="date" 
                    value={manualEntry.date} 
                    onChange={(e) => setManualEntry({...manualEntry, date: e.target.value})}
                    className="bg-white/5 border-white/10"
                  />
                </div>

                {manualEntry.type === 'daily' ? (
                  <div className="space-y-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                    {manualEntry.useTimes ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Start Time</Label>
                          <Input 
                            type="time" 
                            value={manualEntry.startTime}
                            onChange={(e) => setManualEntry({...manualEntry, startTime: e.target.value})}
                            className="bg-white/5 border-white/10"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>End Time</Label>
                          <Input 
                            type="time" 
                            value={manualEntry.endTime}
                            onChange={(e) => setManualEntry({...manualEntry, endTime: e.target.value})}
                            className="bg-white/5 border-white/10"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Duration (Hours:Minutes)</Label>
                        <Input 
                          type="time" 
                          step="60"
                          value={`${Math.floor(manualEntry.duration / 60).toString().padStart(2, '0')}:${(manualEntry.duration % 60).toString().padStart(2, '0')}`}
                          onChange={(e) => {
                            const [h, m] = e.target.value.split(':').map(Number);
                            setManualEntry({...manualEntry, duration: (h * 60) + m});
                          }}
                          className="bg-white/5 border-white/10"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Weekly Daily Breakdown</Label>
                    {manualEntry.weeklyEntries.map((day, idx) => (
                      <div key={day.day} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                        <input 
                          type="checkbox" 
                          checked={day.active} 
                          onChange={(e) => {
                            const newWeekly = [...manualEntry.weeklyEntries];
                            newWeekly[idx].active = e.target.checked;
                            setManualEntry({...manualEntry, weeklyEntries: newWeekly});
                          }}
                          className="h-4 w-4 rounded border-white/10 bg-black text-blue-500"
                        />
                        <span className="text-xs font-bold w-20">{day.day}</span>
                        {day.active && (
                          <div className="flex-1 flex gap-2">
                            {manualEntry.useTimes ? (
                              <>
                                <Input 
                                  type="time" 
                                  value={day.startTime}
                                  onChange={(e) => {
                                    const newWeekly = [...manualEntry.weeklyEntries];
                                    newWeekly[idx].startTime = e.target.value;
                                    setManualEntry({...manualEntry, weeklyEntries: newWeekly});
                                  }}
                                  className="h-7 bg-white/5 border-white/10 text-[10px] p-1"
                                />
                                <Input 
                                  type="time" 
                                  value={day.endTime}
                                  onChange={(e) => {
                                    const newWeekly = [...manualEntry.weeklyEntries];
                                    newWeekly[idx].endTime = e.target.value;
                                    setManualEntry({...manualEntry, weeklyEntries: newWeekly});
                                  }}
                                  className="h-7 bg-white/5 border-white/10 text-[10px] p-1"
                                />
                              </>
                            ) : (
                              <Input 
                                type="time" 
                                step="60"
                                value={`${Math.floor(day.duration / 60).toString().padStart(2, '0')}:${(day.duration % 60).toString().padStart(2, '0')}`}
                                onChange={(e) => {
                                  const [h, m] = e.target.value.split(':').map(Number);
                                  const newWeekly = [...manualEntry.weeklyEntries];
                                  newWeekly[idx].duration = (h * 60) + (m || 0);
                                  setManualEntry({...manualEntry, weeklyEntries: newWeekly});
                                }}
                                className="h-7 bg-white/5 border-white/10 text-[10px] p-1"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea 
                    value={manualEntry.notes}
                    onChange={(e) => setManualEntry({...manualEntry, notes: e.target.value})}
                    placeholder="Work description..."
                    className="bg-white/5 border-white/10 min-h-[60px]"
                  />
                </div>
                <Button onClick={handleManualSubmit} className="w-full h-12 bg-white text-black font-bold rounded-xl hover:bg-white/90">
                  Save Entries
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-black border-white/10 text-white rounded-[2rem] sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold tracking-tighter">Edit Timesheet Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label>Input Mode</Label>
                  <Select value={manualEntry.useTimes ? "times" : "duration"} onValueChange={(v) => setManualEntry({...manualEntry, useTimes: v === "times"})}>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-white/10">
                      <SelectItem value="times">Start & End Time</SelectItem>
                      <SelectItem value="duration">Just Duration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Input 
                  type="date" 
                  value={manualEntry.date} 
                  onChange={(e) => setManualEntry({...manualEntry, date: e.target.value})}
                  className="bg-white/5 border-white/10"
                />
              </div>

              <div className="space-y-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                {manualEntry.useTimes ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input 
                        type="time" 
                        value={manualEntry.startTime}
                        onChange={(e) => setManualEntry({...manualEntry, startTime: e.target.value})}
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input 
                        type="time" 
                        value={manualEntry.endTime}
                        onChange={(e) => setManualEntry({...manualEntry, endTime: e.target.value})}
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Duration (Hours:Minutes)</Label>
                    <Input 
                      type="time" 
                      step="60"
                      value={`${Math.floor(manualEntry.duration / 60).toString().padStart(2, '0')}:${(manualEntry.duration % 60).toString().padStart(2, '0')}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(':').map(Number);
                        setManualEntry({...manualEntry, duration: (h * 60) + m});
                      }}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea 
                  value={manualEntry.notes}
                  onChange={(e) => setManualEntry({...manualEntry, notes: e.target.value})}
                  placeholder="Work description..."
                  className="bg-white/5 border-white/10 min-h-[60px]"
                />
              </div>
              <Button onClick={handleUpdate} className="w-full h-12 bg-white text-black font-bold rounded-xl hover:bg-white/90">
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Recent Entries</h2>
            <div className="flex gap-2">
               {(userRole === 'admin' || userRole === 'super-admin') && (
                 <Badge variant="outline" className={`bg-white/5 border-white/10 ${userRole === 'super-admin' ? 'text-emerald-500' : ''}`}>
                   {userRole === 'super-admin' ? 'Super Admin View' : 'Admin View'}
                 </Badge>
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
                    {isManagerOrAdmin && entry.totalCost && (
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
                    {isManagerOrAdmin && entry.submissionStatus === 'submitted' && (
                      <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white h-8" onClick={() => handleApprove(entry.id)}>
                        Approve
                      </Button>
                    )}
                    {(isManagerOrAdmin || (entry.userId === (impersonatedUser?.uid || user?.uid) && entry.submissionStatus !== 'approved')) && (
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-muted-foreground hover:text-white h-8 w-8 p-0" 
                          onClick={() => handleEdit(entry)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-muted-foreground hover:text-destructive h-8 w-8 p-0" 
                          onClick={() => handleDelete(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
            {isManagerOrAdmin && (
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
