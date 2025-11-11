import { hasOpenAIKey } from "./env";

export class MissingOpenAIKeyError extends Error {
  constructor() {
    super("Missing OPENAI_API_KEY environment variable.");
    this.name = "MissingOpenAIKeyError";
  }
}

let openaiSingleton: any = null;
async function getOpenAI() {
  if (!hasOpenAIKey()) return null;
  if (openaiSingleton) return openaiSingleton;
  const { default: OpenAI } = await import("openai");
  openaiSingleton = new OpenAI();
  return openaiSingleton;
}

export async function synthesizeSpeechToMp3Buffer(text: string): Promise<Buffer> {
  const openai = await getOpenAI();
  if (!openai) {
    throw new MissingOpenAIKeyError();
  }
  const res = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    input: text,
    format: "mp3",
  });
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}
