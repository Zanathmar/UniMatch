import { useEffect, useState, useRef } from "react";
import api from "../lib/api";
import { Layout } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { Skeleton } from "../components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../components/ui/command";
import { Badge } from "../components/ui/badge";
import { Award, ExternalLink, CheckCircle2, HelpCircle, XCircle, Calendar, Plus, Pencil, Trash, ShieldCheck, ChevronDown, Check, University, Search, X } from "lucide-react";

const VERDICT = {
  "Likely Eligible": { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  "Possibly Eligible": { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: HelpCircle },
  "Not Eligible": { cls: "bg-zinc-100 text-zinc-500 border-zinc-200", icon: XCircle },
};

export default function Scholarships() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingSlug, setEditingSlug] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState(null);
  const [universitySelectOpen, setUniversitySelectOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    provider: "",
    coverage_type: "Partial",
    coverage_text: "",
    amount_per_year: "",
    degree_level: "Any",
    field: "Any",
    deadline: "",
    requirements_text: "",
    link: "",
    university_slug: [],
    verified: false,
    // Structured eligibility
    min_gpa: "",
    min_ielts: "",
    min_toefl: "",
    need_based: false,
    merit_based: false,
    citizenship: "",
  });
  const [universities, setUniversities] = useState([]);
  const [universitySearch, setUniversitySearch] = useState("");

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggleUniversity = (slug) => {
    setFormData((prev) => {
      const current = prev.university_slug || [];
      if (current.includes(slug)) {
        return { ...prev, university_slug: current.filter((s) => s !== slug) };
      } else {
        return { ...prev, university_slug: [...current, slug] };
      }
    });
    setUniversitySearch("");
  };

  const getUniversityName = (slug) => {
    const u = universities.find((uni) => uni.slug === slug);
    return u ? u.name : slug;
  };

  const handleEdit = (scholarship) => {
    setEditingSlug(scholarship.slug);
    const elig = scholarship.eligibility || {};
    setFormData({
      name: scholarship.name || "",
      provider: scholarship.provider || "",
      coverage_type: scholarship.coverage_type || "Partial",
      coverage_text: scholarship.coverage_text || "",
      amount_per_year: scholarship.amount_per_year ? String(scholarship.amount_per_year) : "",
      degree_level: scholarship.degree_level || "Any",
      field: scholarship.field || "Any",
      deadline: scholarship.deadline?.value || "",
      requirements_text: scholarship.requirements_text || "",
      link: scholarship.link || "",
      university_slug: Array.isArray(scholarship.university_slug) ? scholarship.university_slug : (scholarship.university_slug ? [scholarship.university_slug] : []),
      verified: scholarship.verified || false,
      min_gpa: elig.min_gpa != null ? String(elig.min_gpa) : "",
      min_ielts: elig.min_ielts != null ? String(elig.min_ielts) : "",
      min_toefl: elig.min_toefl != null ? String(elig.min_toefl) : "",
      need_based: !!elig.need_based,
      merit_based: !!elig.merit_based,
      citizenship: elig.citizenship || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingSlug) return;
    try {
      await api.delete(`/custom/scholarships/${deletingSlug}`);
      setItems((prev) => (prev || []).filter((s) => s.slug !== deletingSlug));
      setDeleteDialogOpen(false);
      setDeletingSlug(null);
    } catch (err) {
      console.error("Failed to delete scholarship:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        provider: formData.provider,
        coverage_type: formData.coverage_type || "Partial",
        coverage_text: formData.coverage_text,
        amount_per_year: formData.amount_per_year ? Number(formData.amount_per_year) : null,
        degree_level: formData.degree_level || "Any",
        field: formData.field || "Any",
        deadline: formData.deadline || null,
        requirements_text: formData.requirements_text,
        link: formData.link,
        university_slug: formData.university_slug,
        verified: formData.verified,
        // Structured eligibility
        min_gpa: formData.min_gpa ? parseFloat(formData.min_gpa) : null,
        min_ielts: formData.min_ielts ? parseFloat(formData.min_ielts) : null,
        min_toefl: formData.min_toefl ? parseInt(formData.min_toefl) : null,
        need_based: formData.need_based,
        merit_based: formData.merit_based,
        citizenship: formData.citizenship,
      };

      if (editingSlug) {
        await api.put(`/custom/scholarships/${editingSlug}`, payload);
        // Re-fetch updated custom scholarships with real eligibility estimation
        const res = await api.get("/custom/scholarships/estimate");
        const updatedCustoms = (res.data.items || []).map((s) => ({ ...s, isCustom: true }));
        setItems((prev) => {
          const curated = (prev || []).filter((i) => !i.isCustom);
          return [...curated, ...updatedCustoms];
        });
      } else {
        const createRes = await api.post("/custom/scholarships", payload);
        // Fetch the newly created scholarship with its eligibility estimate
        const estRes = await api.get("/custom/scholarships/estimate");
        const newItem = (estRes.data.items || []).find((s) => s.slug === createRes.data.slug);
        if (newItem) {
          setItems((prev) => {
            const curated = (prev || []).filter((i) => !i.isCustom);
            return [...curated, { ...newItem, isCustom: true }];
          });
        }
      }
      setDialogOpen(false);
      setEditingSlug(null);
      setFormData({
        name: "",
        provider: "",
        coverage_type: "Partial",
        coverage_text: "",
        amount_per_year: "",
        degree_level: "Any",
        field: "Any",
        deadline: "",
        requirements_text: "",
        link: "",
        university_slug: [],
        verified: false,
      });
    } catch (err) {
      console.error("Failed to save scholarship:", err);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    Promise.all([
      api.get("/scholarships/estimate"),
      api.get("/custom/scholarships/estimate"),
    ]).then(([cur, custom]) => {
      const curated = cur.data.items || [];
      const customs = (custom.data.items || []).map((s) => ({ ...s, isCustom: true }));
      setItems([...curated, ...customs]);
    });
  }, []);

  // Fetch universities when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      Promise.all([
        api.get("/universities?limit=500"),
        api.get("/custom/universities"),
      ]).then(([cur, custom]) => {
        const curated = (cur.data.items || []).map((u) => ({ ...u, isCustom: false }));
        const customs = (custom.data.items || []).map((u) => ({ ...u, isCustom: true }));
        setUniversities([...curated, ...customs]);
      }).catch(() => {});
    }
  }, [dialogOpen]);

  const q = search.trim().toLowerCase();
  const shown = items?.filter((s) => {
    if (filter !== "all" && s.eligibility_result?.verdict !== filter) return false;
    if (!q) return true;
    return [
      s.name,
      s.provider,
      s.coverage_text,
      s.field,
      s.country,
      s.citizenship,
      s.deadline?.value,
      ...(Array.isArray(s.university_slug)
        ? s.university_slug.flatMap((slug) => [slug, getUniversityName(slug)])
        : []),
    ]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const curatedUnis = universities.filter((u) => !u.isCustom);
  const customUnis = universities.filter((u) => u.isCustom);

  const filteredCurated = curatedUnis.filter((u) =>
    u.name.toLowerCase().includes(universitySearch.toLowerCase()) ||
    (u.country || "").toLowerCase().includes(universitySearch.toLowerCase())
  );
  const filteredCustom = customUnis.filter((u) =>
    u.name.toLowerCase().includes(universitySearch.toLowerCase()) ||
    (u.country || "").toLowerCase().includes(universitySearch.toLowerCase())
  );

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-zinc-900">Scholarships</h1>
          <p className="mt-1 text-sm text-zinc-500">Rule-based eligibility estimates with plain-English reasons. Not a guarantee.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search scholarships…"
              className="pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Scholarship
          </Button>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48" data-testid="scholarship-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scholarships</SelectItem>
              <SelectItem value="Likely Eligible">Likely eligible</SelectItem>
              <SelectItem value="Possibly Eligible">Possibly eligible</SelectItem>
              <SelectItem value="Not Eligible">Not eligible</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!items ? (
        <div className="grid gap-4 md:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 py-16 text-center">
          <Search className="h-12 w-12 text-zinc-300" />
          <h3 className="mt-4 font-heading text-lg font-semibold text-zinc-900">No matches</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {q ? `Nothing matches "${search}".` : "No scholarships found."}{" "}
            Try a different term or adjust the filter.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => { setSearch(""); setFilter("all"); }}
          >
            Clear search &amp; filters
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((s) => {
            const v = VERDICT[s.eligibility_result?.verdict] || VERDICT["Possibly Eligible"];
            const Icon = v.icon;
            return (
              <div key={s.slug} className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5" data-testid={`scholarship-${s.slug}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-base font-semibold text-zinc-900">{s.name}</h3>
                      {s.verified && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                          <ShieldCheck className="h-3 w-3" /> Verified
                        </span>
                      )}
                      {s.isCustom && !s.verified && (
                        <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600">Custom</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">{s.provider}</p>
                    {s.isCustom && Array.isArray(s.university_slug) && s.university_slug.length > 0 && (
                      <p className="mt-0.5 text-xs text-zinc-400">
                        Linked to: {s.university_slug.map(getUniversityName).join(", ")}
                      </p>
                    )}
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${v.cls}`}>
                    <Icon className="h-3.5 w-3.5" /> {s.eligibility_result?.verdict || "Unknown"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    <Award className="h-3.5 w-3.5" /> {s.coverage_type}
                  </span>
                  <span className="text-zinc-600">{s.coverage_text}</span>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
                  <Calendar className="h-3.5 w-3.5" /> Deadline {s.deadline?.value || "—"}
                  {s.deadline?.status && <StatusBadge status={s.deadline.status} source={s.deadline.source} />}
                </div>

                <ul className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3">
                  {(s.eligibility_result?.reasons || []).map((r, i) => (
                    <li key={i} className="flex gap-2 text-xs leading-relaxed text-zinc-600">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-300" /> {r}
                    </li>
                  ))}
                </ul>

                {s.isCustom && (
                  <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => handleEdit(s)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs text-red-600 hover:text-red-700 hover:border-red-200 hover:bg-red-50"
                      onClick={() => {
                        setDeletingSlug(s.slug);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                )}

                {s.link && (
                  <a href={s.link} target="_blank" rel="noreferrer" className="mt-auto flex items-center gap-1 pt-3 text-sm font-medium text-indigo-600 hover:underline">
                    Learn more <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
          setEditingSlug(null);
          setFormData({
            name: "",
            provider: "",
            coverage_type: "Partial",
            coverage_text: "",
            amount_per_year: "",
            degree_level: "Any",
            field: "Any",
            deadline: "",
            requirements_text: "",
            link: "",
            university_slug: [],
            verified: false,
            min_gpa: "",
            min_ielts: "",
            min_toefl: "",
            need_based: false,
            merit_based: false,
            citizenship: "",
          });
          setUniversitySearch("");
          }
        }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSlug ? "Edit Scholarship" : "Add Custom Scholarship"}</DialogTitle>
            <DialogDescription>
              {editingSlug ? "Update the scholarship details." : "Add a scholarship to track. It will be saved to your account."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label htmlFor="name">Scholarship Name *</Label>
              <Input id="name" name="name" placeholder="e.g., Gates Millennium Scholars" value={formData.name} onChange={handleInputChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider">Provider / Organization</Label>
              <Input id="provider" name="provider" placeholder="e.g., Bill & Melinda Gates Foundation" value={formData.provider} onChange={handleInputChange} />
            </div>

            {/* Eligibility Requirements */}
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
              <p className="text-sm font-medium text-indigo-900">Eligibility Requirements</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="min_gpa">Min GPA (4.0)</Label>
                  <Input id="min_gpa" name="min_gpa" type="number" min="0" max="4.0" step="0.1" placeholder="e.g., 3.5" value={formData.min_gpa} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_ielts">Min IELTS</Label>
                  <Input id="min_ielts" name="min_ielts" type="number" min="0" max="9" step="0.5" placeholder="e.g., 6.5" value={formData.min_ielts} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_toefl">Min TOEFL</Label>
                  <Input id="min_toefl" name="min_toefl" type="number" min="0" max="120" step="1" placeholder="e.g., 92" value={formData.min_toefl} onChange={handleInputChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="degree_level">Degree Level</Label>
                  <Select value={formData.degree_level} onValueChange={(v) => handleSelectChange("degree_level", v)}>
                    <SelectTrigger id="degree_level"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Any">Any</SelectItem>
                      <SelectItem value="Bachelor's">Bachelor's</SelectItem>
                      <SelectItem value="Master's">Master's</SelectItem>
                      <SelectItem value="PhD">PhD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="citizenship">Citizenship</Label>
                  <Input id="citizenship" name="citizenship" placeholder="e.g., Open to all" value={formData.citizenship} onChange={handleInputChange} />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch id="need_based" checked={formData.need_based} onCheckedChange={(v) => setFormData((p) => ({ ...p, need_based: v }))} />
                  <Label htmlFor="need_based" className="text-sm cursor-pointer">Need-based</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="merit_based" checked={formData.merit_based} onCheckedChange={(v) => setFormData((p) => ({ ...p, merit_based: v }))} />
                  <Label htmlFor="merit_based" className="text-sm cursor-pointer">Merit-based</Label>
                </div>
              </div>
            </div>

            {/* Scholarship Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="coverage_type">Coverage</Label>
                <Select value={formData.coverage_type} onValueChange={(v) => handleSelectChange("coverage_type", v)}>
                  <SelectTrigger id="coverage_type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full">Full</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Full Tuition">Full Tuition</SelectItem>
                    <SelectItem value="Partial Tuition">Partial Tuition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount_per_year">Amount/Year (USD)</Label>
                <Input id="amount_per_year" name="amount_per_year" type="number" placeholder="e.g., 10000" value={formData.amount_per_year} onChange={handleInputChange} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="field">Field of Study</Label>
                <Input id="field" name="field" placeholder="e.g., Computer Science" value={formData.field} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Application Deadline</Label>
                <Input id="deadline" name="deadline" type="date" value={formData.deadline} onChange={handleInputChange} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requirements_text">Additional Requirements (free text)</Label>
              <Textarea id="requirements_text" name="requirements_text" placeholder="Describe any other eligibility requirements..." value={formData.requirements_text} onChange={handleInputChange} rows={2} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="link">Application Link</Label>
              <Input id="link" name="link" type="url" placeholder="https://..." value={formData.link} onChange={handleInputChange} />
            </div>

            {/* University Linking */}
            <div className="space-y-2">
              <Label>Linked Universities</Label>
              <Popover open={universitySelectOpen} onOpenChange={setUniversitySelectOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between h-auto min-h-10 py-2 px-3 text-left flex-wrap gap-1.5" type="button">
                    {formData.university_slug?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {formData.university_slug.map((slug) => {
                          const name = getUniversityName(slug);
                          return (
                            <Badge key={slug} variant="secondary" className="gap-1 h-6 pl-2 pr-1.5 text-xs font-normal">
                              {name.length > 20 ? name.slice(0, 18) + "…" : name}
                              <span role="button" tabIndex={0} className="ml-0.5 rounded-sm opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleToggleUniversity(slug); }}>
                                <X className="h-3 w-3" />
                              </span>
                            </Badge>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Select universities (optional)</span>
                    )}
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-auto" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start">
                  <Command className="max-h-64">
                    <CommandInput placeholder="Search universities..." value={universitySearch} onValueChange={setUniversitySearch} />
                    <CommandList>
                      <CommandEmpty>No university found.</CommandEmpty>
                      {filteredCurated.length > 0 && (
                        <CommandGroup heading="Curated Universities">
                          {filteredCurated.map((u) => {
                            const selected = formData.university_slug?.includes(u.slug);
                            return (
                              <CommandItem key={u.slug} value={u.slug} onSelect={() => handleToggleUniversity(u.slug)} className="cursor-pointer">
                                <Check className={`h-4 w-4 mr-2 ${selected ? "opacity-100" : "opacity-0"}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{u.name}</p>
                                  <p className="text-xs text-muted-foreground">{u.country}</p>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      )}
                      {filteredCustom.length > 0 && (
                        <CommandGroup heading="Your Custom Universities">
                          {filteredCustom.map((u) => {
                            const selected = formData.university_slug?.includes(u.slug);
                            return (
                              <CommandItem key={u.slug} value={u.slug} onSelect={() => handleToggleUniversity(u.slug)} className="cursor-pointer">
                                <Check className={`h-4 w-4 mr-2 ${selected ? "opacity-100" : "opacity-0"}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{u.name}</p>
                                  <p className="text-xs text-muted-foreground">{u.country}</p>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Verified Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-zinc-900">Verified scholarship</p>
                  <p className="text-xs text-zinc-500">Link to universities so it appears in fit scores</p>
                </div>
              </div>
              <Switch checked={formData.verified} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, verified: checked }))} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : editingSlug ? "Update Scholarship" : "Save Scholarship"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Scholarship</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this scholarship? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
