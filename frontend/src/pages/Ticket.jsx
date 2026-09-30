import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Landmark, ArrowLeft, Clock3 } from "lucide-react";
import {
  AppShell,
  Loading,
  StatusChip,
} from "../components/AppShell.jsx";
import { buttonClass } from "../components/Button.jsx";
import {
  ticketsApi,
  branchesApi,
  servicesApi,
  countersApi,
} from "../lib/api.js";

export default function Ticket() {
  const [params] = useSearchParams();
  const id = params.get("id") || "";

  const [ticket, setTicket] = useState(null);
  const [branch, setBranch] = useState(null);
  const [service, setService] = useState(null);
  const [counter, setCounter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer;

    setTicket(null);
    setBranch(null);
    setService(null);
    setCounter(null);
    setError("");
    setLoading(true);

    async function refresh() {
      try {
        if (!/^[1-9]\d*$/.test(id)) {
          throw new Error("சரியான ticket ID கிடைக்கவில்லை.");
        }

        const current = await ticketsApi.get(id);

        const results = await Promise.allSettled([
          branchesApi.get(current.branch_id),
          servicesApi.get(current.service_id),
          current.counter_id
            ? countersApi.get(current.counter_id)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setTicket(current);
        setBranch(
          results[0].status === "fulfilled"
            ? results[0].value
            : null
        );
        setService(
          results[1].status === "fulfilled"
            ? results[1].value
            : null
        );
        setCounter(
          results[2].status === "fulfilled"
            ? results[2].value
            : null
        );
        setError("");
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Ticket பெற முடியவில்லை.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);

          if (/^[1-9]\d*$/.test(id)) {
            timer = window.setTimeout(refresh, 5000);
          }
        }
      }
    }

    refresh();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [id]);

  if (loading) {
    return (
      <AppShell>
        <Loading />
      </AppShell>
    );
  }

  const counterMessage = {
    CALLED: "Please proceed now",
    SERVING: "In service",
    COMPLETED: "Service completed",
    MISSED: "Please see the desk",
    CANCELLED: "Ticket cancelled",
  };

  return (
    <AppShell title="Track your ticket">
      <div className="mx-auto max-w-xl border border-border bg-card p-7 sm:p-10">
        <div className="flex items-center gap-3 text-primary">
          <Landmark />
          <span className="font-display text-xl">
            AUREUM BANK
          </span>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {ticket ? (
          <>
            <p className="mt-9 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Live ticket status
            </p>

            <h1 className="mt-2 font-token text-6xl font-bold text-primary">
              {ticket.token_number}
            </h1>

            <p className="mt-2 text-muted-foreground">
              {service?.name || `Service ${ticket.service_id}`}
              {" · "}
              {branch?.name || `Branch ${ticket.branch_id}`}
            </p>

            <div className="mt-8 flex items-center justify-between border-y border-border py-5">
              <StatusChip status={ticket.status} />
              <span className="text-sm text-muted-foreground">
                Your ticket
              </span>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-4">
              <div>
                <p className="font-token text-3xl">
                  {ticket.status === "WAITING" &&
                  ticket.position != null
                    ? `#${ticket.position}`
                    : "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Position
                </p>
              </div>

              <div>
                <p className="font-token text-3xl">
                  {ticket.status === "WAITING" &&
                  ticket.estimated_wait_minutes != null
                    ? `~${ticket.estimated_wait_minutes}m`
                    : "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Estimated wait
                </p>
              </div>
            </div>

            {ticket.counter_id && (
              <div className="mt-7 border border-primary/30 bg-primary/10 p-4 text-primary">
                {counter?.name || `Counter ${ticket.counter_id}`}
                {" · "}
                {counterMessage[ticket.status] || ticket.status}
              </div>
            )}

            <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
              <QRCodeSVG
                value={window.location.href}
                size={92}
              />
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="size-4" />
                {error
                  ? "Refresh failed · showing last update"
                  : "Updates every 5 seconds"}
              </p>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-8 font-display text-3xl">
              Ticket unavailable
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Ticket உருவாக்கிய account-ல் login செய்து
              மீண்டும் திறக்கவும்.
            </p>
          </>
        )}

        <Link
          to="/"
          className={buttonClass({
            variant: "outline",
            className: "mt-8",
          })}
        >
          <ArrowLeft />
          Get a ticket
        </Link>
      </div>
    </AppShell>
  );
}