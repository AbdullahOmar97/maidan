/**
 * MAIDAN — Martial Arts Belt Localization Utilities
 *
 * Provides accurate Arabic terminology for belts, ranks, and degrees
 * according to international martial arts federations (IBJJF, WKF, IJF, WT).
 */

export function getArabicBeltName(name?: string | null, nameAr?: string | null): string {
  if (nameAr && nameAr.trim()) {
    return nameAr.trim();
  }
  if (!name || !name.trim()) {
    return "حزام غير محدد";
  }

  const clean = name.trim();

  // If already written in Arabic characters, return as is
  if (/[\u0600-\u06FF]/.test(clean)) {
    return clean;
  }

  const lower = clean.toLowerCase();

  const beltMap: Record<string, string> = {
    white: "الحزام الأبيض",
    "white belt": "الحزام الأبيض",
    grey: "الحزام الرمادي",
    "grey belt": "الحزام الرمادي",
    gray: "الحزام الرمادي",
    "gray belt": "الحزام الرمادي",
    yellow: "الحزام الأصفر",
    "yellow belt": "الحزام الأصفر",
    orange: "الحزام البرتقالي",
    "orange belt": "الحزام البرتقالي",
    green: "الحزام الأخضر",
    "green belt": "الحزام الأخضر",
    blue: "الحزام الأزرق",
    "blue belt": "الحزام الأزرق",
    purple: "الحزام البنفسجي",
    "purple belt": "الحزام البنفسجي",
    brown: "الحزام البني",
    "brown belt": "الحزام البني",
    black: "الحزام الأسود",
    "black belt": "الحزام الأسود",
    red: "الحزام الأحمر",
    "red belt": "الحزام الأحمر",
    coral: "الحزام المرجاني",
    "coral belt": "الحزام المرجاني",
    "red/black": "الحزام الأحمر والأسود (المرجاني)",
    "red/white": "الحزام الأحمر والأبيض",
  };

  if (beltMap[lower]) {
    return beltMap[lower];
  }

  // Handle compound names or prefixes (e.g. "Blue Belt 1st Degree", "White / Yellow")
  for (const [key, ar] of Object.entries(beltMap)) {
    if (lower.startsWith(key)) {
      const extra = clean.slice(key.length).replace(/^[\s\-_:/]+/, "").trim();
      if (extra) {
        return `${ar} (${extra})`;
      }
      return ar;
    }
  }

  return clean;
}
