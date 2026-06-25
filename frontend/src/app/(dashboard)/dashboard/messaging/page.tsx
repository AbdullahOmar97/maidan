"use client";
import { useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AxiosError } from "axios";
import { MessageSquare, Plus, Send, FileText, MessageCircle, Mail, Sparkles, AlertCircle } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";

export default function MessagingPage() {
  const [isUnderDevelopmentOpen, setIsUnderDevelopmentOpen] = useState(false);

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<{ results: any[] }>({
    queryKey: ["messaging", "campaigns"],
    queryFn: () => api.messaging.campaigns.list().then((r) => r.data),
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<{ results: any[] }>({
    queryKey: ["messaging", "templates"],
    queryFn: () => api.messaging.templates().then((r) => r.data),
  });

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="الرسائل والإشعارات"
        description="إرسال حملات واتساب وبريد إلكتروني للطلاب، إدارة القوالب الجاهزة، ومتابعة سجل الإرسال."
        icon={MessageSquare}
      >
        <button
          onClick={() => setIsUnderDevelopmentOpen(true)}
          className="flex items-center justify-center gap-3 px-6 py-3 rounded-xl gradient-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/40 hover:scale-[1.05] active:scale-95 transition-all group overflow-hidden relative"
        >
          <Plus className="w-4 h-4 relative z-10 group-hover:rotate-90 transition-transform duration-500" />
          <span className="relative z-10">حملة جديدة</span>
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaigns */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-lg">سجل الحملات</h2>
            <Send className="w-5 h-5 text-emerald-400" />
          </div>

          {campaignsLoading ? (
             <div className="space-y-4">
               {[...Array(4)].map((_, i) => (
                 <div key={i} className="shimmer h-20 rounded-xl" />
               ))}
             </div>
          ) : campaigns?.results?.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
              <p>لم يتم إرسال أي حملات بعد</p>
            </div>
          ) : (
            <div className="space-y-3">
               {campaigns?.results?.map((campaign) => (
                 <div key={campaign.id} className="p-4 rounded-xl border bg-secondary/20 hover:border-primary/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">{campaign.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{campaign.content_preview || "بدون محتوى"}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                       <div className="flex items-center gap-1.5 text-muted-foreground">
                          {campaign.channel === 'whatsapp' ? <MessageCircle className="w-4 h-4 text-emerald-500" /> : <Mail className="w-4 h-4 text-blue-500" />}
                          <span>{campaign.target_audience}</span>
                       </div>
                       <StatusBadge status={campaign.status} />
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>

        {/* Templates */}
        <div className="lg:col-span-1 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-lg">القوالب الجاهزة</h2>
            <FileText className="w-5 h-5 text-amber-400" />
          </div>

          {templatesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="shimmer h-12 rounded-xl" />
              ))}
            </div>
          ) : templates?.results?.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
              <FileText className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm">لا توجد قوالب</p>
            </div>
          ) : (
             <div className="space-y-3">
                {templates?.results?.map((template) => (
                   <div key={template.id} className="p-3 rounded-lg border bg-secondary/30 group cursor-pointer hover:border-primary/50 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        {template.channel === 'whatsapp' ? <MessageCircle className="w-4 h-4 text-emerald-500" /> : <Mail className="w-4 h-4 text-blue-500" />}
                        <h3 className="font-medium text-sm">{template.name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{template.content}</p>
                   </div>
                ))}
             </div>
          )}
        </div>
      </div>

      {/* Under Development Modal */}
      {isUnderDevelopmentOpen && (
        <Modal open={isUnderDevelopmentOpen} onClose={() => setIsUnderDevelopmentOpen(false)} size="sm">
          <ModalHeader
            icon={<Sparkles className="w-5 h-5 text-amber-400" />}
            title="الخدمة تحت التطوير"
            subtitle="قريباً جداً"
            onClose={() => setIsUnderDevelopmentOpen(false)}
          />
          <ModalBody className="space-y-4 text-center py-6">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/10 animate-bounce">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">نعمل على إطلاق هذه الميزة قريباً!</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                ميزة إنشاء الحملات الإعلانية وإرسال الرسائل الجماعية عبر الواتساب والبريد الإلكتروني قيد التطوير والبرمجة حالياً لتلبية احتياجاتكم بأعلى كفاءة.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <button
              onClick={() => setIsUnderDevelopmentOpen(false)}
              className="w-full py-3 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-transform active:scale-95"
            >
              فهمت ذلك
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
