import React, { useState } from "react";
import { 
  Plus, 
  Clock,
  Calendar,
  User as UserIcon,
  ArrowUpRight,
  Play,
  Square,
  History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Timesheets = () => {
  const [isClockedIn, setIsClockedIn] = useState(false);
  
  const entries = [
    { id: 1, user: "John Doe", job: "Q3 Data Infrastructure", date: "Today", duration: "4h 20m", status: "active" },
    { id: 2, user: "Sarah Smith", job: "AI Model Implementation", date: "Yesterday", duration: "8h 00m", status: "completed" },
    { id: 3, user: "Mike Johnson", job: "Data Strategy Consultation", date: "Oct 24, 2023", duration: "6h 30m", status: "completed" },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Timesheets</h1>
          <p className="text-muted-foreground">Track team hours, manage labor costs, and view work history.</p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            onClick={() => setIsClockedIn(!isClockedIn)}
            className={`rounded-xl px-8 h-12 font-bold gap-2 transition-all duration-300 ${
              isClockedIn 
                ? "bg-destructive text-white hover:bg-destructive/90 shadow-[0_0_20px_rgba(239,68,68,0.2)]" 
                : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            }`}
          >
            {isClockedIn ? (
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
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white gap-2">
              <History className="h-4 w-4" />
              View All History
            </Button>
          </div>
          
          {entries.map((entry) => (
            <div key={entry.id} className="p-6 rounded-2xl glass border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
              <div className="flex items-center gap-6">
                <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <UserIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-lg">{entry.user}</h3>
                    {entry.status === 'active' && (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 animate-pulse">
                        Live
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{entry.job}</p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-lg font-bold text-white">{entry.duration}</p>
                  <p className="text-xs text-muted-foreground mt-1">{entry.date}</p>
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
                  <ArrowUpRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold">Team Overview</h2>
          <div className="glass p-6 rounded-3xl border-white/5 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium">Currently Working</span>
              </div>
              <span className="font-bold">4 Team Members</span>
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm">Team Member {i}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">3h 45m</span>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full border-white/10 hover:bg-white/5 rounded-xl">
              View Team Schedule
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timesheets;
