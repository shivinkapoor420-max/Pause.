import { checkinQuestions } from "@/lib/content";
import type { AppState, Sky } from "@/lib/app-state";

const heaviness: Record<Sky, number> = { sunny: 0, partly: 1, cloudy: 2, rainy: 3, stormy: 4 };

export type PatternTag = { label: string; detail: string; urgent?: boolean };

export function buildPatterns(state: AppState): PatternTag[] {
  const out: PatternTag[] = [];
  const band = state.band ?? "adult";
  const moods = state.moods.slice(-30);

  if (moods.length >= 3) {
    const low = moods.filter((m) => heaviness[m.sky] >= 3).length;
    const share = low / moods.length;
    if (share >= 0.5)
      out.push({
        label: "Low mood, most days this month",
        detail: `${low} of your last ${moods.length} check-ins landed in rain or storms.`,
      });
    else if (share >= 0.25)
      out.push({
        label: "Low mood on and off",
        detail: `Heavier days show up roughly one in four check-ins.`,
      });
    else
      out.push({
        label: "Mood mostly steady",
        detail: `Most recent check-ins have been bright or mostly okay.`,
      });
  }

  const tagCounts = new Map<string, number>();
  for (const m of moods) for (const t of m.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  for (const [tag, count] of [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
    if (count >= 2)
      out.push({ label: tag.toLowerCase(), detail: `You've named this ${count} times recently.` });
  }

  const latest = state.checkins[0];
  if (latest) {
    const questions = checkinQuestions[latest.band];
    const byThread = new Map<string, number[]>();
    for (const q of questions) {
      const v = latest.answers[q.id];
      if (v === undefined) continue;
      byThread.set(q.thread, [...(byThread.get(q.thread) ?? []), v / (q.scale.length - 1)]);
    }
    const label: Record<string, string> = {
      autism: band === "child" ? "Autism-related traits in play, speech and sensory reactions" : "Autism-related traits: sensory experience and masking",
      sleep: "Sleep disruption",
      mood: band === "child" ? "Meltdowns and time to settle" : "Mood and anxiety",
      function: band === "child" ? "Everyday functioning" : "Executive functioning and daily load",
    };
    for (const [thread, values] of byThread) {
      if (thread === "risk") continue;
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      if (avg >= 0.5)
        out.push({
          label: label[thread] ?? thread,
          detail: `Your answers here clustered toward the higher end — worth discussing with a professional.`,
        });
    }
  }

  const meltdownish = moods.filter((m) => m.sky === "stormy").length;
  if (band === "child" && meltdownish >= 2)
    out.push({
      label: "Overwhelm has clustered this month",
      detail: `${meltdownish} days were logged as "too much" — noting the time of day helps a clinician a lot.`,
    });

  if (state.riskFlagged)
    out.unshift({
      label: "Self-harm risk indicated in a check-in",
      detail: "This was flagged from a direct question. Crisis resources stay visible until you're safe.",
      urgent: true,
    });

  const toolTotal = Object.values(state.toolUse).reduce((a, b) => a + b, 0);
  if (toolTotal > 0)
    out.push({
      label: "Coping tools in use",
      detail: `${toolTotal} sessions logged this week — supportive context, not a score.`,
    });

  out.push(...companionPatterns(state));

  return out;
}

/**
 * Companion conversations feed the pattern view as *one* soft signal.
 * Everything here compares the person only to their own earlier baseline, and a
 * quieter or differently-paced way of talking is never read as distress on its own.
 */
export function companionPatterns(state: AppState): PatternTag[] {
  const out: PatternTag[] = [];
  const observations = state.companion.flatMap((s) => s.observations);
  if (observations.length < 4) return out;

  const heavy = new Set(["sad", "overwhelmed", "fearful", "angry", "frustrated", "withdrawn"]);
  const split = Math.floor(observations.length / 2);
  const baseline = observations.slice(0, split);
  const recent = observations.slice(split);
  const shareHeavy = (list: typeof observations) =>
    list.filter((o) => heavy.has(o.state) && o.confidence >= 0.55).length / Math.max(1, list.length);

  const recentShare = shareHeavy(recent);
  const baseShare = shareHeavy(baseline);

  // Higher bar when the shift shows up mainly as *how* they talk rather than what
  // they say — that can simply be a communication difference, not a mood change.
  const wordsOnly = recent.every((o) => o.confidence < 0.7);
  const threshold = wordsOnly ? 0.35 : 0.2;

  if (recentShare - baseShare >= threshold && recent.length >= 3) {
    out.push({
      label: "Heavier tone in recent conversations",
      detail: `Talks with Pip have sounded more weighed down lately than they did earlier — compared only to their own earlier conversations, not to anyone else's.`,
    });
  } else if (recentShare > 0 || baseShare > 0) {
    out.push({
      label: "Companion conversations look steady",
      detail: `Tone across recent talks with Pip sits close to their own usual range.`,
    });
  }

  const quiet = recent.filter((o) => o.engagement === "low").length;
  if (quiet >= 3 && quiet / recent.length >= 0.6)
    out.push({
      label: "Quieter in conversation lately",
      detail: `Shorter answers than earlier sessions. Some people are simply brief or need longer to warm up, so this is only worth noticing alongside everything else here.`,
    });

  return out;
}


export function daysUsing(state: AppState) {
  if (!state.startedOn) return 0;
  const start = new Date(state.startedOn).getTime();
  return Math.max(1, Math.round((Date.now() - start) / 86400000) + 1);
}

/**
 * Gentle consistency, never a streak. There is no "missed" state, no counter and
 * no reset language — showing up gets noticed, not showing up is never flagged.
 */
export function consistencyNote(state: AppState): string | null {
  const week = new Set(
    state.moods
      .filter((m) => Date.now() - new Date(m.date).getTime() < 8 * 86400000)
      .map((m) => m.date),
  );
  const days = week.size;
  if (days >= 5) return "You've checked in most days this week. That's real care for yourself.";
  if (days >= 3) return "You've come back a few times this week. That counts.";
  if (days >= 1) return "You showed up today. That's enough for today.";
  return null;
}

/**
 * A short internal primer for Pip — 2–3 plain sentences drawn from very recent
 * check-ins and journal entries. Descriptive only, never diagnostic, never shown
 * to the person and never recited back to them verbatim.
 */
export function pipPrimer(state: AppState): string {
  const lines: string[] = [];
  const recentMoods = state.moods.slice(-3);
  if (recentMoods.length > 0) {
    const heavy = recentMoods.filter((m) => heaviness[m.sky] >= 3).length;
    lines.push(
      heavy >= 2
        ? "Their last few daily check-ins have leaned toward heavier weather."
        : "Their last few daily check-ins have been mostly steady.",
    );
    const tags = [...new Set(recentMoods.flatMap((m) => m.tags))].slice(0, 3);
    if (tags.length > 0) lines.push(`Words they picked recently: ${tags.join(", ")}.`);
  }
  const entry = state.journal[0];
  if (entry?.body)
    lines.push(
      `They journalled recently about: ${entry.body.slice(0, 140).replace(/\s+/g, " ")}.`,
    );
  return lines.slice(0, 3).join(" ");
}

/** What's changed since a given moment — used by the "Share an update" flow. */
export function changesSince(state: AppState, sinceISO: string) {
  const since = new Date(sinceISO).getTime();
  return {
    moods: state.moods.filter((m) => new Date(m.date).getTime() >= since),
    journal: state.journal.filter((j) => new Date(j.date).getTime() >= since),
    checkins: state.checkins.filter((c) => new Date(c.date).getTime() >= since),
    toolTotal: Object.values(state.toolUse).reduce((a, b) => a + b, 0),
  };
}
