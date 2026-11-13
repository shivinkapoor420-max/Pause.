import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PillButton } from "@/components/app-shell";
import { LeafSprig } from "@/components/illustrations";
import { useApp, today } from "@/lib/app-state";

export const Route = createFileRoute("/consent")({
  head: () => ({
    meta: [
      { title: "Consent & privacy — Pause." },
      {
        name: "description",
        content:
          "Plain-language consent, with a caregiver version and a kids' version. Nothing leaves Pause. without review.",
      },
      { property: "og:title", content: "Consent & privacy — Pause." },
      { property: "og:description", content: "How Pause. handles sensitive health data, in plain language." },
    ],
  }),
  component: Consent,
});

function Consent() {
  const { state, update } = useApp();
  const navigate = useNavigate();
  const child = state.band === "child";
  const [kidsVersion, setKidsVersion] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [parentAttested, setParentAttested] = useState(false);
  const [name, setName] = useState(state.name);
  const [caregiver, setCaregiver] = useState(state.caregiverName);
  const [phone, setPhone] = useState(state.phone);
  const [sms, setSms] = useState(state.smsReminders);

  const teen = state.band === "teen";
  const phoneOk = phone.trim() === "" || phone.replace(/\D/g, "").length >= 10;
  const canContinue =
    agreed &&
    name.trim().length > 0 &&
    phoneOk &&
    (!child || (parentAttested && caregiver.trim().length > 0));


  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[50vh]">
        <div className="sky-wash" />
      </div>
      <div className="mx-auto w-full max-w-2xl px-5 py-10">
        <LeafSprig className="size-10 text-forest" />
        <h1 className="mt-4 font-display text-4xl font-black tracking-tight">
          Before we start, here's the deal
        </h1>

        {child && (
          <div className="mt-5 flex gap-2">
            <PillButton
              variant={kidsVersion ? "outline" : "primary"}
              className="px-4 py-2 text-sm"
              onClick={() => setKidsVersion(false)}
            >
              Caregiver version
            </PillButton>
            <PillButton
              variant={kidsVersion ? "primary" : "outline"}
              className="px-4 py-2 text-sm"
              onClick={() => setKidsVersion(true)}
            >
              Read with your child
            </PillButton>
          </div>
        )}

        <div className="card-soft mt-5 space-y-4 p-6">
          {kidsVersion ? (
            <>
              <p className="font-display text-2xl font-bold">This app is for your feelings.</p>
              <ul className="space-y-3 text-lg">
                <li>You pick the picture that matches how you feel today. There are no wrong answers.</li>
                <li>There are games here. You can't lose them.</li>
                <li>Your grown-up can see what you pick, so they can help.</li>
                <li>You can stop any time and nothing bad happens.</li>
              </ul>
            </>
          ) : (
            <>
              <ul className="space-y-3">
                <li>
                  <strong>We screen, we don't diagnose.</strong> Pause. shows patterns in plain
                  language. It will never say "you have X" — that's for a licensed professional.
                </li>
                <li>
                  <strong>Autism traits are treated as a difference, not a disorder.</strong> We use
                  words like trait, pattern and experience, not symptom or abnormal.
                </li>
                <li>
                  <strong>This is sensitive health data.</strong> Entries stay on this device,
                  encrypted in transit if you ever sync. No ad tracking, no third-party sales, ever.
                </li>
                <li>
                  <strong>Nothing goes to a therapist without review.</strong> Any brief is shown to
                  you {child ? "(the caregiver)" : ""} first, fully editable, and only sent when you
                  tap send.
                </li>
                <li>
                  <strong>Safety comes first.</strong> If an answer suggests risk of self-harm,
                  crisis resources appear immediately{" "}
                  {child ? "and you, the caregiver, are alerted directly." : "— never buried in a menu."}
                </li>
                <li>
                  <strong>You can delete everything</strong> from Profile → Settings, at any time.
                </li>
              </ul>
            </>
          )}
        </div>

        <div className="card-soft mt-5 space-y-4 p-6">
          <label className="block">
            <span className="text-sm font-bold">
              {child ? "Your child's first name" : "What should we call you?"}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={child ? "e.g. Sam" : "e.g. Jessie"}
              className="mt-2 w-full rounded-2xl border-2 border-border bg-muted px-4 py-3 text-base font-semibold outline-none focus:border-ink"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold">
              {child ? "Phone number (caregiver)" : "Phone number"}{" "}
              <span className="font-semibold text-muted-foreground">— optional</span>
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={24}
              placeholder="(555) 123-4567"
              className="mt-2 w-full rounded-2xl border-2 border-border bg-muted px-4 py-3 text-base font-semibold outline-none focus:border-ink"
            />
            <span className="mt-2 block text-xs text-muted-foreground">
              Skip it if you'd rather — you can add it later from Profile. If you do give it, it's
              only for account recovery and the reminders below: stored on this device, never sold,
              never used for ads.
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={sms}
              onChange={(e) => setSms(e.target.checked)}
              className="mt-1 size-5 accent-forest"
            />
            <span className="text-sm font-semibold">
              Send me occasional SMS check-in reminders (optional — you can turn this off any time in
              Profile).
            </span>
          </label>



          {child && (
            <>
              <label className="block">
                <span className="text-sm font-bold">Your name (caregiver)</span>
                <input
                  value={caregiver}
                  onChange={(e) => setCaregiver(e.target.value)}
                  placeholder="e.g. Alex"
                  className="mt-2 w-full rounded-2xl border-2 border-border bg-muted px-4 py-3 text-base font-semibold outline-none focus:border-ink"
                />
              </label>
              <label className="flex items-start gap-3 rounded-2xl bg-mustard/40 p-4">
                <input
                  type="checkbox"
                  checked={parentAttested}
                  onChange={(e) => setParentAttested(e.target.checked)}
                  className="mt-1 size-5 accent-forest"
                />
                <span className="text-sm font-semibold">
                  I am this child's parent or legal guardian, and I consent to creating a profile on
                  their behalf.
                </span>
              </label>
            </>
          )}

          {teen && (
            <div className="rounded-2xl border-2 border-ink bg-lavender/60 p-4">
              <p className="font-display text-lg font-bold">Where the line is, before you start</p>
              <ul className="mt-2 space-y-2 text-sm font-semibold">
                <li>
                  Your journal and your conversations with Pip are <strong>private to you</strong>.
                  Nobody else sees them — not by default, not later, not by accident.
                </li>
                <li>
                  A caregiver only gets access if <strong>you invite one</strong>. It never happens
                  automatically, and you can undo it any time in Profile.
                </li>
                <li>
                  Even then, they see <strong>check-in trend summaries only</strong> — never your raw
                  entries and never a transcript.
                </li>
                <li>
                  One exception, and we're telling you now rather than letting you find out later: if
                  something suggests you're in danger, <strong>a caregiver is alerted immediately</strong>,
                  whatever your privacy settings say. That part isn't negotiable.
                </li>
              </ul>
            </div>
          )}

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 size-5 accent-forest"
            />
            <span className="text-sm font-semibold">
              I've read this and I understand Pause. is a screening and support tool, not a
              diagnosis.
            </span>
          </label>
        </div>

        <PillButton
          variant="coral"
          className="mt-6 w-full"
          disabled={!canContinue}
          onClick={() => {
            update({
              name: name.trim(),
              caregiverName: caregiver.trim(),
              phone: phone.trim(),
              smsReminders: sms,
              consented: true,
              startedOn: state.startedOn ?? today(),
            });
            navigate({ to: "/checkin" });
          }}
        >
          I agree — let's start
        </PillButton>
      </div>
    </div>
  );
}
