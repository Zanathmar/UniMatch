import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Layout } from "../components/Layout";
import { FitScoreRing } from "../components/FitScoreRing";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ArrowLeft, X } from "lucide-react";

function money(v) { return v == null ? "—" : `$${v.toLocaleString()}`; }

const ROWS = [
  { label: "Fit Score", get: (c) => c.fit && <FitScoreRing score={c.fit.fit_score} size={52} label={false} />, highlight: true },
  { label: "Country", get: (c) => c.university.country },
  { label: "QS Ranking", get: (c) => (c.university.qs_ranking ? `#${c.university.qs_ranking}` : "—") },
  { label: "Type", get: (c) => c.university.type },
  { label: "Acceptance rate", get: (c) => (c.university.acceptance_rate != null ? `${c.university.acceptance_rate}%` : "—") },
  { label: "Top program", get: (c) => c.top_program?.name || "—" },
  { label: "Tuition / yr", get: (c) => (c.top_program ? <span className="flex items-center gap-1.5">{money(c.top_program.tuition_per_year?.value)}<StatusBadge status={c.top_program.tuition_per_year?.status} source={c.top_program.tuition_per_year?.source} /></span> : "—") },
  { label: "Living / yr", get: (c) => (c.top_program ? <span className="flex items-center gap-1.5">{money(c.top_program.living_cost_per_year?.value)}<StatusBadge status={c.top_program.living_cost_per_year?.status} /></span> : "—") },
  { label: "Min GPA", get: (c) => (c.top_program?.requirements?.min_gpa ? `${c.top_program.requirements.min_gpa.value}/4.0` : "Not published") },
  { label: "English req", get: (c) => (c.top_program?.requirements?.ielts ? `IELTS ${c.top_program.requirements.ielts.value}` : c.top_program?.requirements?.toefl ? `TOEFL ${c.top_program.requirements.toefl.value}` : "Not published") },
  { label: "Deadline", get: (c) => (c.top_program ? <span className="flex items-center gap-1.5">{c.top_program.application_deadline?.value}<StatusBadge status={c.top_program.application_deadline?.status} /></span> : "—") },
  { label: "Scholarships", get: (c) => `${c.scholarships?.length || 0} linked` },
];

export default function Compare() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [mobileIdx, setMobileIdx] = useState(0);
  const slugs = new URLSearchParams(window.location.search).get("slugs")?.split(",") || [];

  useEffect(() => {
    if (slugs.length < 2) return;
    api.post("/compare", { slugs }).then((r) => setItems(r.data.items));
  }, []);

  if (slugs.length < 2) {
    return (
      <Layout>
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <p className="text-zinc-600">Select 2–5 universities to compare from Discover.</p>
          <Button className="mt-3 bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate("/discover")}>Go to Discover</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="mb-1 font-heading text-3xl font-bold tracking-tight text-zinc-900">Compare</h1>
      <p className="mb-6 text-sm text-zinc-500">Side-by-side across your fit and the verifiable data.</p>

      {!items ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          {/* Desktop / tablet matrix */}
          <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white md:block" data-testid="compare-matrix">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="w-40 p-4 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">Attribute</th>
                  {items.map((c) => (
                    <th key={c.university.slug} className="p-4 text-left align-top">
                      <p className="font-heading text-sm font-semibold text-zinc-900">{c.university.name}</p>
                      <p className="text-xs font-normal text-zinc-500">{c.university.city}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label} className={`border-b border-zinc-100 ${row.highlight ? "bg-indigo-50/30" : ""}`}>
                    <td className="p-4 text-sm font-medium text-zinc-600">{row.label}</td>
                    {items.map((c) => (
                      <td key={c.university.slug} className="p-4 text-sm text-zinc-800">{row.get(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile tabbed */}
          <div className="md:hidden" data-testid="compare-mobile">
            <div className="mb-3">
              <Select value={String(mobileIdx)} onValueChange={(v) => setMobileIdx(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {items.map((c, i) => <SelectItem key={c.university.slug} value={String(i)}>{c.university.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
              {ROWS.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 p-3">
                  <span className="text-sm font-medium text-zinc-500">{row.label}</span>
                  <span className="text-right text-sm text-zinc-800">{row.get(items[mobileIdx])}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
