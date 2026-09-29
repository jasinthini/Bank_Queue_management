import { useState } from "react";
import { Link } from "react-router-dom";
import { FlaskConical, Plus, RefreshCcw, ShieldCheck, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonClass } from "../components/Button.jsx";
import { AppShell, Loading } from "../components/AppShell.jsx";
import { useQueue } from "../lib/queue-store.jsx";
import { activeFor, bulkImport, callNext, makeSeed, makeVivaSeed, markMissed, QueueError, uid } from "../lib/queue-engine.js";

const SAMPLE = `# type,code,name,avgMinutes
service,F,Foreign Exchange,8
# type,name,serviceCodes,staff,pin
counter,Teller 5,C|F,Yogarasa J.,5555
counter,Teller 6,F,Priya K.,6666`;

export default function Admin() {
  const { state, session } = useQueue();
  if (!state) return <AppShell><Loading /></AppShell>;
  if (session?.role !== "admin")
    return (
      <AppShell title="Branch Management">
        <div className="mx-auto max-w-md border border-border bg-card p-9 text-center">
          <ShieldCheck className="mx-auto size-10 text-primary" />
          <h1 className="mt-4 font-display text-3xl">Admin access</h1>
          <p className="mt-3 text-sm text-muted-foreground">Sign in to manage branches and counters.</p>
          <Link to="/login" className={buttonClass({ className: "mt-6" })}>Go to sign in</Link>
        </div>
      </AppShell>
    );
  return <AppShell title="Branch Management"><AdminPanel /></AppShell>;
}

