import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  branchesApi,
  servicesApi,
  countersApi,
  usersApi,
  getCurrentUser,
  logout,
} from "../lib/api.js";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

const buttonClass =
  "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50";

function Editor({
  title,
  fields,
  rows,
  api,
  onRefresh,
  canEdit = true,
  canDelete = true,
}) {
  const [values, setValues] = useState({});
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function startEdit(row) {
    setEditId(row.id);
    setValues({ ...row });
    setError("");
    setSuccess("");
  }

  function cancelEdit() {
    setEditId(null);
    setValues({});
  }

  async function save(e) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const data = {};

      fields.forEach((field) => {
        if (editId !== null && field.createOnly) return;

        const value = values[field.key] ?? field.default ?? "";

        data[field.key] =
          field.type === "number"
            ? Number(value)
            : field.type === "checkbox"
              ? Boolean(value)
              : String(value).trim();
      });

      if (editId !== null) {
        await api.update(editId, data);
      } else {
        await api.create(data);
      }

      cancelEdit();
      setSuccess("Saved to database.");
      await onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm(`Delete ${title} ID ${id}?`)) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      await api.remove(id);
      if (editId === id) cancelEdit();
      setSuccess("Deleted from database.");
      await onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface p-6">
      <h2 className="text-xl font-semibold">{title}</h2>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="mt-3 text-sm text-green-700">
          {success}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No records yet.
          </p>
        )}

        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-lg border border-border p-4"
          >
            <p className="font-semibold">
              {row.name || row.full_name}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              ID: {row.id}
              {row.code && ` · Code: ${row.code}`}
              {row.email && ` · ${row.email}`}
              {row.role && ` · ${row.role}`}
              {row.branch_id && ` · Branch ID: ${row.branch_id}`}
              {row.service_id && ` · Service ID: ${row.service_id}`}
              {row.token_prefix && ` · Prefix: ${row.token_prefix}`}
            </p>

            {row.address && (
              <p className="mt-1 text-sm">{row.address}</p>
            )}

            {typeof row.is_active === "boolean" && (
              <p className="mt-1 text-sm">
                {row.is_active ? "Open" : "Closed"}
              </p>
            )}

            <div className="mt-3 flex gap-3">
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startEdit(row)}
                  className="text-sm font-semibold text-primary"
                >
                  Edit
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(row.id)}
                  className="text-sm font-semibold text-red-700"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={save}
        className="mt-5 grid gap-3 sm:grid-cols-2"
      >
        {fields
          .filter((field) => !(editId !== null && field.createOnly))
          .map((field) => (
            <label key={field.key} className="text-sm">
              <span className="mb-1 block font-medium">
                {field.label}
              </span>

              {field.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={
                    values[field.key] ?? field.default ?? false
                  }
                  onChange={(e) =>
                    setValues({
                      ...values,
                      [field.key]: e.target.checked,
                    })
                  }
                />
              ) : (
                <input
                  className={inputClass}
                  type={field.type || "text"}
                  min={field.type === "number" ? 1 : undefined}
                  step={field.type === "number" ? 1 : undefined}
                  minLength={field.minLength}
                  maxLength={field.maxLength}
                  required
                  value={values[field.key] ?? field.default ?? ""}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      [field.key]: e.target.value,
                    })
                  }
                />
              )}
            </label>
          ))}

        <div className="flex items-end gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className={buttonClass}
          >
            {busy ? "Saving..." : editId !== null ? "Update" : "Add"}
          </button>

          {editId !== null && (
            <button
              type="button"
              disabled={busy}
              onClick={cancelEdit}
              className="text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

export default function Admin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);
  const [counters, setCounters] = useState([]);
  const [users, setUsers] = useState([]);
  const [roleBusy, setRoleBusy] = useState(false);

  async function refresh() {
    const result = await Promise.all([
      branchesApi.list(),
      servicesApi.list(),
      countersApi.list(),
      usersApi.list(),
    ]);

    setBranches(result[0]);
    setServices(result[1]);
    setCounters(result[2]);
    setUsers(result[3]);
  }

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser();

        if (String(currentUser.role).toUpperCase() !== "ADMIN") {
          throw new Error("Admin access required.");
        }

        setUser(currentUser);
        await refresh();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function changeRole(id, role) {
    setRoleBusy(true);
    setError("");

    try {
      await usersApi.updateRole(id, role);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setRoleBusy(false);
    }
  }

  async function reload() {
    setError("");

    try {
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        Loading admin data...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-8">
        <p role="alert">{error || "Admin login required."}</p>
        <Link to="/login" className="mt-4 inline-block text-primary">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Aureum Bank
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold">
              Branch Management
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Welcome, {user.full_name}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/" className="text-sm text-primary">
              Home
            </Link>
            <button
              type="button"
              onClick={reload}
              className={buttonClass}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                window.location.assign("/login");
              }}
              className="text-sm font-semibold"
            >
              Logout
            </button>
          </div>
        </header>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-red-700"
          >
            {error}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Editor
            title="Branches"
            rows={branches}
            api={branchesApi}
            onRefresh={refresh}
            fields={[
              { key: "name", label: "Branch name", maxLength: 100 },
              { key: "code", label: "Branch code", maxLength: 20 },
              { key: "address", label: "Address", maxLength: 255 },
            ]}
          />

          <Editor
            title="Services"
            rows={services}
            api={servicesApi}
            onRefresh={refresh}
            fields={[
              {
                key: "branch_id",
                label: "Branch ID",
                type: "number",
                createOnly: true,
              },
              { key: "name", label: "Service name", maxLength: 100 },
              { key: "code", label: "Service code", maxLength: 20 },
              {
                key: "token_prefix",
                label: "Token prefix",
                default: "A",
                maxLength: 5,
              },
            ]}
          />

          <Editor
            title="Counters"
            rows={counters}
            api={countersApi}
            onRefresh={refresh}
            fields={[
              {
                key: "branch_id",
                label: "Branch ID",
                type: "number",
                createOnly: true,
              },
              {
                key: "service_id",
                label: "Service ID",
                type: "number",
                createOnly: true,
              },
              { key: "name", label: "Counter name", maxLength: 100 },
              {
                key: "is_active",
                label: "Counter open",
                type: "checkbox",
                default: true,
              },
            ]}
          />

          <Editor
            title="Create Staff"
            rows={users.filter((item) => item.role === "STAFF")}
            api={{ create: usersApi.createStaff }}
            onRefresh={refresh}
            canEdit={false}
            canDelete={false}
            fields={[
              { key: "full_name", label: "Full name", maxLength: 100 },
              { key: "email", label: "Email", type: "email" },
              {
                key: "password",
                label: "Password (minimum 8 characters)",
                type: "password",
                minLength: 8,
              },
            ]}
          />
        </div>

        <section className="surface p-6">
          <h2 className="text-xl font-semibold">User Roles</h2>

          <div className="mt-4 space-y-3">
            {users.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div>
                  <p className="font-semibold">{item.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.email}
                  </p>
                </div>

                {item.role === "ADMIN" ? (
                  <span className="text-sm font-semibold">ADMIN</span>
                ) : (
                  <select
                    aria-label={`Role for ${item.full_name}`}
                    disabled={roleBusy}
                    value={item.role}
                    onChange={(e) =>
                      changeRole(item.id, e.target.value)
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <option value="CUSTOMER">CUSTOMER</option>
                    <option value="STAFF">STAFF</option>
                  </select>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}