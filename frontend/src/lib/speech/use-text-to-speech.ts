"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface TextToSpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceName?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export interface TextToSpeechHookResult {
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  speak: (text: string, options?: TextToSpeechOptions) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export function useTextToSpeech(): TextToSpeechHookResult {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const updateVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, []);

  const speak = useCallback(
    (text: string, options: TextToSpeechOptions = {}) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        options.onError?.("خاصية نطق النصوص غير مدعومة في هذا المتصفح.");
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) return;

      // Stop any existing speech before starting
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(trimmed);
      utteranceRef.current = utterance;

      const docLang = document.documentElement.lang || "ar";
      const targetLang = options.lang || (docLang.startsWith("ar") ? "ar-SA" : "en-US");
      utterance.lang = targetLang;
      utterance.rate = options.rate ?? 1.0;
      utterance.pitch = options.pitch ?? 1.0;
      utterance.volume = options.volume ?? 1.0;

      // Match voice if requested or find suitable language voice
      const currentVoices = window.speechSynthesis.getVoices();
      if (options.voiceName) {
        const found = currentVoices.find((v) => v.name === options.voiceName);
        if (found) utterance.voice = found;
      } else {
        const prefix = targetLang.slice(0, 2);
        const matchVoice = currentVoices.find((v) => v.lang.startsWith(prefix));
        if (matchVoice) utterance.voice = matchVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
        options.onStart?.();
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        options.onEnd?.();
      };

      utterance.onerror = (e) => {
        setIsSpeaking(false);
        setIsPaused(false);
        if (e.error !== "canceled" && e.error !== "interrupted") {
          options.onError?.(`حدث خطأ أثناء نطق النص: ${e.error}`);
        }
      };

      window.speechSynthesis.speak(utterance);
    },
    []
  );

  return {
    isSpeaking,
    isPaused,
    isSupported,
    voices,
    speak,
    pause,
    resume,
    stop,
  };
}
