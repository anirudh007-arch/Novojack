import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type MediaInput = {
  question: string;
  // data URL: data:image/png;base64,... or data:application/pdf;base64,...
  dataUrl: string;
  filename?: string;
};

export const analyzeMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as MediaInput)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    if (!data.dataUrl?.startsWith("data:")) throw new Error("Invalid file");

    const isPdf = data.dataUrl.startsWith("data:application/pdf");
    const isImage = data.dataUrl.startsWith("data:image/");
    if (!isPdf && !isImage) throw new Error("Only images or PDFs are supported");

    const question =
      data.question?.trim() ||
      (isPdf ? "Summarize this document and pull out any key facts." : "Describe what's on this screen and explain anything important.");

    const userContent: any[] = [{ type: "text", text: question }];
    if (isImage) {
      userContent.push({ type: "image_url", image_url: { url: data.dataUrl } });
    } else {
      const base64 = data.dataUrl.split(",")[1] ?? "";
      userContent.push({
        type: "file",
        file: {
          filename: data.filename || "document.pdf",
          file_data: `data:application/pdf;base64,${base64}`,
        },
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are Nova, a helpful AI. When given a screenshot, describe what the user is looking at and answer their question clearly. When given a PDF, summarize and answer questions accurately citing the document.",
          },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`Vision request failed: ${res.status} ${t}`);
    }
    const json = await res.json();
    const reply: string = json.choices?.[0]?.message?.content ?? "";
    return { reply };
  });

// ---------- Screen Understanding ----------
type ScreenInput = { dataUrl: string; question?: string; languageHint?: string };

export type ScreenUnderstanding = {
  summary: string;
  visible_text: string[];
  ui_elements: { label: string; kind: string; purpose: string }[];
  suggested_actions: { title: string; rationale: string; requires_desktop: boolean }[];
  answer?: string;
  // OCR diagnostics
  detected_languages?: string[]; // BCP-47 / ISO codes, e.g. ["en","ja"]
  orientation_degrees?: 0 | 90 | 180 | 270;
  image_quality?: "high" | "medium" | "low";
  notes?: string; // e.g. "rotated 90° CW", "low-res, text upscaled"
};

const SCREEN_SYSTEM = (languageHint?: string) => `You are Nova's Screen Understanding + OCR agent.
You handle imperfect screenshots: ROTATED (90/180/270°), LOW-RESOLUTION, BLURRY, COMPRESSED, or MIXED-LANGUAGE.

OCR procedure (do this internally before answering):
1. Detect orientation. If the image is rotated, mentally rotate it upright before reading text.
2. Auto-detect every script/language present (Latin, CJK, Cyrillic, Arabic, Devanagari, Hebrew, Thai, Greek, etc.).
   Report them as BCP-47 codes in "detected_languages" (e.g. "en","zh","ja","ar","ru").${languageHint ? ` User language hint: "${languageHint}" — prefer it on ties.` : ""}
3. For low-resolution / blurry text: read characters generously, use surrounding UI context (icons, layout, common app patterns) to disambiguate. Prefer plausible words over gibberish. If a token is unreadable, write [?].
4. Preserve original script — do NOT translate unless asked. Keep punctuation and casing as shown.
5. Read in natural reading order (top→bottom, left→right; right→left for RTL scripts).

Return ONLY strict JSON (no markdown):
{
  "summary": "1-2 sentence description of what's visible (in English)",
  "detected_languages": ["en", ...],
  "orientation_degrees": 0 | 90 | 180 | 270,
  "image_quality": "high" | "medium" | "low",
  "notes": "short OCR notes (rotation/quality handling) or empty",
  "visible_text": ["each meaningful visible string, in reading order, original script"],
  "ui_elements": [{"label":"Send button","kind":"button|link|input|menu|tab|icon|card|toggle|text","purpose":"what it does"}],
  "suggested_actions": [{"title":"Click 'Send'","rationale":"why this helps","requires_desktop":true|false}],
  "answer": "Direct answer to the user's question, if any"
}`;

async function callScreenModel(key: string, system: string, userText: string, dataUrl: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    throw new Error(`Screen analysis failed: ${res.status} ${t}`);
  }
  const json = await res.json();
  const raw: string = json.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  }
}

export const understandScreen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as ScreenInput)
  .handler(async ({ data }): Promise<ScreenUnderstanding> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    if (!data.dataUrl?.startsWith("data:image/")) throw new Error("Upload a screenshot (image)");

    const userText = data.question?.trim()
      ? `User question: ${data.question.trim()}\n\nAnalyze the screen and answer.`
      : "Analyze this screen.";

    const system = SCREEN_SYSTEM(data.languageHint);
    let parsed: any = await callScreenModel(key, system, userText, data.dataUrl);

    // Robustness pass: if OCR came back empty / very thin, or model flagged low quality
    // or non-zero rotation, retry with an aggressive OCR-focused prompt that re-reads
    // text after mentally rotating and upscaling.
    const thinText = !Array.isArray(parsed.visible_text) || parsed.visible_text.length < 2;
    const rotated = parsed.orientation_degrees && parsed.orientation_degrees !== 0;
    const lowQ = parsed.image_quality === "low";
    if (thinText || rotated || lowQ) {
      const retrySystem = `${system}

RETRY MODE: previous OCR was incomplete${rotated ? `, image is rotated ${parsed.orientation_degrees}°` : ""}${lowQ ? ", image is low-resolution" : ""}.
- Re-read EVERY visible glyph, including small/blurry text, watermarks, status bars, and tab titles.
- Apply mental rotation and upscaling. Use linguistic priors of the detected languages to repair broken characters.
- Expand visible_text aggressively; never return fewer items than what is clearly present.`;
      try {
        const retry = await callScreenModel(key, retrySystem, userText, data.dataUrl);
        // Merge: prefer the richer visible_text, keep best summary/answer
        const mergedText = (retry.visible_text?.length ?? 0) > (parsed.visible_text?.length ?? 0)
          ? retry.visible_text : parsed.visible_text;
        parsed = {
          ...parsed,
          ...retry,
          visible_text: mergedText,
          notes: [parsed.notes, retry.notes].filter(Boolean).join(" · "),
        };
      } catch {
        // Keep first-pass result if retry fails
      }
    }

    return {
      summary: parsed.summary ?? "",
      visible_text: parsed.visible_text ?? [],
      ui_elements: parsed.ui_elements ?? [],
      suggested_actions: parsed.suggested_actions ?? [],
      answer: parsed.answer,
      detected_languages: parsed.detected_languages ?? [],
      orientation_degrees: parsed.orientation_degrees ?? 0,
      image_quality: parsed.image_quality ?? "high",
      notes: parsed.notes ?? "",
    };
  });

