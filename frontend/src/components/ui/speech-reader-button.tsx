"use client";

import { Volume2, VolumeX, Pause, Play } from "lucide-react";
import { useTextToSpeech } from "@/lib/speech/use-text-to-speech";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SpeechReaderButtonProps {
  text: string;
  label?: string;
  className?: string;
  lang?: string;
}

export function SpeechReaderButton({
  text,
  label = "استمع للمحتوى",
  className,
  lang,
}: SpeechReaderButtonProps) {
  const { isSpeaking, isPaused, isSupported, speak, pause, resume, stop } =
    useTextToSpeech();

  if (!isSupported || !text) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSpeaking) {
      if (isPaused) {
        resume();
      } else {
        stop();
      }
    } else {
      speak(text, {
        lang,
        onError: (err) => toast.error(err),
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "touch-target px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all duration-200 border select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isSpeaking
          ? "bg-primary/20 text-primary border-primary/30"
          : "bg-white/5 text-muted-foreground hover:text-white hover:bg-white/10 border-white/10",
        className
      )}
      aria-label={
        isSpeaking
          ? `إيقاف قراءة ${label}`
          : `قراءة صوتية: ${label}`
      }
      aria-pressed={isSpeaking}
    >
      {isSpeaking ? (
        <VolumeX className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Volume2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>{isSpeaking ? "إيقاف الصوت" : label}</span>
    </button>
  );
}
