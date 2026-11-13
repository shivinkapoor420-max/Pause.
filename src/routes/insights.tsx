import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Card, EmptyState, LoadingCards, PageHeader, Tabs } from "@/components/kit";
import { api } from "@/lib/api";

export const Route = createFileRoute("/insights")({
  head: () => ({ meta: [{ title: "Insights — Pause." }] }),
  component: Insights,
});

const skyLabel = ["", "Overwhelmed", "Low", "Flat", "Mostly okay", "Bright"];
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Insights() {
  const [range, setRange] = useState<"week" | "month" | "year">("week");
  const q = useQuery({
    queryKey: ["insights", range],
    queryFn: () => api(`/insights?range=${range}`),
    retry: false,
  });
  const moods: any[] = q.data?.moods ?? [];
  const avg = moods.length ? moods.reduce((a, m) => a + m.score, 0) / moods.length : 0;
  return (
    <AppShell title="Insights" wide>
      <PageHeader
        eyebrow="Patterns, gently"
        title="Insights"
        subtitle="Observations from what you've logged — not judgements, and never a diagnosis."
        action={
          <Tabs
            value={range}
            onChange={setRange}
            items={[
              { id: "week", label: "7 days" },
              { id: "month", label: "30 days" },
              { id: "year", label: "Year ✦" },
            ]}
          />
        }
      />
      {q.isLoading ? (
        <LoadingCards n={2} />
      ) : q.error ? (
        <EmptyState
          emoji="✨"
          title="Year-long insights are Premium"
          body="See your whole year and weekday patterns."
          action={
            <Link to="/pricing" className="font-bold underline">
              See Premium
            </Link>
          }
        />
      ) : moods.length === 0 ? (
        <EmptyState
          emoji="🌤️"
          title="Nothing to chart yet"
          body="Check in a few times and your patterns will start to appear here."
          action={
            <Link to="/home" className="font-bold underline">
              Check in now
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <h2 className="font-display text-xl font-bold">Your inner weather</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer>
                <AreaChart data={moods} margin={{ left: -20, right: 8 }}>
                  <defs>
                    <linearGradient id="mood" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-forest)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--color-forest)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} fontSize={12} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} fontSize={12} />
                  <Tooltip
                    formatter={(v) => skyLabel[Number(v)]}
                    labelFormatter={(l) => new Date(l).toDateString()}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="var(--color-forest)"
                    strokeWidth={3}
                    fill="url(#mood)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <h2 className="font-display text-xl font-bold">At a glance</h2>
            <p className="mt-4 font-display text-5xl font-black">{moods.length}</p>
            <p className="text-sm text-muted-foreground">days you checked in</p>
            <p className="mt-4 font-display text-2xl font-bold">{skyLabel[Math.round(avg)]}</p>
            <p className="text-sm text-muted-foreground">most common overall feel</p>
          </Card>
          <Card className="lg:col-span-2">
            <h2 className="font-display text-xl font-bold">Calm activities</h2>
            <div className="mt-4 h-48">
              <ResponsiveContainer>
                <BarChart data={q.data.activity} margin={{ left: -20 }}>
                  <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar
                    dataKey="n"
                    name="Activities"
                    fill="var(--color-coral)"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <h2 className="font-display text-xl font-bold">Deeper patterns</h2>
            {q.data.advanced ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">Words you tag most:</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {q.data.advanced.topTags.map(([t, n]: [string, number]) => (
                    <span key={t} className="rounded-full bg-lavender px-3 py-1 text-xs font-bold">
                      {t} · {n}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Average by weekday:</p>
                <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold">
                  {q.data.advanced.weekdayPattern.map((v: number | null, i: number) => (
                    <div key={i}>
                      <div
                        className="mx-auto w-full rounded-md bg-forest"
                        style={{ height: v ? v * 10 : 2, opacity: v ? 0.35 + v * 0.13 : 0.15 }}
                      />
                      {days[i]}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Weekday patterns and tag trends are part of{" "}
                <Link to="/pricing" className="font-bold underline">
                  Premium
                </Link>
                .
              </p>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
