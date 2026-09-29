// Queue engine: pure, validated state transitions. Acts as the "server" authority for the demo.
// Status values: WAITING | CALLED | SERVING | MISSED | DONE | NO_SHOW

export class QueueError extends Error {}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const MIN = 60_000;

export function makeSeed(now = Date.now()) {
  const sA = { id: uid(), code: "C", name: "Cash Deposit & Withdrawal", avgServiceMin: 5, nextSeq: 101 };
  const sB = { id: uid(), code: "A", name: "Accounts & Cards", avgServiceMin: 8, nextSeq: 201 };
  const sC = { id: uid(), code: "L", name: "Personal & Business Loans", avgServiceMin: 14, nextSeq: 301 };
  const sD = { id: uid(), code: "P", name: "Priority & Senior Citizen Desk", avgServiceMin: 6, nextSeq: 401 };
  const counters = [
    { id: uid(), name: "Teller 1", serviceIds: [sA.id], staffName: "Nila R.", pin: "1111", active: true },
    { id: uid(), name: "Teller 2", serviceIds: [sA.id], staffName: "Kavin S.", pin: "2222", active: true },
    { id: uid(), name: "Customer Desk", serviceIds: [sB.id, sD.id], staffName: "Meera T.", pin: "3333", active: true },
    { id: uid(), name: "Loan Desk", serviceIds: [sC.id, sD.id], staffName: "Arjun P.", pin: "4444", active: true },
  ];
  let state = {
    version: 1,
    org: { name: "Aureum Bank", branch: "Jaffna Main Branch", adminPin: "0000" },
    policy: { recallGap: 2, maxMisses: 2 },
    services: [sA, sB, sC, sD],
    counters,
    entries: [],
    callCount: {},
    log: [],
  };

  // history for reports (earlier today)
  const names = ["Tharun", "Priya", "Sanjay", "Divya", "Karthik", "Anu", "Vimal", "Keerthi", "Rahul", "Lavanya", "Suresh", "Mala"];
  const start = now - 5 * 60 * MIN;
  for (let i = 0; i < 26; i++) {
    const svc = [sA, sA, sB, sC, sD][i % 5];
    const forSvc = counters.filter((c) => c.serviceIds.includes(svc.id));
    const ctr = forSvc[i % 2 === 0 ? 0 : forSvc.length - 1];
    const created = start + i * 11 * MIN;
    const wait = (4 + ((i * 7) % 13)) * MIN;
    const serve = (2 + ((i * 3) % 6)) * MIN;
    const missed = i % 9 === 4;
    state.entries.push({
      id: uid(), serviceId: svc.id, seq: 0, token: "", customer: names[i % names.length], priority: i % 7 === 0,
      status: missed ? "NO_SHOW" : "DONE", counterId: ctr.id, createdAt: created, calledAt: created + wait,
      servingAt: missed ? undefined : created + wait + MIN / 2,
      doneAt: missed ? undefined : created + wait + serve,
      missCount: missed ? 2 : 0,
    });
  }

  // number the history per service
  const seqs = { [sA.id]: 101, [sB.id]: 201, [sC.id]: 301, [sD.id]: 401 };
  for (const e of state.entries) {
    const s = state.services.find((x) => x.id === e.serviceId);
    e.seq = seqs[s.id]++;
    e.token = `${s.code}-${e.seq}`;
  }
  sA.nextSeq = seqs[sA.id]; sB.nextSeq = seqs[sB.id]; sC.nextSeq = seqs[sC.id]; sD.nextSeq = seqs[sD.id];

  // live queue
  const live = ["Yogan", "Jasi", "Ramesh", "Nisha", "Hari"];
  for (let i = 0; i < 5; i++)
    state = checkIn(state, { serviceId: sA.id, customer: live[i], priority: false }, now - (20 - i * 3) * MIN).state;
  state = checkIn(state, { serviceId: sB.id, customer: "Kumar", priority: false }, now - 9 * MIN).state;
  state = checkIn(state, { serviceId: sC.id, customer: "Selvi", priority: true }, now - 4 * MIN).state;
  state.log = [{ at: now, text: "Branch opened · seeded demo data" }];
  return state;
}

/** Fixed viva scenario: queue A-212..A-216 waiting for "Accounts & Cards". */
export function makeVivaSeed(now = Date.now()) {
  let s = makeSeed(now);
  const a = s.services[1];
  s.entries = s.entries.filter((e) => e.serviceId !== a.id || e.status === "DONE" || e.status === "NO_SHOW");
  a.nextSeq = 212;
  for (let i = 0; i < 5; i++)
    s = checkIn(s, { serviceId: a.id, customer: `Customer ${212 + i}`, priority: false }, now - (10 - i) * MIN).state;
  s.log = [{ at: now, text: "Viva scenario loaded · A-212–A-216 waiting" }];
  return s;
}

