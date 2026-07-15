import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { speakText } from "@/lib/nova.functions";

// Splits a reply into speakable chunks (roughly one sentence each) so we can
// start playing the first chunk while later chunks are still being synthesized.
// Handles Latin, CJK, and Indic (danda) sentence terminators.
function splitIntoChunks(text: string): string[] {
  const pieces = text.match(/[^.!?।॥。！？\n]+[.!?।॥。！？]*/g) || [text];
  const chunks: string[] = [];
  let buf = "";
  for (const piece of pieces) {
    buf += piece;
    // Flush on a sentence end, or once a chunk is long enough to be worth speaking.
    if (/[.!?।॥。！？]\s*$/.test(buf) || buf.trim().length >= 90) {
      if (buf.trim()) chunks.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.filter(Boolean);
}

function playClip(audio: HTMLAudioElement, src: string, canceled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (canceled()) return resolve();
    const done = () => {
      audio.removeEventListener("ended", done);
      audio.removeEventListener("error", done);
      resolve();
    };
    audio.addEventListener("ended", done);
    audio.addEventListener("error", done);
    audio.src = src;
    audio.play().catch(() => done());
  });
}

// Speaks a reply as a low-latency pipeline: synthesize chunk N+1 while chunk N
// is still playing, so time-to-first-audio is one short sentence instead of the
// whole paragraph. stop() cancels immediately (used for barge-in and muting).
export function useSpeechQueue(voice: string) {
  const tts = useServerFn(speakText);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canceledRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") audioRef.current = new Audio();
    return () => {
      canceledRef.current = true;
      audioRef.current?.pause();
    };
  }, []);

  const stop = useCallback(() => {
    canceledRef.current = true;
    const a = audioRef.current;
    if (a) {
      a.pause();
      try { a.currentTime = 0; } catch {}
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const audio = audioRef.current;
      if (!audio || !text.trim()) return;
      const chunks = splitIntoChunks(text);
      if (!chunks.length) return;

      canceledRef.current = false;
      setSpeaking(true);

      // Prefetch the next chunk's audio while the current one plays.
      let nextClip = tts({ data: { text: chunks[0], voice } }).catch(() => null);
      for (let i = 0; i < chunks.length; i++) {
        const clip = await nextClip;
        nextClip =
          i + 1 < chunks.length
            ? tts({ data: { text: chunks[i + 1], voice } }).catch(() => null)
            : Promise.resolve(null);
        if (canceledRef.current) break;
        if (clip?.audio) await playClip(audio, clip.audio, () => canceledRef.current);
        if (canceledRef.current) break;
      }

      if (!canceledRef.current) setSpeaking(false);
    },
    [tts, voice],
  );

  return { speak, stop, speaking };
}
