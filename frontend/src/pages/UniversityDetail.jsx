import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Layout } from "../components/Layout";
import { FitScoreRing } from "../components/FitScoreRing";
import { WhyThisMatch } from "../components/WhyThisMatch";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { useCompare } from "../context/CompareContext";
import { toast } from "sonner";
import {
  MapPin, Trophy, Globe, Building2, ArrowLeft, Bookmark, BookmarkCheck,
  GitCompare, Clock, DollarSign, Home, Languages, Award, ExternalLink, BookOpen,
} from "lucide-react";

function money(v) { return v == null ? "—" : `$${v.toLocaleString()}`; }

export default function UniversityDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const compare = useCompare();
  const [data, setData] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get(`/recommendations/${slug}`).then((r) => setData(r.data));
    api.get("/saved").then((r) => setSaved(r.data.items.some((s) => s.university_slug === slug)));
  }, [slug]);

  const save = async () => {
    try {
      await api.post("/saved", { university_slug: slug });
      setSaved(true);
      toast.success("Added to your shortlist");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not save");
    }
  };

  if (!data) {
    return <Layout><Skeleton className="h-64 w-full" /></Layout>;
  }

  const u = data.university;
  const programs = data.programs;

  return (
    <Layout>
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800" data-testid="back-btn">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="relative h-48 w-full bg-zinc-100 sm:h-56">
          {u.image_url ? (
            <img src={u.image_url} alt={u.name} className="h-full w-full object-cover" onError={(e) => { e.target.style.display = "none"; }} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-indigo-50">
              <Building2 className="h-12 w-12 text-indigo-200" />
            </div>
          )}
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{u.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{u.city}, {u.country}</span>
                {u.qs_ranking && <span className="flex items-center gap-1"><Trophy className="h-4 w-4" />QS #{u.qs_ranking}</span>}
                <span className="flex items-center gap-1"><Building2 className="h-4 w-4" />{u.type}</span>
                {u.acceptance_rate != null && <span className="flex items-center gap-1"><Award className="h-4 w-4" />{u.acceptance_rate}% acceptance</span>}
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600">{u.description}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={save} disabled={saved} className={saved ? "bg-emerald-600 hover:bg-emerald-600" : "bg-indigo-600 hover:bg-indigo-700"} data-testid="save-university-btn">
              {saved ? <><BookmarkCheck className="mr-1.5 h-4 w-4" /> Shortlisted</> : <><Bookmark className="mr-1.5 h-4 w-4" /> Add to shortlist</>}
            </Button>
            <Button variant="outline" className="border-zinc-300" onClick={() => compare.toggle(u.slug)} data-testid="compare-toggle-detail">
              <GitCompare className="mr-1.5 h-4 w-4" /> {compare.has(u.slug) ? "Selected" : "Compare"}
            </Button>
            {u.website && (
              <a href={u.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
                Official site <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      <h2 className="mb-3 mt-8 font-heading text-xl font-semibold text-zinc-900">Programs & your fit</h2>
      <div className="space-y-4">
        {programs.map(({ program: p, fit, scholarships }) => (
          <div key={p.id} className="rounded-xl border border-zinc-200 bg-white p-5" data-testid={`program-${p.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] uppercase text-zinc-600">{p.degree}</span>
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-[10px] uppercase text-indigo-600">{p.field}</span>
                </div>
                <h3 className="mt-2 font-heading text-lg font-semibold text-zinc-900">{p.name}</h3>
              </div>
              <div className="flex items-center gap-3">
                <FitScoreRing score={fit.fit_score} size={64} />
                <WhyThisMatch fit={fit} universityName={u.name} programName={p.name} />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Spec icon={DollarSign} label="Tuition / year" value={money(p.tuition_per_year?.value)} field={p.tuition_per_year} />
              <Spec icon={Home} label="Living / year" value={money(p.living_cost_per_year?.value)} field={p.living_cost_per_year} />
              <Spec icon={Clock} label="Application deadline" value={p.application_deadline?.value} field={p.application_deadline} />
              <Spec icon={Languages} label="Language" value={p.language} />
              <Spec icon={BookOpen} label="Min GPA" value={p.requirements?.min_gpa ? `${p.requirements.min_gpa.value}/4.0` : "Not published"} field={p.requirements?.min_gpa} />
              <Spec icon={Globe} label="English" value={p.requirements?.ielts ? `IELTS ${p.requirements.ielts.value}` : p.requirements?.toefl ? `TOEFL ${p.requirements.toefl.value}` : "Not published"} field={p.requirements?.ielts || p.requirements?.toefl} />
            </div>

            {scholarships.length > 0 && (
              <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800"><Award className="h-4 w-4" />{scholarships.length} linked scholarship{scholarships.length > 1 ? "s" : ""}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {scholarships.map((s) => (
                    <span key={s.slug} className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs text-emerald-700">{s.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-zinc-400">Fit Scores are estimates based on your profile and verifiable data — never a guarantee of admission.</p>
    </Layout>
  );
}

function Spec({ icon: Icon, label, value, field }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
      <p className="flex items-center gap-1.5 text-xs text-zinc-500"><Icon className="h-3.5 w-3.5" />{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-800">{value || "—"}</span>
        {field && <StatusBadge status={field.status} source={field.source} />}
      </div>
    </div>
  );
}