const push = (s, text, at = Date.now()) => ({
  ...s,
  version: s.version + 1,
  log: [{ at, text }, ...s.log].slice(0, 60),
});

export function checkIn(s, input, at = Date.now()) {
  const svc = s.services.find((x) => x.id === input.serviceId);
  if (!svc) throw new QueueError("Unknown service");
  const name = input.customer.trim().slice(0, 60);
  if (!name) throw new QueueError("Please enter your name");
  const seq = svc.nextSeq;
  const entry = {
    id: uid(), serviceId: svc.id, seq, token: `${svc.code}-${seq}`, customer: name, priority: input.priority,
    status: "WAITING", counterId: null, createdAt: at, missCount: 0,
  };
  const services = s.services.map((x) => (x.id === svc.id ? { ...x, nextSeq: seq + 1 } : x));
  return {
    state: push({ ...s, services, entries: [...s.entries, entry] }, `${entry.token} checked in${entry.priority ? " (priority)" : ""}`, at),
    entry,
  };
}

/**
 * Fairness rule (applied per counter across the services it serves):
 *  1. PRIORITY tokens that are WAITING, oldest check-in first.
 *  2. MISSED tokens that became recall-eligible (>= recallGap calls since the miss), oldest first.
 *  3. NORMAL WAITING tokens in token order (FIFO).
 * Only WAITING / eligible MISSED entries with no counter are candidates, so an entry that is
 * CALLED/SERVING at another counter can never be assigned twice.
 */
export function orderedCandidates(s, serviceIds) {
  const inSvc = s.entries.filter((e) => serviceIds.includes(e.serviceId) && e.counterId === null);
  const pri = inSvc.filter((e) => e.status === "WAITING" && e.priority).sort((a, b) => a.createdAt - b.createdAt);
  const recallList = inSvc
    .filter((e) => e.status === "MISSED" && (s.callCount[e.serviceId] ?? 0) >= (e.recallAfterCall ?? Infinity))
    .sort((a, b) => a.createdAt - b.createdAt);
  const normal = inSvc
    .filter((e) => e.status === "WAITING" && !e.priority)
    .sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq);
  return [...pri, ...recallList, ...normal];
}

export function activeFor(s, counterId) {
  return s.entries.find((e) => e.counterId === counterId && (e.status === "CALLED" || e.status === "SERVING"));
}

function requireCounter(s, counterId, pin) {
  const c = s.counters.find((x) => x.id === counterId);
  if (!c) throw new QueueError("Counter not found");
  if (c.pin !== pin) throw new QueueError("Not authorised for this counter");
  if (!c.active) throw new QueueError("Counter is closed");
  return c;
}

export function callNext(s, counterId, pin, at = Date.now()) {
  const c = requireCounter(s, counterId, pin);
  if (activeFor(s, counterId)) throw new QueueError("Finish or mark the current token before calling next");
  const next = orderedCandidates(s, c.serviceIds)[0];
  if (!next) throw new QueueError("No one is waiting for this counter");
  if (next.counterId !== null) throw new QueueError("Token already assigned");
  const wasMissed = next.status === "MISSED";
  const entries = s.entries.map((e) =>
    e.id === next.id ? { ...e, status: "CALLED", counterId, calledAt: at, recalled: wasMissed || e.recalled } : e
  );
  const callCount = { ...s.callCount, [next.serviceId]: (s.callCount[next.serviceId] ?? 0) + 1 };
  return {
    state: push({ ...s, entries, callCount }, `${c.name} called ${next.token}${wasMissed ? " (recall)" : ""}`, at),
    entry: next,
  };
}

function mutateActive(s, counterId, pin, fn) {
  const c = requireCounter(s, counterId, pin);
  const cur = activeFor(s, counterId);
  if (!cur) throw new QueueError("No active token at this counter");
  const { entry, text } = fn(cur, c);
  return push({ ...s, entries: s.entries.map((e) => (e.id === cur.id ? entry : e)) }, text);
}

export const startServing = (s, counterId, pin) =>
  mutateActive(s, counterId, pin, (e, c) => {
    if (e.status !== "CALLED") throw new QueueError("Token is already being served");
    return { entry: { ...e, status: "SERVING", servingAt: Date.now() }, text: `${c.name} serving ${e.token}` };
  });

