"use client";

import { useState } from "react";
import { CheckCircle, Loader2, CreditCard, Banknote, Building2, Smartphone, Wallet, ArrowDownRight, AlertCircle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, Textarea } from "@/components/ui/form-field";

export type PaymentMethodKey = "cash" | "bank_transfer" | "card" | "mobile_wallet";

interface PaymentMethodOption {
  value: PaymentMethodKey;
  label: string;
  icon: React.ElementType;
  activeClass: string;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  { value: "cash", label: "نقد", icon: Banknote, activeClass: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" },
  { value: "bank_transfer", label: "تحويل بنكي", icon: Building2, activeClass: "bg-blue-500/15 border-blue-500/40 text-blue-400" },
  { value: "card", label: "بطاقة بنكية", icon: CreditCard, activeClass: "bg-violet-500/15 border-violet-500/40 text-violet-400" },
  { value: "mobile_wallet", label: "محفظة إلكترونية", icon: Smartphone, activeClass: "bg-amber-500/15 border-amber-500/40 text-amber-400" },
];

interface MarkAsPaidModalProps {
  invoiceNumber: string;
  totalAmount: number;
  amountPaid: number;
  currency?: string;
  isPending: boolean;
  onConfirm: (data: {
    paymentMethod: PaymentMethodKey;
    amount?: number;
    surplusAction?: "credit" | "change";
    note: string;
  }) => void;
  onClose: () => void;
}

export default function MarkAsPaidModal({
  invoiceNumber,
  totalAmount,
  amountPaid,
  currency = "JOD",
  isPending,
  onConfirm,
  onClose,
}: MarkAsPaidModalProps) {
  const currentDue = Math.max(0, Number(totalAmount) - Number(amountPaid));

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodKey>("cash");
  const [enteredAmount, setEnteredAmount] = useState<number | "">(currentDue);
  const [surplusAction, setSurplusAction] = useState<"credit" | "change">("credit");
  const [note, setNote] = useState("");

  const numEntered = enteredAmount === "" ? 0 : Number(enteredAmount);
  const isPartial = numEntered > 0 && numEntered < currentDue;
  const isSurplus = numEntered > currentDue;
  const surplusDiff = isSurplus ? numEntered - currentDue : 0;
  const remainingDue = isPartial ? currentDue - numEntered : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numEntered <= 0) return;
    onConfirm({
      paymentMethod: selectedMethod,
      amount: numEntered,
      surplusAction: isSurplus ? surplusAction : undefined,
      note,
    });
  };

  return (
    <Modal open onClose={onClose} size="sm" disableBackdropClose={isPending}>
      <ModalHeader
        icon={<CheckCircle className="w-5 h-5" />}
        iconColor="bg-emerald-500/15 text-emerald-400"
        title="تسجيل سداد الفاتورة"
        subtitle={invoiceNumber}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-4">
          {/* Summary Box */}
          <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/50 flex items-center justify-between text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px]">المبلغ المتبقي المستحق:</span>
              <span className="text-sm font-black text-white font-mono">
                {formatCurrency(currentDue, currency)}
              </span>
            </div>
            {Number(amountPaid) > 0 && (
              <div className="text-end">
                <span className="text-muted-foreground block text-[10px]">سُدد سابقاً:</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  {formatCurrency(amountPaid, currency)}
                </span>
              </div>
            )}
          </div>

          {/* Amount Input */}
          <FormField label="المبلغ المستلم الآن" required>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={enteredAmount}
              onChange={(e) => setEnteredAmount(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={isPending}
              required
              className="text-lg font-black font-mono tracking-wider"
              placeholder="0.00"
            />
          </FormField>

          {/* Scenario Alerts */}
          {isPartial && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">سداد جزئي</p>
                <p className="text-[11px] text-amber-400/80 mt-0.5">
                  سيبقى على الطالب متبقٍ قدره{" "}
                  <span className="font-bold font-mono text-white">
                    {formatCurrency(remainingDue, currency)}
                  </span>
                  ، وستتحول حالة الفاتورة إلى "مدفوعة جزئياً".
                </p>
              </div>
            </div>
          )}

          {isSurplus && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <ArrowDownRight className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <div>
                  <p className="font-bold">مبلغ زائد عن قيمة الفاتورة</p>
                  <p className="text-[11px] text-emerald-400/80 mt-0.5">
                    الزيادة المسلّمة:{" "}
                    <span className="font-black font-mono text-white">
                      {formatCurrency(surplusDiff, currency)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-emerald-500/20">
                <label className="text-[11px] font-bold text-white block">كيف تريد التعامل مع الزيادة؟</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSurplusAction("credit")}
                    className={cn(
                      "p-2.5 rounded-lg border text-center transition-all flex flex-col items-center gap-1",
                      surplusAction === "credit"
                        ? "bg-emerald-500/20 border-emerald-500 text-white font-bold"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                    )}
                  >
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px]">إيداع بمحفظة الطالب</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSurplusAction("change")}
                    className={cn(
                      "p-2.5 rounded-lg border text-center transition-all flex flex-col items-center gap-1",
                      surplusAction === "change"
                        ? "bg-emerald-500/20 border-emerald-500 text-white font-bold"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                    )}
                  >
                    <Banknote className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px]">إرجاع الفائض نقداً</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Payment method grid */}
          <FormField label="طريقة الدفع" required>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(({ value, label, icon: Icon, activeClass }) => {
                const isSelected = selectedMethod === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedMethod(value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all text-center",
                      isSelected
                        ? activeClass
                        : "bg-secondary/30 border-border/50 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-semibold">{label}</span>
                  </button>
                );
              })}
            </div>
          </FormField>

          <FormField label="ملاحظة السداد">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isPending}
              rows={2}
              placeholder="رقم وصل الدفع، اسم المحوّل، أو سبب الفائض..."
            />
          </FormField>
        </ModalBody>

        <ModalFooter>
          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isPending || numEntered <= 0}
              className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {isPartial ? "تأكيد الدفعة الجزئية" : "تأكيد السداد"}
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
