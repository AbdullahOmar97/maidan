"use client";
import { PageHeader } from "@/components/dashboard/page-header";
import React, { useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { 
  Shield, 
  Search, 
  Plus, 
  Building2, 
  Globe, 
  Mail, 
  Phone, 
  Calendar,
  CheckCircle2,
  XCircle,
  MoreVertical,
  ExternalLink,
  Loader2,
  Inbox
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import { toast } from "sonner";

function TenantCard({ tenant }: { tenant: any }) {
  const [mounted, setMounted] = useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const hostname = mounted ? window.location.hostname : (process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "localhost");
  const primaryDomain = tenant.domains?.find((d: any) => d.is_primary)?.domain || `${tenant.slug}.${hostname}`;

  
  return (
    <div className="glass-card group p-6 hover:border-primary/40 transition-all duration-500 relative overflow-hidden">
      <div className="absolute -end-12 -top-12 w-40 h-40 bg-primary/5 blur-[60px] rounded-full group-hover:bg-primary/10 transition-colors pointer-events-none" />
      
      <div className="flex items-start justify-between mb-6 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center shadow-xl shadow-primary/20 group-hover:rotate-3 transition-transform">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white group-hover:text-primary transition-colors tracking-tight">
              {tenant.name}
            </h3>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mt-1">
              {tenant.schema_name}
            </p>
          </div>
        </div>
        
        <div className={cn(
          "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shrink-0",
          tenant.is_active 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
            : "bg-destructive/10 border-destructive/20 text-destructive"
        )}>
          {tenant.is_active ? "نشط" : "غير نشط"}
        </div>
      </div>

      <div className="space-y-3 relative z-10">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Globe className="w-4 h-4 text-primary/70" />
          <span className="font-mono text-xs">{primaryDomain}</span>
          <a href={`http://${primaryDomain}`} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Mail className="w-4 h-4 text-primary/70" />
          <span>{tenant.email}</span>
        </div>

        {tenant.phone && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Phone className="w-4 h-4 text-primary/70" />
            <span><bdi>{tenant.phone}</bdi></span>
          </div>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
          <Calendar className="w-3 h-3" />
          <span>مسجل منذ: <bdi>{new Date(tenant.created_at).toLocaleDateString("ar-SA")}</bdi></span>
        </div>
        
        <Link 
          href={`/dashboard/tenants/${tenant.id}`}
          className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-inner"
        >
          <MoreVertical className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}


export default function TenantsPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"tenants" | "requests">("tenants");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [modalType, setModalType] = useState<"approve" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => api.platform.tenants.list().then(r => r.data),
  });

  const { data: requestsData, isLoading: requestsLoading, refetch: refetchRequests } = useQuery({
    queryKey: ["platform-requests"],
    queryFn: () => api.platform.subscriptionRequests.list().then(r => r.data),
    enabled: activeTab === "requests",
  });

  const filteredTenants = tenants?.filter((t: any) => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.slug.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase())
  );

  const requests = Array.isArray(requestsData) ? requestsData : (requestsData as any)?.results || [];
  const pendingRequests = requests.filter((r: any) => r.status === "pending");

  const handleAction = async () => {
    if (!selectedRequest || !modalType) return;
    try {
      setProcessing(true);
      if (modalType === "approve") {
        await api.platform.subscriptionRequests.approve(selectedRequest.id, { admin_notes: adminNotes });
        toast.success("تمت الموافقة وتعديل باقة العميل وتطبيق حدود الباقة الجديدة بنجاح ✓");
      } else {
        await api.platform.subscriptionRequests.reject(selectedRequest.id, { admin_notes: adminNotes });
        toast.success("تم رفض طلب تغيير الباقة ✗");
      }
      setModalType(null);
      setSelectedRequest(null);
      setAdminNotes("");
      refetchRequests();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "فشل تنفيذ هذا الإجراء.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <PermissionGuard role="platform_admin">
    <div className="space-y-10 pb-20">
      <PageHeader
        title="بوابـة مسؤول المنصة"
        description="التحكم في الأكاديميات المسجلة، متابعة حالات الفوترة، وإدارة باقات SaaS والاشتراكات."
        icon={Shield}
      >
        <Link
          href="/dashboard/tenants/create"
          className="flex items-center justify-center gap-3 px-8 py-4 rounded-xl gradient-brand text-white text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-primary/40 hover:scale-[1.05] active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          إضافة أكاديمية جديدة
        </Link>
      </PageHeader>

      {/* Tabs Menu */}
      <div className="flex border-b border-white/5 space-x-8 rtl:space-x-reverse text-sm font-bold">
        <button
          onClick={() => setActiveTab("tenants")}
          className={cn(
            "pb-4 relative",
            activeTab === "tenants" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-white"
          )}
        >
          الأكاديميات المسجلة ({tenants?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={cn(
            "pb-4 relative flex items-center gap-2",
            activeTab === "requests" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-white"
          )}
        >
          طلبات تغيير الباقة
          {pendingRequests.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black">{pendingRequests.length} معلق</span>
          )}
        </button>
      </div>

      {activeTab === "tenants" && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Filters */}
          <div className="relative group max-w-2xl">
            <Search className="absolute end-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-all" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم الأكاديمية، الرابط، أو البريد الإلكتروني..."
              className="w-full pe-14 ps-8 py-5 rounded-3xl bg-white/[0.03] border border-white/5 focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold shadow-inner"
            />
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground font-bold italic">جاري تحميل الأكاديميات...</p>
            </div>
          ) : filteredTenants?.length === 0 ? (
            <div className="glass-card py-32 flex flex-col items-center justify-center text-center border-dashed border-white/10 bg-transparent">
              <div className="w-24 h-24 rounded-[2rem] bg-white/5 flex items-center justify-center mb-6">
                <Inbox className="w-10 h-10 text-muted-foreground/30" />
              </div>
              <h3 className="text-xl font-black text-white">لا توجد أكاديميات</h3>
              <p className="text-sm text-muted-foreground mt-2">لم نتمكن من العثور على أي أكاديمية تطابق بحثك.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredTenants?.map((tenant: any) => (
                <TenantCard key={tenant.id} tenant={tenant} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "requests" && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {requestsLoading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground font-bold italic">جاري تحميل الطلبات...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="glass-card py-24 flex flex-col items-center justify-center text-center border-dashed border-white/10 bg-transparent">
              <Inbox className="w-12 h-12 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-black text-white">لا توجد طلبات تغيير باقات</h3>
              <p className="text-xs text-muted-foreground mt-1">لم يتم إرسال أي طلبات تغيير أو ترقية اشتراك حتى الآن.</p>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-start">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <th className="py-4 px-5 text-start">النادي / الأكاديمية</th>
                      <th className="py-4 px-5 text-start">التغيير المطلوب</th>
                      <th className="py-4 px-5 text-start">السبب</th>
                      <th className="py-4 px-5 text-start">تاريخ الطلب</th>
                      <th className="py-4 px-5 text-start">الحالة</th>
                      <th className="py-4 px-5 text-end">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm text-white font-medium">
                    {requests.map((req: any) => (
                      <tr key={req.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="py-4 px-5 text-start">
                          <span className="font-black text-white block">{req.tenant_name}</span>
                          <span className="text-[10px] text-muted-foreground">{req.requested_by_email}</span>
                        </td>
                        <td className="py-4 px-5 text-start">
                          <span className="text-xs font-black text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-md">{req.new_plan_name}</span>
                          {req.old_plan_name && <span className="text-[10px] text-muted-foreground block mt-1">بدلاً من {req.old_plan_name}</span>}
                        </td>
                        <td className="py-4 px-5 text-start max-w-xs truncate" title={req.reason}>
                          {req.reason || "—"}
                        </td>
                        <td className="py-4 px-5 text-start text-xs text-muted-foreground">
                          <bdi>{new Date(req.created_at).toLocaleDateString("ar-SA")}</bdi>
                        </td>
                        <td className="py-4 px-5 text-start">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                            req.status === "pending" && "bg-amber-500/10 border-amber-500/20 text-amber-400",
                            req.status === "approved" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                            req.status === "rejected" && "bg-red-500/10 border-red-500/20 text-red-400"
                          )}>
                            {req.status === "pending" && "معلق"}
                            {req.status === "approved" && "مقبول"}
                            {req.status === "rejected" && "مرفوض"}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-end">
                          {req.status === "pending" ? (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setModalType("approve");
                                }}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[10px] font-black tracking-widest uppercase hover:bg-emerald-600 transition-all"
                              >
                                موافقة
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setModalType("reject");
                                }}
                                className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[10px] font-black tracking-widest uppercase hover:bg-red-600 transition-all"
                              >
                                رفض
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">{req.admin_notes || "معالج"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal open={!!modalType} onClose={() => {
        setModalType(null);
        setSelectedRequest(null);
        setAdminNotes("");
      }} size="sm">
        <ModalHeader
          icon={<Shield className="w-5 h-5" />}
          title={modalType === "approve" ? "تأكيد قبول طلب الترقية" : "تأكيد رفض طلب الترقية"}
          onClose={() => {
            setModalType(null);
            setSelectedRequest(null);
            setAdminNotes("");
          }}
        />
        <ModalBody className="space-y-4">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2 text-start text-xs">
              <p className="text-muted-foreground">الأكاديمية: <strong className="text-white font-bold">{selectedRequest.tenant_name}</strong></p>
              <p className="text-muted-foreground">الباقة المطلوبة: <strong className="text-white font-bold">{selectedRequest.new_plan_name}</strong></p>
              {modalType === "approve" && (
                <p className="text-amber-400 font-bold leading-relaxed mt-2">
                  تنبيه: سيتم تفعيل الباقة فوراً. في حال كان هذا الإجراء تخفيضاً للباقة (Downgrade)، فسيتم تحويل الفروع والموظفين والطلاب الأحدث الذين يتجاوزون الحد المسموح إلى حالة غير نشطة تلقائياً.
                </p>
              )}
            </div>

            <div className="space-y-2 text-start">
              <label className="text-sm font-bold text-white">
                {modalType === "approve" ? "ملاحظات إضافية للعميل (اختياري)" : "سبب الرفض (مطلوب)"}
              </label>
              <textarea
                rows={4}
                placeholder={modalType === "approve" ? "اكتب أي ملاحظات ترغب في إرسالها للعميل..." : "يجب كتابة سبب الرفض بالتفصيل ليظهر للعميل..."}
                className="w-full p-3 rounded-xl border bg-background/50 border-white/5 focus:border-primary/50 outline-none text-sm text-white transition-all placeholder:text-muted-foreground/40"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
        </ModalBody>
        <ModalFooter>
          <button
            onClick={() => {
              setModalType(null);
              setSelectedRequest(null);
              setAdminNotes("");
            }}
            className="px-6 py-2.5 rounded-xl border border-white/10 text-white text-xs font-black hover:bg-white/5 active:scale-95 transition-all"
          >
            إلغاء
          </button>
          <button
            disabled={processing || (modalType === "reject" && !adminNotes.trim())}
            onClick={handleAction}
            className={cn(
              "px-6 py-2.5 rounded-xl text-white text-xs font-black hover:opacity-90 active:scale-95 transition-all flex items-center gap-2",
              modalType === "approve" ? "bg-emerald-500" : "bg-red-500"
            )}
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : modalType === "approve" ? "تأكيد الموافقة" : "تأكيد الرفض"}
          </button>
        </ModalFooter>
      </Modal>
    </div>
    </PermissionGuard>
  );
}

