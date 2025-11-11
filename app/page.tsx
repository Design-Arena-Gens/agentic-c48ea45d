"use client";

import { useCallback, useMemo, useRef, useState } from "react";

type Tab = "text" | "url" | "youtube" | "upload";

export default function Home() {
  const [tab, setTab] = useState<Tab>("text");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [script, setScript] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  // Text inputs
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const activeTabClasses = "bg-black text-white dark:bg-white dark:text-black";
  const tabButton = (id: Tab, label: string) => (
    <button
      key={id}
      onClick={() => switchTab(id)}
      className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
        tab === id
          ? activeTabClasses
          : "border-black/10 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );

  const resetOutputs = useCallback(() => {
    setAudioUrl(null);
    setScript(null);
    setError(null);
  }, []);

  const switchTab = useCallback((t: Tab) => {
    setTab(t);
    resetOutputs();
  }, [resetOutputs]);

  const speakScript = useCallback(() => {
    if (!script) return;
    const utter = new SpeechSynthesisUtterance(script);
    utter.rate = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }, [script]);

  const stopSpeak = useCallback(() => {
    window.speechSynthesis.cancel();
  }, []);

  const onSubmit = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setAudioUrl(null);
      setScript(null);

      let res: Response;
      if (tab === "text") {
        res = await fetch("/api/text-to-podcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, title: title || undefined }),
        });
      } else if (tab === "url") {
        res = await fetch("/api/url-to-podcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, title: title || undefined }),
        });
      } else if (tab === "youtube") {
        res = await fetch("/api/youtube-to-podcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, title: title || undefined }),
        });
      } else {
        const file = fileRef.current?.files?.[0];
        if (!file) {
          setError("Please choose an audio/video file first.");
          return;
        }
        const fd = new FormData();
        fd.set("file", file);
        res = await fetch("/api/upload-to-podcast", { method: "POST", body: fd });
      }

      if (!res.ok) {
        const j = await safeJson(res);
        setError(j?.error || `Request failed (${res.status})`);
        return;
      }

      const ctype = res.headers.get("Content-Type") || "";
      if (ctype.includes("audio/")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      } else if (ctype.includes("application/json")) {
        const j = await res.json();
        if (j.missingOpenAIKey && j.script) {
          setScript(j.script);
        } else if (j.script) {
          setScript(j.script);
        } else {
          setError("Unexpected response.");
        }
      } else {
        setError("Unsupported response type.");
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [tab, text, url, title]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold">AI Podcast Generator</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Turn text, links, or videos into a podcast.
        </p>

        <div className="flex flex-wrap gap-2 mt-6">
          {tabButton("text", "Text ? Podcast")}
          {tabButton("url", "URL ? Podcast")}
          {tabButton("youtube", "YouTube ? Podcast")}
          {tabButton("upload", "Upload ? Podcast")}
        </div>

        <div className="mt-6 grid gap-4">
          <label className="text-sm font-medium">Optional title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Episode title"
            className="w-full rounded-md border border-black/10 dark:border-white/20 bg-white/80 dark:bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-black/20"
          />

          {tab === "text" && (
            <div className="grid gap-2">
              <label className="text-sm font-medium">Paste text</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder="Paste or write your content here..."
                className="w-full rounded-md border border-black/10 dark:border-white/20 bg-white/80 dark:bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-black/20"
              />
            </div>
          )}
          {tab === "url" && (
            <div className="grid gap-2">
              <label className="text-sm font-medium">Web page URL</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article"
                className="w-full rounded-md border border-black/10 dark:border-white/20 bg-white/80 dark:bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-black/20"
              />
            </div>
          )}
          {tab === "youtube" && (
            <div className="grid gap-2">
              <label className="text-sm font-medium">YouTube URL</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full rounded-md border border-black/10 dark:border-white/20 bg-white/80 dark:bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-black/20"
              />
              <p className="text-xs text-zinc-500">Requires video captions to be available.</p>
            </div>
          )}
          {tab === "upload" && (
            <div className="grid gap-2">
              <label className="text-sm font-medium">Upload audio/video</label>
              <input ref={fileRef} type="file" accept="audio/*,video/*" className="text-sm" />
              <p className="text-xs text-zinc-500">Transcription uses OpenAI Whisper (server-side).</p>
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button
              onClick={onSubmit}
              disabled={loading}
              className="px-4 py-2 rounded-md bg-black text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading ? "Generating?" : "Generate Podcast"}
            </button>
            {script && (
              <>
                <button onClick={speakScript} className="px-4 py-2 rounded-md border">Play (browser voice)</button>
                <button onClick={stopSpeak} className="px-4 py-2 rounded-md border">Stop</button>
              </>
            )}
          </div>

          {error && (
            <div className="mt-2 text-sm text-red-600">{error}</div>
          )}

          {audioUrl && (
            <div className="mt-6 grid gap-3">
              <audio controls src={audioUrl} className="w-full" />
              <a
                href={audioUrl}
                download={makeDownloadName(title)}
                className="text-sm underline"
              >
                Download MP3
              </a>
            </div>
          )}

          {script && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold">Podcast Script</h2>
              <p className="text-xs text-zinc-500">OpenAI key missing on server; reading with your browser voice.</p>
              <div className="mt-2 whitespace-pre-wrap text-sm border rounded-md p-3 bg-white/70 dark:bg-zinc-900">
                {script}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

async function safeJson(res: Response): Promise<any | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function makeDownloadName(title: string) {
  const base = title?.trim() ? title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") : "podcast";
  return `${base}.mp3`;
}
