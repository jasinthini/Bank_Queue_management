import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { makeSeed, QueueError } from "./queue-engine.js";

const KEY = "aureum-bank-queue-v1";
const SESSION = "aureum-bank-session-v1";
const BANKS_KEY = "aureum-bank-branches-v1";

const initialBranches = [{ id: "jaffna-main", bank: "Aureum Bank", name: "Jaffna Main Branch" }];

const QueueCtx = createContext(null);

// Read the saved state for a branch (or create demo data the first time).
function load(id) {
  try {
    const raw = localStorage.getItem(`${KEY}-${id}`);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  const s = makeSeed();
  localStorage.setItem(`${KEY}-${id}`, JSON.stringify(s));
  return s;
}

export function QueueProvider({ children }) {
  const [state, setState] = useState(null);
  const [session, setSessionState] = useState(null);
  const [now, setNow] = useState(0);
  const [branches, setBranches] = useState(initialBranches);
  const [activeBranchId, setActiveBranchId] = useState("jaffna-main");

  useEffect(() => {
    const savedBranches = localStorage.getItem(BANKS_KEY);
    if (savedBranches) {
      try { setBranches(JSON.parse(savedBranches)); } catch { /* ignore */ }
    }
    const branchId = localStorage.getItem(`${KEY}-active`) || "jaffna-main";
    setActiveBranchId(branchId);
    setState(load(branchId));
    try {
      const s = sessionStorage.getItem(SESSION);
      if (s) setSessionState(JSON.parse(s));
    } catch { /* ignore */ }
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 5000);
    // Other browser tabs (e.g. a second counter) update this one live.
    const onStorage = (e) => {
      if (e.key === `${KEY}-${branchId}` && e.newValue) setState(JSON.parse(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(t);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const commit = useCallback(
    (s) => {
      localStorage.setItem(`${KEY}-${activeBranchId}`, JSON.stringify(s));
      setState(s);
    },
    [activeBranchId]
  );

  // run(fn, successMessage): reads the latest saved state, validates via fn, saves, shows toast.
  const run = useCallback(
    (fn, ok) => {
      const latest = load(activeBranchId);
      try {
        const out = fn(latest);
        const isState = "services" in out;
        const next = isState ? out : out.state;
        commit(next);
        if (ok) toast.success(ok);
        return isState ? undefined : out.value;
      } catch (e) {
        toast.error(e instanceof QueueError ? e.message : "Something went wrong");
        setState(latest);
        return undefined;
      }
    },
    [commit, activeBranchId]
  );

  const setSession = (s) => {
    setSessionState(s);
    if (s) sessionStorage.setItem(SESSION, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION);
  };

  const saveBranches = (list) => {
    localStorage.setItem(BANKS_KEY, JSON.stringify(list));
    setBranches(list);
    const active = list.find((b) => b.id === activeBranchId);
    if (active && state) commit({ ...state, org: { ...state.org, name: active.bank, branch: active.name } });
  };

  const switchBranch = (id) => {
    if (!branches.some((b) => b.id === id)) return;
    localStorage.setItem(`${KEY}-active`, id);
    setActiveBranchId(id);
    const branch = branches.find((b) => b.id === id);
    const next = load(id);
    if (branch) {
      next.org = { ...next.org, name: branch.bank, branch: branch.name };
      localStorage.setItem(`${KEY}-${id}`, JSON.stringify(next));
    }
    setState(next);
    if (session?.role === "staff") setSession(null);
  };

  return (
    <QueueCtx.Provider value={{ state, run, replace: commit, session, setSession, now, branches, activeBranchId, saveBranches, switchBranch }}>
      {children}
    </QueueCtx.Provider>
  );
}

export function useQueue() {
  const c = useContext(QueueCtx);
  if (!c) throw new Error("useQueue outside provider");
  return c;
}
