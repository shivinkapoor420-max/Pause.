/**
 * Always-on crisis pathway. Anything matching here bypasses pattern tracking
 * entirely and surfaces concrete resources on-screen immediately.
 */
const patterns: RegExp[] = [
  /\bkill(ing)? (myself|me)\b/i,
  /\bend (it|my life)\b/i,
  /\bsuicid/i,
  /\bhurt(ing)? (myself|me)\b/i,
  /\bcut(ting)? myself\b/i,
  /\bdon'?t want to (be here|live|wake up)\b/i,
  /\bbetter off (dead|gone)\b/i,
  /\bwant to die\b/i,
  /\b(he|she|they|dad|mom|mum|someone) (hits|hit|hurts|hurt|touches|touched) me\b/i,
  /\bnot safe (at home|here)\b/i,
  /\bafraid of (him|her|them|dad|mom|mum)\b/i,
];

export function detectCrisis(text: string) {
  return patterns.some((p) => p.test(text));
}
