// Server-only. Direct Google Gemini client replacing the old Lovable AI
// Gateway (which proxied chat/vision/TTS through ai.gateway.lovable.dev).
// Safe to import at the top of other .server.ts / .functions.ts server
// handlers — this module does no top-level side effects itself.

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const CHAT_MODEL = "gemini-2.5-flash";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

function apiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");
  return key;
}

async function throwForStatus(res: Response, label: string) {
  const t = await res.text().catch(() => "");
  if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
  if (res.status === 400 || res.status === 403) throw new Error(`${label} auth/quota error: ${res.status} ${t}`);
  throw new Error(`${label} failed: ${res.status} ${t}`);
}

function toGeminiContents(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

function extractText(json: any): string {
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: any) => p.text ?? "").join("");
}

// Chat completion in strict-JSON mode — mirrors the old gateway's
// `response_format: json_object` chat/completions calls.
export async function chatJSON(system: string, messages: ChatMessage[]): Promise<any> {
  const res = await fetch(`${BASE}/${CHAT_MODEL}:generateContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: toGeminiContents(messages),
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) await throwForStatus(res, "Gemini chat");
  const raw = extractText(await res.json()) || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return { reply: raw, actions: [] };
  }
}

function dataUrlToInlineData(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("Invalid data URL");
  return { mimeType: match[1], data: match[2] };
}

// Image/PDF understanding — mirrors the gateway's multimodal chat/completions
// calls (image_url / file parts).
export async function visionAsk(system: string, question: string, dataUrl: string): Promise<string> {
  const inlineData = dataUrlToInlineData(dataUrl);
  const res = await fetch(`${BASE}/${CHAT_MODEL}:generateContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: question }, { inlineData }] }],
    }),
  });
  if (!res.ok) await throwForStatus(res, "Gemini vision");
  return extractText(await res.json());
}

// Same as visionAsk but requesting strict JSON back (screen understanding / OCR).
export async function visionJSON(system: string, question: string, dataUrl: string): Promise<any> {
  const inlineData = dataUrlToInlineData(dataUrl);
  const res = await fetch(`${BASE}/${CHAT_MODEL}:generateContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: question }, { inlineData }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) await throwForStatus(res, "Gemini vision");
  const raw = extractText(await res.json()) || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  }
}

// Gemini TTS returns raw 24kHz/16-bit mono PCM, not a playable file — wrap it
// in a minimal WAV container so the browser <audio> element can play it.
function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function synthesizeSpeech(text: string, voiceName: string): Promise<string> {
  const res = await fetch(`${BASE}/${TTS_MODEL}:generateContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: text.slice(0, 4000) }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    }),
  });
  if (!res.ok) await throwForStatus(res, "Gemini TTS");
  const json = await res.json();
  const inline = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inline?.data) throw new Error("Gemini TTS returned no audio");
  const wav = pcmToWav(Buffer.from(inline.data, "base64"));
  return `data:audio/wav;base64,${wav.toString("base64")}`;
}
