import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell, StatusChip } from "../components/AppShell.jsx";
import { Button } from "../components/Button.jsx";
import {
  branchesApi,
  servicesApi,
  ticketsApi,
  getToken,
} from "../lib/api.js";

export default function Home() {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState("");
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadBranches() {
      try {
        const data = await branchesApi.list();
        if (cancelled) return;

        setBranches(data);
        setBranchId(String(data[0]?.id || ""));

        if (!data.length) {
          setError("No branches available. Add a branch in Admin.");
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
    setTicket(null);
    setError("");
    setServicesLoading(true);

    async function loadServices() {
      try {
        const data = await servicesApi.list(branchId);
        if (cancelled) return;

        const matching = data.filter(
          (service) => String(service.branch_id) === branchId
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

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (!getToken()) {
      setError("Please sign in before taking a ticket.");
      return;
    }

    if (!branchId || !serviceId) {
      setError("Select a branch and service.");
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
    (item) => String(item.id) === branchId
  );

  const service = services.find(
    (item) => String(item.id) === String(ticket?.service_id)
  );

  const fieldClass =
    "mt-2 w-full rounded-md border border-input bg-background px-4 py-3";

  return (
    <AppShell title="Get a ticket">
      <div className="mx-auto max-w-xl border border-border bg-card p-6 sm:p-8">
        <p className="font-display text-2xl font-semibold">
          AUREUM BANK
        </p>
        <p className="mt-2 text-muted-foreground">
          Take your queue ticket
        </p>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-md bg-red-500/10 p-3 text-red-500"
          >
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-6">Loading branches…</p>
        ) : ticket ? (
          <div className="mt-7">
            <p className="text-sm text-muted-foreground">
              Your queue ticket
            </p>
            <p className="my-4 font-token text-6xl font-bold text-primary">
              {ticket.token_number}
            </p>
            <p>{branch?.name}</p>
            <p className="mb-4 text-muted-foreground">
              {service?.name}
            </p>

            <StatusChip status={ticket.status} />

            <p className="mt-5 text-sm text-muted-foreground">
              Your ticket has been saved. Check the Live Board
              for your counter call.
            </p>

            <Link
              to={`/board?branch_id=${ticket.branch_id}`}
              className="mt-6 block font-semibold text-primary"
            >
              View Live Board →
            </Link>

            <Button
              variant="outline"
              className="mt-5"
              onClick={() => setTicket(null)}
            >
              New ticket
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7">
            <label className="block text-sm font-medium">
              Branch
              <select
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
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
                onChange={(event) => setServiceId(event.target.value)}
                className={fieldClass}
                disabled={servicesLoading || submitting}
                required
              >
                <option value="">
                  {servicesLoading ? "Loading services…" : "Select service"}
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
                submitting || servicesLoading || !serviceId
              }
            >
              {submitting ? "Creating ticket…" : "Get my ticket"}
            </Button>

            {!getToken() && (
              <Link
                to="/login"
                className="mt-4 block text-center text-primary"
              >
                Sign in to take a ticket
              </Link>
            )}
          </form>
        )}
      </div>
    </AppShell>
  );
}