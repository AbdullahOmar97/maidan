const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");

test("Internationalization — Dynamic RTL/LTR and Lang Synchronization", () => {
  const shellFile = path.join(rootDir, "src/components/dashboard/dashboard-shell.tsx");
  const content = fs.readFileSync(shellFile, "utf-8");

  assert.match(
    content,
    /document\.documentElement\.dir\s*=\s*langPref\s*===\s*"ar"\s*\?\s*"rtl"\s*:\s*"ltr"/,
    "Shell must dynamically set html dir attribute based on language preference"
  );
  assert.match(
    content,
    /document\.documentElement\.lang\s*=\s*langPref/,
    "Shell must dynamically set html lang attribute"
  );
});

test("Internationalization — CSS Logical Properties and Directional Elements", () => {
  const cssFile = path.join(rootDir, "src/styles/globals.css");
  const content = fs.readFileSync(cssFile, "utf-8");

  assert.match(
    content,
    /\[dir="rtl"\]\s*\.rtl-flip\s*\{[^}]*scaleX\(-1\)/,
    "RTL flip utility must invert directional icons appropriately"
  );

  const topbarFile = path.join(rootDir, "src/components/dashboard/topbar.tsx");
  const topbarContent = fs.readFileSync(topbarFile, "utf-8");

  assert.match(
    topbarContent,
    /start-0|end-4|ps-|pe-/,
    "Topbar must utilize CSS logical properties (start, end, ps, pe)"
  );
});

test("Internationalization — Arabic Numerals and Formatting Consistency", () => {
  const cssFile = path.join(rootDir, "src/styles/globals.css");
  const content = fs.readFileSync(cssFile, "utf-8");

  assert.match(
    content,
    /font-variant-numeric:\s*lining-nums\s+tabular-nums/,
    "Typography must ensure lining and tabular nums for clean financial/data presentation"
  );
});
