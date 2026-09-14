import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Layout } from "../components/Layout";
import { FitScoreRing } from "../components/FitScoreRing";
import { WhyThisMatch } from "../components/WhyThisMatch";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Bookmark, CalendarClock, TrendingUp, ArrowRight, AlertCircle, MapPin, Trophy } from "lucide-react";
import { StatusBadge } from "../components/StatusBadge";

const STEP_LABELS = {
  personal: "Personal info",
  academics: "Academics",
  english: "English score",
  interest: "Study interest",
  destinations: "Destinations",
  budget: "Budget",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data));
  }, []);

  const comp = data?.completeness;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-zinc-900">
          Welcome back{data?.profile?.full_name ? `, ${data.profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Your matches update automatically as you complete your profile.</p>
      </div>

      {!data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-40 lg:col-span-1" />
          <Skeleton className="h-40 lg:col-span-2" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Completeness */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5" data-testid="completeness-card">
              <div className="flex items-center gap-4">
                <FitScoreRing score={comp.percent} size={72} label={false} testid="profile-completeness-ring" />
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-zinc-400">Profile</p>
                  <p className="font-heading text-lg font-semibold text-zinc-900">{comp.percent}% complete</p>
                  {comp.percent < 100 && <p className="text-xs text-zinc-500">Finish for precise scores</p>}
                </div>
              </div>
              {comp.percent < 100 && (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(comp.missing_by_step).map((s) => (
                      <span key={s} className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        <AlertCircle className="h-3 w-3" /> {STEP_LABELS[s]}
                      </span>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" className="mt-3 w-full border-zinc-300" onClick={() => navigate("/onboarding")} data-testid="complete-profile-btn">
                    Complete profile
                  </Button>
                </div>
              )}
            </div>

            {/* Stats */}
            <button onClick={() => navigate("/saved")} className="rounded-xl border border-zinc-200 bg-white p-5 text-left transition-shadow hover:shadow-sm" data-testid="stat-saved">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50"><Bookmark className="h-5 w-5 text-indigo-600" /></div>
              <p className="mt-3 font-heading text-3xl font-bold text-zinc-900">{data.saved_count}</p>
              <p className="text-sm text-zinc-500">Universities shortlisted</p>
            </button>
            <button onClick={() => navigate("/timeline")} className="rounded-xl border border-zinc-200 bg-white p-5 text-left transition-shadow hover:shadow-sm" data-testid="stat-deadlines">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50"><CalendarClock className="h-5 w-5 text-indigo-600" /></div>
              <p className="mt-3 font-heading text-3xl font-bold text-zinc-900">{data.upcoming_deadlines.length}</p>
              <p className="text-sm text-zinc-500">Upcoming deadlines</p>
            </button>
          </div>

          {/* Top matches */}
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-heading text-xl font-semibold text-zinc-900">
                <TrendingUp className="h-5 w-5 text-indigo-600" /> Top matches
              </h2>
              <Button variant="ghost" size="sm" className="gap-1 text-indigo-700 hover:bg-indigo-50" onClick={() => navigate("/discover")} data-testid="see-all-matches">
                See all <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {data.top_matches.map((m) => (
                <div key={m.university.slug} className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4" data-testid={`top-match-${m.university.slug}`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-heading text-base font-semibold text-zinc-900">{m.university.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{m.university.country}</span>
                        {m.university.qs_ranking && <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />QS #{m.university.qs_ranking}</span>}
                      </div>
                    </div>
                    <FitScoreRing score={m.fit.fit_score} size={52} />
                  </div>
                  <p className="mt-3 truncate text-sm text-zinc-600">{m.top_program?.name}</p>
                  <div className="mt-auto flex items-center gap-2 pt-4">
                    <WhyThisMatch fit={m.fit} universityName={m.university.name} programName={m.top_program?.name} />
                    <Button size="sm" variant="ghost" className="ml-auto gap-1 text-indigo-700 hover:bg-indigo-50" onClick={() => navigate(`/university/${m.university.slug}`)}>
                      View <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming deadlines */}
          {data.upcoming_deadlines.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 font-heading text-xl font-semibold text-zinc-900">
                <CalendarClock className="h-5 w-5 text-indigo-600" /> Upcoming deadlines
              </h2>
              <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
                {data.upcoming_deadlines.map((e, i) => (
                  <div key={i} className="flex items-center gap-4 p-4" data-testid={`deadline-${i}`}>
                    <div className="flex w-14 flex-col items-center rounded-lg bg-zinc-50 py-1.5">
                      <span className="font-heading text-lg font-bold text-zinc-900">{new Date(e.date).getDate()}</span>
                      <span className="text-[10px] uppercase text-zinc-500">{new Date(e.date).toLocaleString("en", { month: "short" })}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-800">{e.title}</p>
                      <span className="text-xs text-zinc-500">{e.type} deadline</span>
                    </div>
                    <StatusBadge status={e.status} source={e.source} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
