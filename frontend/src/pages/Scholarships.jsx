import { useEffect, useState } from "react";
import api from "../lib/api";
import { Layout } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { Skeleton } from "../components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Award, ExternalLink, CheckCircle2, HelpCircle, XCircle, Calendar } from "lucide-react";

const VERDICT = {
  "Likely Eligible": { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  "Possibly Eligible": { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: HelpCircle },
  "Not Eligible": { cls: "bg-zinc-100 text-zinc-500 border-zinc-200", icon: XCircle },
};

export default function Scholarships() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.get("/scholarships/estimate").then((r) => setItems(r.data.items));
  }, []);

  const shown = items?.filter((s) => filter === "all" || s.eligibility_result.verdict === filter);

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-zinc-900">Scholarships</h1>
          <p className="mt-1 text-sm text-zinc-500">Rule-based eligibility estimates with plain-English reasons. Not a guarantee.</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48" data-testid="scholarship-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All scholarships</SelectItem>
            <SelectItem value="Likely Eligible">Likely eligible</SelectItem>
            <SelectItem value="Possibly Eligible">Possibly eligible</SelectItem>
            <SelectItem value="Not Eligible">Not eligible</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!items ? (
        <div className="grid gap-4 md:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((s) => {
            const v = VERDICT[s.eligibility_result.verdict] || VERDICT["Possibly Eligible"];
            const Icon = v.icon;
            return (
              <div key={s.slug} className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5" data-testid={`scholarship-${s.slug}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-heading text-base font-semibold text-zinc-900">{s.name}</h3>
                    <p className="mt-0.5 text-xs text-zinc-500">{s.provider}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${v.cls}`}>
                    <Icon className="h-3.5 w-3.5" /> {s.eligibility_result.verdict}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    <Award className="h-3.5 w-3.5" /> {s.coverage_type}
                  </span>
                  <span className="text-zinc-600">{s.coverage_text}</span>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
                  <Calendar className="h-3.5 w-3.5" /> Deadline {s.deadline?.value || "—"}
                  {s.deadline?.status && <StatusBadge status={s.deadline.status} source={s.deadline.source} />}
                </div>

                <ul className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3">
                  {s.eligibility_result.reasons.map((r, i) => (
                    <li key={i} className="flex gap-2 text-xs leading-relaxed text-zinc-600">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-300" /> {r}
                    </li>
                  ))}
                </ul>

                {s.link && (
                  <a href={s.link} target="_blank" rel="noreferrer" className="mt-auto flex items-center gap-1 pt-3 text-sm font-medium text-indigo-600 hover:underline">
                    Learn more <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
