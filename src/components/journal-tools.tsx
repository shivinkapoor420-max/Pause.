import { useEffect, useRef, useState } from "react";
import { Eraser, Mic, Square, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

const colours = [
  "#1A1917",
  "#E8875C",
  "#E7BE68",
  "#B9DCAF",
  "#2F5741",
  "#8CC5E6",
  "#B9A7E8",
  "#F3CBD8",
  "#FFFFFF",
];

/** A real drawing pad: pointer/touch drawing, colours, sizes, undo. Exports a compressed PNG data URL. */
export function DrawingPad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [colour, setColour] = useState(colours[0]!);
  const [size, setSize] = useState(6);
  const history = useRef<ImageData[]>([]);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  };
  const emit = () => {
    const c = canvasRef.current!;
    onChange(dirty.current ? c.toDataURL("image/png") : null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={720}
        height={480}
        className="w-full touch-none rounded-2xl border-2 border-ink bg-white"
        aria-label="Drawing area"
        onPointerDown={(e) => {
          const ctx = canvasRef.current!.getContext("2d")!;
          history.current.push(ctx.getImageData(0, 0, 720, 480));
          if (history.current.length > 30) history.current.shift();
          drawing.current = true;
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + 0.1, p.y + 0.1);
          ctx.strokeStyle = colour;
          ctx.lineWidth = size;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.stroke();
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = canvasRef.current!.getContext("2d")!;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          dirty.current = true;
        }}
        onPointerUp={() => {
          drawing.current = false;
          dirty.current = true;
          emit();
        }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {colours.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColour(c)}
            aria-label={`Colour ${c}`}
            aria-pressed={colour === c}
            className={cn(
              "size-8 rounded-full border-2 border-ink",
              colour === c && "ring-4 ring-ring",
            )}
            style={{ background: c }}
          />
        ))}
        <select
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="rounded-xl border-2 border-border bg-card px-2 py-1 text-sm font-bold"
          aria-label="Brush size"
        >
          <option value={3}>Thin</option>
          <option value={6}>Medium</option>
          <option value={14}>Thick</option>
          <option value={30}>Huge</option>
        </select>
        <button
          type="button"
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Undo"
          onClick={() => {
            const prev = history.current.pop();
            if (prev) canvasRef.current!.getContext("2d")!.putImageData(prev, 0, 0);
            emit();
          }}
        >
          <Undo2 className="size-5" />
        </button>
        <button
          type="button"
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Eraser"
          onClick={() => setColour("#FFFFFF")}
        >
          <Eraser className="size-5" />
        </button>
        <button
          type="button"
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Clear drawing"
          onClick={() => {
            const ctx = canvasRef.current!.getContext("2d")!;
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, 720, 480);
            dirty.current = false;
            history.current = [];
            emit();
          }}
        >
          <Trash2 className="size-5" />
        </button>
      </div>
    </div>
  );
}

/** Records a voice note (up to 2 minutes) and returns it as an audio data URL. */
export function VoiceRecorder({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [rec]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: (r.mimeType || "audio/webm").split(";")[0] });
        const reader = new FileReader();
        reader.onload = () => {
          const data = String(reader.result);
          if (data.length > 1_400_000) {
            setError("That recording is a bit long — try keeping it under two minutes.");
            onChange(null);
            return;
          }
          setUrl(data);
          onChange(data);
        };
        reader.readAsDataURL(blob);
      };
      setSecs(0);
      setUrl(null);
      onChange(null);
      r.start();
      setRec(r);
      setTimeout(() => r.state === "recording" && r.stop(), 120_000);
    } catch {
      setError("Pause needs microphone permission to record. You can type instead.");
    }
  };

  return (
    <div className="rounded-2xl border-2 border-dashed border-ink bg-muted p-6 text-center">
      {rec ? (
        <button
          type="button"
          onClick={() => {
            rec.stop();
            setRec(null);
          }}
          className="mx-auto grid size-20 animate-pulse place-items-center rounded-full bg-coral text-coral-foreground"
          aria-label="Stop recording"
        >
          <Square className="size-8" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void start()}
          className="mx-auto grid size-20 place-items-center rounded-full border-2 border-ink bg-primary"
          aria-label="Start recording"
        >
          <Mic className="size-8" />
        </button>
      )}
      <p className="mt-3 font-bold">
        {rec
          ? `Recording… ${secs}s (tap to stop)`
          : url
            ? "Recorded — listen back below"
            : "Tap to record a voice note"}
      </p>
      {url && !rec && <audio controls src={url} className="mx-auto mt-3 w-full max-w-sm" />}
      {error && <p className="mt-2 text-sm font-bold text-destructive">{error}</p>}
    </div>
  );
}
