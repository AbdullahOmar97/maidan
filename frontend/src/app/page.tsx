import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles, Users2, Shield } from "lucide-react";
import { TenantRedirect } from "@/components/TenantRedirect";

const stats = [
  { label: "أكاديميات مسجلة", value: "120+" },
  { label: "طلاب نشطون شهرياً", value: "18k+" },
  { label: "تسجيلات حضور", value: "250k+" },
];

const features = [
  {
    title: "إدارة دورة حياة الطالب",
    description:
      "تتبع العملاء المحتملين، العضويات النشطة، تقدم الأحزمة، والحضور من لوحة تحكم واحدة مبسطة.",
    icon: Users2,
  },
  {
    title: "فوترة ومدفوعات آمنة",
    description:
      "تعامل مع المدفوعات المتكررة، تنبيهات التأخير، وسجل الفواتير مع وضوح مالي كامل.",
    icon: ShieldCheck,
  },
  {
    title: "عمليات يومية ذكية",
    description:
      "إدارة الجدولة، تعيين المدربين، وتخطيط سعة الحصص دون التنقل بين أدوات متعددة.",
    icon: Sparkles,
  },
];

const highlights = [
  "محسن للغة العربية والفرق التي تعتمد العربية أولاً",
  "لوحات تحكم سريعة للمالكين وموظفي الاستقبال",
  "إعداد مرن للأكاديميات الفردية أو متعددة الفروع",
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <TenantRedirect />
      {/* Dynamic Background Elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="gradient-brand-soft absolute -right-24 top-10 h-[500px] w-[500px] rounded-full blur-[120px] opacity-50" />
        <div className="gradient-brand-soft absolute -bottom-24 -left-24 h-[600px] w-[600px] rounded-full blur-[120px] opacity-30" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <section className="relative mx-auto flex w-full max-w-7xl flex-col px-6 pb-20 pt-12 sm:px-8 lg:px-12">
        {/* Navigation / Header */}
        <header className="mb-24 flex items-center justify-between">
          <div className="flex items-center gap-4 group">
            <div className="gradient-brand h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-500">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xl font-black tracking-tighter text-gradient">MAIDAN</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">نظام إدارة الدوجو</p>
            </div>
          </div>

          <Link
            href="/login"
            className="rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-bold text-foreground backdrop-blur-md transition-all hover:bg-white/10 hover:border-primary/40 hover:text-primary active:scale-95"
          >
            تسجيل الدخول
          </Link>
        </header>

        <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-24">
          <div className="page-enter">
            <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary glow-primary">
              <Sparkles className="h-3.5 w-3.5" />
              صُمم لأكاديميات الفنون القتالية الحديثة
            </span>

            <h1 className="text-balance text-5xl font-black leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
              أدر أكاديميتك <br />
              <span className="text-gradient">بثقة، وضوح، وسرعة.</span>
            </h1>

            <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground/90 sm:text-xl">
              يساعد ميدان (MAIDAN) المالكين والموظفين على إدارة الطلاب، العضويات، الحضور، والعمليات من مركز تحكم واحد فائق الجودة.
            </p>

            <div className="mt-12 flex flex-wrap gap-4">
              <Link
                href="/register"
                className="gradient-brand glow-primary inline-flex items-center gap-3 rounded-2xl px-8 py-4 text-base font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95 shadow-xl shadow-primary/20"
              >
                سجل أكاديميتك الآن مجاناً
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-base font-bold text-foreground backdrop-blur-md transition-all hover:bg-white/10 hover:border-primary/40 hover:text-primary active:scale-95"
              >
                تسجيل الدخول
              </Link>
            </div>

            <div className="mt-16 grid gap-6 sm:grid-cols-3">
              {stats.map((item) => (
                <article key={item.label} className="glass-card glass-card-hover px-6 py-5">
                  <p className="text-3xl font-black tracking-tight text-gradient">{item.value}</p>
                  <p className="mt-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">{item.label}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="relative page-enter" style={{ animationDelay: "0.2s" }}>
            <div className="glass-card p-8 sm:p-10 relative z-10 overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] -mr-16 -mt-16 group-hover:bg-primary/20 transition-colors duration-700" />
              
              <h2 className="text-2xl font-black tracking-tight mb-8">كل ما يحتاجه فريقك</h2>

              <div className="space-y-5">
                {features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <article
                      key={feature.title}
                      className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 transition-all duration-300 hover:bg-white/[0.05] hover:border-primary/30 group/item"
                    >
                      <div className="flex items-start gap-4">
                        <div className="rounded-xl bg-primary/10 p-3 text-primary group-hover/item:scale-110 group-hover/item:bg-primary/20 transition-all duration-500">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white">{feature.title}</h3>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-10 pt-8 border-t border-white/[0.05]">
                <ul className="space-y-3">
                  {highlights.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                      <div className="flex-shrink-0 rounded-full bg-emerald-500/20 p-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            {/* Decorative element behind the card */}
            <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-primary/10 blur-[80px] rounded-full" />
          </div>
        </div>
      </section>

      {/* Footer Decoration */}
      <footer className="relative mt-20 py-10 text-center border-t border-white/[0.05]">
        <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">
          &copy; {new Date().getFullYear()} MAIDAN SYSTEM. جميع الحقوق محفوظة.
        </p>
      </footer>
    </main>
  );
}

