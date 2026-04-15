import React, { useState, useEffect } from "react";
import { 
  format, 
  addMinutes, 
  startOfDay, 
  endOfDay, 
  isWithinInterval, 
  setHours, 
  setMinutes,
  isSameDay,
  parseISO
} from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, Clock, Check, AlertCircle } from "lucide-react";
import { db } from "../firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SchedulePickerProps {
  value?: string; // ISO string
  onChange: (value: string) => void;
  placeholder?: string;
  excludeId?: string;
}

export function SchedulePicker({ value, onChange, placeholder = "Select date and time", excludeId }: SchedulePickerProps) {
  const [date, setDate] = useState<Date | undefined>(() => {
    if (!value) return undefined;
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  });
  const [busySlots, setBusySlots] = useState<{ start: Date; end: Date; title: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Generate time slots from 8 AM to 8 PM every 30 mins
  const timeSlots = [];
  for (let hour = 8; hour <= 20; hour++) {
    timeSlots.push({ hour, minute: 0 });
    if (hour !== 20) timeSlots.push({ hour, minute: 30 });
  }

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setDate(d);
      }
    } else {
      setDate(undefined);
    }
  }, [value]);

  useEffect(() => {
    if (date) {
      fetchBusySlots(date);
    }
  }, [date]);

  async function fetchBusySlots(selectedDate: Date) {
    setLoading(true);
    try {
      const start = startOfDay(selectedDate);
      const end = endOfDay(selectedDate);

      const visitsQuery = query(
        collection(db, "visits"),
        where("scheduledAt", ">=", Timestamp.fromDate(start)),
        where("scheduledAt", "<=", Timestamp.fromDate(end))
      );

      const jobsQuery = query(
        collection(db, "jobs"),
        where("status", "==", "active"),
        where("scheduledAt", ">=", Timestamp.fromDate(start)),
        where("scheduledAt", "<=", Timestamp.fromDate(end))
      );

      const [visitsSnapshot, jobsSnapshot] = await Promise.all([
        getDocs(visitsQuery),
        getDocs(jobsQuery)
      ]);

      const processDocs = (snapshot: any, defaultTitle: string) => 
        snapshot.docs
          .filter((doc: any) => doc.id !== excludeId)
          .map((doc: any) => {
            const data = doc.data();
            const startTime = data.scheduledAt.toDate();
            const durationStr = data.duration || "1h";
            let durationMinutes = 60;
            if (durationStr.endsWith("h")) {
              durationMinutes = parseInt(durationStr) * 60;
            } else if (durationStr.endsWith("m")) {
              durationMinutes = parseInt(durationStr);
            }
            
            return {
              start: startTime,
              end: addMinutes(startTime, durationMinutes),
              title: data.title || defaultTitle
            };
          });

      const busy = [
        ...processDocs(visitsSnapshot, "Visit"),
        ...processDocs(jobsSnapshot, "Active Job")
      ];
      setBusySlots(busy);
    } catch (error) {
      console.error("Error fetching busy slots:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleDateSelect = (newDate: Date | undefined) => {
    if (newDate) {
      // Preserve current time if date changes
      if (date) {
        const updatedDate = setHours(setMinutes(newDate, date.getMinutes()), date.getHours());
        setDate(updatedDate);
      } else {
        setDate(newDate);
      }
    }
  };

  const handleTimeSelect = (hour: number, minute: number) => {
    if (date) {
      const newDateTime = setHours(setMinutes(date, minute), hour);
      setDate(newDateTime);
      onChange(newDateTime.toISOString());
    }
  };

  const isSlotBusy = (hour: number, minute: number) => {
    if (!date) return false;
    const slotStart = setHours(setMinutes(date, minute), hour);
    const slotEnd = addMinutes(slotStart, 29); // Check within the 30 min slot

    return busySlots.some(busy => {
      // Use a small offset to allow back-to-back bookings
      const busyInterval = { start: busy.start, end: addMinutes(busy.end, -1) };
      return isWithinInterval(slotStart, busyInterval) ||
             isWithinInterval(slotEnd, busyInterval) ||
             (slotStart <= busy.start && slotEnd >= busy.end);
    });
  };

  const getBusyTitle = (hour: number, minute: number) => {
    if (!date) return null;
    const slotStart = setHours(setMinutes(date, minute), hour);
    const busy = busySlots.find(busy => 
      isWithinInterval(slotStart, { start: busy.start, end: addMinutes(busy.end, -1) })
    );
    return busy?.title;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal bg-white/5 border-white/10 hover:bg-white/10",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP p") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-black border-white/10 flex flex-col md:flex-row" align="start">
        <div className="p-3 border-r border-white/10">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            initialFocus
            className="bg-transparent"
          />
        </div>
        <div className="w-full md:w-64 flex flex-col">
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Available Times
            </div>
            {loading && <div className="text-[10px] animate-pulse text-muted-foreground">Checking...</div>}
          </div>
          <ScrollArea className="h-[300px]">
            <div className="p-2 space-y-1">
              {!date ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Please select a date first
                </div>
              ) : (
                timeSlots.map(({ hour, minute }) => {
                  const busy = isSlotBusy(hour, minute);
                  const busyTitle = getBusyTitle(hour, minute);
                  const isSelected = date && date.getHours() === hour && date.getMinutes() === minute;
                  
                  return (
                    <button
                      key={`${hour}-${minute}`}
                      disabled={busy}
                      onClick={() => handleTimeSelect(hour, minute)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group",
                        busy 
                          ? "opacity-50 cursor-not-allowed bg-red-500/5 text-red-200/50" 
                          : isSelected
                            ? "bg-white text-black font-bold"
                            : "hover:bg-white/10 text-white"
                      )}
                    >
                      <span>{format(setHours(setMinutes(new Date(), minute), hour), "h:mm a")}</span>
                      {busy ? (
                        <div className="flex items-center gap-1 text-[10px] text-red-400">
                          <AlertCircle className="h-3 w-3" />
                          <span className="max-w-[80px] truncate">{busyTitle || "Busy"}</span>
                        </div>
                      ) : isSelected ? (
                        <Check className="h-4 w-4" />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
          {date && (
            <div className="p-3 border-t border-white/10 mt-auto">
              <Button 
                className="w-full bg-white text-black hover:bg-white/90" 
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={!date || isSlotBusy(date.getHours(), date.getMinutes())}
              >
                Confirm Selection
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
