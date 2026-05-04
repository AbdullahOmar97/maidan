"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { CalendarCheck, Users, Clock, CheckCircle, Plus, MapPin, Sparkles, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClassSession } from "@/types";

export default function AttendancePage() {
  const { data: sessions, isLoading } = useQuery<ClassSession[]>({
    queryKey: ["attendance", "sessions", "today"],
    queryFn: () => api.attendance.sessions.today().then((r) => r.data),
    refetchInterval: 30 * 1000,
  });

  return (
    <div className="space-y-10 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">الحضور اليومي</h1>
          </div>
          <p className="text-muted-foreground text-sm font-bold flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            تتبع حضور الطلاب في حصص اليوم وإدارة الكشك الذكي
          </p>
        </div>
        <a
          href="/kiosk"
          target="_blank"
          className="flex items-center gap-3 px-6 py-3 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all active:scale-95"
        >
          <Monitor className="w-4 h-4" />
          فتح كشك الحضور
        </a>
      </div>

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-8 space-y-4 animate-pulse">
              <div className="h-6 bg-white/5 rounded-lg w-3/4" />
              <div className="h-4 bg-white/5 rounded-lg w-1/2" />
              <div className="flex gap-4 pt-4">
                <div className="h-8 bg-white/5 rounded-lg w-20" />
                <div className="h-8 bg-white/5 rounded-lg w-20" />
              </div>
            </div>
          ))
        ) : sessions?.length === 0 ? (
          <div className="md:col-span-2 py-32 text-center glass-card">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
              <CalendarCheck className="w-10 h-10 text-muted-foreground opacity-20" />
            </div>
            <p className="text-white font-black text-xl">لا توجد حصص مجدولة لليوم</p>
            <p className="text-muted-foreground text-sm font-bold mt-2">سيظهر جدول اليوم هنا بمجرد توفر حصص نشطة.</p>
          </div>
        ) : (
          sessions?.map((session) => (
            <div key={session.id} className="glass-card p-8 group hover:border-primary/40 transition-all relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
              
              <div className="flex items-start justify-between mb-8 relative z-10">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-white group-hover:text-primary transition-colors">{session.class_name}</h3>
                  <div className="flex items-center gap-2 text-muted-foreground font-bold text-xs">
                    <MapPin className="w-3.5 h-3.5" />
                    {session.location_name}
                  </div>
                </div>
                <span className={cn(
                  "px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border shadow-lg",
                  session.status === "in_progress" 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10" 
                    : session.status === "scheduled" 
                      ? "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-500/10" 
                      : "bg-white/5 text-muted-foreground border-white/10"
                )}>
                  {session.status === "in_progress" ? "جارية الآن" : session.status === "scheduled" ? "مجدولة" : "منتهية"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl flex items-center gap-4 group-hover:bg-white/[0.05] transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-white">{session.attendance_count}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">حاضر</p>
                  </div>
                </div>
                <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl flex items-center gap-4 group-hover:bg-white/[0.05] transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-white">{session.date.split(" ")[0]}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">الوقت</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center relative z-10">
                <div className="flex -space-x-3 rtl:space-x-reverse">
                  {[...Array(Math.min(session.attendance_count, 5))].map((_, i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0f172a] bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">
                      {i + 1}
                    </div>
                  ))}
                  {session.attendance_count > 5 && (
                    <div className="w-8 h-8 rounded-full border-2 border-[#0f172a] bg-white/5 flex items-center justify-center text-[10px] font-black text-muted-foreground">
                      +{session.attendance_count - 5}
                    </div>
                  )}
                </div>
                <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                  عرض الحضور بالتفصيل
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

