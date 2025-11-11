import { NextRequest } from "next/server";
import { generatePodcastScript } from "@/lib/summarize";
import { synthesizeSpeechToMp3Buffer, MissingOpenAIKeyError } from "@/lib/tts";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { text, title } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'text'" }), { status: 400 });
    }

    const script = await generatePodcastScript(text, { title });

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
