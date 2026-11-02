"use client";

import { useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { useSpeechRecognition } from "@/lib/speech/use-speech-recognition";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VoiceSearchButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  lang?: string;
  inputName?: string;
}

export function VoiceSearchButton({
  onTranscript,
  className,
  lang,
  inputName = "حقل البحث",
}: VoiceSearchButtonProps) {
  const [interim, setInterim] = useState("");

  const {
    isListening,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    lang,
    continuous: false,
    interimResults: true,
    onResult: (text, isFinal) => {
      setInterim(text);
      if (isFinal) {
        onTranscript(text);
        setInterim("");
        toast.success(`تم إدخال النص صوتياً: "${text}"`);
      }
    },
    onError: (err) => {
      toast.error(err);
      setInterim("");
    },
    onEnd: () => {
      setInterim("");
    },
  });

  if (!isSupported) {
    return null; // Graceful progressive enhancement
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "touch-target w-10 h-10 rounded-xl flex items-center justify-center transition-all select-none relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          isListening
            ? "bg-primary text-white shadow-lg shadow-primary/30 animate-pulse"
            : "text-muted-foreground hover:text-white hover:bg-white/10 active:scale-95",
          className
        )}
        aria-label={
          isListening
            ? `إيقاف الإدخال الصوتي لـ ${inputName}`
            : `البحث والإدخال الصوتي لـ ${inputName}`
        }
        aria-pressed={isListening}
      >
        {isListening ? (
          <MicOff className="w-4 h-4 pointer-events-none" aria-hidden="true" />
        ) : (
          <Mic className="w-4 h-4 pointer-events-none" aria-hidden="true" />
        )}
      </button>

      {/* Screen reader live announcement */}
      <span className="sr-only" role="status" aria-live="polite">
        {isListening
          ? interim
            ? `جاري التقاط الصوت: ${interim}`
            : "الميكروفون قيد العمل، تحدث الآن..."
          : ""}
      </span>
    </div>
  );
}
