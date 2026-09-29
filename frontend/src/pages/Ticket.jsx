import { Link, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Landmark, ArrowLeft, Clock3 } from "lucide-react";
import { AppShell, Loading, StatusChip } from "../components/AppShell.jsx";
import { buttonClass } from "../components/Button.jsx";
import { useQueue } from "../lib/queue-store.jsx";
import { estimateWaitMin, positionOf } from "../lib/queue-engine.js";

export default function Ticket() {
  const [params] = useSearchParams();
  const id = params.get("id") ?? "";
  const { state } = useQueue();
  if (!state) return <AppShell><Loading /></AppShell>;
  const ticket = state.entries.find((e) => e.id === id);

  return (
    <AppShell title="Track your ticket">
      <div className="mx-auto max-w-xl border border-border bg-card p-7 sm:p-10">
        <div className="flex items-center gap-3 text-primary"><Landmark /><span className="font-display text-xl">AUREUM BANK</span></div>
        {ticket ? (
          <>
            <p className="mt-9 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Live ticket status</p>
            <h1 className="mt-2 font-token text-6xl font-bold text-primary">{ticket.token}</h1>
            <p className="mt-2 text-muted-foreground">{state.services.find((s) => s.id === ticket.serviceId)?.name} · {state.org.branch}</p>
            <div className="mt-8 flex items-center justify-between border-y border-border py-5">
              <StatusChip status={ticket.status} />
              <span className="text-sm text-muted-foreground">{ticket.customer}</span>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-4">
              <div>
                <p className="font-token text-3xl">{ticket.status === "WAITING" ? `#${positionOf(state, ticket)}` : "—"}</p>
                <p className="text-sm text-muted-foreground">Position</p>
              </div>
              <div>
                <p className="font-token text-3xl">~{estimateWaitMin(state, ticket)}m</p>
                <p className="text-sm text-muted-foreground">Estimated wait</p>
              </div>
            </div>
            {ticket.counterId && (
              <div className="mt-7 border border-primary/30 bg-primary/10 p-4 text-primary">
                {state.counters.find((c) => c.id === ticket.counterId)?.name} · {ticket.status === "CALLED" ? "Please proceed now" : "In service"}
              </div>
            )}
            <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
              <QRCodeSVG value={window.location.href} size={92} />
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-4" /> Updates live in this browser</p>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-8 font-display text-3xl">Ticket not found</h1>
            <p className="mt-3 text-sm text-muted-foreground">This demo ticket is available only in the same browser and branch where it was issued.</p>
          </>
        )}
        <Link to="/" className={buttonClass({ variant: "outline", className: "mt-8" })}><ArrowLeft /> Get a ticket</Link>
      </div>
    </AppShell>
  );
}
