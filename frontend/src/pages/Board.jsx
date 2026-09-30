import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "../components/Button.jsx";
import lobby from "../assets/bank-lobby.jpg";
import { AppShell, Loading } from "../components/AppShell.jsx";
import {
  branchesApi,
  servicesApi,
  countersApi,
  getBoardTickets,
} from "../lib/api.js";

function callTime(ticket) {
  return Date.parse(ticket.called_at || "") || 0;
}

export default function Board() {
  const [params] = useSearchParams();
  const requestedBranchId = params.get("branch_id") || "";

  const [branch, setBranch] = useState(null);
  const [services, setServices] = useState([]);
  const [counters, setCounters] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sound, setSound] = useState(false);
  const [now, setNow] = useState(Date.now());

  const lastCall = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer;
    let selectedBranch = null;

    setLoading(true);
    setError("");
    setBranch(null);
    setServices([]);
    setCounters([]);
    setTickets([]);
    lastCall.current = null;

    async function refresh() {
      try {
        if (!selectedBranch) {
          const branches = await branchesApi.list();

          selectedBranch = requestedBranchId
            ? branches.find(
                (item) =>
                  String(item.id) === requestedBranchId
              )
            : branches[0];

          if (!selectedBranch) {
            throw new Error(
              "Branch கிடைக்கவில்லை. Admin page-ல் branch சேருங்கள்."
            );
          }
        }

        const [serviceData, counterData, ticketData] =
          await Promise.all([
            servicesApi.list(selectedBranch.id),
            countersApi.list({
              branch_id: selectedBranch.id,
            }),
            getBoardTickets(selectedBranch.id),
          ]);

        if (cancelled) return;

        setBranch(selectedBranch);
        setServices(
          serviceData.filter(
            (item) =>
              item.branch_id === selectedBranch.id
          )
        );
        setCounters(
          counterData.filter(
            (item) =>
              item.branch_id === selectedBranch.id
          )
        );
        setTickets(ticketData);
        setError("");
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message || "Board தகவல் பெற முடியவில்லை."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = window.setTimeout(refresh, 5000);
        }
      }
    }

    refresh();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [requestedBranchId]);

  const newest = tickets
    .filter((ticket) => ticket.status === "CALLED")
    .sort((a, b) => callTime(b) - callTime(a))[0];

  const newestId = newest?.id;
  const newestCalledAt = newest?.called_at;

  useEffect(() => {
    if (!newestId) return;

    const key = `${newestId}:${newestCalledAt}`;

    if (
      lastCall.current &&
      lastCall.current !== key &&
      sound
    ) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (AudioContextClass) {
        try {
          const ctx = new AudioContextClass();

          [0, 0.18].forEach((delay, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.frequency.value = 784;
            gain.gain.value = 0.08;

            osc.connect(gain).connect(ctx.destination);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.12);

            if (index === 1) {
              osc.onended = () => {
                ctx.close().catch(() => {});
              };
            }
          });

          ctx.resume().catch(() => {});
        } catch {
          // Board updates continue if audio is unavailable.
        }
      }
    }

    lastCall.current = key;
  }, [newestId, newestCalledAt, sound]);

  if (loading) {
    return (
      <AppShell>
        <Loading />
      </AppShell>
    );
  }

  const active = tickets
    .filter(
      (ticket) =>
        ticket.status === "CALLED" ||
        ticket.status === "SERVING"
    )
    .sort((a, b) => callTime(b) - callTime(a));

  const latest = active[0];
  const missed = tickets.filter(
    (ticket) => ticket.status === "MISSED"
  );

  const time = new Date(now).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const counterName = (id) =>
    counters.find((counter) => counter.id === id)?.name ||
    `Counter ${id}`;

  return (
    <AppShell title="Live Waiting Board">
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
          {branch && " · Showing the last successful update"}
        </p>
      )}

      <div className="overflow-hidden rounded-md bg-ink text-ink-foreground shadow-lift">
        <div className="flex items-center justify-between border-b border-ink-foreground/10 px-8 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-ink-foreground/60">
            Now serving
          </p>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              title={
                sound
                  ? "Mute announcements"
                  : "Enable announcement chime"
              }
              onClick={() => setSound((value) => !value)}
            >
              {sound ? <Volume2 /> : <VolumeX />}
            </Button>

            <p className="font-token text-xl">{time}</p>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-5">
          <div className="flex flex-col items-center justify-center gap-4 border-ink-foreground/10 p-10 lg:col-span-2 lg:border-r">
            {latest ? (
              <>
                <p
                  key={latest.id}
                  className="animate-flip font-token text-6xl sm:text-8xl xl:text-9xl font-extrabold leading-none text-accent"
                >
                  {latest.token_number}
                </p>

                <p className="text-3xl font-display">
                  → {counterName(latest.counter_id)}
                </p>
              </>
            ) : (
              <p className="text-2xl text-ink-foreground/50">
                {error
                  ? "Board information unavailable"
                  : "Waiting for next call…"}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-px bg-ink-foreground/10 lg:col-span-3">
            {counters.map((counter) => {
              const ticket = active.find(
                (item) => item.counter_id === counter.id
              );

              return (
                <div
                  key={counter.id}
                  className="bg-ink p-6"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-ink-foreground/50">
                    {counter.name}
                  </p>

                  <p
                    key={ticket?.id}
                    className={`mt-3 font-token text-3xl sm:text-5xl font-bold ${
                      ticket
                        ? "animate-flip"
                        : "text-ink-foreground/20"
                    }`}
                  >
                    {ticket?.token_number ?? "—"}
                  </p>

                  <p
                    className={`mt-2 text-sm font-semibold ${
                      ticket?.status === "SERVING"
                        ? "text-serving"
                        : ticket
                          ? "text-called animate-soft-pulse"
                          : "text-ink-foreground/40"
                    }`}
                  >
                    {ticket
                      ? ticket.status === "SERVING"
                        ? "Being served"
                        : "Please proceed"
                      : counter.is_active
                        ? "Open"
                        : "Closed"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {services.map((service) => {
          const queue = tickets.filter(
            (ticket) =>
              ticket.service_id === service.id &&
              ticket.status === "WAITING"
          );

          return (
            <div
              key={service.id}
              className="surface p-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">
                  {service.code} · {service.name}
                </h3>

                <span className="rounded-md bg-muted px-3 py-1 text-xs font-semibold">
                  {queue.length} waiting
                </span>
              </div>

              <ol className="mt-4 space-y-2">
                {queue.slice(0, 6).map((ticket, index) => (
                  <li
                    key={ticket.id}
                    className="animate-rise flex items-center justify-between rounded-md bg-background px-4 py-2.5"
                    style={{
                      animationDelay: `${index * 40}ms`,
                    }}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {index + 1}
                      </span>

                      <span className="font-token text-xl font-bold">
                        {ticket.token_number}
                      </span>
                    </span>

                    <span className="font-token text-sm text-muted-foreground">
                      Waiting
                    </span>
                  </li>
                ))}

                {!queue.length && (
                  <li className="py-6 text-center text-sm text-muted-foreground">
                    No one waiting
                  </li>
                )}
              </ol>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid overflow-hidden border border-border bg-card md:grid-cols-2">
        <img
          src={lobby}
          alt="Aureum Bank branch interior"
          className="h-52 w-full object-cover md:h-64"
        />

        <div className="flex flex-col justify-center p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Aureum Bank
          </p>

          <h2 className="mt-3 font-display text-3xl">
            More time for what matters.
          </h2>

          <p className="mt-3 text-sm text-muted-foreground">
            Bank with confidence at{" "}
            {branch?.name || "Aureum Bank"}.
            Your place in line is always right here.
          </p>
        </div>
      </div>

      {missed.length > 0 && (
        <div className="mt-6 surface flex flex-wrap items-center gap-3 p-5">
          <span className="text-sm font-semibold text-missed">
            Missed — please see the desk:
          </span>

          {missed.map((ticket) => (
            <span
              key={ticket.id}
              className="rounded-lg bg-missed/10 px-3 py-1 font-token font-bold text-missed"
            >
              {ticket.token_number}
            </span>
          ))}
        </div>
      )}
    </AppShell>
  );
}