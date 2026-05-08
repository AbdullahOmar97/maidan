"use client";

import { useState } from "react";
import { CheckCircle, Loader2, CreditCard, Banknote, Building2, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Textarea } from "@/components/ui/form-field";

export type PaymentMethodKey = "cash" | "bank_transfer" | "card" | "mobile_wallet";

interface PaymentMethodOption {
  value: PaymentMethodKey;
  label: string;
  icon: React.ElementType;
  activeClass: string;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  { value: "cash",          label: "نقد",             icon: Banknote,  activeClass: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" },
  { value: "bank_transfer", label: "تحويل بنكي",      icon: Building2, activeClass: "bg-blue-500/15 border-blue-500/40 text-blue-400"         },
  { value: "card",          label: "بطاقة بنكية",     icon: CreditCard,activeClass: "bg-violet-500/15 border-violet-500/40 text-violet-400"    },
  { value: "mobile_wallet", label: "محفظة إلكترونية", icon: Smartphone,activeClass: "bg-amber-500/15 border-amber-500/40 text-amber-400"       },
];

interface MarkAsPaidModalProps {
  invoiceNumber: string;
  isPending: boolean;
  onConfirm: (paymentMethod: PaymentMethodKey, note: string) => void;
  onClose: () => void;
}

export default function MarkAsPaidModal({
  invoiceNumber,
  isPending,
  onConfirm,
  onClose,
}: MarkAsPaidModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodKey>("cash");
  const [note, setNote] = useState("");

  return (
    <Modal open onClose={onClose} size="sm" disableBackdropClose={isPending}>
      <ModalHeader
        icon={<CheckCircle className="w-5 h-5" />}
        iconColor="bg-emerald-500/15 text-emerald-400"
        title="تأكيد استلام الدفع"
        subtitle={invoiceNumber}
        onClose={onClose}
      />

      <ModalBody className="space-y-5">
        {/* Payment method grid */}
        <FormField label="طريقة الدفع" required>
          <div className="grid grid-cols-2 gap-2.5">
            {PAYMENT_METHODS.map(({ value, label, icon: Icon, activeClass }) => {
              const isSelected = selectedMethod === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedMethod(value)}
                  className={cn(
                    "flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl border transition-all text-center",
                    isSelected
                      ? activeClass
                      : "bg-secondary/30 border-border/50 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-semibold">{label}</span>
                </button>
              );
            })}
          </div>
        </FormField>

        <FormField label="ملاحظة">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isPending}
            rows={2}
            placeholder="رقم وصل الدفع، اسم المحوّل..."
            dir="rtl"
          />
        </FormField>
      </ModalBody>

      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="px-5 py-2.5 rounded-xl border border-border hover:bg-secondary/60 transition-colors text-sm font-medium disabled:opacity-50"
        >
          إلغاء
        </button>
        <button
          type="button"
          onClick={() => onConfirm(selectedMethod, note)}
          disabled={isPending}
          className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          تأكيد السداد
        </button>
      </ModalFooter>
    </Modal>
  );
}