function AdminPanel() {
  const { state: s, replace, run, branches, activeBranchId, saveBranches, switchBranch } = useQueue();
  const [bankName, setBankName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [csv, setCsv] = useState(SAMPLE);
  const [errors, setErrors] = useState([]);
  const [svc, setSvc] = useState({ code: "", name: "", avg: "5" });
  const [steps, setSteps] = useState([]);

  const edit = (fn, msg) => run((st) => ({ ...fn(st), version: st.version + 1 }), msg);

  const addService = () => {
    const code = svc.code.toUpperCase();
    run((st) => {
      if (!/^[A-Z]$/.test(code)) throw new QueueError("Code must be one letter");
      if (st.services.some((x) => x.code === code)) throw new QueueError("Code already used");
      if (!svc.name.trim()) throw new QueueError("Name required");
      return { ...st, services: [...st.services, { id: uid(), code, name: svc.name.trim(), avgServiceMin: Number(svc.avg) || 5, nextSeq: 1 }] };
    }, "Service added");
    setSvc({ code: "", name: "", avg: "5" });
  };

  const addCounter = () =>
    edit((st) => ({
      ...st,
      counters: [...st.counters, {
        id: uid(), name: `Teller ${st.counters.length + 1}`, serviceIds: [st.services[0].id],
        staffName: "New staff", pin: String(1000 + st.counters.length * 1111).slice(0, 4), active: true,
      }],
    }), "Counter added");

  const doImport = () => {
    const r = bulkImport(s, csv);
    setErrors(r.errors);
    if (r.errors.length) toast.error(`${r.errors.length} row(s) invalid — nothing imported`);
    else { replace(r.state); toast.success(`Imported ${r.added} rows`); }
  };

  // The signature viva scenario: A-212..A-216
  const runViva = () => {
    let st = makeVivaSeed();
    const [c1, c2] = st.counters;
    c1.serviceIds = [st.services[1].id];
    c2.serviceIds = [st.services[1].id];
    const log = [{ text: "Queue A-212–A-216 waiting (Accounts & Cards)", ok: true }];
    const tok = (x, cid) => activeFor(x, cid)?.token;

    st = callNext(st, c1.id, c1.pin).state;
    log.push({ text: `Teller 1 calls next → ${tok(st, c1.id)}`, ok: true });
    // complete A-212
    st = { ...st, entries: st.entries.map((e) => (e.counterId === c1.id && e.status === "CALLED" ? { ...e, status: "DONE", servingAt: Date.now(), doneAt: Date.now() } : e)) };
    log.push({ text: "Teller 1 completes A-212", ok: true });

    st = callNext(st, c1.id, c1.pin).state;
    log.push({ text: `Teller 1 calls next → ${tok(st, c1.id)}`, ok: tok(st, c1.id) === "A-213" });
    st = markMissed(st, c1.id, c1.pin);
    log.push({ text: "Teller 1 marks A-213 MISSED", ok: true });

    st = callNext(st, c1.id, c1.pin).state;
    log.push({ text: `Teller 1 calls next → ${tok(st, c1.id)} (CALLED)`, ok: tok(st, c1.id) === "A-214" });

    st = callNext(st, c2.id, c2.pin).state;
    const got = tok(st, c2.id);
    log.push({ text: `Teller 2 calls next while A-214 is CALLED → ${got} ${got === "A-215" ? "✓ never A-214" : "✗"}`, ok: got === "A-215" });

    try { callNext(st, c1.id, c1.pin); } catch (e) {
      log.push({ text: `Teller 1 tries Call Next again → blocked: "${e.message}"`, ok: true });
    }
    replace(st); setSteps(log); toast.success("Viva scenario executed");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Organisation</p>
          <h1 className="text-4xl font-semibold">{s.org.name}</h1>
          <input value={s.org.branch} onChange={(e) => replace({ ...s, org: { ...s.org, branch: e.target.value } })} className="mt-1 bg-transparent text-muted-foreground outline-none" />
        </div>
        <Button onClick={() => { replace(makeSeed()); setSteps([]); toast.success("Demo data reset"); }}
          className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">
          <RefreshCcw className="size-4" /> Reset demo data
        </Button>
      </div>

      {/* Banks & branches */}
      <section className="border-y border-border py-7">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Network</p>
            <h2 className="font-display text-2xl">Banks & branches</h2>
          </div>
          <span className="text-xs text-muted-foreground">{branches.length} branch(es)</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {branches.map((b) => (
            <div key={b.id} className={`border p-4 ${b.id === activeBranchId ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
              <div className="flex items-center gap-2">
                <input aria-label="Bank name" value={b.bank} onChange={(e) => saveBranches(branches.map((x) => (x.id === b.id ? { ...x, bank: e.target.value } : x)))} className="min-w-0 flex-1 bg-transparent font-semibold outline-none" />
                <Button variant="outline" size="sm" disabled={b.id === activeBranchId} onClick={() => switchBranch(b.id)}>Switch</Button>
              </div>
              <input aria-label="Branch name" value={b.name} onChange={(e) => saveBranches(branches.map((x) => (x.id === b.id ? { ...x, name: e.target.value } : x)))} className="mt-2 w-full bg-transparent text-sm text-muted-foreground outline-none" />
              <p className="mt-3 font-token text-[10px] text-muted-foreground">ID {b.id}</p>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!bankName.trim() || !branchName.trim()) return;
            saveBranches([...branches, { id: uid(), bank: bankName.trim(), name: branchName.trim() }]);
            setBankName(""); setBranchName(""); toast.success("Branch added");
          }}
          className="mt-4 flex flex-wrap gap-2">
          <input required value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" className="min-w-0 flex-1 border border-input bg-background px-3 py-2" />
          <input required value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="Branch name" className="min-w-0 flex-1 border border-input bg-background px-3 py-2" />
          <Button type="submit"><Plus /> Add branch</Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">Each branch keeps a separate queue in this browser.</p>
      </section>

      {/* Viva */}
      <div className="rounded-md bg-ink p-8 text-ink-foreground shadow-lift">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold"><FlaskConical className="size-5 text-accent" /> Viva: fairness demonstration</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Priority waiting tokens first (oldest check-in) → missed tokens once {s.policy.recallGap} calls have passed → normal tokens FIFO. Only unassigned entries can be called, so a CALLED/SERVING token can never go to a second counter.
            </p>
          </div>
          <Button onClick={runViva} className="h-auto rounded-xl bg-warm px-6 py-3 font-semibold text-accent-foreground shadow-accent">Run A-212–A-216 scenario</Button>
        </div>
        {steps.length > 0 && (
          <ol className="mt-6 grid gap-2 md:grid-cols-2">
            {steps.map((st, i) => (
              <li key={i} className="animate-rise flex items-center gap-3 rounded-xl bg-ink-foreground/5 px-4 py-3 text-sm" style={{ animationDelay: `${i * 80}ms` }}>
                <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${st.ok ? "bg-serving text-ink" : "bg-missed text-ink"}`}>{i + 1}</span>
                {st.text}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Services */}
        <div className="surface p-6">
          <h2 className="text-xl font-semibold">Services</h2>
          <div className="mt-4 space-y-2">
            {s.services.map((x) => (
              <div key={x.id} className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <span className="grid size-9 place-items-center rounded-lg bg-primary font-token font-bold text-primary-foreground">{x.code}</span>
                <div className="flex-1">
                  <p className="font-medium">{x.name}</p>
                  <p className="font-token text-[10px] text-muted-foreground">id {x.id.slice(0, 8)} · next {x.code}{x.nextSeq}</p>
                </div>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  avg
                  <input type="number" min={1} value={x.avgServiceMin}
                    onChange={(e) => replace({ ...s, services: s.services.map((y) => (y.id === x.id ? { ...y, avgServiceMin: Math.max(1, Number(e.target.value)) } : y)) })}
                    className="w-14 rounded-lg border border-input bg-card px-2 py-1 text-foreground" />m
                </label>
                <Button variant="ghost" size="icon" title="Remove service" className="hover:bg-missed/10 hover:text-missed"
                  onClick={() => run((st) => {
                    if (st.entries.some((e) => e.serviceId === x.id && ["WAITING", "CALLED", "SERVING"].includes(e.status))) throw new QueueError("Service has active tokens");
                    return { ...st, services: st.services.filter((y) => y.id !== x.id), counters: st.counters.map((c) => ({ ...c, serviceIds: c.serviceIds.filter((i) => i !== x.id) })) };
                  }, "Service removed")}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-[60px_1fr_70px_auto] gap-2">
            <input value={svc.code} onChange={(e) => setSvc({ ...svc, code: e.target.value.slice(0, 1) })} placeholder="E" className="rounded-xl border border-input bg-background px-3 py-2 text-center font-token uppercase" />
            <input value={svc.name} onChange={(e) => setSvc({ ...svc, name: e.target.value })} placeholder="Service name" className="rounded-xl border border-input bg-background px-3 py-2" />
            <input value={svc.avg} onChange={(e) => setSvc({ ...svc, avg: e.target.value })} type="number" className="rounded-xl border border-input bg-background px-3 py-2" />
            <Button onClick={addService} className="h-auto rounded-xl px-3"><Plus className="size-4" /></Button>
          </div>
        </div>

        {/* Counters */}
        <div className="surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Counters & staff</h2>
            <Button onClick={addCounter} size="sm" className="rounded-full"><Plus className="size-3.5" /> Add</Button>
          </div>
          <div className="mt-4 space-y-2">
            {s.counters.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-2">
                  <input value={c.name} onChange={(e) => replace({ ...s, counters: s.counters.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)) })} className="min-w-0 flex-1 bg-transparent font-semibold outline-none" />
                  <span className="font-token text-xs text-muted-foreground">PIN {c.pin}</span>
                  <Button size="sm" variant="ghost"
                    onClick={() => run((st) => {
                      if (activeFor(st, c.id)) throw new QueueError("Counter has an active token");
                      return { ...st, counters: st.counters.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)) };
                    }, c.active ? "Counter closed" : "Counter opened")}
                    className={`rounded-full font-bold ${c.active ? "bg-serving/15 text-serving hover:bg-serving/25" : "bg-muted text-muted-foreground"}`}>
                    {c.active ? "Open" : "Closed"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{c.staffName}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.services.map((x) => {
                    const on = c.serviceIds.includes(x.id);
                    return (
                      <Button key={x.id} size="sm"
                        onClick={() => replace({ ...s, counters: s.counters.map((y) => (y.id === c.id ? { ...y, serviceIds: on ? y.serviceIds.filter((i) => i !== x.id) : [...y.serviceIds, x.id] } : y)) })}
                        className={`h-auto rounded-lg px-2.5 py-1 font-semibold ${on ? "bg-primary text-primary-foreground" : "border border-border bg-transparent text-muted-foreground hover:bg-muted"}`}>
                        {x.code} · {x.name}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk import */}
      <div className="surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold"><Upload className="size-4" /> Bulk import configuration</h2>
            <p className="text-xs text-muted-foreground">CSV rows: <code>service,CODE,Name,avgMin</code> and <code>counter,Name,CODE|CODE,Staff,PIN</code>. All rows are validated — any error means nothing is applied.</p>
          </div>
          <label className="cursor-pointer rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
            Upload .csv
            <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} />
          </label>
        </div>
        <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={7} className="mt-4 w-full rounded-xl border border-input bg-background p-4 font-token text-sm outline-none focus:ring-4 ring-ring/30" />
        {errors.length > 0 && <ul className="mt-2 space-y-1 text-sm text-destructive">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>}
        <Button onClick={doImport} className="mt-3 h-auto rounded-xl px-6 py-3 font-semibold">Validate & import</Button>
      </div>
    </div>
  );
}
