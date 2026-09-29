import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "../components/Button.jsx";
import { AppShell, Loading } from "../components/AppShell.jsx";
import { useQueue } from "../lib/queue-store.jsx";

const tabs = ["Daily Queue Summary", "Counter Performance", "Waiting / Service Time"];
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const m = (ms) => (ms / 60000).toFixed(1);

function download(name, rows) {
  const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

export default function Reports() {
  const { state } = useQueue();
  const [tab, setTab] = useState(tabs[0]);
  if (!state) return <AppShell><Loading /></AppShell>;

  const E = state.entries;
  const waitMs = E.filter((e) => e.calledAt).map((e) => e.calledAt - e.createdAt);
  const serveMs = E.filter((e) => e.doneAt && e.servingAt).map((e) => e.doneAt - e.servingAt);

  // Report 1: Daily queue summary (per service)
  const summary = state.services.map((s) => {
    const xs = E.filter((e) => e.serviceId === s.id);
    return {
      service: `${s.code} · ${s.name}`,
      issued: xs.length,
      served: xs.filter((e) => e.status === "DONE").length,
      waiting: xs.filter((e) => e.status === "WAITING").length,
      missed: xs.filter((e) => e.status === "MISSED" || e.status === "NO_SHOW").length,
      priority: xs.filter((e) => e.priority).length,
    };
  });

  // Report 2: Counter performance
  const perf = state.counters.map((c) => {
    const xs = E.filter((e) => e.counterId === c.id);
    const done = xs.filter((e) => e.status === "DONE");
    return {
      counter: c.name,
      staff: c.staffName,
      served: done.length,
      missed: xs.filter((e) => e.status === "NO_SHOW").length,
      avgService: Number(m(avg(done.filter((e) => e.servingAt).map((e) => e.doneAt - e.servingAt)))),
    };
  });

  // Report 3: Waiting / service time by hour
  const hours = new Map();
  E.forEach((e) => {
    const h = new Date(e.createdAt).getHours();
    const b = hours.get(h) ?? { w: [], s: [] };
    if (e.calledAt) b.w.push(e.calledAt - e.createdAt);
    if (e.doneAt && e.servingAt) b.s.push(e.doneAt - e.servingAt);
    hours.set(h, b);
  });
  const timeRows = [...hours.entries()].sort((a, b) => a[0] - b[0]).map(([h, b]) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    wait: Number(m(avg(b.w))),
    service: Number(m(avg(b.s))),
  }));

  const kpis = [
    { label: "Tokens issued", value: E.length },
    { label: "Served", value: E.filter((e) => e.status === "DONE").length },
    { label: "Avg wait", value: `${m(avg(waitMs))}m` },
    { label: "Avg service", value: `${m(avg(serveMs))}m` },
    { label: "Missed / no-show", value: E.filter((e) => e.status === "MISSED" || e.status === "NO_SHOW").length },
  ];

  const reportRows =
    tab === tabs[0] ? [["Service", "Issued", "Served", "Waiting", "Missed", "Priority"], ...summary.map((r) => Object.values(r))]
    : tab === tabs[1] ? [["Counter", "Staff", "Served", "No-shows", "Avg service min"], ...perf.map((r) => Object.values(r))]
    : [["Hour", "Avg wait min", "Avg service min"], ...timeRows.map((r) => Object.values(r))];
  const fileName = ["daily-queue-summary", "counter-performance", "wait-service-times"][tabs.indexOf(tab)];

  const exportCsv = () => download(`${fileName}.csv`, reportRows);
  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(reportRows), "Branch report");
    XLSX.writeFile(book, `${fileName}.xlsx`);
  };
  const exportPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text(`Aureum Bank - ${tab}`, 14, 20);
    pdf.setFontSize(10);
    pdf.text(`${state.org.name} / ${state.org.branch} - ${new Date().toLocaleDateString()}`, 14, 29);
    let y = 42;
    reportRows.forEach((row) => {
      const lines = pdf.splitTextToSize(row.map(String).join("  |  "), 180);
      if (y + lines.length * 5 > 280) { pdf.addPage(); y = 18; }
      pdf.text(lines, 14, y);
      y += lines.length * 5 + 3;
    });
    pdf.save(`${fileName}.pdf`);
  };

  const axis = { stroke: "var(--muted-foreground)", fontSize: 12 };
  const grid = <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />;

  return (
    <AppShell title="Branch Analytics">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Branch analytics · today</p>
          <h1 className="text-4xl font-semibold">Reports</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportCsv} variant="outline"><Download /> CSV</Button>
          <Button onClick={exportExcel} variant="outline"><FileSpreadsheet /> Excel</Button>
          <Button onClick={exportPdf}><FileText /> PDF</Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((k, i) => (
          <div key={k.label} className="border border-border bg-card animate-rise p-5" style={{ animationDelay: `${i * 50}ms` }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{k.label}</p>
            <p className="mt-2 font-token text-3xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 inline-flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
        {tabs.map((t) => (
          <Button key={t} variant={tab === t ? "default" : "ghost"} onClick={() => setTab(t)} className="rounded-md px-4 py-2 text-sm">{t}</Button>
        ))}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-5">
        <div className="border border-border bg-card p-6 lg:col-span-3">
          <div className="h-80">
            <ResponsiveContainer>
              {tab === tabs[0] ? (
                <BarChart data={summary}>{grid}<XAxis dataKey="service" {...axis} /><YAxis {...axis} /><Tooltip /><Legend />
                  <Bar dataKey="served" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="waiting" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="missed" fill="var(--chart-2)" radius={[6, 6, 0, 0]} /></BarChart>
              ) : tab === tabs[1] ? (
                <BarChart data={perf}>{grid}<XAxis dataKey="counter" {...axis} /><YAxis {...axis} /><Tooltip /><Legend />
                  <Bar dataKey="served" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="avgService" name="avg service (min)" fill="var(--chart-2)" radius={[6, 6, 0, 0]} /></BarChart>
              ) : (
                <BarChart data={timeRows}>{grid}<XAxis dataKey="hour" {...axis} /><YAxis {...axis} /><Tooltip /><Legend />
                  <Bar dataKey="wait" name="avg wait (min)" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="service" name="avg service (min)" fill="var(--chart-1)" radius={[6, 6, 0, 0]} /></BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-border bg-card overflow-hidden lg:col-span-2">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-widest text-muted-foreground">
              {tab === tabs[0] ? <tr><th className="p-3">Service</th><th>Issued</th><th>Served</th><th>Missed</th></tr>
                : tab === tabs[1] ? <tr><th className="p-3">Counter</th><th>Served</th><th>No-show</th><th>Avg</th></tr>
                : <tr><th className="p-3">Hour</th><th>Avg wait</th><th>Avg service</th></tr>}
            </thead>
            <tbody className="divide-y divide-border">
              {tab === tabs[0] && summary.map((r) => (
                <tr key={r.service}><td className="p-3 font-medium">{r.service}</td><td className="font-token">{r.issued}</td><td className="font-token">{r.served}</td><td className="font-token text-missed">{r.missed}</td></tr>
              ))}
              {tab === tabs[1] && perf.map((r) => (
                <tr key={r.counter}><td className="p-3"><p className="font-medium">{r.counter}</p><p className="text-xs text-muted-foreground">{r.staff}</p></td><td className="font-token">{r.served}</td><td className="font-token text-missed">{r.missed}</td><td className="font-token">{r.avgService}m</td></tr>
              ))}
              {tab === tabs[2] && timeRows.map((r) => (
                <tr key={r.hour}><td className="p-3 font-token">{r.hour}</td><td className="font-token">{r.wait}m</td><td className="font-token">{r.service}m</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
