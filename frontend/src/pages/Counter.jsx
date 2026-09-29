import { Link } from "react-router-dom";
import { BellRing, CheckCircle2, Lock, PhoneCall, Play, RotateCcw, UserX } from "lucide-react";
import staffImg from "../assets/counter-staff.jpg";
import { Button, buttonClass } from "../components/Button.jsx";
import { AppShell, Loading, PriorityChip, StatusChip } from "../components/AppShell.jsx";
import { useQueue } from "../lib/queue-store.jsx";
import { activeFor, callNext, complete, estimateWaitMin, markMissed, orderedCandidates, recall, startServing } from "../lib/queue-engine.js";

const btnStyles = {
  primary: "bg-warm text-accent-foreground shadow-accent",
  serve: "bg-primary text-primary-foreground shadow-soft",
  ghost: "border border-border bg-card hover:bg-muted",
  danger: "border border-missed/30 bg-missed/10 text-missed hover:bg-missed/15",
};

function ActionButton({ onClick, disabled, children, variant = "ghost" }) {
  return (
    <Button onClick={onClick} disabled={disabled}
      className={`flex h-auto items-center justify-center gap-2 rounded-md px-4 py-4 font-semibold transition hover:brightness-105 ${btnStyles[variant]}`}>
      {children}
    </Button>
  );
}

export default function Counter() {
  const { state, session } = useQueue();
  if (!state) return <AppShell><Loading /></AppShell>;

  const allowed = session && session.role === "staff" && state.counters.some((c) => c.id === session.counterId);
  if (!allowed)
    return (
      <AppShell title="Teller Console">
        <div className="mx-auto max-w-md border border-border bg-card p-8 text-center">
          <Lock className="mx-auto size-9 text-primary" />
          <h1 className="mt-4 font-display text-3xl">Teller access</h1>
          <p className="mt-3 text-muted-foreground">Sign in to operate your counter.</p>
          <Link to="/login" className={buttonClass({ className: "mt-6" })}>Go to sign in</Link>
        </div>
      </AppShell>
    );

  return <AppShell title="Teller Console"><Console /></AppShell>;
}

function Console() {
  const { state: s, session, run } = useQueue();
  const counter = s.counters.find((c) => c.id === session.counterId);
  const pin = session.pin;
  const cur = activeFor(s, counter.id);
  const queue = orderedCandidates(s, counter.serviceIds);
  const missed = s.entries.filter((e) => e.status === "MISSED" && counter.serviceIds.includes(e.serviceId));
  const servedToday = s.entries.filter((e) => e.counterId === counter.id && e.status === "DONE").length;
  const svcName = (id) => s.services.find((x) => x.id === id)?.name;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        {/* Current token */}
        <div className="relative overflow-hidden rounded-md bg-hero p-8 text-foreground shadow-lift">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <img src={staffImg} alt="Teller officer" className="size-12 rounded-full object-cover" />
                <p className="text-xs font-bold uppercase tracking-widest opacity-70">{counter.name} · {counter.staffName}</p>
              </div>
              <p className="mt-1 text-sm opacity-80">{counter.serviceIds.map(svcName).join(" · ")}</p>
            </div>
            <div className="text-right">
              <p className="font-token text-3xl font-bold">{servedToday}</p>
              <p className="text-xs opacity-70">served today</p>
            </div>
          </div>
          <div className="mt-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest opacity-70">Current token</p>
              <p key={cur?.id ?? "none"} className="animate-flip font-token text-6xl sm:text-8xl font-extrabold leading-none">{cur?.token ?? "—"}</p>
              {cur && <p className="mt-2 text-sm opacity-85">{cur.customer} · {svcName(cur.serviceId)}{cur.recalled ? " · recalled" : ""}</p>}
            </div>
            {cur && <div className="rounded-full bg-primary-foreground px-1 py-0.5"><StatusChip status={cur.status} /></div>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ActionButton variant="primary" disabled={!!cur || !queue.length} onClick={() => run((st) => callNext(st, counter.id, pin), "Next token called")}>
            <PhoneCall className="size-4" /> Call Next
          </ActionButton>
          <ActionButton variant="serve" disabled={cur?.status !== "CALLED"} onClick={() => run((st) => startServing(st, counter.id, pin), "Now serving")}>
            <Play className="size-4" /> Start Serving
          </ActionButton>
          <ActionButton disabled={cur?.status !== "SERVING"} onClick={() => run((st) => complete(st, counter.id, pin), "Token completed")}>
            <CheckCircle2 className="size-4" /> Complete
          </ActionButton>
          <ActionButton variant="danger" disabled={cur?.status !== "CALLED"} onClick={() => run((st) => markMissed(st, counter.id, pin), "Marked missed")}>
            <UserX className="size-4" /> Mark Missed
          </ActionButton>
        </div>

        {/* Missed tokens */}
        <div className="surface p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold"><BellRing className="size-4 text-missed" /> Missed tokens</h3>
          <p className="text-xs text-muted-foreground">Auto-recalled after {s.policy.recallGap} more calls · second miss becomes a no-show.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {missed.map((e) => {
              const ready = (s.callCount[e.serviceId] ?? 0) >= (e.recallAfterCall ?? Infinity);
              return (
                <Button key={e.id} disabled={!!cur} onClick={() => run((st) => recall(st, counter.id, pin, e.id), `${e.token} recalled`)}
                  className="flex h-auto items-center gap-2 rounded-md border border-missed/30 bg-missed/5 px-3 py-2">
                  <span className="font-token font-bold text-missed">{e.token}</span>
                  <span className="text-xs text-muted-foreground">{ready ? "eligible" : "cooling"}</span>
                  <RotateCcw className="size-3.5" />
                </Button>
              );
            })}
            {!missed.length && <p className="text-sm text-muted-foreground">None 🎉</p>}
          </div>
        </div>
      </div>

      {/* Up next + activity */}
      <div className="surface p-6 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Up next for this counter</h3>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{queue.length}</span>
        </div>
        <p className="text-xs text-muted-foreground">Order: priority → eligible recalls → normal FIFO</p>
        <ol className="mt-4 space-y-2">
          {queue.map((e, i) => (
            <li key={e.id} className={`animate-rise flex items-center justify-between rounded-md border px-4 py-3 ${i === 0 ? "border-accent/40 bg-accent-soft" : "border-border bg-background"}`} style={{ animationDelay: `${i * 30}ms` }}>
              <span className="flex items-center gap-3">
                <span className="font-token text-xl font-bold">{e.token}</span>
                <span className="text-sm text-muted-foreground">{e.customer}</span>
              </span>
              <span className="flex items-center gap-2">
                {e.priority && <PriorityChip />}
                {e.status === "MISSED" ? <StatusChip status="MISSED" /> : <span className="font-token text-xs text-muted-foreground">~{estimateWaitMin(s, e)}m</span>}
              </span>
            </li>
          ))}
          {!queue.length && <li className="py-10 text-center text-muted-foreground">Queue is empty</li>}
        </ol>
        <h4 className="mt-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Activity</h4>
        <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-sm">
          {s.log.slice(0, 12).map((l, i) => (
            <li key={i} className="flex gap-3">
              <span className="font-token text-xs text-muted-foreground">{new Date(l.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              {l.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
