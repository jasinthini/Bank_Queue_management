import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell.jsx";
import {
  branchesApi,
  servicesApi,
  countersApi,
  getBoardTickets,
} from "../lib/api.js";
import lobby from "../assets/bank-lobby.jpg";

function sameId(a, b) {
  return String(a) === String(b);
}

function callTime(ticket) {
  return Date.parse(ticket.called_at || "") || 0;
}

export default function Board() {
  const [params, setParams] = useSearchParams();
  const requestedBranchId = params.get("branch_id") || "";

  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState(null);
  const [services, setServices] = useState([]);
  const [counters, setCounters] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [now, setNow] = useState(Date.now());

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
    setUpdatedAt(null);

    async function refresh() {
      try {
        if (!selectedBranch) {
          const branchData = await branchesApi.list();
          if (cancelled) return;

          if (!Array.isArray(branchData)) {
            throw new Error("Unexpected branch response.");
          }

          setBranches(branchData);

          selectedBranch = requestedBranchId
            ? branchData.find((item) =>
                sameId(item.id, requestedBranchId)
              )
            : branchData[0];

          if (!selectedBranch) {
            throw new Error(
              "Branch not found. Select an available branch."
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

        if (
          !Array.isArray(serviceData) ||
          !Array.isArray(counterData) ||
          !Array.isArray(ticketData)
        ) {
          throw new Error(
            "Unexpected board response from backend."
          );
        }

        setBranch(selectedBranch);

        setServices(
          serviceData.filter((item) =>
            sameId(item.branch_id, selectedBranch.id)
          )
        );

        setCounters(
          counterData.filter((item) =>
            sameId(item.branch_id, selectedBranch.id)
          )
        );

        // Preserve the sequence order returned by the backend.
        setTickets(ticketData);
        setUpdatedAt(Date.now());
        setError("");
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message || "Could not load the Live Board."
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

  function changeBranch(event) {
    const nextParams = new URLSearchParams(params);
    nextParams.set("branch_id", event.target.value);
    setParams(nextParams);
  }

  const waiting = tickets.filter(
    (ticket) => ticket.status === "WAITING"
  );

  const active = tickets
    .filter(
      (ticket) =>
        ticket.status === "CALLED" ||
        ticket.status === "SERVING"
    )
    .sort((a, b) => callTime(b) - callTime(a));

  const missed = tickets.filter(
    (ticket) => ticket.status === "MISSED"
  );

  const latest = active[0];

  function counterName(id) {
    return (
      counters.find((item) => sameId(item.id, id))?.name ||
      `Counter ${id}`
    );
  }

  function serviceName(id) {
    return (
      services.find((item) => sameId(item.id, id))?.name ||
      `Service ${id}`
    );
  }

  const time = new Date(now).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <AppShell title="Live Board">
      {/* Bank image banner */}
      <section className="relative mb-6 overflow-hidden rounded-lg border border-border">
        <img
          src={lobby}
          alt="Aureum Bank lobby"
          className="h-48 w-full object-cover sm:h-64"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
            AUREUM BANK
          </p>

          <h2 className="mt-3 font-display text-3xl text-white sm:text-4xl">
            Your turn, made simple.
          </h2>

          <p className="mt-3 max-w-md text-sm text-white/80">
            Watch your token and proceed to your counter
            when called.
          </p>
        </div>
      </section>

      {/* Heading and branch selection */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Aureum Bank
          </p>

          <h1 className="mt-2 font-display text-3xl">
            Live Queue Board
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            {branch?.name || "Select your branch"}
          </p>
        </div>

        {branches.length > 0 && (
          <label className="text-sm font-medium">
            Branch
            <select
              value={
                requestedBranchId ||
                String(branch?.id || branches[0]?.id || "")
              }
              onChange={changeBranch}
              className="ml-3 rounded-md border border-input bg-background px-3 py-2 text-foreground"
            >
              {requestedBranchId &&
                !branches.some((item) =>
                  sameId(item.id, requestedBranchId)
                ) && (
                  <option value={requestedBranchId}>
                    Unavailable branch
                  </option>
                )}

              {branches.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-md bg-red-500/10 p-4 text-sm text-red-500"
        >
          {error}
          {updatedAt
            ? " Showing the last successful update."
            : ""}
        </p>
      )}

      {loading ? (
        <p className="py-16 text-center text-muted-foreground">
          Loading queue…
        </p>
      ) : !branch ? (
        <p className="py-12 text-center text-muted-foreground">
          Board data is unavailable.
        </p>
      ) : (
        <>
          {/* Queue totals */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {[
              ["Waiting", waiting.length],
              ["Called / Serving", active.length],
              ["Missed", missed.length],
            ].map(([label, count]) => (
              <div
                key={label}
                className="rounded-lg border border-border bg-card p-5"
              >
                <p className="text-sm text-muted-foreground">
                  {label}
                </p>

                <p className="mt-2 font-token text-3xl font-bold text-primary">
                  {count}
                </p>
              </div>
            ))}
          </div>

          {/* Latest active call */}
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-primary">
                Now Serving
              </h2>

              <p className="font-token text-xl">
                {time}
              </p>
            </div>

            <div className="p-8 text-center sm:p-12">
              {latest ? (
                <>
                  <p className="font-token text-6xl font-bold text-primary sm:text-8xl">
                    {latest.token_number}
                  </p>

                  <p className="mt-4 font-display text-2xl">
                    {counterName(latest.counter_id)}
                  </p>

                  <p className="mt-2 text-muted-foreground">
                    {serviceName(latest.service_id)}
                  </p>

                  <p className="mt-4 font-semibold text-primary">
                    {latest.status === "CALLED"
                      ? "Please proceed to your counter"
                      : "Being served"}
                  </p>
                </>
              ) : (
                <p className="text-xl text-muted-foreground">
                  Waiting for next call…
                </p>
              )}
            </div>
          </section>

          {/* Counters */}
          <section className="mt-8">
            <h2 className="font-display text-2xl">
              Counters
            </h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {counters.map((counter) => {
                const current = active.find((ticket) =>
                  sameId(ticket.counter_id, counter.id)
                );

                return (
                  <div
                    key={counter.id}
                    className="rounded-lg border border-border bg-card p-6"
                  >
                    <h3 className="font-semibold">
                      {counter.name}
                    </h3>

                    <p className="mt-2 text-xs text-muted-foreground">
                      {serviceName(counter.service_id)}
                    </p>

                    <p className="mt-4 font-token text-4xl font-bold text-primary">
                      {current?.token_number || "—"}
                    </p>

                    <p className="mt-3 text-sm text-muted-foreground">
                      {current
                        ? current.status === "CALLED"
                          ? "Please proceed"
                          : "Being served"
                        : counter.is_active
                          ? "Open — waiting for next call"
                          : "Closed"}
                    </p>
                  </div>
                );
              })}
            </div>

            {!counters.length && (
              <p className="mt-4 text-sm text-muted-foreground">
                No counters configured for this branch.
              </p>
            )}
          </section>

          {/* Services and waiting lists */}
          <section className="mt-8">
            <h2 className="font-display text-2xl">
              Services and Waiting Tokens
            </h2>

            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              {services.map((service) => {
                const queue = waiting.filter((ticket) =>
                  sameId(ticket.service_id, service.id)
                );

                const nextTicket = queue[0];

                const serviceMissed = missed.filter((ticket) =>
                  sameId(ticket.service_id, service.id)
                );

                return (
                  <div
                    key={service.id}
                    className="rounded-lg border border-border bg-card p-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-semibold">
                          {service.name}
                        </h3>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {service.code}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-md bg-muted px-3 py-1 text-xs font-semibold">
                        {queue.length} waiting
                      </span>
                    </div>

                    <div className="mt-5 rounded-md border border-primary/30 bg-primary/10 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-primary">
                        Next to call
                      </p>

                      <p className="mt-2 font-token text-3xl font-bold">
                        {nextTicket?.token_number || "—"}
                      </p>

                      <p className="mt-2 text-xs text-muted-foreground">
                        {nextTicket
                          ? "Waiting for an available counter to call."
                          : "No waiting tokens."}
                      </p>
                    </div>

                    <h4 className="mt-5 text-sm font-semibold">
                      Waiting list
                    </h4>

                    <ol className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                      {queue.map((ticket, index) => (
                        <li
                          key={ticket.id}
                          className="flex items-center justify-between gap-3 rounded-md bg-background px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                              #{index + 1}
                            </span>

                            <span className="font-token text-xl font-bold">
                              {ticket.token_number}
                            </span>
                          </div>

                          <span className="text-xs text-muted-foreground">
                            WAITING
                          </span>
                        </li>
                      ))}
                    </ol>

                    {!queue.length && (
                      <p className="py-5 text-center text-sm text-muted-foreground">
                        No one waiting
                      </p>
                    )}

                    <div className="mt-5 border-t border-border pt-4">
                      <h4 className="text-sm font-semibold text-missed">
                        Missed tokens ({serviceMissed.length})
                      </h4>

                      {serviceMissed.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {serviceMissed.map((ticket) => (
                            <span
                              key={ticket.id}
                              className="rounded-md bg-missed/10 px-3 py-2 font-token font-bold text-missed"
                            >
                              {ticket.token_number}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No missed tokens
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!services.length && (
              <p className="mt-4 text-sm text-muted-foreground">
                No services configured for this branch.
              </p>
            )}
          </section>

          {/* Existing branch image section */}
          <section className="mt-8 grid overflow-hidden rounded-lg border border-border bg-card md:grid-cols-2">
            <img
              src={lobby}
              alt="Aureum Bank lobby"
              className="h-64 w-full object-cover"
            />

            <div className="flex flex-col justify-center p-7">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Aureum Bank
              </p>

              <h2 className="mt-3 font-display text-3xl">
                More time for what matters.
              </h2>

              <p className="mt-4 text-sm text-muted-foreground">
                Your queue at {branch.name}. Please proceed
                to your counter when your token is called.
              </p>
            </div>
          </section>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Refreshes every 5 seconds.
            {updatedAt &&
              ` Last updated: ${new Date(updatedAt).toLocaleTimeString()}`}
          </p>
        </>
      )}
    </AppShell>
  );
}