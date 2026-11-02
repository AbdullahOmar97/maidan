const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");

test("WCAG 2.2 AA — Skip to Main Content Link (SC 2.4.1 Bypass Blocks)", () => {
  const shellFile = path.join(rootDir, "src/components/dashboard/dashboard-shell.tsx");
  const content = fs.readFileSync(shellFile, "utf-8");

  assert.match(
    content,
    /href="#main-content"/,
    "Dashboard shell must include a skip link targeting #main-content"
  );
  assert.match(
    content,
    /sr-only focus:not-sr-only/,
    "Skip link must be visually hidden until focused"
  );
  assert.match(
    content,
    /id="main-content"/,
    "Target main element with id='main-content' must exist"
  );
});

test("WCAG 2.2 AA — Visible Focus Indicators (SC 2.4.7 & 2.4.11 Focus Appearance)", () => {
  const cssFile = path.join(rootDir, "src/styles/globals.css");
  const content = fs.readFileSync(cssFile, "utf-8");

  assert.match(
    content,
    /:focus-visible\s*\{[^}]*outline:/,
    "globals.css must specify an accessible, prominent :focus-visible outline"
  );
});

test("WCAG 2.2 AA — Target Size Minimum (SC 2.5.5 / 2.5.8 Target Size)", () => {
  const cssFile = path.join(rootDir, "src/styles/globals.css");
  const content = fs.readFileSync(cssFile, "utf-8");

  assert.match(
    content,
    /\.touch-target\s*\{[^}]*min-h-\[44px\]\s+min-w-\[44px\]/,
    "touch-target class must enforce at least 44x44px target size"
  );
});

test("WCAG 2.2 AA — Accessible Form Controls & Error Associations (SC 1.3.1, 3.3.2, 4.1.2)", () => {
  const formFieldFile = path.join(rootDir, "src/components/ui/form-field.tsx");
  const content = fs.readFileSync(formFieldFile, "utf-8");

  assert.match(
    content,
    /htmlFor=\{fieldId\}/,
    "FormField label must be programmatically associated with input via htmlFor"
  );
  assert.match(
    content,
    /role="alert"/,
    "Validation errors must carry role='alert' for screen reader announcements"
  );
  assert.match(
    content,
    /aria-invalid/,
    "Inputs must expose aria-invalid attribute when in error state"
  );
  assert.match(
    content,
    /aria-describedby/,
    "Inputs must be described by error/hint via aria-describedby"
  );
});

test("WCAG 2.2 AA — Dialog & Drawer Semantics & Focus Trapping (SC 2.1.2 No Keyboard Trap, 4.1.2)", () => {
  const modalFile = path.join(rootDir, "src/components/ui/modal.tsx");
  const modalContent = fs.readFileSync(modalFile, "utf-8");

  assert.match(
    modalContent,
    /role="dialog"/,
    "Modal must have role='dialog'"
  );
  assert.match(
    modalContent,
    /aria-modal="true"/,
    "Modal must have aria-modal='true'"
  );
  assert.match(
    modalContent,
    /e\.key === "Tab"/,
    "Modal must trap Tab / Shift+Tab keyboard focus"
  );
  assert.match(
    modalContent,
    /e\.key === "Escape"/,
    "Modal must support Escape key dismissal"
  );

  const drawerFile = path.join(rootDir, "src/components/ui/drawer.tsx");
  const drawerContent = fs.readFileSync(drawerFile, "utf-8");

  assert.match(
    drawerContent,
    /role="dialog"/,
    "Drawer must have role='dialog'"
  );
  assert.match(
    drawerContent,
    /aria-modal="true"/,
    "Drawer must have aria-modal='true'"
  );
  assert.match(
    drawerContent,
    /e\.key === "Tab"/,
    "Drawer must trap Tab / Shift+Tab keyboard focus"
  );
  assert.match(
    drawerContent,
    /e\.key === "Escape"/,
    "Drawer must support Escape key dismissal"
  );
});

test("WCAG 2.2 AA — Table Column Headers Accessibility (SC 1.3.1 Info and Relationships)", () => {
  const tableFile = path.join(rootDir, "src/components/ui/mobile-table.tsx");
  const content = fs.readFileSync(tableFile, "utf-8");

  assert.match(
    content,
    /scope="col"/,
    "Table header cells must specify scope='col'"
  );
  assert.match(
    content,
    /<span className="sr-only">الإجراءات<\/span>/,
    "Action header column must provide an accessible text name for screen readers"
  );
});
