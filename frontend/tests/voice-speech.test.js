const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");

test("Voice & Speech Accessibility — Speech Recognition Hook", () => {
  const file = path.join(rootDir, "src/lib/speech/use-speech-recognition.ts");
  const content = fs.readFileSync(file, "utf-8");

  assert.ok(
    content.includes("SpeechRecognition") && content.includes("webkitSpeechRecognition"),
    "Speech recognition hook must feature-detect both standard and webkit prefixes"
  );
  assert.match(
    content,
    /event\.error === "not-allowed"/,
    "Must handle microphone permission denied with clear user instructions"
  );
  assert.match(
    content,
    /continuous|interimResults/,
    "Must support continuous and interim results configuration"
  );
});

test("Voice & Speech Accessibility — Text-to-Speech Hook", () => {
  const file = path.join(rootDir, "src/lib/speech/use-text-to-speech.ts");
  const content = fs.readFileSync(file, "utf-8");

  assert.ok(
    content.includes("speechSynthesis") && content.includes("in window"),
    "Text-to-speech hook must feature detect speechSynthesis in window"
  );
  assert.match(
    content,
    /utterance\.lang\s*=/,
    "Utterance must be configured with target language (Arabic/English)"
  );
  assert.match(
    content,
    /window\.speechSynthesis\.cancel\(\)/,
    "Must cancel pending speech on unmount/stop to prevent intrusive playback"
  );
});

test("Voice & Speech Accessibility — UI Components Progressive Enhancement", () => {
  const btnFile = path.join(rootDir, "src/components/ui/voice-search-button.tsx");
  const btnContent = fs.readFileSync(btnFile, "utf-8");

  assert.ok(
    btnContent.includes("if (!isSupported)") && btnContent.includes("return null"),
    "VoiceSearchButton must progressively enhance without breaking unsupported browsers"
  );
  assert.match(
    btnContent,
    /role="status"\s+aria-live="polite"/,
    "VoiceSearchButton must provide live region status for screen readers during listening"
  );

  const readerFile = path.join(rootDir, "src/components/ui/speech-reader-button.tsx");
  const readerContent = fs.readFileSync(readerFile, "utf-8");

  assert.ok(
    readerContent.includes("if (!isSupported") && readerContent.includes("return null"),
    "SpeechReaderButton must progressively enhance and require text"
  );
});
