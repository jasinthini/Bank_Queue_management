import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Banknote, Clock3, CreditCard, Landmark, Star, UsersRound, Download, MessageCircle, Smartphone, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AppShell, Loading, StatusChip } from "../components/AppShell.jsx";
import { Button, buttonClass } from "../components/Button.jsx";
import { useQueue } from "../lib/queue-store.jsx";
import { checkIn, estimateWaitMin, positionOf } from "../lib/queue-engine.js";
import lobby from "../assets/bank-lobby.jpg";

const icons = [Banknote, CreditCard, Landmark, UsersRound];

export default function Home() {
  const { state, run, branches, activeBranchId, switchBranch } = useQueue();
  const [name, setName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [myId, setMyId] = useState(null);
  const [phone, setPhone] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);

  if (!state) return <AppShell><Loading /></AppShell>;

  const sid = serviceId || state.services[0]?.id || "";
  const mine = state.entries.find((e) => e.id === myId);
  const waiting = state.entries.filter((e) => e.status === "WAITING").length;
  const serving = state.entries.filter((e) => e.status === "SERVING" || e.status === "CALLED");

  const submit = (ev) => {
    ev.preventDefault();
    let created;
    run((s) => {
      const isPriority = s.services.find((x) => x.id === sid)?.code === "P";
      const r = checkIn(s, { serviceId: sid, customer: name, priority: isPriority });
      created = r.entry;
      return r.state;
    });
    if (created) { setMyId(created.id); setName(""); }
  };

  const stats = [
    ["Live queue", `${waiting} waiting`],
    ["Open desks", `${state.counters.filter((c) => c.active).length} available`],
    ["Your branch", state.org.branch],
    ["Banking hours", "Live now"],
  ];

  return (
    <AppShell>
      {/* HERO */}
      <section className="relative min-h-[360px] overflow-hidden border border-border sm:min-h-[430px]">
        <img src={lobby} alt="Modern Aureum Bank lobby and teller desks" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/10" />
        <div className="relative flex min-h-[360px] flex-col justify-center p-7 sm:min-h-[430px] sm:p-12">
          <span className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
            <span className="size-2 rounded-full bg-serving animate-soft-pulse" /> Your branch, your time
          </span>
          <h1 className="max-w-xl font-display text-4xl leading-tight sm:text-6xl">Banking that moves <em className="text-primary">with you.</em></h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-foreground/85 sm:text-base">Take a ticket, skip the crowd, and arrive when it's your turn. A more considered way to bank.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#kiosk" className={buttonClass({ size: "lg" })}>Get a ticket <ArrowRight /></a>
            <Link to="/board" className={buttonClass({ size: "lg", variant: "outline", className: "border-primary/50 bg-ink/50 text-foreground" })}>Live board</Link>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="grid grid-cols-2 border border-t-0 border-border bg-card md:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="border-r border-border p-4 last:border-0 sm:p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="mt-1 truncate font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* KIOSK */}
      <section id="kiosk" className="grid gap-8 py-12 lg:grid-cols-[1fr_390px] lg:gap-12">
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Self-service kiosk</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">What brings you in today?</h2>
            </div>
            <select aria-label="Choose branch" value={activeBranchId} onChange={(e) => switchBranch(e.target.value)} className="max-w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
              {branches.map((b) => <option key={b.id} value={b.id}>{b.bank} · {b.name}</option>)}
            </select>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {state.services.map((svc, i) => {
              const Icon = icons[i % icons.length] ?? Banknote;
              const on = svc.id === sid;
              const queue = state.entries.filter((e) => e.serviceId === svc.id && e.status === "WAITING");
              const servers = Math.max(1, state.counters.filter((c) => c.active && c.serviceIds.includes(svc.id)).length);
              return (
                <Button key={svc.id} variant="outline" onClick={() => setServiceId(svc.id)}
                  className={`h-auto min-h-32 flex-col items-start justify-between rounded-md border p-5 text-left whitespace-normal ${on ? "border-primary bg-primary/10" : "bg-card hover:border-primary/50"}`}>
                  <span className="flex w-full items-start justify-between">
                    <Icon className="size-6 text-primary" />
                    <span className="font-token text-xs text-primary">{svc.code}-•••</span>
                  </span>
                  <span className="mt-4 block text-base font-semibold text-foreground">{svc.name}</span>
                  <span className="mt-2 flex w-full justify-between text-xs text-muted-foreground">
                    <span>{queue.length} waiting</span>
                    <span>~{Math.max(1, Math.ceil((queue.length + 1) / servers) * svc.avgServiceMin)} min</span>
                  </span>
                </Button>
              );
            })}
          </div>
          <div className="mt-8 flex items-center gap-3 border-t border-border pt-6 text-sm text-muted-foreground">
            <Clock3 className="size-5 text-primary" /> Fair, live updates from check-in to counter.
          </div>
        </div>

        {/* TICKET CARD */}
        <div className="self-start border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Landmark className="size-6 text-primary" />
            <div>
              <p className="font-display text-lg font-semibold">AUREUM BANK</p>
              <p className="text-xs text-muted-foreground">{state.org.branch}</p>
            </div>
          </div>
          <div className="my-7 border-t border-dashed border-border" />

          {mine ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Your queue ticket</p>
              <p className="mt-3 font-token text-6xl font-bold text-foreground">{mine.token}</p>
              <p className="mt-2 text-sm text-muted-foreground">{state.services.find((s) => s.id === mine.serviceId)?.name}</p>
              <div className="mt-5 flex items-center gap-3">
                <StatusChip status={mine.status} />
                <span className="text-xs text-muted-foreground">{state.org.branch}</span>
              </div>
              <div className="my-6 grid grid-cols-2 gap-3 border-y border-border py-5 text-center">
                <div>
                  <p className="font-token text-2xl">{mine.status === "WAITING" ? `#${positionOf(state, mine)}` : "—"}</p>
                  <p className="text-xs text-muted-foreground">In line</p>
                </div>
                <div>
                  <p className="font-token text-2xl">~{estimateWaitMin(state, mine)}m</p>
                  <p className="text-xs text-muted-foreground">Est. wait</p>
                </div>
              </div>
              {serving.some((e) => e.id === mine.id) && (
                <p className="mb-5 font-semibold text-primary">Please proceed to {state.counters.find((c) => c.id === mine.counterId)?.name}</p>
              )}
              <div className="mx-auto w-fit bg-foreground p-3">
                <QRCodeSVG value={`${window.location.origin}/ticket?id=${mine.id}`} size={138} />
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">Scan for live status</p>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => window.print()}><Download /> Print</Button>
                <Button variant="outline" onClick={() => setAlertOpen(true)}><MessageCircle /> Alerts</Button>
              </div>
              {mine.status === "DONE" && <Button className="mt-3 w-full" onClick={() => setRatingOpen(true)}><Star /> Rate your visit</Button>}
              <Button variant="ghost" className="mt-3 w-full text-primary" onClick={() => setMyId(null)}>New ticket <ArrowRight /></Button>
            </>
          ) : (
            <form onSubmit={submit}>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Your next step</p>
              <h3 className="mt-3 font-display text-2xl">Take your ticket</h3>
              <p className="mt-2 text-sm text-muted-foreground">Select a service and we'll save your place.</p>
              <label className="mt-7 block text-sm font-medium">
                Your name
                <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name"
                  className="mt-2 w-full rounded-md border border-input bg-background px-4 py-3 outline-none focus:border-primary" />
              </label>
              <div className="mt-6 flex justify-between border-y border-border py-4 text-sm">
                <span className="text-muted-foreground">Selected service</span>
                <span className="max-w-[55%] text-right font-medium">{state.services.find((s) => s.id === sid)?.name}</span>
              </div>
              <Button type="submit" size="lg" className="mt-6 h-12 w-full">Get my ticket <ArrowRight /></Button>
              <p className="mt-4 text-center text-xs text-muted-foreground">No account needed · Free to use</p>
            </form>
          )}
        </div>
      </section>

      {/* NOW SERVING */}
      <section className="border-t border-border py-9">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Across the branch</p>
            <h2 className="mt-1 font-display text-2xl">Now serving</h2>
          </div>
          <Link to="/board" className="text-sm font-semibold text-primary">Full board →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {state.counters.map((c) => {
            const e = serving.find((x) => x.counterId === c.id);
            return (
              <div key={c.id} className="border border-border bg-card p-5">
                <p className="text-xs text-muted-foreground">{c.name}</p>
                <p className="mt-3 font-token text-3xl font-bold text-primary">{e?.token ?? "—"}</p>
                <p className="mt-2 text-xs text-muted-foreground">{e ? (e.status === "CALLED" ? "Please proceed" : "Being served") : "Available"}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ALERTS MODAL */}
      {alertOpen && mine && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md border border-border bg-card p-7">
            <div className="flex justify-between">
              <h2 className="font-display text-2xl">Turn alerts</h2>
              <Button variant="ghost" size="icon" title="Close" onClick={() => setAlertOpen(false)}><X /></Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Preview only — messages are not sent in this demo.</p>
            <label className="mt-6 block text-sm">
              Mobile number
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+94 77 123 4567" type="tel" className="mt-2 w-full rounded-md border border-input bg-background p-3" />
            </label>
            <div className="mt-5 border border-border bg-background p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold text-primary"><Smartphone className="size-4" /> SMS / WhatsApp preview</p>
              <p className="mt-2 text-muted-foreground">
                Aureum Bank: {mine.token}, you're {mine.status === "WAITING" ? `#${positionOf(state, mine)} in line` : mine.status.toLowerCase()}. We'll let you know when it's your turn at {state.org.branch}.
              </p>
            </div>
            <Button className="mt-5 w-full" onClick={() => setAlertOpen(false)}>Done</Button>
          </div>
        </div>
      )}

      {/* RATING MODAL */}
      {ratingOpen && mine && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm border border-border bg-card p-7 text-center">
            <h2 className="font-display text-2xl">How was your visit?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your feedback helps us serve you better.</p>
            <div className="mt-6 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Button key={n} size="icon" variant="ghost" title={`${n} stars`}
                  className={n <= (mine.rating || 0) ? "text-primary" : "text-muted-foreground"}
                  onClick={() => {
                    run((s) => ({ ...s, entries: s.entries.map((e) => (e.id === mine.id ? { ...e, rating: n } : e)) }), "Thank you for your feedback");
                    setRatingOpen(false);
                  }}>
                  <Star className="size-6" fill={n <= (mine.rating || 0) ? "currentColor" : "none"} />
                </Button>
              ))}
            </div>
            <Button variant="ghost" className="mt-5" onClick={() => setRatingOpen(false)}>Not now</Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
