import { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import { Layout } from "../components/Layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { ChevronDown, ChevronUp, Plus, Globe, MapPin, Trophy, ExternalLink, Building2, Pencil, Trash2, BookOpen, X } from "lucide-react";

const fetchIdRef = useRef(0);

async function fetchUniversities() {
  const requestId = ++fetchIdRef.current;
  setLoading(true);
  try {
    const res = await api.get("/custom/universities");
    if (requestId !== fetchIdRef.current) return;
    const items = res.data.items || [];
    const deduped = Array.from(
      new Map(items.map((u) => [u.slug || u.id, u])).values()
    );
    setUniversities(deduped);
  } catch (e) {
    console.error(e);
  } finally {
    if (requestId === fetchIdRef.current) setLoading(false);
  }
}

const EMPTY_PROGRAM = {
  name: "",
  degree: "Bachelor",
  field: "",
  duration_years: 4,
  language: "English",
  tuition_per_year: "",
  living_cost_per_year: "",
  intake: "",
  application_deadline: "",
  min_gpa: "",
  ielts: "",
  toefl: "",
};

const EMPTY_FORM = {
  name: "",
  country: "",
  city: "",
  type: "Public",
  website: "",
  qs_ranking: "",
  description: "",
  image_url: "",
  programs: [],
};

function ProgramCard({ program, index, onRemove }) {
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4 relative">
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="absolute right-2 top-2 text-zinc-400 hover:text-red-500 transition-colors"
        title="Remove program"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pr-6">
        <p className="font-medium text-zinc-900 text-sm">
          {program.name || <span className="italic text-zinc-400">Untitled program</span>}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {program.degree} · {program.field || "No field"} · {program.duration_years}y
        </p>
        {(program.tuition_per_year || program.min_gpa || program.ielts || program.toefl) && (
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs text-zinc-600">
            {program.tuition_per_year && <span>${Number(program.tuition_per_year).toLocaleString()}/yr tuition</span>}
            {program.min_gpa && <span>GPA min: {program.min_gpa}/4.0</span>}
            {program.ielts && <span>IELTS min: {program.ielts}</span>}
            {program.toefl && <span>TOEFL min: {program.toefl}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function ProgramForm({ program, index, onChange, onRemove }) {
  function handleChange(e) {
    const { name, value } = e.target;
    onChange(index, name, value);
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Program {index + 1}</p>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-zinc-400 hover:text-red-500 transition-colors"
          title="Remove"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-zinc-600 mb-1 block">Program Name *</label>
          <Input
            name="name"
            value={program.name}
            onChange={handleChange}
            placeholder="e.g. Computer Science"
            required
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600 mb-1 block">Degree</label>
          <select
            name="degree"
            value={program.degree}
            onChange={handleChange}
            className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="Bachelor">Bachelor</option>
            <option value="Master">Master</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600 mb-1 block">Field of Study</label>
          <Input
            name="field"
            value={program.field}
            onChange={handleChange}
            placeholder="e.g. Computer Science"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600 mb-1 block">Duration (years)</label>
          <Input
            name="duration_years"
            type="number"
            min="1"
            max="10"
            step="0.5"
            value={program.duration_years}
            onChange={handleChange}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600 mb-1 block">Language</label>
          <Input
            name="language"
            value={program.language}
            onChange={handleChange}
            placeholder="e.g. English"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600 mb-1 block">Tuition/Year (USD)</label>
          <Input
            name="tuition_per_year"
            type="number"
            min="0"
            value={program.tuition_per_year}
            onChange={handleChange}
            placeholder="e.g. 15000"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600 mb-1 block">Living Cost/Year (USD)</label>
          <Input
            name="living_cost_per_year"
            type="number"
            min="0"
            value={program.living_cost_per_year}
            onChange={handleChange}
            placeholder="e.g. 10000"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600 mb-1 block">Intake</label>
          <Input
            name="intake"
            value={program.intake}
            onChange={handleChange}
            placeholder="e.g. September, January"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600 mb-1 block">Application Deadline</label>
          <Input
            name="application_deadline"
            type="date"
            value={program.application_deadline}
            onChange={handleChange}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600 mb-1 block">Min GPA (4.0 scale)</label>
          <Input
            name="min_gpa"
            type="number"
            min="0"
            max="4"
            step="0.1"
            value={program.min_gpa}
            onChange={handleChange}
            placeholder="e.g. 3.0"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600 mb-1 block">Min IELTS</label>
          <Input
            name="ielts"
            type="number"
            min="0"
            max="9"
            step="0.5"
            value={program.ielts}
            onChange={handleChange}
            placeholder="e.g. 6.5"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600 mb-1 block">Min TOEFL (IBT)</label>
          <Input
            name="toefl"
            type="number"
            min="0"
            max="120"
            value={program.toefl}
            onChange={handleChange}
            placeholder="e.g. 92"
            className="h-8 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

export default function Universities() {
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [programsExpanded, setProgramsExpanded] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchUniversities();
  }, []);

  async function fetchUniversities() {
    setLoading(true);
    try {
      const res = await api.get("/custom/universities");
      setUniversities(res.data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function updateProgram(index, field, value) {
    setForm((prev) => {
      const programs = [...prev.programs];
      programs[index] = { ...programs[index], [field]: value };
      return { ...prev, programs };
    });
  }

  function addProgram() {
    setForm((prev) => ({
      ...prev,
      programs: [...prev.programs, { ...EMPTY_PROGRAM }],
    }));
    setProgramsExpanded(true);
  }

  function removeProgram(index) {
    setForm((prev) => {
      const programs = prev.programs.filter((_, i) => i !== index);
      return { ...prev, programs };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (payload.qs_ranking === "") payload.qs_ranking = null;
      else payload.qs_ranking = Number(payload.qs_ranking);

      // Clean up program fields — convert empty strings to null
      payload.programs = payload.programs
        .filter((p) => p.name.trim() !== "")
        .map((p) => ({
          name: p.name,
          degree: p.degree,
          field: p.field || "",
          duration_years: p.duration_years ? Number(p.duration_years) : 4,
          language: p.language || "English",
          tuition_per_year: p.tuition_per_year !== "" ? Number(p.tuition_per_year) : null,
          living_cost_per_year: p.living_cost_per_year !== "" ? Number(p.living_cost_per_year) : null,
          intake: p.intake ? p.intake.split(",").map((s) => s.trim()).filter(Boolean) : [],
          application_deadline: p.application_deadline || null,
          min_gpa: p.min_gpa !== "" ? parseFloat(p.min_gpa) : null,
          ielts: p.ielts !== "" ? parseFloat(p.ielts) : null,
          toefl: p.toefl !== "" ? Number(p.toefl) : null,
        }));

      if (editingId) {
        await api.put(`/custom/universities/${editingId}`, payload);
      } else {
        await api.post("/custom/universities", payload);
      }
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      setProgramsExpanded(false);
      fetchUniversities();
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to save university");
    } finally {
      setSubmitting(false);
    }
  }

  function openDialog() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
    setProgramsExpanded(false);
    setDialogOpen(true);
  }

  function openEditDialog(uni) {
    setEditingId(uni.slug);
    setForm({
      name: uni.name,
      country: uni.country,
      city: uni.city || "",
      type: uni.type || "Public",
      website: uni.website || "",
      qs_ranking: uni.qs_ranking?.toString() || "",
      description: uni.description || "",
      image_url: uni.image_url || "",
      programs: (uni.programs || []).map((p) => ({
        name: p.name || "",
        degree: p.degree || "Bachelor",
        field: p.field || "",
        duration_years: p.duration_years || 4,
        language: p.language || "English",
        tuition_per_year: p.tuition_per_year?.value?.toString() || "",
        living_cost_per_year: p.living_cost_per_year?.value?.toString() || "",
        intake: Array.isArray(p.intake) ? p.intake.join(", ") : "",
        application_deadline: p.application_deadline?.value || "",
        min_gpa: p.requirements?.min_gpa?.value?.toString() || "",
        ielts: p.requirements?.ielts?.value?.toString() || "",
        toefl: p.requirements?.toefl?.value?.toString() || "",
      })),
    });
    setError("");
    setProgramsExpanded((uni.programs || []).length > 0);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/custom/universities/${deleteId}`);
      setDeleteDialogOpen(false);
      setDeleteId(null);
      fetchUniversities();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-zinc-900">
            Universities
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Browse and manage your custom university listings
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openDialog} className="gap-2">
              <Plus className="h-4 w-4" /> Add University
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit University" : "Add University"}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Update the university details below."
                  : "Enter the university details below. You can also add programs to compare against other universities."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}

              {/* Basic Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-zinc-700 mb-1 block">
                    University Name *
                  </label>
                  <Input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Harvard University"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-700 mb-1 block">Country *</label>
                  <Input
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    placeholder="e.g. United States"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-700 mb-1 block">City</label>
                  <Input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="e.g. Cambridge"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-700 mb-1 block">Type</label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  >
                    <option value="Public">Public</option>
                    <option value="Private">Private</option>
                    <option value="State">State</option>
                    <option value="Non-Profit">Non-Profit</option>
                    <option value="For-Profit">For-Profit</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-700 mb-1 block">QS Ranking</label>
                  <Input
                    name="qs_ranking"
                    type="number"
                    min="1"
                    value={form.qs_ranking}
                    onChange={handleChange}
                    placeholder="e.g. 3"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-zinc-700 mb-1 block">Website</label>
                  <Input
                    name="website"
                    type="url"
                    value={form.website}
                    onChange={handleChange}
                    placeholder="https://www.example.edu"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-zinc-700 mb-1 block">Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Brief description of the university..."
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-700 mb-1 block">Image URL</label>
                  <Input
                    name="image_url"
                    type="url"
                    value={form.image_url}
                    onChange={handleChange}
                    placeholder="https://images.unsplash.com/..."
                  />
                </div>
              </div>

              {/* Programs Section */}
              <div className="border-t border-zinc-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-indigo-600" />
                    <h3 className="text-sm font-semibold text-zinc-900">Programs</h3>
                    {form.programs.length > 0 && (
                      <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {form.programs.length}
                      </span>
                    )}
                    {form.programs.length > 0 && (
                      <span className="text-xs text-zinc-400">
                        — used for fit scoring &amp; comparison
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {form.programs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setProgramsExpanded((v) => !v)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        {programsExpanded ? (
                          <><ChevronUp className="h-3.5 w-3.5" /> Collapse</>
                        ) : (
                          <><ChevronDown className="h-3.5 w-3.5" /> Expand</>
                        )}
                      </button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-xs"
                      onClick={addProgram}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Program
                    </Button>
                  </div>
                </div>

                {form.programs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 py-6 text-center">
                    <BookOpen className="h-6 w-6 text-zinc-300 mx-auto" />
                    <p className="mt-2 text-xs text-zinc-400">
                      No programs added yet. Add programs to see detailed fit scores and compare with other universities.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {form.programs.map((program, index) =>
                      programsExpanded ? (
                        <ProgramForm
                          key={index}
                          program={program}
                          index={index}
                          onChange={updateProgram}
                          onRemove={removeProgram}
                        />
                      ) : (
                        <ProgramCard
                          key={index}
                          program={program}
                          index={index}
                          onRemove={removeProgram}
                        />
                      )
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : editingId ? "Update University" : "Add University"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete University</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this university? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete University"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : universities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 py-16 text-center">
          <Building2 className="h-12 w-12 text-zinc-300" />
          <h3 className="mt-4 font-heading text-lg font-semibold text-zinc-900">
            No universities yet
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Add your first university to get started.
          </p>
          <Button variant="outline" className="mt-4 gap-2" onClick={openDialog}>
            <Plus className="h-4 w-4" /> Add University
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {universities.map((uni) => (
            <div
              key={uni.id || uni.slug}
              className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-sm"
            >
              {uni.image_url && (
                <div className="relative -mx-5 -mt-5 mb-4 h-40 w-[calc(100%+2.5rem)] overflow-hidden rounded-t-xl bg-zinc-100">
                  <img
                    src={uni.image_url}
                    alt={uni.name}
                    className="h-full w-full object-cover"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                </div>
              )}
              <div className="flex items-start gap-3">
                {!uni.image_url && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 shrink-0">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-heading text-base font-semibold text-zinc-900">
                    {uni.name}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {uni.city}, {uni.country}
                    </span>
                  </div>
                </div>
                {uni.qs_ranking && (
                  <div className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1">
                    <Trophy className="h-3 w-3 text-amber-600" />
                    <span className="text-xs font-medium text-amber-700">
                      #{uni.qs_ranking}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 capitalize">
                  {uni.type}
                </span>
                {uni.programs?.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">
                    <BookOpen className="h-3 w-3" />
                    {uni.programs.length} program{uni.programs.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {uni.description && (
                <p className="mt-3 text-sm text-zinc-600 line-clamp-2">
                  {uni.description}
                </p>
              )}

              {uni.website && (
                <a
                  href={uni.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 pt-4"
                >
                  <Globe className="h-4 w-4" />
                  Visit website
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

              <div className="mt-4 flex items-center gap-2 pt-4 border-t border-zinc-100">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => openEditDialog(uni)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-red-600 hover:text-red-700 hover:border-red-200"
                  onClick={() => {
                    setDeleteId(uni.slug);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
