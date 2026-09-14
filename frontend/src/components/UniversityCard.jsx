import { useLocation } from "react-router-dom";
import { useCompare } from "../context/CompareContext";
import { FitScoreRing } from "./FitScoreRing";
import { WhyThisMatch } from "./WhyThisMatch";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { MapPin, Trophy, GitCompare, ArrowRight, Award } from "lucide-react";

function money(v) {
  if (v == null) return "—";
  return `$${v.toLocaleString()}`;
}

export function UniversityCard({ item, onOpen }) {
  const compare = useCompare();
  const u = item.university;
  const p = item.top_program;
  const fit = item.fit;
  const scholars = item.eligible_scholarships || [];

  return (
    <div
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-md"
      data-testid={`university-card-${u.slug}`}
    >
      <div className="relative h-32 w-full overflow-hidden bg-zinc-100">
        <img src={u.image_url} alt={u.name} className="h-full w-full object-cover" />
        <div className="absolute right-2 top-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm">
            <Checkbox
              checked={compare.has(u.slug)}
              onCheckedChange={() => compare.toggle(u.slug)}
              data-testid={`compare-check-${u.slug}`}
            />
            <GitCompare className="h-3 w-3" />
            Compare
          </label>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-heading text-base font-semibold text-zinc-900">{u.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {u.city}, {u.country}
              </span>
              {u.qs_ranking && (
                <span className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> QS #{u.qs_ranking}
                </span>
              )}
            </div>
          </div>
          <FitScoreRing score={fit.fit_score} size={56} testid={`fit-ring-${u.slug}`} />
        </div>

        {p && (
          <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
            <p className="truncate text-sm font-medium text-zinc-800">{p.name}</p>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-zinc-600">
                {money(p.tuition_per_year?.value)}/yr tuition
                <StatusBadge status={p.tuition_per_year?.status} source={p.tuition_per_year?.source} />
              </span>
            </div>
          </div>
        )}

        {scholars.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <Award className="h-3.5 w-3.5" />
            {scholars.length} scholarship{scholars.length > 1 ? "s" : ""} you may qualify for
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 pt-4">
          <WhyThisMatch fit={fit} universityName={u.name} programName={p?.name} />
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto gap-1 text-indigo-700 hover:bg-indigo-50"
            onClick={() => onOpen(u.slug)}
            data-testid={`view-detail-${u.slug}`}
          >
            View <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default UniversityCard;
