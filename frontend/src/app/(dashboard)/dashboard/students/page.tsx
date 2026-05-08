"use client";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/dashboard/page-header";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { api } from "@/lib/api/client";
import { getStatusBadgeClass, getStatusLabel, cn } from "@/lib/utils";
import {
  Users, Search, Plus, ChevronRight, Phone,
  Mail, Award, Sparkles, Filter, Inbox, ArrowLeft, ArrowRight
} from "lucide-react";
import type { PaginatedResponse, Student } from "@/types";
import Link from "next/link";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { PermissionGuard } from "@/components/dashboard/permission-guard";

const STATUS_OPTIONS = [
  { value: "", label: "جميع الحالات" },
  { value: "active", label: "نشط" },
  { value: "trial", label: "تجريبي" },
  { value: "lead", label: "عميل محتمل" },
  { value: "inactive", label: "غير نشط" },
];

function StudentCard({ student }: { student: Student }) {
  return (
    <Link
      href={`/dashboard/students/${student.id}`}
      className="glass-card group flex items-center gap-6 p-6 hover:border-primary/40 transition-all duration-500 relative overflow-hidden active:scale-[0.98]"
    >
      {/* Dynamic Hover Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      <div className="absolute -right-12 -top-12 w-40 h-40 bg-primary/10 blur-[60px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      
      {/* Avatar */}
      <div className="relative shrink-0 z-10">
        <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-white/10 group-hover:border-primary/40 transition-all duration-500 shadow-2xl group-hover:rotate-3">
          {student.photo_url ? (
            <img
              src={student.photo_url}
              alt={student.full_name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full gradient-brand flex items-center justify-center text-white font-black text-3xl">
              {student.first_name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
        {/* Status indicator */}
        <div
          className={cn(
            "absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-[#0f172a] shadow-xl z-20 transition-all",
            student.status === "active" ? "bg-emerald-500 shadow-emerald-500/50" :
            student.status === "trial" ? "bg-blue-500 shadow-blue-500/50" :
            student.status === "lead" ? "bg-amber-500 shadow-amber-500/50" : "bg-gray-500"
          )}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 z-10">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h3 className="font-black text-lg tracking-tight text-white group-hover:text-primary transition-colors truncate">
              {student.full_name}
            </h3>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mt-1">{student.student_number}</p>
          </div>
          <StatusBadge status={student.status} />
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
          {student.phone && (
            <div className="flex items-center gap-2.5 text-xs font-bold text-muted-foreground group-hover:text-white/80 transition-colors">
              <div className="w-6 h-6 rounded-xl bg-white/5 flex items-center justify-center text-primary/70 group-hover:bg-primary/20 group-hover:text-primary transition-all">
                <Phone className="w-3 h-3" />
              </div>
              <span dir="ltr" className="tracking-tight">{student.phone}</span>
            </div>
          )}
          {student.email && (
            <div className="flex items-center gap-2.5 text-xs font-bold text-muted-foreground group-hover:text-white/80 transition-colors max-w-[200px]">
              <div className="w-6 h-6 rounded-xl bg-white/5 flex items-center justify-center text-primary/70 group-hover:bg-primary/20 group-hover:text-primary transition-all">
                <Mail className="w-3 h-3" />
              </div>
              <span className="truncate tracking-tight">{student.email}</span>
            </div>
          )}
        </div>

        {/* Belt + membership */}
        <div className="flex items-center gap-6 mt-5 pt-5 border-t border-white/5">
          {student.current_belt && (
            <div className="flex items-center gap-2.5">
              <div
                className="w-5 h-5 rounded-lg border border-white/20 shadow-lg relative overflow-hidden group-hover:rotate-12 transition-transform"
                style={{ backgroundColor: student.current_belt.color }}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-white/20" />
              </div>
              <span className="text-xs font-black tracking-tight text-white/90">{student.current_belt.name}</span>
            </div>
          )}
          {student.active_membership && (
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/10 group-hover:bg-primary/10 transition-all">
              <Award className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                {student.active_membership.plan_name}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary/30 transition-all duration-500 rtl-flip">
        <ChevronRight className="w-5 h-5" />
      </div>
    </Link>
  );
}

function StudentCardSkeleton() {
  return (
    <div className="glass-card p-6 flex items-center gap-6">
      <div className="shimmer w-20 h-20 rounded-3xl shrink-0" />
      <div className="flex-1 space-y-4">
        <div className="flex justify-between">
          <div className="shimmer h-6 w-48 rounded-xl" />
          <div className="shimmer h-8 w-20 rounded-xl" />
        </div>
        <div className="shimmer h-4 w-32 rounded-lg" />
        <div className="flex gap-4 pt-5 border-t border-white/5">
          <div className="shimmer h-5 w-24 rounded-lg" />
          <div className="shimmer h-5 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}


export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery<PaginatedResponse<Student>>({
    queryKey: ["students", { search: debouncedSearch, status, page }],
    queryFn: () =>
      api.students
        .list({ search: debouncedSearch, status: status || undefined, page })
        .then((r) => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ["students", "stats"],
    queryFn: () => api.students.stats().then((r) => r.data),
  });

  return (
    <PermissionGuard permission="can_manage_students">
    <div className="space-y-10 pb-20">
      <PageHeader
        title="الطلاب"
        description="إدارة قاعدة بيانات الطلاب المركزية، تتبع مستويات الأحزمة، ومراقبة حالة الاشتراكات النشطة لجميع الفروع."
        icon={Users}
      >
        <Link
          href="/dashboard/students/new"
          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" />
          إضافة طالب
        </Link>
      </PageHeader>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard label="إجمالي الطلاب" value={stats?.total ?? 0} icon={Users} color="primary" description="جميع المسجلين" />
        <StatsCard label="طلاب نشطون" value={stats?.active ?? 0} icon={Sparkles} color="emerald" description="اشتراكات جارية" />
        <StatsCard label="تجريبيون" value={stats?.trials ?? 0} icon={Award} color="blue" description="فترة تجربة" />
        <StatsCard label="محتملون" value={stats?.leads ?? 0} icon={Filter} color="amber" description="قيد المتابعة" />
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col lg:flex-row gap-5 p-2">
        {/* Search */}
        <div className="relative flex-1 group">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary group-focus-within:scale-110 transition-all" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="ابحث بالاسم، رقم الطالب، أو رقم الهاتف..."
            className="w-full pr-14 pl-8 py-5 rounded-3xl bg-white/[0.03] border border-white/5 focus:bg-white/[0.07] focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold placeholder:text-muted-foreground/40 shadow-inner"
          />
        </div>

        {/* Status Filter */}
        <div className="relative min-w-[240px]">
          <Select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="w-full px-8 py-5 rounded-3xl bg-white/[0.03] border border-white/5 focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm font-black appearance-none cursor-pointer shadow-inner"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-6 py-2">
        <div className="flex items-center gap-3">
           <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            يتم عرض <span className="text-white">{data?.results.length ?? 0}</span> طالب من أصل <span className="text-white">{data?.count ?? 0}</span>
          </p>
        </div>
      </div>

      {/* Student Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {isLoading ? (
          [...Array(6)].map((_, i) => <StudentCardSkeleton key={i} />)
        ) : data?.results.length === 0 ? (
          <div className="lg:col-span-2 glass-card py-32 flex flex-col items-center justify-center text-center relative overflow-hidden border-dashed border-white/10 bg-transparent">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.03)_0%,transparent_70%)]" />
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-28 h-28 rounded-[2.5rem] bg-white/5 border border-white/10 flex items-center justify-center mb-8 relative z-10">
                <Inbox className="w-12 h-12 text-muted-foreground/30" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-white relative z-10">لا توجد نتائج بحث</h3>
            <p className="text-sm font-bold text-muted-foreground mt-3 max-w-xs leading-relaxed relative z-10">
              لم نتمكن من العثور على أي طالب يطابق معايير البحث الحالية. جرب تغيير كلمات البحث أو إعادة ضبط الفلاتر.
            </p>
            <button
              onClick={() => { setSearch(""); setStatus(""); }}
              className="mt-10 px-8 py-3 rounded-2xl bg-primary/10 text-primary font-black text-xs uppercase tracking-widest hover:bg-primary hover:text-white transition-all relative z-10"
            >
              إعادة ضبط البحث
            </button>
          </div>
        ) : (
          data?.results.map((student) => (
            <StudentCard key={student.id} student={student} />
          ))
        )}
      </div>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-6 pt-12">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!data.previous}
            className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/10 text-white disabled:opacity-20 hover:bg-primary hover:border-primary transition-all active:scale-90 shadow-xl rtl-flip"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="px-6 py-3 rounded-2xl gradient-brand text-white font-black text-sm shadow-2xl shadow-primary/30 min-w-[60px] text-center">
              {data.current_page}
            </div>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">من أصل</span>
            <div className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-sm min-w-[60px] text-center">
              {data.total_pages}
            </div>
          </div>

          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!data.next}
            className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/10 text-white disabled:opacity-20 hover:bg-primary hover:border-primary transition-all active:scale-90 shadow-xl rtl-flip"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
    </PermissionGuard>
  );
}
