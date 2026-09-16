import { CheckCircle2, HelpCircle } from "lucide-react";

export function StatusBadge({ status, source, className = "" }) {
  const verified = status === "Verified";
  const base =
    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide";
  const cls = verified
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <span
      className={`${base} ${cls} ${className}`}
      title={source ? `Source: ${source}` : status}
      data-testid={`status-badge-${verified ? "verified" : "estimated"}`}
    >
      {verified ? <CheckCircle2 className="h-3 w-3" /> : <HelpCircle className="h-3 w-3" />}
      {verified ? "Verified" : "Estimated"}
    </span>
  );
}

export default StatusBadge;
