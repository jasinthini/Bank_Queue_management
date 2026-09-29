import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "../components/Button.jsx";
import lobby from "../assets/bank-lobby.jpg";
import { AppShell, Loading, PriorityChip } from "../components/AppShell.jsx";
import { useQueue } from "../lib/queue-store.jsx";
import { estimateWaitMin, orderedCandidates } from "../lib/queue-engine.js";

export default function Board() {
  const { state, now } = useQueue();
  const [sound, setSound] = useState(false);
  const lastCall = useRef(null);

  const newest = state?.entries
    .filter((e) => e.status === "CALLED")
    .sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0))[0];

  // Two-beep chime whenever a new token is called (if sound is enabled)
  useEffect(() => {
    if (!newest) return;
    const key = `${newest.id}:${newest.calledAt}`;
    if (lastCall.current && lastCall.current !== key && sound) {
      const ctx = new AudioContext();
      [0, 0.18].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 784;
        gain.gain.value = 0.08;
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.12);
      });
    }
    lastCall.current = key;
  }, [newest?.id, newest?.calledAt, sound]);

  if (!state) return <AppShell><Loading /></AppShell>;

  const active = state.entries
    .filter((e) => e.status === "CALLED" || e.status === "SERVING")
    .sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0));
  const latest = active[0];
  const missed = state.entries.filter((e) => e.status === "MISSED");
  const time = now ? new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <AppShell title="Live Waiting Board">
      <div className="overflow-hidden rounded-md bg-ink text-ink-foreground shadow-lift">
        <div className="flex items-center justify-between border-b border-ink-foreground/10 px-8 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-ink-foreground/60">Now serving</p>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" title={sound ? "Mute announcements" : "Enable announcement chime"} onClick={() => setSound(!sound)}>
              {sound ? <Volume2 /> : <VolumeX />}
            </Button>
            <p className="font-token text-xl">{time}</p>
          </div>
        </div>
        <div className="grid gap-0 lg:grid-cols-5">
          <div className="flex flex-col items-center justify-center gap-4 border-ink-foreground/10 p-10 lg:col-span-2 lg:border-r">
            {latest ? (
              <>
                <p key={latest.id} className="animate-flip font-token text-6xl sm:text-8xl xl:text-9xl font-extrabold leading-none text-accent">{latest.token}</p>
                <p className="text-3xl font-display">→ {state.counters.find((c) => c.id === latest.counterId)?.name}</p>
              </>
            ) : (
              <p className="text-2xl text-ink-foreground/50">Waiting for next call…</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-px bg-ink-foreground/10 lg:col-span-3">
            {state.counters.map((c) => {
              const e = active.find((x) => x.counterId === c.id);
              return (
                <div key={c.id} className="bg-ink p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-ink-foreground/50">{c.name}</p>
                  <p key={e?.id} className={`mt-3 font-token text-3xl sm:text-5xl font-bold ${e ? "animate-flip" : "text-ink-foreground/20"}`}>{e?.token ?? "—"}</p>
                  <p className={`mt-2 text-sm font-semibold ${e?.status === "SERVING" ? "text-serving" : e ? "text-called animate-soft-pulse" : "text-ink-foreground/40"}`}>
                    {e ? (e.status === "SERVING" ? "Being served" : "Please proceed") : "Open"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {state.services.map((s) => {
          const q = orderedCandidates(state, [s.id]).filter((e) => e.status === "WAITING");
          return (
            <div key={s.id} className="surface p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">{s.code} · {s.name}</h3>
                <span className="rounded-md bg-muted px-3 py-1 text-xs font-semibold">{q.length} waiting</span>
              </div>
              <ol className="mt-4 space-y-2">
                {q.slice(0, 6).map((e, i) => (
                  <li key={e.id} className="animate-rise flex items-center justify-between rounded-md bg-background px-4 py-2.5" style={{ animationDelay: `${i * 40}ms` }}>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{i + 1}</span>
                      <span className="font-token text-xl font-bold">{e.token}</span>
                      {e.priority && <PriorityChip />}
                    </span>
                    <span className="font-token text-sm text-muted-foreground">~{estimateWaitMin(state, e)} min</span>
                  </li>
                ))}
                {!q.length && <li className="py-6 text-center text-sm text-muted-foreground">No one waiting</li>}
              </ol>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid overflow-hidden border border-border bg-card md:grid-cols-2">
        <img src={lobby} alt="Aureum Bank branch interior" className="h-52 w-full object-cover md:h-64" />
        <div className="flex flex-col justify-center p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Aureum Bank</p>
          <h2 className="mt-3 font-display text-3xl">More time for what matters.</h2>
          <p className="mt-3 text-sm text-muted-foreground">Bank with confidence at {state.org.branch}. Your place in line is always right here.</p>
        </div>
      </div>

      {missed.length > 0 && (
        <div className="mt-6 surface flex flex-wrap items-center gap-3 p-5">
          <span className="text-sm font-semibold text-missed">Missed — please see the desk:</span>
          {missed.map((e) => <span key={e.id} className="rounded-lg bg-missed/10 px-3 py-1 font-token font-bold text-missed">{e.token}</span>)}
        </div>
      )}
    </AppShell>
  );
}
