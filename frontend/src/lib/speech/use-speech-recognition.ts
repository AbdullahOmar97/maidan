"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface SpeechRecognitionHookOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

export interface SpeechRecognitionHookResult {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

// Global browser SpeechRecognition interfaces
interface IWindowSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => IWindowSpeechRecognition;

export function useSpeechRecognition({
  lang,
  continuous = false,
  interimResults = true,
  onResult,
  onError,
  onEnd,
}: SpeechRecognitionHookOptions = {}): SpeechRecognitionHookResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<IWindowSpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      null;

    setIsSupported(Boolean(SpeechRec));
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Recognition already stopped
      }
    }
    setIsListening(false);
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    if (typeof window === "undefined") return;

    const SpeechRec: SpeechRecognitionConstructor | null =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      null;

    if (!SpeechRec) {
      const err = "خاصية الإدخال الصوتي غير مدعومة في هذا المتصفح.";
      setError(err);
      onError?.(err);
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRec();
      const currentDocLang = document.documentElement.lang || "ar";
      const resolvedLang = lang || (currentDocLang.startsWith("ar") ? "ar-SA" : "en-US");

      recognition.lang = resolvedLang;
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let finalTrans = "";
        let interimTrans = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTrans += item[0].transcript;
          } else {
            interimTrans += item[0].transcript;
          }
        }

        if (finalTrans) {
          setTranscript((prev) => {
            const next = prev ? `${prev} ${finalTrans}` : finalTrans;
            onResult?.(next, true);
            return next;
          });
        }

        setInterimTranscript(interimTrans);
        if (interimTrans && !finalTrans) {
          onResult?.(interimTrans, false);
        }
      };

      recognition.onerror = (event: any) => {
        let errorMsg = "حدث خطأ أثناء التعرف على الصوت.";
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          errorMsg = "تم رفض إذن استخدام الميكروفون. يرجى تفعيل الإذن من إعدادات المتصفح.";
        } else if (event.error === "no-speech") {
          errorMsg = "لم يتم التقاط أي صوت، يرجى المحاولة مرة أخرى.";
        } else if (event.error === "network") {
          errorMsg = "تعذر الاتصال بخدمة التعرف على الصوت.";
        }
        setError(errorMsg);
        setIsListening(false);
        onError?.(errorMsg);
      };

      recognition.onend = () => {
        setIsListening(false);
        onEnd?.();
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      const err = e?.message || "تعذر بدء التعرف على الصوت.";
      setError(err);
      setIsListening(false);
      onError?.(err);
    }
  }, [continuous, interimResults, lang, onError, onEnd, onResult]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Cleanup ignore
        }
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
