"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { MessageSquare, Send, Mail, MessageCircle, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MessagingPage() {
  const { data: campaigns, isLoading: campaignsLoading } = useQuery<{ results: any[] }>({
    queryKey: ["messaging", "campaigns"],
    queryFn: () => api.messaging.campaigns.list().then((r) => r.data),
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<{ results: any[] }>({
    queryKey: ["messaging", "templates"],
    queryFn: () => api.messaging.templates().then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            الرسائل والإشعارات
          </h1>
          <p className="text-muted-foreground text-sm mt-1">إرسال حملات واتساب وبريد إلكتروني للطلاب</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-brand text-white font-medium shadow-lg hover:opacity-90 transition-all text-sm">
          <Plus className="w-4 h-4" />
          حملة جديدة
        </button>
      </div>

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
                       <span className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium border",
                          campaign.status === "completed" ? "badge-active" : 
                          campaign.status === "in_progress" ? "badge-trial" : "badge-inactive"
                       )}>
                         {campaign.status === "completed" ? "مكتملة" : campaign.status === "in_progress" ? "جاري الإرسال" : "مسودة"}
                       </span>
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
    </div>
  );
}
