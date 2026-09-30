import { useEffect, useState } from "react";
import {
  NavLink,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Landmark, LogOut } from "lucide-react";
import {
  getCurrentUser,
  getToken,
  logout,
} from "../lib/api.js";
import { Button } from "./Button.jsx";

export function AppShell({ children, title }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    document.title = title
      ? `${title} — Aureum Bank`
      : "Aureum Bank — Banking Queue";
  }, [title]);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      setChecking(true);
      setUser(null);

      if (!getToken()) {
        setChecking(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser();

        if (!cancelled) {
          setUser(currentUser);
        }
      } catch (err) {
        if (!cancelled && err.status === 401) {
          logout();
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    checkSession();

    const onStorage = (event) => {
      if (
        event.key === "queueflow_access_token" ||
        event.key === null
      ) {
        checkSession();
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, [location.pathname]);

  const role = String(user?.role || "").toUpperCase();

  const nav = [
    { to: "/", label: "Get a ticket" },
    { to: "/board", label: "Live Board" },
  ];

  if (role === "STAFF" || role === "ADMIN") {
    nav.push({ to: "/counter", label: "Teller" });
  }

  if (role === "ADMIN") {
    nav.push(
      { to: "/admin", label: "Branches" },
      { to: "/reports", label: "Reports" }
    );
  }

  if (!user && !checking) {
    nav.push({ to: "/login", label: "Sign in" });
  }

  const desktopClass = ({ isActive }) =>
    `rounded-md px-3 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:text-foreground"
    }`;

  const mobileClass = ({ isActive }) =>
    `whitespace-nowrap rounded-md px-3 py-1 text-xs ${
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground"
    }`;

  function handleLogout() {
    logout();
    setUser(null);
    navigate("/login", { replace: true });
  }

  const roleLabel = {
    ADMIN: "Admin",
    STAFF: "Staff",
    CUSTOMER: "Customer",
  };

  return (
    <div className="min-h-screen grain">
      <header className="sticky top-0 z-30 border-b border-border bg-ink/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md border border-primary/50 bg-primary/10 text-primary">
              <Landmark className="size-6" />
            </div>

            <div className="leading-tight">
              <p className="font-display text-lg font-semibold">
                AUREUM{" "}
                <span className="text-primary">BANK</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Secure Queue Management
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={desktopClass}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 text-sm">
            {user ? (
              <>
                <span className="hidden rounded-md bg-primary-soft px-3 py-1 text-xs font-semibold text-primary sm:inline">
                  {roleLabel[role] || role}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  title="Sign out"
                  onClick={handleLogout}
                >
                  <LogOut className="size-4" />
                </Button>
              </>
            ) : getToken() ? (
              <>
                <span className="text-xs text-muted-foreground">
                  {checking
                    ? "Checking session…"
                    : "Session unavailable"}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  title="Sign out"
                  onClick={handleLogout}
                >
                  <LogOut className="size-4" />
                </Button>
              </>
            ) : (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-serving animate-soft-pulse" />
                Live
              </span>
            )}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={mobileClass}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        {children}
      </main>
    </div>
  );
}

export function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-muted-foreground">
      Loading queue…
    </div>
  );
}

const statusStyle = {
  WAITING: "bg-wait/15 text-wait",
  CALLED: "bg-called/15 text-called",
  SERVING: "bg-serving/15 text-serving",
  MISSED: "bg-missed/15 text-missed",
  COMPLETED: "bg-done/15 text-done",
  CANCELLED: "bg-done/15 text-done line-through",
  DONE: "bg-done/15 text-done",
  NO_SHOW: "bg-done/15 text-done line-through",
};

export function StatusChip({ status }) {
  const value = String(status || "UNKNOWN").toUpperCase();

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
        statusStyle[value] || "bg-muted text-muted-foreground"
      }`}
    >
      <span
        className={`size-1.5 rounded-full bg-current ${
          value === "SERVING" || value === "CALLED"
            ? "animate-soft-pulse"
            : ""
        }`}
      />
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function PriorityChip() {
  return (
    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">
      Priority
    </span>
  );
}