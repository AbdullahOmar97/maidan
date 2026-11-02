const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");

test("PWA — Manifest Configuration", () => {
  const manifestFile = path.join(rootDir, "src/app/manifest.ts");
  assert.ok(fs.existsSync(manifestFile), "manifest.ts must exist");
  const content = fs.readFileSync(manifestFile, "utf-8");

  assert.match(content, /start_url:\s*["']\/dashboard["']/);
  assert.match(content, /display:\s*["']standalone["']/);
  assert.match(content, /background_color:\s*["']#050811["']/);
  assert.match(content, /theme_color:\s*["']#050811["']/);
  assert.match(content, /icons:/);
});

test("PWA & Security — Service Worker Caching Safeguards", () => {
  const swFile = path.join(rootDir, "public/sw.js");
  assert.ok(fs.existsSync(swFile), "sw.js must exist in public folder");
  const content = fs.readFileSync(swFile, "utf-8");

  assert.match(
    content,
    /request\.method\s*!==\s*["']GET["']/,
    "Service worker must never cache non-GET mutating requests"
  );
  assert.match(
    content,
    /url\.pathname\.startsWith\(["']\/api\/auth["']\)/,
    "Service worker must never cache sensitive authentication or token endpoints"
  );
  assert.match(
    content,
    /request\.mode\s*===\s*["']navigate["']/,
    "Service worker must handle navigation with network-first strategy"
  );
});

test("Performance & Accessibility — Prefers-Reduced-Motion Rules", () => {
  const cssFile = path.join(rootDir, "src/styles/globals.css");
  const content = fs.readFileSync(cssFile, "utf-8");

  assert.match(
    content,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)/,
    "globals.css must respect prefers-reduced-motion user preference"
  );
  assert.match(
    content,
    /animation-duration:\s*0\.01ms\s*!important/,
    "Animations must be suppressed when reduced motion is requested"
  );
});

test("Performance & Usability — Print Media Stylesheet", () => {
  const cssFile = path.join(rootDir, "src/styles/globals.css");
  const content = fs.readFileSync(cssFile, "utf-8");

  assert.match(
    content,
    /@media\s+print/,
    "globals.css must include dedicated print media styles"
  );
  assert.match(
    content,
    /\.no-print\s*\{[^}]*display:\s*none\s*!important/,
    "Non-printable UI chrome must be hidden during printing"
  );
});
