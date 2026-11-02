"use client";

import { useEffect } from "react";

/**
 * Patterns matching ClickFix / ClearFake / Pastejacking PowerShell & shell payloads.
 */
const MALICIOUS_CLIPBOARD_PATTERN =
  /powershell|pwsh|cmd\.exe|mshta|wscript|cscript|rundll32|regsvr32|certutil|bitsadmin|invoke-expression|invoke-webrequest|invoke-restmethod|\biex\b|\birm\b|\biwr\b|-encodedcommand|-enc\s|-windowstyle\s+hidden|-w\s+hidden|-ep\s+bypass|executionpolicy\s+bypass|verification\s+id|not\s+a\s+robot|recaptcha/i;

/**
 * Patterns matching ClickFix / Fake CAPTCHA social engineering DOM overlays.
 */
const CLICKFIX_DOM_PATTERN =
  /complete\s+these\s+verification\s+steps|prove\s+you\s+are\s+not\s+a\s+robot|open\s+windows\s+powershell|open\s+power\s+user\s+menu|recaptcha\s+verification\s+id|press\s+windows\s+key/i;

/**
 * Checks whether a DOM element is part of the legitimate Maidan application tree.
 */
function isProtectedAppElement(el: Element): boolean {
  if (el === document.documentElement || el === document.body || el === document.head) {
    return true;
  }
  if (el.hasAttribute("data-maidan-root") || el.querySelector("[data-maidan-root]")) {
    return true;
  }
  if (el.hasAttribute("data-sonner-toaster") || el.closest("[data-sonner-toaster]")) {
    return true;
  }
  return false;
}

/**
 * Inspects and neutralizes unauthorized scripts, iframes, and ClickFix overlays.
 */
function sanitizeNode(node: Node, scrubClipboard: () => void): void {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;

  // 1. Block any injected <iframe>, <object>, <embed>, <applet>
  const tagName = el.tagName.toUpperCase();
  if (tagName === "IFRAME" || tagName === "OBJECT" || tagName === "EMBED" || tagName === "APPLET") {
    el.remove();
    scrubClipboard();
    return;
  }

  // 2. Block external <script> tags not originating from same origin
  if (tagName === "SCRIPT") {
    const src = el.getAttribute("src");
    if (src && !src.startsWith("/") && !src.startsWith(window.location.origin)) {
      el.remove();
      scrubClipboard();
      return;
    }
  }

  // Also strip nested iframes/external scripts inside newly injected subtrees
  const nestedFrames = el.querySelectorAll("iframe, object, embed, applet");
  if (nestedFrames.length > 0) {
    nestedFrames.forEach((frame) => frame.remove());
    scrubClipboard();
  }

  const nestedScripts = el.querySelectorAll("script[src]");
  nestedScripts.forEach((script) => {
    const src = script.getAttribute("src");
    if (src && !src.startsWith("/") && !src.startsWith(window.location.origin)) {
      script.remove();
      scrubClipboard();
    }
  });

  // 3. Detect and remove ClickFix / Fake CAPTCHA overlay nodes
  const text = el.textContent || "";
  if (CLICKFIX_DOM_PATTERN.test(text)) {
    // Walk up to the highest removable wrapper outside the protected app root
    let target: Element = el;
    while (
      target.parentElement &&
      target.parentElement !== document.body &&
      target.parentElement !== document.documentElement &&
      !isProtectedAppElement(target.parentElement)
    ) {
      target = target.parentElement;
    }

    if (!isProtectedAppElement(target)) {
      target.remove();
      scrubClipboard();
      // Restore body scroll if locked by the malicious modal
      if (document.body) {
        document.body.style.removeProperty("overflow");
        document.body.style.removeProperty("pointer-events");
        document.body.style.removeProperty("filter");
      }
    }
  }
}

/**
 * Runtime Application Self-Protection (RASP) component.
 * Neutralizes browser-extension DOM injections (ClickFix / ClearFake / Fake reCAPTCHA)
 * and blocks unauthorized clipboard hijacking (Pastejacking).
 */
