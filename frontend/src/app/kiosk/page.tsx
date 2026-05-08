"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  Shield, CheckCircle, XCircle, Users, Clock,
  Wifi, WifiOff, Search, ChevronRight, MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Student, ClassSession, Location } from "@/types";

const PRIVILEGED_ROLES = ["platform_admin", "tenant_owner"];

export default function KioskPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [lastCheckIn, setLastCheckIn] = useState<{ name: string; success: boolean; message: string } | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const queryClient = useQueryClient();

  const handleSelectLocation = (loc: Location) => {
    setSelectedLocation(loc);
    localStorage.setItem("kiosk_location", JSON.stringify(loc));
  };

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Locations list
  const { data: locations } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: () => api.locations.list().then((r: any) => r.data.results || r.data),
  });

  const activeLocations = (locations?.filter((loc: any) => loc.is_active) ?? []).filter((loc: any) => {
    // If user is admin/owner, they see all
    if (PRIVILEGED_ROLES.includes(user?.role)) return true;
    
    // If user has assigned locations, they only see those
    if (user?.assigned_location_ids && Array.isArray(user.assigned_location_ids) && user.assigned_location_ids.length > 0) {
      return user.assigned_location_ids.includes(loc.id);
    }
    
    // Default: see all (for legacy or unassigned staff if any)
    return true;
  });

  // Auto-select if only one location is available or load from storage
  useEffect(() => {
    if (selectedLocation) return;
    if (activeLocations.length === 0) return;
    
    if (activeLocations.length === 1) {
      handleSelectLocation(activeLocations[0]);
      return;
    }

    const saved = localStorage.getItem("kiosk_location");
    if (saved) {
      try {
        const loc = JSON.parse(saved);
        if (activeLocations.some((al: any) => al.id === loc.id)) {
          setSelectedLocation(loc);
        }
      } catch (e) {
        localStorage.removeItem("kiosk_location");
      }
    }
  }, [activeLocations, selectedLocation]);

  // Auto-dismiss check-in result after 4 seconds
  useEffect(() => {
    if (lastCheckIn) {
      const timer = setTimeout(() => setLastCheckIn(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [lastCheckIn]);

  // Today's sessions
  const { data: sessions } = useQuery<ClassSession[]>({
    queryKey: ["kiosk", "sessions", selectedLocation?.id],
    queryFn: () => api.attendance.sessions.today(selectedLocation?.id).then((r: any) => r.data),
    enabled: !!selectedLocation,
    refetchInterval: 60 * 1000, // refresh every minute
  });

  // Student search
  const { data: studentResults, isLoading: searching } = useQuery({
    queryKey: ["kiosk", "search", searchValue, selectedLocation?.id],
    queryFn: () =>
      searchValue.length >= 2
        ? api.students.kioskSearch(searchValue, selectedLocation?.id).then((r: any) => r.data)
        : Promise.resolve([]),
    enabled: searchValue.length >= 2,
  });

  // Check-in mutation
  const checkinMutation = useMutation({
    mutationFn: (studentId: number) =>
      api.attendance.records.kiosk({ student_id: studentId }),
    onSuccess: (data: any) => {
      const result = data.data;
      setLastCheckIn({
        name: result.student_name,
        success: true,
        message: result.already_checked_in
          ? "تم تسجيل الحضور مسبقاً"
          : `تم تسجيل حضور ${result.student_name} بنجاح`,
      });
      setSearchValue("");
      queryClient.invalidateQueries({ queryKey: ["kiosk", "sessions"] });
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || "حدث خطأ. حاول مرة أخرى.";
      setLastCheckIn({ name: "", success: false, message: typeof msg === 'string' ? msg : "حدث خطأ. حاول مرة أخرى." });
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-border bg-card/30 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center shadow-lg shadow-primary/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">MAIDAN Kiosk</h1>
            <p className="text-xs text-muted-foreground">
              {selectedLocation ? `فرع: ${selectedLocation.name}` : "يرجى اختيار الفرع"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Switch location button */}
          <button 
            onClick={() => {
              setSelectedLocation(null);
              localStorage.removeItem("kiosk_location");
            }}
            className="text-xs text-primary hover:underline"
          >
            تغيير الفرع
          </button>

          {/* Online indicator */}
          <div className={cn("flex items-center gap-1.5 text-sm", isOnline ? "text-emerald-400" : "text-red-400")}>
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {isOnline ? "متصل" : "غير متصل"}
          </div>

          {/* Active sessions count */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            {sessions?.length ?? 0} حصص اليوم
          </div>

          {/* Clock */}
          <KioskClock />
        </div>
      </div>

      {/* Main Content */}
      {!selectedLocation ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto w-full text-center">
           <div className="w-20 h-20 rounded-3xl gradient-brand mb-8 flex items-center justify-center shadow-2xl shadow-primary/40">
             <MapPin className="w-10 h-10 text-white" />
           </div>
           <h2 className="text-3xl font-bold mb-4">مرحباً بك في ميدان</h2>
           <p className="text-muted-foreground mb-12">يرجى اختيار الفرع الحالي لهذا الجهاز للبدء</p>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
             {activeLocations.map((loc) => (
               <button
                 key={loc.id}
                 onClick={() => handleSelectLocation(loc)}
                 className="p-6 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all group text-right flex items-center justify-between"
               >
                 <div>
                   <p className="font-bold text-lg">{loc.name}</p>
                   <p className="text-sm text-muted-foreground">موقع التدريب</p>
                 </div>
                 <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary rtl-flip transition-colors" />
               </button>
             ))}
           </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto w-full">
        {/* Check-in Result */}
        {lastCheckIn && (
          <div
            className={cn(
              "w-full mb-8 p-6 rounded-2xl border text-center transition-all animate-fade-in",
              lastCheckIn.success
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            )}
          >
            {lastCheckIn.success ? (
              <CheckCircle className="w-12 h-12 mx-auto mb-3" />
            ) : (
              <XCircle className="w-12 h-12 mx-auto mb-3" />
            )}
            <p className="text-xl font-bold">{lastCheckIn.message}</p>
          </div>
        )}

        {/* Search Box */}
        <div className="w-full glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl gradient-brand mx-auto mb-6 flex items-center justify-center shadow-xl shadow-primary/30">
            <Users className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl font-bold mb-2">ابحث عن طالب</h2>
          <p className="text-muted-foreground text-sm mb-8">
            اكتب اسمك أو رقم هاتفك لتسجيل الحضور
          </p>

          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="الاسم أو رقم الهاتف..."
              className="w-full pr-12 pl-4 py-4 text-lg rounded-xl bg-secondary/50 border border-border focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all text-center"
              autoFocus
              autoComplete="off"
            />
          </div>

          {/* Search Results */}
          {searchValue.length >= 2 && (
            <div className="mt-4 space-y-2">
              {searching && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  جاري البحث...
                </div>
              )}
              {!searching && studentResults?.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  لم يتم العثور على طالب
                </div>
              )}
              {studentResults?.map((student: Student) => (
                <button
                  key={student.id}
                  id={`checkin-student-${student.id}`}
                  onClick={() => checkinMutation.mutate(student.id)}
                  disabled={checkinMutation.isPending}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary/30 hover:bg-primary/10 border border-border hover:border-primary/30 transition-all group text-right"
                >
                  <div className="w-12 h-12 rounded-xl gradient-brand-soft border border-primary/20 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                    {student.first_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{student.full_name}</p>
                    <p className="text-sm text-muted-foreground">{student.phone}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary rtl-flip transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Today's Sessions */}
        {sessions && sessions.length > 0 && (
          <div className="w-full mt-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">حصص اليوم</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sessions.map((session) => (
                <div key={session.id} className="glass-card p-4 flex items-center gap-3">
                  <div className="w-2 h-10 rounded-full bg-primary" />
                  <div>
                    <p className="font-medium text-sm">{session.class_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.location_name} · {session.attendance_count} حاضر
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function KioskClock() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return <div className="text-sm font-mono text-muted-foreground w-20" />;

  return (
    <div className="text-sm font-mono text-muted-foreground" dir="ltr">
      {time.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </div>
  );
}
