import { NextRequest } from "next/server";
import * as cheerio from "cheerio";
import { generatePodcastScript } from "@/lib/summarize";
import { synthesizeSpeechToMp3Buffer, MissingOpenAIKeyError } from "@/lib/tts";

export const runtime = "nodejs";

async function extractMainTextFromHtml(html: string): Promise<string> {
  const $ = cheerio.load(html);
  const candidates = ["article", "main", "#content", "#main", ".post", ".article", ".entry", "body"];
  for (const sel of candidates) {
    const el = $(sel);
    if (el.length) {
      const text = el.text().trim();
      if (text.split(/\s+/).length > 120) return text;
    }
  }
  // Fallback: concatenate paragraphs
  const parts: string[] = [];
  $("p").each((_, p) => {
    const t = $(p).text().trim();
    if (t.length > 40) parts.push(t);
  });
  return parts.join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const { url, title } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'url'" }), { status: 400 });
    }
    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 PodcastBot" } });
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch URL (${resp.status})` }), { status: 400 });
    }
    const html = await resp.text();
    const mainText = await extractMainTextFromHtml(html);
    if (!mainText) {
      return new Response(JSON.stringify({ error: "Could not extract readable text" }), { status: 400 });
    }

    const script = await generatePodcastScript(mainText, { title });

    try {
      const audio = await synthesizeSpeechToMp3Buffer(script);
      return new Response(new Uint8Array(audio), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Disposition": `inline; filename=podcast.mp3`,
        },
      });
    } catch (err: any) {
      if (err instanceof MissingOpenAIKeyError) {
        return new Response(
          JSON.stringify({ missingOpenAIKey: true, script }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      throw err;
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), { status: 500 });
  }
}
