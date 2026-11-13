import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Only shown when a guardian has switched location check-ins on. Nothing is
 * tracked in the background: the child taps, the browser asks, one point is sent.
 */
export function LocationShare({ big = false }: { big?: boolean }) {
  const status = useQuery({
    queryKey: ["location-status"],
    queryFn: () => api<{ enabled: boolean; sharedAt: string | null }>("/location/status"),
  });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  if (!status.data?.enabled) return null;
  const share = () => {
    if (!("geolocation" in navigator)) return setState("error");
    setState("sending");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api("/location", {
            body: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            },
          });
          setState("sent");
        } catch {
          setState("error");
        }
      },
      () => setState("error"),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  };
  return (
    <button
      onClick={share}
      disabled={state === "sending"}
      className={`flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-ink bg-card font-black ${big ? "p-5 text-xl" : "p-3 text-sm"}`}
    >
      <MapPin className={big ? "size-7" : "size-5"} aria-hidden="true" />
      {state === "sent"
        ? "Sent to your grown-up ✓"
        : state === "sending"
          ? "Sending…"
          : state === "error"
            ? "Couldn't share — try again"
            : "Tell my grown-up where I am"}
    </button>
  );
}