export const complete = (s, counterId, pin) =>
  mutateActive(s, counterId, pin, (e, c) => {
    if (e.status !== "SERVING") throw new QueueError("Start serving before completing");
    return { entry: { ...e, status: "DONE", doneAt: Date.now() }, text: `${c.name} completed ${e.token}` };
  });

export const markMissed = (s, counterId, pin) =>
  mutateActive(s, counterId, pin, (e, c) => {
    if (e.status !== "CALLED") throw new QueueError("Only a CALLED token can be marked missed");
    const missCount = e.missCount + 1;
    if (missCount >= s.policy.maxMisses)
      return { entry: { ...e, status: "NO_SHOW", counterId: null, missCount }, text: `${e.token} missed twice → no-show` };
    return {
      entry: { ...e, status: "MISSED", counterId: null, missCount, recallAfterCall: (s.callCount[e.serviceId] ?? 0) + s.policy.recallGap },
      text: `${c.name} marked ${e.token} missed · recall after ${s.policy.recallGap} calls`,
    };
  });

/** Staff may manually recall a specific missed token to their own counter. */
export function recall(s, counterId, pin, entryId) {
  const c = requireCounter(s, counterId, pin);
  if (activeFor(s, counterId)) throw new QueueError("Finish the current token first");
  const e = s.entries.find((x) => x.id === entryId);
  if (!e || e.status !== "MISSED" || e.counterId !== null) throw new QueueError("Token is not available for recall");
  if (!c.serviceIds.includes(e.serviceId)) throw new QueueError("This counter does not serve that service");
  return push(
    { ...s, entries: s.entries.map((x) => (x.id === e.id ? { ...x, status: "CALLED", counterId, calledAt: Date.now(), recalled: true } : x)) },
    `${c.name} recalled ${e.token}`
  );
}

export function estimateWaitMin(s, entry) {
  const svc = s.services.find((x) => x.id === entry.serviceId);
  if (!svc || entry.status !== "WAITING") return 0;
  const servers = Math.max(1, s.counters.filter((c) => c.active && c.serviceIds.includes(svc.id)).length);
  const order = orderedCandidates(s, [svc.id]);
  const pos = order.findIndex((e) => e.id === entry.id);
  return Math.round(((pos + 1) / servers) * svc.avgServiceMin);
}

export function positionOf(s, entry) {
  return orderedCandidates(s, [entry.serviceId]).findIndex((e) => e.id === entry.id) + 1;
}

// ---- Bulk import -------------------------------------------------------
// CSV lines:  service,<CODE>,<Name>,<avgMin>
//             counter,<Name>,<CODE|CODE>,<Staff>,<PIN>
export function bulkImport(s, csv) {
  const errors = [];
  let services = [...s.services];
  let counters = [...s.counters];
  let added = 0;
  csv.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const p = line.split(",").map((x) => x.trim());
    const n = i + 1;
    if (p[0]?.toLowerCase() === "service") {
      const [, code, name, avg] = p;
      if (!/^[A-Z]$/.test(code ?? "")) return errors.push(`Line ${n}: code must be one capital letter`);
      if (!name) return errors.push(`Line ${n}: service name missing`);
      const m = Number(avg);
      if (!(m > 0 && m < 120)) return errors.push(`Line ${n}: avg minutes must be 1–119`);
      const ex = services.find((x) => x.code === code);
      if (ex) services = services.map((x) => (x.code === code ? { ...x, name, avgServiceMin: m } : x));
      else services.push({ id: uid(), code, name, avgServiceMin: m, nextSeq: 1 });
      added++;
    } else if (p[0]?.toLowerCase() === "counter") {
      const [, name, codes, staff, pin] = p;
      if (!name) return errors.push(`Line ${n}: counter name missing`);
      const ids = (codes ?? "").split("|").map((c) => services.find((x) => x.code === c.trim())?.id);
      if (!ids.length || ids.some((x) => !x)) return errors.push(`Line ${n}: unknown service code in "${codes}"`);
      if (!/^\d{4}$/.test(pin ?? "")) return errors.push(`Line ${n}: PIN must be 4 digits`);
      const ex = counters.find((c) => c.name.toLowerCase() === name.toLowerCase());
      const data = { name, serviceIds: ids, staffName: staff || "Staff", pin, active: true };
      if (ex) counters = counters.map((c) => (c.id === ex.id ? { ...c, ...data } : c));
      else counters.push({ id: uid(), ...data });
      added++;
    } else errors.push(`Line ${n}: first column must be "service" or "counter"`);
  });
  if (errors.length) return { state: s, errors, added: 0 };
  return { state: push({ ...s, services, counters }, `Bulk import: ${added} rows applied`), errors, added };
}
