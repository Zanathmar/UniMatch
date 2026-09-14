import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Sparkles } from "lucide-react";
import { StatusBadge } from "./StatusBadge";

function barColor(score) {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 70) return "bg-indigo-600";
  if (score >= 50) return "bg-zinc-600";
  return "bg-zinc-300";
}

export function WhyThisMatch({ fit, universityName, programName, triggerLabel = "Why this match?", triggerClass }) {
  const [open, setOpen] = useState(false);
  if (!fit) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 border-zinc-300 text-zinc-700 hover:bg-zinc-50 ${triggerClass || ""}`}
          data-testid="why-this-match-btn"
        >
          <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="why-this-match-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Why this match?</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <p className="text-sm text-zinc-600">
            {universityName}
            {programName ? ` · ${programName}` : ""}
          </p>
          <div className="flex items-center gap-3 py-2">
            <span className="font-heading text-3xl font-bold text-zinc-900">{fit.fit_score}</span>
            <span className="text-sm text-zinc-500">weighted Fit Score</span>
            <span className="ml-auto">
              <StatusBadge status={fit.overall_confidence} source={`${fit.confidence_pct}% of score from verified data`} />
            </span>
          </div>
          {fit.estimated_categories > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {fit.estimated_categories} categor{fit.estimated_categories === 1 ? "y is" : "ies are"} estimated because
              some data is missing. Complete your profile for a more precise score. This is never a guarantee of admission.
            </div>
          )}
        </div>
        <div className="mt-2 space-y-4">
          {fit.breakdown.map((b) => (
            <div key={b.key} data-testid={`breakdown-${b.key}`}>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-800">{b.label}</span>
                  <span className="font-mono text-[10px] text-zinc-400">{b.weight}%</span>
                  <StatusBadge status={b.confidence} />
                </div>
                <span className="font-mono text-sm font-semibold text-zinc-900">{b.score}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full ${barColor(b.score)}`}
                  style={{ width: `${b.score}%`, transition: "width 0.6s ease" }}
                />
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">{b.explanation}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WhyThisMatch;
