import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User as UserIcon,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";

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

const Schedule = () => {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    const visitsQuery = query(collection(db, "visits"), orderBy("scheduledAt", "asc"));
    const jobsQuery = query(collection(db, "jobs"), where("status", "==", "active"), orderBy("scheduledAt", "asc"));

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
  }, []);

  const [scheduleData, setScheduleData] = useState<{ visits: any[], jobs: any[] }>({ visits: [], jobs: [] });

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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Schedule</h1>
          <p className="text-muted-foreground">View and manage your team's daily schedule and visits.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white/5 rounded-xl border border-white/10 p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-4 text-sm font-bold">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
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
            <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
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
        <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
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
        ) : (
          visits.map((item) => (
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
                    item.type === 'job' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-white/5 border-white/10"
                  )}>
                    {item.type === 'job' ? 'Job' : 'Visit'}
                  </Badge>
                  <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px] uppercase tracking-wider">
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
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Schedule;
