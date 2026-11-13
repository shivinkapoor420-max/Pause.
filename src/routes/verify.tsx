import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/public-layout";
import { api } from "@/lib/api";

export const Route = createFileRoute("/verify")({
  head: () => ({ meta: [{ title: "Verify email — Pause." }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s["token"] === "string" ? s["token"] : "",
  }),
  component: Verify,
});

function Verify() {
  const { token } = Route.useSearch();
  const qc = useQueryClient();
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!token) {
      setState("error");
      setMsg("This link is missing its code.");
      return;
    }
    api("/auth/verify-email", { body: { token } })
      .then(() => {
        setState("ok");
        void qc.invalidateQueries({ queryKey: ["me"] });
      })
      .catch((e) => {
        setState("error");
        setMsg(e.message);
      });
  }, [token, qc]);
  return (
    <PublicLayout>
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="text-6xl">{state === "ok" ? "🌷" : state === "error" ? "🍂" : "⏳"}</p>
        <h1 className="mt-4 font-display text-3xl font-black">
          {state === "ok"
            ? "Email confirmed"
            : state === "error"
              ? "That didn't work"
              : "Confirming…"}
        </h1>
        {msg && <p className="mt-2 text-muted-foreground">{msg}</p>}
        <Link
          to="/home"
          className="mt-6 inline-block rounded-full bg-forest px-6 py-3 font-bold text-forest-foreground"
        >
          Go to Pause
        </Link>
      </div>
    </PublicLayout>
  );
}
