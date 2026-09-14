import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Layout } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { Skeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { CalendarClock, FileText, Award, AlertTriangle } from "lucide-react";

const TYPE_CLS = {
  Application: { dot: "bg-indigo-600", chip: "bg-indigo-50 text-indigo-700", icon: FileText },
  Scholarship: { dot: "bg-emerald-600", chip: "bg-emerald-50 text-emerald-700", icon: Award },
};

function daysUntil(dateStr) {
  const d = new Date(dateStr);
  const diff = Math.ceil((d - new Date()) / 86400000);
  return diff;
}

export default function Timeline() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    api.get("/timeline").then((r) => setItems(r.data.items));
  }, []);

  const shown = items?.filter((e) => filter === "All" || e.type === filter);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-zinc-900">Timeline</h1>
        <p className="mt-1 text-sm text-zinc-500">Deadlines generated from your shortlisted universities.</p>
      </div>

      {items && items.length > 0 && (
        <div className="mb-5 flex gap-2">
          {["All", "Application", "Scholarship"].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                filter === t ? "border-indigo-600 bg-indigo-600 text-white" : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
              }`}
              data-testid={`timeline-filter-${t}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {!items ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center" data-testid="timeline-empty">
          <CalendarClock className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-3 text-zinc-600">No deadlines yet — shortlist some universities to build your timeline.</p>
          <Button className="mt-3 bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate("/discover")}>Discover universities</Button>
        </div>
      ) : (
        <div className="relative border-l-2 border-zinc-200 pl-6" data-testid="timeline-list">
          {shown.map((e, i) => {
            const t = TYPE_CLS[e.type] || TYPE_CLS.Application;
            const Icon = t.icon;
            const d = daysUntil(e.date);
            const past = d < 0;
            const soon = d >= 0 && d <= 30;
            return (
              <div key={i} className="relative mb-6" data-testid={`timeline-item-${i}`}>
                <span className={`absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full ${t.dot} ring-4 ring-[#FAFAFA]`} />
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${t.chip}`}>
                        <Icon className="h-3.5 w-3.5" /> {e.type}
                      </span>
                      <StatusBadge status={e.status} source={e.source} />
                    </div>
                    <span className="font-mono text-sm font-semibold text-zinc-900">
                      {new Date(e.date).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <button onClick={() => navigate(`/university/${e.university_slug}`)} className="mt-2 block text-left text-sm font-medium text-zinc-800 hover:text-indigo-700">
                    {e.title}
                  </button>
                  <div className="mt-1 text-xs">
                    {past ? (
                      <span className="text-zinc-400">Passed</span>
                    ) : soon ? (
                      <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3 w-3" />{d} days left</span>
                    ) : (
                      <span className="text-zinc-500">{d} days away</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
