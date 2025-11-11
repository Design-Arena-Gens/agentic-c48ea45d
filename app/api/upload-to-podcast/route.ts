import { NextRequest } from "next/server";
import { generatePodcastScript } from "@/lib/summarize";
import { synthesizeSpeechToMp3Buffer, MissingOpenAIKeyError } from "@/lib/tts";

export const runtime = "nodejs";

let openaiSingleton: any = null;
async function getOpenAIOrNull() {
  try {
    const { default: OpenAI } = await import("openai");
    if (!process.env.OPENAI_API_KEY) return null;
    if (!openaiSingleton) openaiSingleton = new OpenAI();
    return openaiSingleton;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "Missing file" }), { status: 400 });
    }

    const openai = await getOpenAIOrNull();
    if (!openai) {
      return new Response(JSON.stringify({ error: "Transcription requires OPENAI_API_KEY" }), { status: 400 });
    }

    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
      response_format: "text",
      temperature: 0,
    });

    const script = await generatePodcastScript(transcription);

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
