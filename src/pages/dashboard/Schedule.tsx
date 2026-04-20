import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  CalendarDays,
  History,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType, auth } from "../../firebase";
import { collection, onSnapshot, query, orderBy, where, doc, deleteDoc, limit } from "firebase/firestore";

import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VisitForm } from "../../components/forms/VisitForm";
import { JobForm } from "../../components/forms/JobForm";
import { cn } from "@/lib/utils";
import { AuthContext } from "../../App";
import { useContext } from "react";

import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addDays, subDays, addWeeks, addMonths, startOfWeek, endOfWeek } from "date-fns";

const Schedule = () => {
  const { user, impersonatedUser, currentUserData } = useContext(AuthContext);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'timeline'>('calendar');
  const [scheduleData, setScheduleData] = useState<{ visits: any[], jobs: any[] }>({ visits: [], jobs: [] });

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      const collectionName = itemToDelete.type === 'job' ? 'jobs' : 'visits';
      await deleteDoc(doc(db, collectionName, itemToDelete.id));
      setItemToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, itemToDelete.type === 'job' ? 'jobs' : 'visits');
    }
  };

  useEffect(() => {
    if (!user || (!currentUserData?.businessId && !impersonatedUser?.businessId)) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    const visitsQuery = query(
      collection(db, "visits"), 
      where("businessId", "==", businessId),
      orderBy("scheduledAt", "asc")
    );
    const jobsQuery = query(
      collection(db, "jobs"), 
      where("businessId", "==", businessId),
      where("status", "==", "active"),
      orderBy("scheduledAt", "asc")
    );

    const unsubscribeVisits = onSnapshot(visitsQuery, (snapshot) => {
      const visitsData = snapshot.docs.map(doc => ({ id: doc.id, type: 'visit', ...doc.data() }));
      updateSchedule(visitsData, 'visits');
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "visits");
    });

    const unsubscribeJobs = onSnapshot(jobsQuery, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({ id: doc.id, type: 'job', ...doc.data() }));
      updateSchedule(jobsData, 'jobs');
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "jobs");
    });

    return () => {
      unsubscribeVisits();
      unsubscribeJobs();
    };
  }, [user, currentUserData?.businessId, impersonatedUser?.businessId]);

  const updateSchedule = (data: any[], type: 'visits' | 'jobs') => {
    setScheduleData(prev => {
      const newData = { ...prev, [type]: data };
      const merged = [...newData.visits, ...newData.jobs]
        .filter(item => item.scheduledAt)
        .sort((a, b) => a.scheduledAt.toDate() - b.scheduledAt.toDate());
      setVisits(merged);
      setLoading(false);
      return newData;
    });
  };

  const handlePrev = () => {
    if (viewMode === 'timeline') {
      setCurrentDate(prev => addWeeks(prev, -1));
    } else {
      setCurrentDate(prev => startOfMonth(addMonths(prev, -1)));
    }
  };

  const handleNext = () => {
    if (viewMode === 'timeline') {
      setCurrentDate(prev => addWeeks(prev, 1));
    } else {
      setCurrentDate(prev => startOfMonth(addMonths(prev, 1)));
    }
  };

  const filteredVisits = visits.filter(item => {
    if (!item.scheduledAt) return false;
    const date = item.scheduledAt.toDate();
    
    let isVisible = false;
    if (viewMode === 'timeline') {
      const sw = startOfWeek(currentDate, { weekStartsOn: 1 });
      const ew = endOfWeek(currentDate, { weekStartsOn: 1 });
      isVisible = date >= sw && date <= ew;
    } else {
      isVisible = date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
    }
    
    // Privacy Logic:
    const role = impersonatedUser?.role || currentUserData?.role || 'team';
    const visibility = currentUserData?.jobVisibility || 'all';
    const currentUserId = impersonatedUser?.uid || user?.uid;

    if (role !== 'admin' && role !== 'manager' && visibility === 'own') {
      if (item.type === 'job') {
        return isVisible && (item.assignedTeam || []).includes(currentUserId);
      }
      return isVisible; 
    }

    return isVisible;
  });

  const visibleDays = viewMode === 'timeline'
    ? eachDayOfInterval({ 
        start: startOfWeek(currentDate, { weekStartsOn: 1 }), 
        end: endOfWeek(currentDate, { weekStartsOn: 1 }) 
      })
    : eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });

  const groupedVisits = filteredVisits.reduce((acc, item) => {
    if (!item.scheduledAt) return acc;
    const dateStr = item.scheduledAt.toDate().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Schedule</h1>
          <p className="text-muted-foreground">View and manage your team's daily schedule and visits.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white/5 rounded-xl border border-white/10 p-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("rounded-lg px-3", viewMode === 'list' && "bg-white/10")}
              onClick={() => setViewMode('list')}
            >
              <LayoutList className="h-4 w-4 mr-2" />
              List
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("rounded-lg px-3", viewMode === 'calendar' && "bg-white/10")}
              onClick={() => setViewMode('calendar')}
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              Calendar
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("rounded-lg px-3", viewMode === 'timeline' && "bg-white/10")}
              onClick={() => setViewMode('timeline')}
            >
              <History className="h-4 w-4 mr-2" />
              Timeline
            </Button>
          </div>
          <div className="flex items-center bg-white/5 rounded-xl border border-white/10 p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handlePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-4 text-sm font-bold min-w-[140px] text-center">
              {viewMode === 'timeline' 
                ? `${format(startOfWeek(currentDate), "MMM d")} - ${format(endOfWeek(currentDate), "MMM d, yyyy")}`
                : format(currentDate, "MMMM yyyy")}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white text-black hover:bg-white/90 rounded-xl gap-2 font-bold">
                <Plus className="h-4 w-4" />
                New Visit
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black border-white/10 text-white sm:max-w-[700px] rounded-[2rem] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold tracking-tighter">Schedule New Visit</DialogTitle>
              </DialogHeader>
              <div className="pt-4">
                <VisitForm 
                  onSuccess={() => setIsAddDialogOpen(false)} 
                  onCancel={() => setIsAddDialogOpen(false)} 
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="bg-black border-white/10 text-white sm:max-w-[700px] rounded-[2rem] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tighter">
              Edit {editingItem?.type === 'job' ? 'Job' : 'Visit'}
            </DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            {editingItem?.type === 'job' ? (
              <JobForm 
                initialData={editingItem}
                onSuccess={() => setEditingItem(null)} 
                onCancel={() => setEditingItem(null)} 
              />
            ) : editingItem && (
              <VisitForm 
                initialData={{
                  ...editingItem,
                  scheduledAt: editingItem.scheduledAt?.toDate().toISOString() || ""
                }}
                onSuccess={() => setEditingItem(null)} 
                onCancel={() => setEditingItem(null)} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6">
        {loading ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground">Loading schedule...</div>
        ) : visits.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground glass rounded-2xl border-white/5">No items scheduled for this period.</div>
        ) : viewMode === 'calendar' ? (
          <div className="space-y-8">
            {Object.entries(groupedVisits).map(([dateStr, items]) => (
              <div key={dateStr} className="space-y-4">
                <h2 className="text-xl font-bold border-b border-white/10 pb-2 text-emerald-400">{dateStr}</h2>
                <div className="grid gap-4">
                  {(items as any[]).map((item) => (
                    <div key={item.id} className="p-4 rounded-2xl glass border-white/5 flex items-center gap-4 hover:border-white/10 transition-colors group cursor-pointer" onClick={() => setEditingItem(item)}>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-bold text-lg">{item.title}</h3>
                          <Badge variant="outline" className={cn(
                            "text-[10px] uppercase tracking-wider",
                            item.type === 'job' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-white/5 border-white/10",
                            item.status === 'confirmed' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                          )}>
                            {item.type === 'job' ? 'Job' : 'Visit'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{item.notes || "No notes provided."}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {item.scheduledAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="flex items-center gap-1.5"><UserIcon className="h-3 w-3" /> {item.clientName}</span>
                          {item.address && <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {item.address}</span>}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemToDelete(item);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'timeline' ? (
          <div className="overflow-x-auto pb-6 -mx-8 px-8 no-scrollbar">
            <div className="flex gap-4 min-w-max">
              {visibleDays.map(day => {
                const dayItems = filteredVisits.filter(v => isSameDay(v.scheduledAt.toDate(), day));
                return (
                  <div key={day.toISOString()} className="w-72 flex-shrink-0 space-y-4">
                    <div className={cn(
                      "p-4 rounded-3xl text-center border transition-all cursor-default",
                      isSameDay(day, new Date()) 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]" 
                        : "bg-white/5 border-white/5 text-muted-foreground hover:border-white/10"
                    )}>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">{format(day, 'EEEE')}</p>
                      <p className="text-3xl font-black tracking-tighter">{format(day, 'd')}</p>
                      <p className="text-[10px] uppercase font-bold mt-1 opacity-50 tracking-widest">{format(day, 'MMMM')}</p>
                    </div>
                    
                    <div className="space-y-3 min-h-[500px]">
                      {dayItems.length === 0 ? (
                        <div className="h-32 border border-dashed border-white/5 rounded-[2rem] flex flex-col items-center justify-center opacity-20">
                           <CalendarIcon className="h-5 w-5 mb-2" />
                           <span className="text-[10px] font-bold uppercase tracking-widest">Free Day</span>
                        </div>
                      ) : (
                        dayItems.map(item => (
                          <div 
                            key={item.id} 
                            onClick={() => setEditingItem(item)}
                            className={cn(
                              "p-5 rounded-[2rem] border transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] group relative glass",
                              item.type === 'job' 
                                ? "hover:border-blue-400/40" 
                                : "hover:border-white/20"
                            )}
                          >
                            <div className={cn(
                              "absolute top-4 right-4 h-2 w-2 rounded-full",
                              item.type === 'job' ? "bg-blue-500" : "bg-muted-foreground/30"
                            )} />
                            
                            <h4 className="font-bold text-sm mb-3 group-hover:text-white transition-colors line-clamp-2 pr-4">{item.title}</h4>
                            
                            <div className="space-y-2">
                              <p className="text-[10px] text-muted-foreground flex items-center gap-2 font-medium">
                                <Clock className="h-3 w-3" />
                                {format(item.scheduledAt.toDate(), 'h:mm a')}
                              </p>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-2 font-medium">
                                <UserIcon className="h-3 w-3" />
                                <span className="truncate">{item.clientName}</span>
                              </p>
                              
                              {item.type === 'job' && item.assignedTeam?.length > 0 && (
                                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                                  <div className="flex -space-x-2">
                                    {item.assignedTeam.slice(0, 3).map((tmId: string) => (
                                      <div key={tmId} className="h-6 w-6 rounded-full border-2 border-[#0a0a0a] bg-white/10 flex items-center justify-center text-[8px] font-black uppercase ring-1 ring-white/10">
                                        {tmId.substring(0, 2)}
                                      </div>
                                    ))}
                                    {item.assignedTeam.length > 3 && (
                                      <div className="h-6 w-6 rounded-full border-2 border-[#0a0a0a] bg-white/20 flex items-center justify-center text-[8px] font-black ring-1 ring-white/10">
                                        +{item.assignedTeam.length - 3}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Team</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          filteredVisits.map((item) => (
            <div key={item.id} className="p-6 rounded-2xl glass border-white/5 flex items-center gap-6 hover:border-white/10 transition-colors group cursor-pointer" onClick={() => setEditingItem(item)}>
              <div className="w-24 text-center border-r border-white/10 pr-6">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                  {item.scheduledAt?.toDate().toLocaleDateString('en-US', { weekday: 'short' })}
                </p>
                <p className="text-3xl font-bold mt-1">
                  {item.scheduledAt?.toDate().getDate()}
                </p>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-xl">{item.title}</h3>
                  <Badge variant="outline" className={cn(
                    "text-[10px] uppercase tracking-wider",
                    item.type === 'job' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-white/5 border-white/10",
                    item.status === 'confirmed' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                  )}>
                    {item.type === 'job' ? 'Job' : 'Visit'}
                  </Badge>
                  <Badge variant="outline" className={cn(
                    "bg-white/5 border-white/10 text-[10px] uppercase tracking-wider",
                    item.status === 'confirmed' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                  )}>
                    {item.status || 'Scheduled'}
                  </Badge>
                </div>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {item.scheduledAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="flex items-center gap-1.5"><UserIcon className="h-4 w-4" /> {item.clientName}</span>
                  {item.address && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {item.address}</span>}
                </div>
              </div>
              <div className="flex -space-x-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-black bg-white/10 flex items-center justify-center text-[10px] font-bold">
                    TM
                  </div>
                ))}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setItemToDelete(item);
                }}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="bg-black border-white/10 text-white sm:max-w-[400px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tighter text-center">Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center text-muted-foreground">
            Are you sure you want to delete this {itemToDelete?.type}? This action cannot be undone.
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setItemToDelete(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1 rounded-xl font-bold" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Schedule;