export function SecurityShield() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalWriteText =
      navigator.clipboard && typeof navigator.clipboard.writeText === "function"
        ? navigator.clipboard.writeText.bind(navigator.clipboard)
        : null;

    const scrubClipboard = () => {
      try {
        if (originalWriteText) {
          void originalWriteText("");
        }
      } catch {
        // Ignore clipboard permission errors when window is not focused
      }
    };

    // --- 1. Clipboard Firewall (navigator.clipboard.writeText & write) ---
    if (navigator.clipboard) {
      try {
        if (originalWriteText) {
          navigator.clipboard.writeText = async (text: string): Promise<void> => {
            if (typeof text === "string" && MALICIOUS_CLIPBOARD_PATTERN.test(text)) {
              await originalWriteText("");
              return;
            }
            return originalWriteText(text);
          };
        }

        if (typeof navigator.clipboard.write === "function") {
          const originalWrite = navigator.clipboard.write.bind(navigator.clipboard);
          navigator.clipboard.write = async (data: ClipboardItems): Promise<void> => {
            for (const item of data) {
              if (item.types.includes("text/plain")) {
                const blob = await item.getType("text/plain");
                const text = await blob.text();
                if (MALICIOUS_CLIPBOARD_PATTERN.test(text)) {
                  if (originalWriteText) await originalWriteText("");
                  return;
                }
              }
            }
            return originalWrite(data);
          };
        }
      } catch {
        // Ignore if navigator.clipboard properties are read-only in specific environments
      }
    }

    // --- 2. Legacy document.execCommand('copy') Firewall ---
    const originalExecCommand =
      typeof document.execCommand === "function" ? document.execCommand.bind(document) : null;

    if (originalExecCommand) {
      try {
        document.execCommand = (commandId: string, showUI?: boolean, value?: string): boolean => {
          const cmd = commandId.toLowerCase();
          if (cmd === "copy" || cmd === "cut") {
            const selectionText = window.getSelection()?.toString() || "";
            const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
            const activeVal = activeEl && typeof activeEl.value === "string" ? activeEl.value : "";

            if (
              MALICIOUS_CLIPBOARD_PATTERN.test(selectionText) ||
              MALICIOUS_CLIPBOARD_PATTERN.test(activeVal) ||
              (value && MALICIOUS_CLIPBOARD_PATTERN.test(value))
            ) {
              window.getSelection()?.removeAllRanges();
              if (activeEl && typeof activeEl.value === "string") {
                activeEl.value = "";
              }
              scrubClipboard();
              return false;
            }
          }
          return originalExecCommand(commandId, showUI, value);
        };
      } catch {
        // Ignore if read-only
      }
    }

    // --- 3. Capture-Phase Copy/Cut Event Interceptor ---
    const handleCopyOrCut = (e: ClipboardEvent) => {
      const selectionText = window.getSelection()?.toString() || "";
      const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
      const activeVal = activeEl && typeof activeEl.value === "string" ? activeEl.value : "";

      if (
        MALICIOUS_CLIPBOARD_PATTERN.test(selectionText) ||
        MALICIOUS_CLIPBOARD_PATTERN.test(activeVal)
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        e.clipboardData?.setData("text/plain", "");
        scrubClipboard();
      }
    };

    window.addEventListener("copy", handleCopyOrCut, true);
    window.addEventListener("cut", handleCopyOrCut, true);

    // --- 4. Real-Time DOM MutationObserver ---
    const sweepDOM = () => {
      if (!document.body) return;
      Array.from(document.body.children).forEach((child) => {
        sanitizeNode(child, scrubClipboard);
      });
    };

    sweepDOM();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          sanitizeNode(mutation.addedNodes[i], scrubClipboard);
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    return () => {
      window.removeEventListener("copy", handleCopyOrCut, true);
      window.removeEventListener("cut", handleCopyOrCut, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
