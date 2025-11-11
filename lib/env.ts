export function hasOpenAIKey(): boolean {
  return typeof process.env.OPENAI_API_KEY === "string" && process.env.OPENAI_API_KEY.length > 0;
}

export function getOpenAIKeyOrNull(): string | null {
  return hasOpenAIKey() ? (process.env.OPENAI_API_KEY as string) : null;
}
