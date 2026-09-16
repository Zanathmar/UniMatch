function scoreColor(score) {
  if (score >= 85) return { stroke: "#059669", text: "text-emerald-600" };
  if (score >= 70) return { stroke: "#4F46E5", text: "text-indigo-600" };
  if (score >= 50) return { stroke: "#3f3f46", text: "text-zinc-700" };
  return { stroke: "#a1a1aa", text: "text-zinc-500" };
}

export function FitScoreRing({ score, size = 64, stroke = 6, label = true, testid }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const { stroke: color, text } = scoreColor(score);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} data-testid={testid}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEEEF0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-heading font-bold ${text}`} style={{ fontSize: size * 0.28 }}>
          {score}
        </span>
        {label && <span className="font-mono text-[8px] uppercase tracking-wider text-zinc-400">fit</span>}
      </div>
    </div>
  );
}

export default FitScoreRing;
