import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Continuous "Hey Nova" wake-word listener using browser SpeechRecognition.
 * When wake word is heard, captures the rest of the utterance and fires onCommand.
 * Also supports "stop"/"cancel" to interrupt.
 */
export function useWakeWord(opts: {
  language?: string;
  onCommand?: (text: string) => void;
  onInterrupt?: () => void;
  enabled?: boolean;
}) {
  const { language = "en-US", onCommand, onInterrupt, enabled = false } = opts;
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [heard, setHeard] = useState("");
  const recRef = useRef<any>(null);
  const restartRef = useRef(true);
  const cbRef = useRef({ onCommand, onInterrupt });
  cbRef.current = { onCommand, onInterrupt };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const W = window as any;
    setSupported(!!(W.SpeechRecognition || W.webkitSpeechRecognition));
  }, []);

  const stop = useCallback(() => {
    restartRef.current = false;
    try { recRef.current?.stop(); } catch {}
    setActive(false);
  }, []);

  useEffect(() => {
    if (!enabled || !supported) { stop(); return; }
    const W = window as any;
    const SRClass = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SRClass) return;

    restartRef.current = true;
    const rec = new SRClass();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = language;

    rec.onresult = (e: any) => {
      let finalText = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      const blob = (finalText || interim).toLowerCase();
      setHeard(blob.slice(-80));
      // interrupt words
      if (/\b(stop|cancel|nova stop)\b/.test(blob)) cbRef.current.onInterrupt?.();
      // wake word
      const m = blob.match(/(?:hey|hi|ok|okay)\s+nova[,!.\s]+(.+)/i);
      if (m && finalText) {
        const cmd = m[1].trim();
        if (cmd.length > 1) cbRef.current.onCommand?.(cmd);
      }
    };
    rec.onerror = () => {};
    rec.onend = () => {
      setActive(false);
      if (restartRef.current) {
        try { rec.start(); setActive(true); } catch {}
      }
    };

    recRef.current = rec;
    try { rec.start(); setActive(true); } catch {}

    return () => { restartRef.current = false; try { rec.stop(); } catch {} };
  }, [enabled, supported, language, stop]);

  return { supported, active, heard };
}
