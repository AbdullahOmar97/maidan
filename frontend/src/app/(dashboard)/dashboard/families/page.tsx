"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { api } from "@/lib/api/client";
import {
  Users, Search, Plus, ChevronRight, Phone,
  Mail, Inbox, ArrowLeft, ArrowRight, User
} from "lucide-react";
import type { PaginatedResponse, Family } from "@/types";
import Link from "next/link";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import FamilyFormDialog from "@/components/dashboard/FamilyFormDialog";

function FamilyCard({ family, onEditClick }: { family: Family; onEditClick: (f: Family) => void }) {
  return (
    <Link
      href={`/dashboard/families/${family.id}`}
      className="glass-card group flex items-center gap-4 sm:gap-6 p-4 sm:p-6 hover:border-primary/40 transition-all duration-300 relative overflow-hidden active:scale-[0.98]"
    >
      {/* Dynamic Hover Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      <div className="absolute -end-12 -top-12 w-40 h-40 bg-primary/10 blur-[60px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

      {/* Family Icon Avatar */}
      <div className="relative shrink-0 z-10">
        <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-white/10 group-hover:border-primary/40 bg-white/5 flex items-center justify-center text-primary group-hover:scale-105 transition-all duration-300 shadow-xl">
          <Users className="w-8 h-8 sm:w-10 sm:h-10 text-primary/70 group-hover:text-primary transition-colors" />
        </div>
        {/* Count indicator */}
        <div className="absolute -bottom-1 -end-1 bg-primary text-white text-[10px] font-black w-6 h-6 rounded-full border-4 border-[#0f172a] shadow-xl z-20 flex items-center justify-center">
          {family.member_count}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 z-10">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h3 className="font-black text-lg tracking-tight text-white group-hover:text-primary transition-colors truncate">
              {family.name}
            </h3>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mt-1 flex items-center gap-1.5">
              <User className="w-3 h-3 text-primary/60" />
              المسؤول: {family.primary_contact_name}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
          {family.primary_contact_phone && (
            <div className="flex items-center gap-2.5 text-xs font-bold text-muted-foreground group-hover:text-foreground/80 transition-colors">
              <div className="w-6 h-6 rounded-xl bg-white/5 flex items-center justify-center text-primary/70 group-hover:bg-primary/20 group-hover:text-primary transition-all">
                <Phone className="w-3 h-3" />
              </div>
              <span className="tracking-tight"><bdi>{family.primary_contact_phone}</bdi></span>
            </div>
          )}
          {family.primary_contact_email && (
            <div className="flex items-center gap-2.5 text-xs font-bold text-muted-foreground group-hover:text-foreground/80 transition-colors max-w-[200px]">
              <div className="w-6 h-6 rounded-xl bg-white/5 flex items-center justify-center text-primary/70 group-hover:bg-primary/20 group-hover:text-primary transition-all">
                <Mail className="w-3 h-3" />
              </div>
              <span className="truncate tracking-tight">{family.primary_contact_email}</span>
            </div>
          )}
        </div>
      </div>

      <div className="hidden sm:flex w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white/5 items-center justify-center group-hover:bg-primary group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary/30 transition-all duration-300 rtl-flip shrink-0">
        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
    </Link>
  );
}

function FamilyCardSkeleton() {
  return (
    <div className="glass-card p-4 sm:p-6 flex items-center gap-4 sm:gap-6">
      <div className="shimmer w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl shrink-0" />
      <div className="flex-1 space-y-3">
        <div className="flex justify-between">
          <div className="shimmer h-5 w-36 rounded-xl" />
        </div>
        <div className="shimmer h-3.5 w-24 rounded-lg" />
        <div className="flex gap-4 pt-4 border-t border-white/5">
          <div className="shimmer h-4 w-20 rounded-lg" />
          <div className="shimmer h-4 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function FamiliesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery<PaginatedResponse<Family>>({
    queryKey: ["families", { search: debouncedSearch, page }],
    queryFn: () =>
      api.families
        .list({
          search: debouncedSearch,
          page,
        })
        .then((r) => r.data),
  });

  return (
    <PermissionGuard permission="can_manage_students">
      <div className="space-y-6 sm:space-y-8 pb-6 page-enter">
        <PageHeader
          title="العائلات"
          description="إدارة الحسابات العائلية وربط الطلاب بأولياء أمورهم لتنظيم وتسهيل الفواتير وعمليات المتابعة."
          icon={Users}
        >
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            إضافة عائلة
          </button>
        </PageHeader>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
          <StatsCard
            label="إجمالي العائلات"
            value={data?.count ?? 0}
            icon={Users}
            color="primary"
            description="حسابات أولياء الأمور النشطة"
          />
          <StatsCard
            label="إجمالي الأعضاء"
            value={data?.results?.reduce((acc, f) => acc + f.member_count, 0) ?? 0}
            icon={Users}
            color="emerald"
            description="الطلاب المرتبطين بالعائلات"
          />
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute end-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-all" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="ابحث باسم العائلة، جهة الاتصال، أو رقم الهاتف..."
              className="filter-input pe-12"
            />
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between px-6 py-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              يتم عرض <span className="text-white">{data?.results?.length ?? 0}</span> عائلة من أصل <span className="text-white">{data?.count ?? 0}</span>
            </p>
          </div>
        </div>

        {/* Family Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {isLoading ? (
            [...Array(6)].map((_, i) => <FamilyCardSkeleton key={i} />)
          ) : data?.results?.length === 0 ? (
            <div className="lg:col-span-2 glass-card py-32 flex flex-col items-center justify-center text-center relative overflow-hidden border-dashed border-white/10 bg-transparent">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.03)_0%,transparent_70%)]" />
              <div className="relative group">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-28 h-28 rounded-[2.5rem] bg-white/5 border border-white/10 flex items-center justify-center mb-8 relative z-10">
                  <Inbox className="w-12 h-12 text-muted-foreground/30" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-white relative z-10">لا توجد عائلات</h3>
              <p className="text-sm font-bold text-muted-foreground mt-3 max-w-xs leading-relaxed relative z-10">
                لم نتمكن من العثور على أي عائلة تطابق معايير البحث.
              </p>
            </div>
          ) : (
            data?.results?.map((family) => (
              <FamilyCard key={family.id} family={family} onEditClick={() => {}} />
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

      <FamilyFormDialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </PermissionGuard>
  );
}
