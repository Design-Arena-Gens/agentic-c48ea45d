import { NextRequest } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import { generatePodcastScript } from "@/lib/summarize";
import { synthesizeSpeechToMp3Buffer, MissingOpenAIKeyError } from "@/lib/tts";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { url, title } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'url'" }), { status: 400 });
    }

    const items = await YoutubeTranscript.fetchTranscript(url).catch(() => null);
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "Could not fetch YouTube transcript (captions may be disabled)" }), { status: 400 });
    }
    const fullText = items.map((i) => i.text).join(" ");
    const script = await generatePodcastScript(fullText, { title });

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
