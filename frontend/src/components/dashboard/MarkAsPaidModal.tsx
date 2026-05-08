"use client";

import { useState } from "react";
import { X, CheckCircle, Loader2, CreditCard, Banknote, Building2, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaymentMethodKey = "cash" | "bank_transfer" | "card" | "mobile_wallet";

interface PaymentMethodOption {
  value: PaymentMethodKey;
  label: string;
  icon: React.ElementType;
  color: string;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  { value: "cash",           label: "نقد",              icon: Banknote,      color: "emerald" },
  { value: "bank_transfer",  label: "تحويل بنكي",       icon: Building2,     color: "blue"    },
  { value: "card",           label: "بطاقة بنكية",      icon: CreditCard,    color: "violet"  },
  { value: "mobile_wallet",  label: "محفظة إلكترونية",  icon: Smartphone,    color: "amber"   },
];

interface MarkAsPaidModalProps {
  /** Invoice number shown in the header for confirmation. */
  invoiceNumber: string;
  isPending: boolean;
  onConfirm: (paymentMethod: PaymentMethodKey, note: string) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MarkAsPaidModal({
  invoiceNumber,
  isPending,
  onConfirm,
  onClose,
}: MarkAsPaidModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodKey>("cash");
  const [note, setNote] = useState("");

  const handleConfirm = () => {
    onConfirm(selectedMethod, note);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#0f172a] border border-white/10 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-br from-emerald-500/10 to-transparent">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/20">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">تأكيد استلام الدفع</h2>
              <p className="text-xs font-bold text-muted-foreground mt-0.5">{invoiceNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-red-500/20 hover:text-red-400 transition-all disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          {/* Payment Method Selection */}
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-400/70">
              طريقة الدفع
            </p>
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_METHODS.map(({ value, label, icon: Icon, color }) => {
                const isSelected = selectedMethod === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedMethod(value)}
                    className={cn(
                      "flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all text-center",
                      isSelected
                        ? `bg-${color}-500/15 border-${color}-500/40 text-${color}-400 shadow-lg shadow-${color}-500/10`
                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-black">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Note */}
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              ملاحظة (اختياري)
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isPending}
              rows={2}
              placeholder="رقم وصل الدفع، اسم المحوّل..."
              className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-bold focus:border-emerald-500/50 focus:bg-white/[0.08] focus:outline-none transition-all resize-none text-right placeholder:text-muted-foreground/30"
              dir="rtl"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-black uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="flex-[2] h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-black uppercase tracking-widest shadow-xl shadow-emerald-500/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3"
            >
              {isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>تأكيد السداد</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
