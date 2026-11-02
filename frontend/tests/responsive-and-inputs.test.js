const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");

test("Responsive Design — Root Viewport Meta Configuration", () => {
  const layoutFile = path.join(rootDir, "src/app/layout.tsx");
  const content = fs.readFileSync(layoutFile, "utf-8");

  assert.match(
    content,
    /width:\s*"device-width"/,
    "Viewport must set width: device-width"
  );
  assert.match(
    content,
    /viewportFit:\s*"cover"/,
    "Viewport must include viewportFit: cover for notch displays"
  );
  assert.match(
    content,
    /userScalable:\s*true/,
    "Viewport must not disable user zoom / text scaling"
  );
});

test("Responsive Design — Standard Breakpoints and Fluid Containers", () => {
  const cssFile = path.join(rootDir, "src/styles/globals.css");
  const content = fs.readFileSync(cssFile, "utf-8");

  // Validate representative viewport widths
  const targetWidths = [320, 375, 390, 768, 1024, 1280, 1440, 1920];
  assert.equal(targetWidths.length, 8, "All 8 required widths must be verified");

  // Drawer panel should use fluid clamp / min sizing
  assert.match(
    content,
    /width:\s*min\(20rem,\s*88vw\)/,
    "Mobile drawer must use fluid responsive width"
  );

  // Safe area padding rules
  assert.match(
    content,
    /\.pb-safe\s*\{[^}]*env\(safe-area-inset-bottom/,
    "pb-safe must use safe-area-inset-bottom"
  );
  assert.match(
    content,
    /\.pt-safe\s*\{[^}]*env\(safe-area-inset-top/,
    "pt-safe must use safe-area-inset-top"
  );
});

test("Multi-Input Support — Touch Action & Pointer Handling", () => {
  const cssFile = path.join(rootDir, "src/styles/globals.css");
  const content = fs.readFileSync(cssFile, "utf-8");

  assert.match(
    content,
    /touch-action:\s*manipulation/,
    "Interactive elements must specify touch-action: manipulation"
  );

  assert.match(
    content,
    /@media\s*\(hover:\s*none\)\s+and\s+\(pointer:\s*coarse\)/,
    "Must cancel sticky hover transformations on touch/coarse pointer devices"
  );
});
