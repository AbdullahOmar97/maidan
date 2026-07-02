"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  Shield, CheckCircle, XCircle, Users, Clock,
  Wifi, WifiOff, Search, ChevronRight, MapPin,
  QrCode, Phone, Keyboard, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Student, ClassSession, Location } from "@/types";

const PRIVILEGED_ROLES = ["platform_admin", "tenant_owner"];

type KioskTab = "qr" | "keypad" | "code" | "search";

export default function KioskPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  
  // Tab control
  const [activeTab, setActiveTab] = useState<KioskTab>("qr");
  
  // Inputs
  const [searchValue, setSearchValue] = useState("");
  const [phoneValue, setPhoneValue] = useState("");
  const [codeValue, setCodeValue] = useState("");
  
  // State for check-in status
  const [lastCheckIn, setLastCheckIn] = useState<{ name: string; success: boolean; message: string } | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const queryClient = useQueryClient();
  const scannerRef = useRef<any>(null);

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
    if (PRIVILEGED_ROLES.includes(user?.role)) return true;
    if (user?.assigned_location_ids && Array.isArray(user.assigned_location_ids) && user.assigned_location_ids.length > 0) {
      return user.assigned_location_ids.includes(loc.id);
    }
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

  // Student search (Name lookup)
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
    mutationFn: (variables: { student_id?: number; student_number?: string; phone?: string }) =>
      api.attendance.records.kiosk(variables),
    onSuccess: (data: any) => {
      const result = data.data;
      setLastCheckIn({
        name: result.student_name,
        success: true,
        message: result.already_checked_in
          ? "تم تسجيل الحضور مسبقاً"
          : `تم تسجيل حضور ${result.student_name} بنجاح (${result.class_name})`,
      });
      setSearchValue("");
      setPhoneValue("");
      setCodeValue("");
      queryClient.invalidateQueries({ queryKey: ["kiosk", "sessions"] });
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || "حدث خطأ. حاول مرة أخرى.";
      setLastCheckIn({ name: "", success: false, message: typeof msg === 'string' ? msg : "حدث خطأ. حاول مرة أخرى." });
    },
  });

  // Camera QR scanner effect
  useEffect(() => {
    let scannerInstance: any = null;

    if (activeTab === "qr" && selectedLocation) {
      import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
        setTimeout(() => {
          const container = document.getElementById("kiosk-qr-reader");
          if (!container) return;

          scannerInstance = new Html5QrcodeScanner(
            "kiosk-qr-reader",
            { 
              fps: 10, 
              qrbox: { width: 220, height: 220 },
              aspectRatio: 1.0
            },
            /* verbose= */ false
          );
          
          scannerRef.current = scannerInstance;

          scannerInstance.render(
            (decodedText: string) => {
              if (decodedText) {
                checkinMutation.mutate({ student_number: decodedText });
              }
            },
            (error: any) => {
              // silent fail for individual frame scan failures
            }
          );
        }, 200);
      }).catch(err => console.error("Error loading html5-qrcode library", err));
    }

    return () => {
      if (scannerInstance) {
        scannerInstance.clear().catch((err: any) => console.log("HTML5Qrcode cleanup error", err));
      }
    };
  }, [activeTab, selectedLocation]);

  // Code input auto-focus
  useEffect(() => {
    if (activeTab === "code") {
      const input = document.getElementById("kiosk-code-input");
      if (input) input.focus();
    }
  }, [activeTab]);

  const handleKeypadPress = (digit: string) => {
    if (phoneValue.length < 15) {
      setPhoneValue(prev => prev + digit);
    }
  };

  const handleKeypadBackspace = () => {
    setPhoneValue(prev => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    setPhoneValue("");
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneValue) return;
    checkinMutation.mutate({ phone: phoneValue });
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeValue.trim()) return;
    checkinMutation.mutate({ student_number: codeValue.trim() });
  };

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
          {selectedLocation && (
            <button
              onClick={() => {
                setSelectedLocation(null);
                localStorage.removeItem("kiosk_location");
              }}
              className="text-xs text-primary hover:underline"
            >
              تغيير الفرع
            </button>
          )}

          <div className={cn("flex items-center gap-1.5 text-sm", isOnline ? "text-emerald-400" : "text-red-400")}>
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {isOnline ? "متصل" : "غير متصل"}
          </div>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            {sessions?.length ?? 0} حصص اليوم
          </div>

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
                className="p-6 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all group text-end flex items-center justify-between"
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
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 p-8 max-w-6xl mx-auto w-full overflow-y-auto">
          
          {/* Left Column: Input Modes & Interface (2/3 width) */}
          <div className="lg:col-span-2 flex flex-col justify-start">
            
            {/* Visual Feedback Alerts */}
            {lastCheckIn && (
              <div
                className={cn(
                  "w-full mb-6 p-6 rounded-2xl border text-center transition-all animate-bounce shadow-lg",
                  lastCheckIn.success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10"
                    : "bg-red-500/10 border-red-500/30 text-red-400 shadow-red-500/10"
                )}
              >
                {lastCheckIn.success ? (
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
                ) : (
                  <XCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
                )}
                <p className="text-2xl font-bold">{lastCheckIn.message}</p>
              </div>
            )}

            {/* Check-In Interface Card */}
            <div className="w-full glass-card p-6 flex flex-col">
              
              {/* Custom Tabs */}
              <div className="grid grid-cols-4 gap-2 mb-8 bg-secondary/30 p-1.5 rounded-xl border border-border/40">
                <button
                  onClick={() => { setActiveTab("qr"); setSearchValue(""); }}
                  className={cn(
                    "flex flex-col sm:flex-row items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all",
                    activeTab === "qr"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:bg-secondary/50"
                  )}
                >
                  <QrCode className="w-4 h-4" />
                  <span>مسح الرمز (QR)</span>
                </button>
                <button
                  onClick={() => { setActiveTab("keypad"); setSearchValue(""); }}
                  className={cn(
                    "flex flex-col sm:flex-row items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all",
                    activeTab === "keypad"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:bg-secondary/50"
                  )}
                >
                  <Phone className="w-4 h-4" />
                  <span>رقم الهاتف</span>
                </button>
                <button
                  onClick={() => { setActiveTab("code"); setSearchValue(""); }}
                  className={cn(
                    "flex flex-col sm:flex-row items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all",
                    activeTab === "code"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:bg-secondary/50"
                  )}
                >
                  <Keyboard className="w-4 h-4" />
                  <span>رمز الطالب</span>
                </button>
                <button
                  onClick={() => { setActiveTab("search"); }}
                  className={cn(
                    "flex flex-col sm:flex-row items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all",
                    activeTab === "search"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:bg-secondary/50"
                  )}
                >
                  <Search className="w-4 h-4" />
                  <span>بحث بالاسم</span>
                </button>
              </div>

              {/* Tab Contents */}
              <div className="flex-1 flex flex-col justify-center min-h-[350px]">
                
                {/* 1. Camera QR Scanner */}
                {activeTab === "qr" && (
                  <div className="text-center space-y-4">
                    <p className="text-muted-foreground text-sm mb-2">
                      ضع رمز الـ QR الخاص بك أمام كاميرا الجهاز اللوحي لتسجيل حضورك مباشرة
                    </p>
                    <div className="relative mx-auto max-w-[280px] aspect-square rounded-2xl overflow-hidden border border-border bg-black/40 flex items-center justify-center shadow-lg">
                      <div id="kiosk-qr-reader" className="w-full h-full" />
                      {/* Decorative scanning laser animation */}
                      <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-primary/80 animate-pulse shadow-md shadow-primary" />
                    </div>
                  </div>
                )}

                {/* 2. Phone Keypad (Touch dialer) */}
                {activeTab === "keypad" && (
                  <div className="max-w-xs mx-auto w-full text-center space-y-6">
                    <div className="text-3xl font-mono font-bold tracking-widest bg-secondary/40 border border-border/40 py-3 rounded-xl min-h-[56px] flex items-center justify-center px-4">
                      {phoneValue || <span className="text-muted-foreground/30 text-lg">أدخل رقم الهاتف</span>}
                    </div>

                    <form onSubmit={handlePhoneSubmit} className="space-y-4">
                      {/* Dialer Grid */}
                      <div className="grid grid-cols-3 gap-3">
                        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(num => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleKeypadPress(num)}
                            className="h-14 rounded-xl border border-border bg-card/50 text-xl font-bold hover:bg-primary/15 active:bg-primary/20 transition-all flex items-center justify-center"
                          >
                            {num}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={handleKeypadClear}
                          className="h-14 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 font-bold transition-all flex items-center justify-center text-sm"
                        >
                          مسح الكل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleKeypadPress("0")}
                          className="h-14 rounded-xl border border-border bg-card/50 text-xl font-bold hover:bg-primary/15 transition-all flex items-center justify-center"
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={handleKeypadBackspace}
                          className="h-14 rounded-xl border border-border bg-card/50 text-lg hover:bg-primary/15 transition-all flex items-center justify-center"
                        >
                          ⌫
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={!phoneValue || checkinMutation.isPending}
                        className="w-full py-4 rounded-xl gradient-brand text-white font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                      >
                        {checkinMutation.isPending ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          "تسجيل الحضور"
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {/* 3. Student Code (Hardware/typed barcode input) */}
                {activeTab === "code" && (
                  <div className="max-w-md mx-auto w-full text-center space-y-6">
                    <div className="w-16 h-16 rounded-2xl bg-secondary/50 mx-auto flex items-center justify-center border border-border">
                      <Keyboard className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">تسجيل حضور برمز الطالب</h3>
                      <p className="text-muted-foreground text-sm">
                        اكتب رمز الطالب الخاص بك أو قم بتوجيه كرت المشترك لجهاز مسح الباركود
                      </p>
                    </div>

                    <form onSubmit={handleCodeSubmit} className="space-y-4">
                      <input
                        id="kiosk-code-input"
                        type="text"
                        value={codeValue}
                        onChange={(e) => setCodeValue(e.target.value)}
                        placeholder="STU-XXXXXX..."
                        className="w-full py-4 text-xl rounded-xl bg-secondary/50 border border-border focus:border-primary/50 focus:outline-none text-center font-mono font-bold tracking-wider"
                        autoComplete="off"
                      />
                      <button
                        type="submit"
                        disabled={!codeValue.trim() || checkinMutation.isPending}
                        className="w-full py-4 rounded-xl gradient-brand text-white font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                      >
                        {checkinMutation.isPending ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          "تأكيد الرمز وتسجيل الحضور"
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {/* 4. Name Search */}
                {activeTab === "search" && (
                  <div className="w-full space-y-4">
                    <p className="text-muted-foreground text-sm text-center">
                      ابحث عن اسمك في النظام ثم اضغط عليه لتسجيل الحضور
                    </p>
                    
                    <div className="relative">
                      <Search className="absolute end-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        placeholder="ابحث بالاسم هنا..."
                        className="w-full pe-12 ps-4 py-4 text-lg rounded-xl bg-secondary/50 border border-border focus:border-primary/50 focus:outline-none text-center"
                        autoComplete="off"
                      />
                    </div>

                    {/* Results dropdown */}
                    {searchValue.length >= 2 && (
                      <div className="space-y-2 max-h-[250px] overflow-y-auto border border-border/50 rounded-xl bg-background/50 p-2 scrollbar-thin">
                        {searching && (
                          <div className="text-center py-4 text-muted-foreground text-sm flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            <span>جاري البحث...</span>
                          </div>
                        )}
                        {!searching && studentResults?.length === 0 && (
                          <div className="text-center py-4 text-muted-foreground text-sm">
                            لم يتم العثور على طالب بهذا الاسم
                          </div>
                        )}
                        {studentResults?.map((student: Student) => (
                          <button
                            key={student.id}
                            onClick={() => checkinMutation.mutate({ student_id: student.id })}
                            disabled={checkinMutation.isPending}
                            className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary/30 hover:bg-primary/10 border border-border hover:border-primary/30 transition-all group text-end"
                          >
                            <div className="w-10 h-10 rounded-lg gradient-brand-soft border border-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                              {student.first_name?.[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">{student.full_name}</p>
                              <p className="text-xs text-muted-foreground"><bdi>{student.phone}</bdi></p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary rtl-flip transition-colors" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

          </div>

          {/* Right Column: Today's Sessions Sidebar (1/3 width) */}
          <div className="lg:col-span-1 flex flex-col justify-start">
            <div className="glass-card p-6 flex flex-col h-full min-h-[400px]">
              <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-4 shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span>حصص اليوم المفتوحة</span>
                </h3>
              </div>

              {/* Sessions List */}
              <div className="flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
                {sessions && sessions.length > 0 ? (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 rounded-xl border border-border/40 bg-secondary/15 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-10 rounded-full bg-primary" />
                        <div>
                          <p className="font-bold text-sm leading-tight">{session.class_name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {session.location_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-border/20 pt-2 mt-1">
                        <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary font-medium">
                          {session.status === "in_progress" ? "نشطة حالياً" : "مجدولة"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {session.attendance_count} طلاب حاضرين
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12 text-muted-foreground">
                    <Clock className="w-10 h-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm">لا توجد حصص نشطة أو مجدولة اليوم في هذا الفرع</p>
                  </div>
                )}
              </div>
            </div>
          </div>

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
    <div className="text-sm font-mono text-muted-foreground">
      {time.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </div>
  );
}
