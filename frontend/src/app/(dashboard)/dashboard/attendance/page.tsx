"use client";
import { PageHeader } from "@/components/dashboard/page-header";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { CalendarCheck, Users, Clock, MapPin, Monitor } from "lucide-react";
import type { ClassSession } from "@/types";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { StatsCard } from "@/components/dashboard/StatsCard";


export default function AttendancePage() {
  const { data: sessions, isLoading } = useQuery<ClassSession[]>({
    queryKey: ["attendance", "sessions", "today"],
    queryFn: () => api.attendance.sessions.today().then((r) => r.data),
    refetchInterval: 30 * 1000,
  });

  return (
    <div className="space-y-10 pb-12">
      <PageHeader
        title="الحضور اليومي"
        description="تتبع حضور الطلاب في حصص اليوم، إدارة الجلسات التدريبية، والوصول السريع لكشك الحضور الذكي."
        icon={CalendarCheck}
      >
        <a
          href="/kiosk"
          target="_blank"
          className="flex items-center gap-3 px-6 py-3 rounded-xl gradient-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.05] transition-all active:scale-95"
        >
          <Monitor className="w-4 h-4" />
          فتح الكشك
        </a>
      </PageHeader>

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
                <StatusBadge 
                  status={session.status} 
                  className="shadow-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 relative z-10">
                <StatsCard
                  label="حاضر"
                  value={session.attendance_count.toString()}
                  icon={Users}
                />
                <StatsCard
                  label="الوقت"
                  value={session.date.split(" ")[0]}
                  icon={Clock}
                />
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
                <button className="px-6 py-3 rounded-xl gradient-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.05] transition-all active:scale-95">
                  تفاصيل الحضور
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
