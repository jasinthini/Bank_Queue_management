import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Landmark, ArrowRight, Printer } from "lucide-react";
import { AppShell, StatusChip } from "../components/AppShell.jsx";
import { Button } from "../components/Button.jsx";
import {
  branchesApi,
  servicesApi,
  ticketsApi,
  getToken,
} from "../lib/api.js";

export default function CreateTicket() {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState("");
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBranches() {
      try {
        const data = await branchesApi.list();
        if (cancelled) return;

        setBranches(data);
        setBranchId(String(data[0]?.id || ""));

        if (!data.length) {
          setError("No branches available.");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBranches();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!branchId) return;

    let cancelled = false;

    setServices([]);
    setServiceId("");
    setError("");
    setServicesLoading(true);

    async function loadServices() {
      try {
        const data = await servicesApi.list(branchId);
        if (cancelled) return;

        const matching = data.filter(
          (item) => String(item.branch_id) === branchId
        );

        setServices(matching);
        setServiceId(String(matching[0]?.id || ""));

        if (!matching.length) {
          setError("No services available for this branch.");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setServicesLoading(false);
      }
    }

    loadServices();

    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const ticketId = ticket?.id;

  useEffect(() => {
    if (!ticketId) return;

    let cancelled = false;
    let timer;

    async function refresh() {
      try {
        const updated = await ticketsApi.get(ticketId);
        if (cancelled) return;

        setTicket(updated);
        setError("");

        if (["COMPLETED", "CANCELLED"].includes(updated.status)) {
          return;
        }
      } catch (err) {
        if (cancelled) return;

        setError(err.message);

        if ([401, 403, 404].includes(err.status)) {
          return;
        }
      }

      if (!cancelled) {
        timer = window.setTimeout(refresh, 5000);
      }
    }

    timer = window.setTimeout(refresh, 5000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ticketId]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setError("");

    if (!getToken()) {
      setError("Please sign in before taking a ticket.");
      return;
    }

    if (!branchId || !serviceId) {
      setError("Please select a branch and service.");
      return;
    }

    setSubmitting(true);

    try {
      const created = await ticketsApi.create(branchId, serviceId);
      setTicket(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const branch = branches.find(
    (item) =>
      String(item.id) === String(ticket?.branch_id ?? branchId)
  );

  const service = services.find(
    (item) =>
      String(item.id) === String(ticket?.service_id ?? serviceId)
  );

  const statusMessage = {
    WAITING: "Your ticket is saved. Watch the Live Board for your call.",
    CALLED: "Your token has been called. Check the Live Board for your counter.",
    SERVING: "Your service is in progress.",
    MISSED: "Your call was missed. Please speak to a staff member.",
    COMPLETED: "Your service is complete. Thank you for visiting.",
    CANCELLED: "This ticket has been cancelled.",
  };

  const fieldClass =
    "mt-2 w-full rounded-md border border-input bg-background px-4 py-3 text-foreground outline-none focus:border-primary";

  return (
    <AppShell title="Create Ticket">
      <div className="mx-auto max-w-xl">
        <Link
          to="/"
          className="text-sm font-semibold text-primary"
        >
          ← Back to Home
        </Link>

        <div className="mt-5 rounded-lg border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Landmark className="size-8 text-primary" />

            <div>
              <p className="font-display text-xl font-semibold">
                AUREUM BANK
              </p>
              <p className="text-sm text-muted-foreground">
                Secure Queue Management
              </p>
            </div>
          </div>

          <div className="my-6 border-t border-dashed border-border" />

          {error && (
            <p
              role="alert"
              className="mb-5 rounded-md bg-red-500/10 p-3 text-sm text-red-500"
            >
              {error}
            </p>
          )}

          {loading ? (
            <p className="py-8 text-center text-muted-foreground">
              Loading branches…
            </p>
          ) : ticket ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Your queue ticket
              </p>

              <p className="mt-4 break-words font-token text-6xl font-bold text-primary">
                {ticket.token_number}
              </p>

              <p className="mt-4 font-semibold">
                {service?.name}
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                {branch?.name}
              </p>

              <div className="mt-5">
                <StatusChip status={ticket.status} />
              </div>

              <p
                aria-live="polite"
                className="mt-5 text-sm text-muted-foreground"
              >
                {statusMessage[ticket.status] || ticket.status}
              </p>

              <Link
                to={`/board?branch_id=${ticket.branch_id}`}
                className="mt-6 flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground"
              >
                View Live Board
                <ArrowRight className="size-4" />
              </Link>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                >
                  <Printer className="size-4" />
                  Print
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setTicket(null);
                    setError("");
                  }}
                >
                  New ticket
                </Button>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                New ticket returns to the form. Your existing
                ticket remains in the queue.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Your next step
              </p>

              <h1 className="mt-3 font-display text-3xl">
                Take your ticket
              </h1>

              <p className="mt-3 text-sm text-muted-foreground">
                Select your branch and banking service.
              </p>

              <label className="mt-6 block text-sm font-medium">
                Branch
                <select
                  value={branchId}
                  onChange={(event) =>
                    setBranchId(event.target.value)
                  }
                  className={fieldClass}
                  disabled={submitting || !branches.length}
                  required
                >
                  <option value="">Select branch</option>

                  {branches.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-5 block text-sm font-medium">
                Service
                <select
                  value={serviceId}
                  onChange={(event) =>
                    setServiceId(event.target.value)
                  }
                  className={fieldClass}
                  disabled={servicesLoading || submitting}
                  required
                >
                  <option value="">
                    {servicesLoading
                      ? "Loading services…"
                      : "Select service"}
                  </option>

                  {services.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <Button
                type="submit"
                size="lg"
                className="mt-6 w-full"
                disabled={
                  submitting ||
                  servicesLoading ||
                  !branchId ||
                  !serviceId
                }
              >
                {submitting ? "Creating ticket…" : "Get my ticket"}
                <ArrowRight className="size-4" />
              </Button>

              {!getToken() && (
                <Link
                  to="/login"
                  className="mt-4 block text-center text-sm font-semibold text-primary"
                >
                  Sign in to take a ticket
                </Link>
              )}
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}