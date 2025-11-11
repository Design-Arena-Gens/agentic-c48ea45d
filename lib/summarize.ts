import { hasOpenAIKey } from "./env";

let openaiSingleton: any = null;
async function getOpenAI() {
  if (!hasOpenAIKey()) return null;
  if (openaiSingleton) return openaiSingleton;
  const { default: OpenAI } = await import("openai");
  openaiSingleton = new OpenAI();
  return openaiSingleton;
}

export type SummarizeOptions = {
  maxWords?: number;
  title?: string;
};

export async function generatePodcastScript(rawText: string, options: SummarizeOptions = {}): Promise<string> {
  const text = normalizeText(rawText);
  const maxWords = options.maxWords ?? 1200;

  const openai = await getOpenAI();
  if (openai) {
    const prompt = `You are a podcast scriptwriter. Write a clear, engaging, natural-sounding solo podcast monologue based on the content below.\n\n- Aim for ${Math.min(maxWords, 1400)} words.\n- Reorganize logically with a short intro and a concise outro.\n- Use plain, friendly language.\n- Do not include section headings or speaker labels.\n- Avoid lists; prefer narrative paragraphs.\n\nContent:\n${text}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You produce natural, human-like podcast monologues." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });
    const out = completion.choices?.[0]?.message?.content?.trim();
    if (out) return out;
  }

  // Fallback: very simple extractive summary transformed into a monologue
  const summary = extractiveSummary(text, maxWords);
  return [
    options.title ? `Today, we're exploring ${options.title}.` : "Welcome to today's episode.",
    "",
    summary,
    "",
    "Thanks for listening. If you enjoyed this episode, consider sharing it.",
  ].join("\n");
}

function normalizeText(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\t+/g, " ")
    .trim();
}

function extractiveSummary(text: string, maxWords: number): string {
  const sentences = splitIntoSentences(text);
  const scores = sentences.map((s) => scoreSentence(s));
  // pick top sentences until reaching maxWords
  const indexed = sentences.map((s, i) => ({ s, i, score: scores[i] }));
  indexed.sort((a, b) => b.score - a.score || a.i - b.i);
  const picked: string[] = [];
  let wordCount = 0;
  for (const it of indexed) {
    const wc = it.s.split(/\s+/).length;
    if (wordCount + wc > maxWords) continue;
    picked.push(it.s);
    wordCount += wc;
    if (wordCount >= maxWords) break;
  }
  // Preserve loose original order of picked sentences
  picked.sort((a, b) => sentences.indexOf(a) - sentences.indexOf(b));
  return picked.join(" ");
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'?(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function scoreSentence(sentence: string): number {
  const lengthScore = Math.min(sentence.length / 100, 3); // prefer moderate length
  const punctuation = (sentence.match(/[,:;\-??]/g) || []).length * 0.1;
  const numbers = (sentence.match(/\b\d+\b/g) || []).length * 0.3;
  const properNouns = (sentence.match(/\b[A-Z][a-z]+\b/g) || []).length * 0.05;
  return lengthScore + punctuation + numbers + properNouns;
}
