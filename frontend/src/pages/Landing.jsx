import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import {
  GraduationCap,
  Target,
  ShieldCheck,
  BarChart3,
  Award,
  CalendarClock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const features = [
  { icon: Target, title: "Explainable Fit Scores", desc: "A weighted score across 7 dimensions — academics, budget, scholarships, requirements & more. No black boxes." },
  { icon: ShieldCheck, title: "Verified vs Estimated", desc: "Every cost, deadline and requirement carries a source and an honest verification label. We never invent data." },
  { icon: Award, title: "Scholarship Estimator", desc: "Rule-based eligibility checks with plain-English reasons for every scholarship linked to your matches." },
  { icon: CalendarClock, title: "Personalized Timeline", desc: "Deadlines generated from your real shortlist — application and scholarship dates in one view." },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-heading text-lg font-bold tracking-tight text-zinc-900">UniMatch</span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Button onClick={() => navigate("/dashboard")} className="bg-indigo-600 hover:bg-indigo-700" data-testid="go-dashboard-btn">
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate("/login")} data-testid="nav-login-btn">
                  Sign in
                </Button>
                <Button onClick={() => navigate("/register")} className="bg-indigo-600 hover:bg-indigo-700" data-testid="nav-signup-btn">
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 lg:px-8 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 font-mono text-xs uppercase tracking-widest text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Data-driven decisions
            </span>
            <h1 className="mt-5 font-heading text-4xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
              Find universities that <span className="text-indigo-600">actually fit</span> your profile.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-zinc-600 sm:text-lg">
              Build your student profile once and get honest, explainable Fit Scores for global universities and
              scholarships. No hype, no fake guarantees — just transparent, verifiable matches.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={() => navigate(user ? "/dashboard" : "/register")}
                className="gap-2 bg-indigo-600 px-6 hover:bg-indigo-700"
                data-testid="hero-cta-btn"
              >
                Build my profile <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/login")} className="border-zinc-300">
                I have an account
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-500">
              {["30+ verified universities", "Rule-based, testable engine", "Never guarantees admission"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {t}
                </span>
              ))}
            </div>
          </div>

          <div className="animate-fade-up rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm" style={{ animationDelay: "0.1s" }}>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <p className="font-heading text-sm font-semibold text-zinc-900">ETH Zurich</p>
                <p className="text-xs text-zinc-500">Zurich, Switzerland · QS #7</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-emerald-500">
                <span className="font-heading text-lg font-bold text-emerald-600">94</span>
              </div>
            </div>
            <div className="space-y-3 pt-4">
              {[
                { l: "Academic Fit", s: 96, c: "bg-emerald-500" },
                { l: "Budget Fit", s: 98, c: "bg-emerald-500" },
                { l: "Scholarship", s: 82, c: "bg-indigo-600" },
                { l: "Requirements", s: 90, c: "bg-emerald-500" },
              ].map((b) => (
                <div key={b.l}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-zinc-600">{b.l}</span>
                    <span className="font-mono font-semibold text-zinc-800">{b.s}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div className={`h-full rounded-full ${b.c}`} style={{ width: `${b.s}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <BarChart3 className="h-4 w-4" /> Every score cites the underlying, verifiable data point.
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
                <f.icon className="h-5 w-5 text-indigo-600" strokeWidth={1.75} />
              </div>
              <h3 className="mt-3 font-heading text-base font-semibold text-zinc-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-zinc-400 sm:px-6 lg:px-8">
          UniMatch · Decisions you can verify. Never a guarantee of admission.
        </div>
      </footer>
    </div>
  );
}
