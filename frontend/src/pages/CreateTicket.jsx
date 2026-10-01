import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Landmark,
  ArrowRight,
  Printer,
  XCircle,
} from "lucide-react";
import { AppShell, StatusChip } from "../components/AppShell.jsx";
import { Button } from "../components/Button.jsx";
import {
  branchesApi,
  servicesApi,
  ticketsApi,
  getToken,
} from "../lib/api.js";

const terminalStatuses = ["COMPLETED", "CANCELLED"];

const statusMessage = {
  WAITING: "Your ticket is saved. Please wait for your call.",
  CALLED: "Your token has been called. Proceed to your counter.",
  SERVING: "Your service is in progress.",
  MISSED: "Your call was missed. Please speak to a staff member.",
  COMPLETED: "Your service is complete. Thank you for visiting.",
  CANCELLED: "Your ticket has been cancelled.",
};

export default function CreateTicket() {
  const [searchParams, setSearchParams] = useSearchParams();
  const ticketId = searchParams.get("ticket_id");

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [services, setServices] = useState([]);
  const [servicesBranchId, setServicesBranchId] = useState("");
  const [serviceId, setServiceId] = useState("");

  const [ticket, setTicket] = useState(null);
  const [ticketService, setTicketService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [error, setError] = useState("");
  const [ticketError, setTicketError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBranches() {
      try {
        const data = await branchesApi.list();

        if (cancelled) return;
        if (!Array.isArray(data)) {
          throw new Error("Invalid branches response.");
        }

        setBranches(data);
        setBranchId(String(data[0]?.id ?? ""));

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
    let cancelled = false;

    setServices([]);
    setServicesBranchId("");
    setServiceId("");

    if (!branchId) {
      setServicesLoading(false);
      return;
    }

    setServicesLoading(true);

    async function loadServices() {
      try {
        const data = await servicesApi.list(branchId);

        if (cancelled) return;
        if (!Array.isArray(data)) {
          throw new Error("Invalid services response.");
        }

        const matching = data.filter(
          (item) => String(item.branch_id) === String(branchId)
        );

        setServices(matching);
        setServicesBranchId(String(branchId));

        // Customer explicitly chooses a service.
        setServiceId("");

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

  // Restore the ticket from the URL after browser refresh.
  useEffect(() => {
    let cancelled = false;

    setTicket(null);
    setTicketService(null);
    setTicketError("");

    if (!ticketId) {
      setTicketLoading(false);
      return;
    }

    setTicketLoading(true);

    async function loadTicket() {
      try {
        if (!getToken()) {
          throw new Error("Please sign in to view your ticket.");
        }

        const data = await ticketsApi.get(ticketId);

        if (!cancelled) setTicket(data);
      } catch (err) {
        if (!cancelled) setTicketError(err.message);
      } finally {
        if (!cancelled) setTicketLoading(false);
      }
    }

    loadTicket();

    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  const displayedServiceId = ticket?.service_id;

  useEffect(() => {
    let cancelled = false;

    setTicketService(null);

    if (!displayedServiceId) return;

    async function loadTicketService() {
      try {
        const data = await servicesApi.get(displayedServiceId);

        if (!cancelled) setTicketService(data);
      } catch {
        // The ticket remains visible if its service lookup fails.
      }
    }

    loadTicketService();

    return () => {
      cancelled = true;
    };
  }, [displayedServiceId]);

  const activeTicketId = ticket?.id;
  const ticketFinished = terminalStatuses.includes(ticket?.status);

  useEffect(() => {
    if (!activeTicketId || ticketFinished || cancelling) return;

    let cancelled = false;
    let timer;

    async function refresh() {
      let keepPolling = true;

      try {
        const updated = await ticketsApi.get(activeTicketId);

        if (cancelled) return;

        setTicket(updated);
        setTicketError("");

        keepPolling = !terminalStatuses.includes(updated.status);
      } catch (err) {
        if (cancelled) return;

        setTicketError(err.message);

        if ([401, 403, 404].includes(err.status)) {
          keepPolling = false;
        }
      }

      if (!cancelled && keepPolling) {
        timer = window.setTimeout(refresh, 5000);
      }
    }

    timer = window.setTimeout(refresh, 5000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeTicketId, ticketFinished, cancelling]);

  function handleBranchChange(event) {
    // Immediately clear the old branch's service selection.
    setBranchId(event.target.value);
    setServiceId("");
    setServices([]);
    setServicesBranchId("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) return;

    setError("");

    if (!getToken()) {
      setError("Please sign in before taking a ticket.");
      return;
    }

    const selectedService = services.find(
      (item) => String(item.id) === String(serviceId)
    );

    if (!branchId || !selectedService) {
      setError("Please select a branch and an available service.");
      return;
    }

    if (
      servicesLoading ||
      servicesBranchId !== String(branchId) ||
      String(selectedService.branch_id) !== String(branchId)
    ) {
      setError("Please select a service belonging to this branch.");
      return;
    }

    setSubmitting(true);

    try {
      const created = await ticketsApi.create(
        Number(branchId),
        Number(selectedService.id)
      );

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("ticket_id", String(created.id));
      setSearchParams(nextParams, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!ticket || ticket.status !== "WAITING" || cancelling) {
      return;
    }

    if (!window.confirm("Cancel this waiting ticket?")) return;

    setCancelling(true);
    setTicketError("");

    try {
      const updated = await ticketsApi.cancel(ticket.id);
      setTicket(updated);
    } catch (err) {
      setTicketError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  function showNewTicketForm() {
    setTicket(null);
    setTicketService(null);
    setError("");
    setTicketError("");

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("ticket_id");
    setSearchParams(nextParams, { replace: true });
  }

  const displayedBranch = branches.find(
    (item) =>
      String(item.id) === String(ticket?.branch_id ?? branchId)
  );

  const selectedService = services.find(
    (item) => String(item.id) === String(serviceId)
  );

  const canCreate =
    !!branchId &&
    !!selectedService &&
    servicesBranchId === String(branchId) &&
    String(selectedService.branch_id) === String(branchId) &&
    !servicesLoading &&
    !submitting;

  const fieldClass =
    "mt-2 w-full rounded-md border border-input bg-background px-4 py-3 text-foreground outline-none focus:border-primary";

  const visibleError = ticketId ? ticketError : error;

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

          {visibleError && (
            <p
              role="alert"
              className="mb-5 rounded-md bg-red-500/10 p-3 text-sm text-red-500"
            >
              {visibleError}
            </p>
          )}

          {loading || ticketLoading ? (
            <p className="py-8 text-center text-muted-foreground">
              Loading…
            </p>
          ) : ticket ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Your queue ticket
              </p>

              <p className="mt-4 break-words font-token text-6xl font-bold text-primary">
                {ticket.token_number}
              </p>

              {ticket.customer_name && (
                <p className="mt-4 text-lg font-semibold">
                  {ticket.customer_name}
                </p>
              )}

              <p className="mt-4 font-semibold">
                {ticketService?.name ||
                  `Service #${ticket.service_id}`}
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                {displayedBranch?.name ||
                  `Branch #${ticket.branch_id}`}
              </p>

              <div className="mt-5">
                <StatusChip status={ticket.status} />
              </div>

              {ticket.counter_id != null &&
                ["CALLED", "SERVING"].includes(ticket.status) && (
                  <p className="mt-4 font-semibold text-primary">
                    Assigned counter ID: {ticket.counter_id}
                  </p>
                )}

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

              {ticket.status === "WAITING" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={cancelling}
                  onClick={handleCancel}
                  className="mt-3 w-full text-red-500"
                >
                  <XCircle className="size-4" />
                  {cancelling ? "Cancelling…" : "Cancel ticket"}
                </Button>
              )}

              <div className="mt-3 grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.print()}
                >
                  <Printer className="size-4" />
                  Print
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={cancelling}
                  onClick={showNewTicketForm}
                >
                  New ticket
                </Button>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                New ticket returns to the form. It does not cancel
                your existing ticket.
              </p>

              <p className="mt-3 text-xs text-muted-foreground">
                {ticketFinished
                  ? "This ticket is closed."
                  : "Status refreshes every 5 seconds."}
              </p>
            </div>
          ) : ticketId ? (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Could not load this ticket.
              </p>

              {!getToken() && (
                <Link
                  to="/login"
                  className="mt-4 inline-block font-semibold text-primary"
                >
                  Sign in
                </Link>
              )}

              <Button
                type="button"
                variant="outline"
                className="mt-5 w-full"
                onClick={showNewTicketForm}
              >
                Back to ticket form
              </Button>
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
                  onChange={handleBranchChange}
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
                  onChange={(event) => {
                    setServiceId(event.target.value);
                    setError("");
                  }}
                  className={fieldClass}
                  disabled={
                    !branchId ||
                    servicesLoading ||
                    submitting ||
                    servicesBranchId !== String(branchId)
                  }
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
                disabled={!canCreate}
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