import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Layout } from "../components/Layout";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Skeleton } from "../components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { Bookmark, Trash2, MapPin, Trophy, ArrowRight, Save } from "lucide-react";

const STATUS_OPTS = ["Considering", "Applying", "Submitted"];
const STATUS_CLS = {
  Considering: "bg-zinc-100 text-zinc-600",
  Applying: "bg-indigo-50 text-indigo-700",
  Submitted: "bg-emerald-50 text-emerald-700",
};

export default function Saved() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [drafts, setDrafts] = useState({});

  const load = () => api.get("/saved").then((r) => {
    setItems(r.data.items);
    const d = {};
    r.data.items.forEach((s) => (d[s.id] = { note: s.note || "", status: s.status }));
    setDrafts(d);
  });

  useEffect(() => { load(); }, []);

  const update = async (id, patch) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    if (patch.status) {
      await api.patch(`/saved/${id}`, patch);
      toast.success("Status updated");
      setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    }
  };

  const saveNote = async (id) => {
    await api.patch(`/saved/${id}`, { note: drafts[id].note });
    toast.success("Note saved");
  };

  const remove = async (id) => {
    await api.delete(`/saved/${id}`);
    setItems((prev) => prev.filter((s) => s.id !== id));
    toast.success("Removed from shortlist");
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-zinc-900">My shortlist</h1>
        <p className="mt-1 text-sm text-zinc-500">Track your target universities with private notes and a status.</p>
      </div>

      {!items ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center" data-testid="saved-empty">
          <Bookmark className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-3 text-zinc-600">Your shortlist is empty.</p>
          <Button className="mt-3 bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate("/discover")}>Discover universities</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((s) => (
            <div key={s.id} className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row" data-testid={`saved-${s.university_slug}`}>
              <img src={s.university?.image_url} alt="" className="h-24 w-full rounded-lg object-cover sm:h-24 sm:w-32" />
              <div className="flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-heading text-base font-semibold text-zinc-900">{s.university?.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.university?.city}, {s.university?.country}</span>
                      {s.university?.qs_ranking && <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />QS #{s.university.qs_ranking}</span>}
                      {s.fit_score != null && <span className="font-mono font-medium text-indigo-600">Fit {s.fit_score}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={drafts[s.id]?.status} onValueChange={(v) => update(s.id, { status: v })}>
                      <SelectTrigger className={`h-8 w-36 text-xs ${STATUS_CLS[drafts[s.id]?.status] || ""}`} data-testid={`status-select-${s.university_slug}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <button onClick={() => remove(s.id)} className="text-zinc-400 hover:text-red-600" data-testid={`remove-${s.university_slug}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="mt-3 flex items-end gap-2">
                  <Textarea
                    value={drafts[s.id]?.note || ""}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], note: e.target.value } }))}
                    placeholder="Private notes — why this school, what to prepare…"
                    rows={2}
                    className="resize-none text-sm"
                    data-testid={`note-${s.university_slug}`}
                  />
                  <Button size="sm" variant="outline" className="border-zinc-300" onClick={() => saveNote(s.id)} data-testid={`save-note-${s.university_slug}`}>
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 text-right">
                  <Button size="sm" variant="ghost" className="gap-1 text-indigo-700 hover:bg-indigo-50" onClick={() => navigate(`/university/${s.university_slug}`)}>
                    View details <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
