import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PhoneCall,
  Play,
  CheckCircle2,
  UserX,
  Lock,
} from "lucide-react";
import {
  AppShell,
  StatusChip,
} from "../components/AppShell.jsx";
import { Button } from "../components/Button.jsx";
import {
  getCurrentUser,
  countersApi,
  servicesApi,
  ticketsApi,
} from "../lib/api.js";

export default function Counter() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [counters, setCounters] = useState([]);
  const [counterId, setCounterId] = useState("");
  const [services, setServices] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const currentUser = await getCurrentUser();
        if (cancelled) return;

        setUser(currentUser);

        const role = String(currentUser.role).toUpperCase();

        if (!["ADMIN", "STAFF"].includes(role)) return;

        const data = await countersApi.list();
        if (cancelled) return;

        setCounters(data);
        setCounterId(String(data[0]?.id || ""));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const counter = counters.find(
    (item) => String(item.id) === counterId
  );

  const branchId = counter?.branch_id;

  useEffect(() => {
    if (!branchId) return;

    let cancelled = false;
    let timer;

    setLoading(true);
    setTickets([]);
    setServices([]);

    async function refresh() {
      try {
        const [ticketData, serviceData] = await Promise.all([
          ticketsApi.staff(branchId),
          servicesApi.list(branchId),
        ]);

        if (cancelled) return;

        setTickets(ticketData);
        setServices(serviceData);
        setError("");
      } catch (err) {
        if (!cancelled) setError(err.message);
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
  }, [branchId, refreshKey]);

  const allowed = ["ADMIN", "STAFF"].includes(
    String(user?.role || "").toUpperCase()
  );

  const service = services.find(
    (item) => String(item.id) === String(counter?.service_id)
  );

  const current = tickets.find(
    (ticket) =>
      String(ticket.counter_id) === counterId &&
      ["CALLED", "SERVING"].includes(ticket.status)
  );

  const serviceTickets = tickets.filter(
    (ticket) =>
      String(ticket.service_id) === String(counter?.service_id)
  );

  const waiting = serviceTickets
    .filter((ticket) => ticket.status === "WAITING")
    .sort(
      (a, b) =>
        a.sequence_number - b.sequence_number ||
        a.id - b.id
    );

  const missed = serviceTickets.filter(
    (ticket) => ticket.status === "MISSED"
  );

  const completed = tickets.filter(
    (ticket) =>
      String(ticket.counter_id) === counterId &&
      ticket.status === "COMPLETED"
  ).length;

  async function perform(action) {
    if (busy) return;

    setBusy(true);
    setActionError("");

    try {
      const updated = await action();

      setTickets((previous) => {
        const exists = previous.some(
          (item) => item.id === updated.id
        );

        return exists
          ? previous.map((item) =>
              item.id === updated.id ? updated : item
            )
          : [...previous, updated];
      });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setRefreshKey((value) => value + 1);
      setBusy(false);
    }
  }

  return (
    <AppShell title="Staff Dashboard">
      {checking ? (
        <p className="py-12 text-center">
          Checking session…
        </p>
      ) : !allowed ? (
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-8 text-center">
          <Lock className="mx-auto size-9 text-primary" />

          <h1 className="mt-4 font-display text-3xl">
            Staff access required
          </h1>

          <p className="mt-3 text-muted-foreground">
            Sign in with a Staff or Admin account.
          </p>

          {error && (
            <p className="mt-4 text-red-500">{error}</p>
          )}

          <Link
            to="/login"
            className="mt-6 inline-block rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Aureum Bank
              </p>

              <h1 className="mt-2 font-display text-3xl">
                Staff Dashboard
              </h1>

              <p className="mt-2 text-muted-foreground">
                Welcome, {user.full_name}
              </p>
            </div>

            <label className="text-sm font-medium">
              Counter
              <select
                value={counterId}
                disabled={busy}
                onChange={(event) => {
                  setCounterId(event.target.value);
                  setActionError("");
                }}
                className="ml-3 rounded-md border border-input bg-background px-3 py-2 text-foreground"
              >
                <option value="">Select counter</option>

                {counters.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {(error || actionError) && (
            <p
              role="alert"
              className="mb-5 rounded-md bg-red-500/10 p-4 text-sm text-red-500"
            >
              {actionError || error}
            </p>
          )}

          {!counter ? (
            <p className="py-10 text-center text-muted-foreground">
              No counter selected. Add counters in Admin if needed.
            </p>
          ) : loading ? (
            <p className="py-12 text-center">
              Loading queue…
            </p>
          ) : (
            <>
              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                {[
                  ["Waiting", waiting.length],
                  ["Completed at this counter", completed],
                  ["Missed for this service", missed.length],
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

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-6">
                  <section className="rounded-lg border border-border bg-card p-7">
                    <div className="flex justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold">
                          {counter.name}
                        </h2>

                        <p className="mt-2 text-muted-foreground">
                          {service?.name}
                        </p>
                      </div>

                      <span className="text-sm text-primary">
                        {counter.is_active ? "Open" : "Closed"}
                      </span>
                    </div>

                    <p className="mt-7 text-xs font-bold uppercase tracking-widest text-primary">
                      Current customer
                    </p>

                    <p className="mt-3 font-token text-6xl font-bold text-primary sm:text-7xl">
                      {current?.token_number || "—"}
                    </p>

                    {current ? (
                      <>
                        <p className="my-4 text-xl font-semibold">
                          {current.customer_name}
                        </p>

                        <StatusChip status={current.status} />
                      </>
                    ) : (
                      <p className="mt-4 text-muted-foreground">
                        No active customer. Call the next token.
                      </p>
                    )}
                  </section>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      className="h-auto py-4"
                      disabled={
                        busy ||
                        !!error ||
                        !!current ||
                        !waiting.length ||
                        !counter.is_active
                      }
                      onClick={() =>
                        perform(() =>
                          ticketsApi.callNext(counter.id)
                        )
                      }
                    >
                      <PhoneCall className="size-4" />
                      Call Next
                    </Button>

                    <Button
                      className="h-auto py-4"
                      disabled={
                        busy || current?.status !== "CALLED"
                      }
                      onClick={() =>
                        perform(() =>
                          ticketsApi.startServing(current.id)
                        )
                      }
                    >
                      <Play className="size-4" />
                      Start Serving
                    </Button>

                    <Button
                      variant="outline"
                      className="h-auto py-4"
                      disabled={
                        busy || current?.status !== "SERVING"
                      }
                      onClick={() =>
                        perform(() =>
                          ticketsApi.complete(current.id)
                        )
                      }
                    >
                      <CheckCircle2 className="size-4" />
                      Complete
                    </Button>

                    <Button
                      variant="outline"
                      className="h-auto py-4 text-missed"
                      disabled={
                        busy ||
                        !["CALLED", "SERVING"].includes(
                          current?.status
                        )
                      }
                      onClick={() =>
                        perform(() =>
                          ticketsApi.markMissed(current.id)
                        )
                      }
                    >
                      <UserX className="size-4" />
                      Mark Missed
                    </Button>
                  </div>

                  <section className="rounded-lg border border-border bg-card p-6">
                    <h2 className="text-lg font-semibold text-missed">
                      Missed customers
                    </h2>

                    {missed.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="mt-3 flex items-center justify-between gap-3 border-b border-border py-3"
                      >
                        <span className="font-token text-xl font-bold">
                          {ticket.token_number}
                        </span>

                        <span className="text-sm">
                          {ticket.customer_name}
                        </span>
                      </div>
                    ))}

                    {!missed.length && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No missed customers
                      </p>
                    )}
                  </section>
                </div>

                <section className="rounded-lg border border-border bg-card p-6">
                  <h2 className="text-xl font-semibold">
                    Waiting customers
                  </h2>

                  <p className="mt-2 text-sm text-muted-foreground">
                    {service?.name} · {waiting.length} waiting
                  </p>

                  <div className="my-5 rounded-md border border-primary/30 bg-primary/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-primary">
                      Next to call
                    </p>

                    <p className="mt-2 font-token text-3xl font-bold">
                      {waiting[0]?.token_number || "—"}
                    </p>

                    <p className="mt-2">
                      {waiting[0]?.customer_name ||
                        "Queue is empty"}
                    </p>
                  </div>

                  <ol className="space-y-3">
                    {waiting.map((ticket, index) => (
                      <li
                        key={ticket.id}
                        className="flex items-center justify-between gap-3 rounded-md bg-background p-4"
                      >
                        <div>
                          <p className="font-token text-xl font-bold">
                            {ticket.token_number}
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {ticket.customer_name}
                          </p>
                        </div>

                        <span className="text-sm text-muted-foreground">
                          #{index + 1}
                        </span>
                      </li>
                    ))}
                  </ol>

                  {!waiting.length && (
                    <p className="py-8 text-center text-muted-foreground">
                      No waiting customers
                    </p>
                  )}
                </section>
              </div>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                Queue refreshes every 5 seconds.
              </p>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}