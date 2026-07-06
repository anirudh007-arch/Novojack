import { useEffect, useRef, useState, useCallback } from "react";

type SR = any;

export function useSpeechRecognition(language: string = "en-US") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const recRef = useRef<SR | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const W = window as any;
    const SRClass = W.SpeechRecognition || W.webkitSpeechRecognition;
    setSupported(!!SRClass);
  }, []);

  const start = useCallback(
    (onFinal?: (text: string) => void) => {
      const W = window as any;
      const SRClass = W.SpeechRecognition || W.webkitSpeechRecognition;
      if (!SRClass) return;
      const rec: SR = new SRClass();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = language;
      let finalText = "";
      rec.onresult = (e: any) => {
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += t;
          else interimText += t;
        }
        setInterim(interimText);
        if (finalText) setTranscript(finalText);
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => {
        setListening(false);
        setInterim("");
        if (finalText.trim() && onFinal) onFinal(finalText.trim());
      };
      recRef.current = rec;
      setTranscript("");
      setInterim("");
      setListening(true);
      rec.start();
    },
    [language]
  );

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, transcript, interim, start, stop };
}
