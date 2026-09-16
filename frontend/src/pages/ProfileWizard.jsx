import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { Check, ChevronLeft, ChevronRight, Loader2, User, BookOpen, Languages, Target, Globe, Wallet } from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  { key: "personal", label: "Personal", icon: User },
  { key: "academics", label: "Academics", icon: BookOpen },
  { key: "english", label: "English", icon: Languages },
  { key: "interest", label: "Interest", icon: Target },
  { key: "destinations", label: "Destinations", icon: Globe },
  { key: "budget", label: "Budget", icon: Wallet },
];

export default function ProfileWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [meta, setMeta] = useState({ countries: [], fields: [], degree_levels: [] });
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [customCountryInput, setCustomCountryInput] = useState("");
  const [addingCountry, setAddingCountry] = useState(false);

  useEffect(() => {
    (async () => {
      const [m, p] = await Promise.all([api.get("/meta"), api.get("/profile")]);
      setMeta(m.data);
      setForm({ gpa_scale: 4.0, preferred_countries: [], needs_funding: false, ...p.data });
    })();
  }, []);

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleCountry = (c) =>
    setForm((f) => {
      const list = f.preferred_countries || [];
      return { ...f, preferred_countries: list.includes(c) ? list.filter((x) => x !== c) : [...list, c] };
    });

  async function addCustomCountry() {
    const name = customCountryInput.trim();
    if (!name) return;
    const existing = [...(meta.countries || []), ...(form.preferred_countries || [])];
    if (existing.includes(name)) {
      setCustomCountryInput("");
      return;
    }
    setAddingCountry(true);
    try {
      // Add to form preferred_countries (in-memory)
      toggleCountry(name);
      // Persist the full preferred_countries list to the profile
      const updated = (form.preferred_countries || []).includes(name)
        ? form.preferred_countries
        : [...(form.preferred_countries || []), name];
      await api.put("/profile", { preferred_countries: updated });
    } catch {}
    setAddingCountry(false);
    setCustomCountryInput("");
  }

  const saveStep = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      ["gpa", "english_score", "graduation_year", "budget_per_year"].forEach((k) => {
        if (payload[k] === "" || payload[k] == null) delete payload[k];
        else payload[k] = Number(payload[k]);
      });
      await api.put("/profile", payload);
      return true;
    } catch {
      toast.error("Could not save. Try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    const ok = await saveStep();
    if (!ok) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else {
      toast.success("Profile saved! Here are your matches.");
      navigate("/dashboard");
    }
  };

  const current = STEPS[step].key;

  return (
    <div className="min-h-screen bg-[#FAFAFA] px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md  overflow-hidden">
            <img src="/assets/logo.png" alt="UniMatch" className="size-8 object-contain" />
          </div>
          <span className="font-heading text-lg font-bold text-zinc-900">Build your profile</span>
          <button onClick={() => navigate("/dashboard")} className="ml-auto text-sm text-zinc-500 hover:text-zinc-800" data-testid="skip-wizard">
            Skip for now
          </button>
        </div>

        {/* Stepper */}
        <div className="mb-6 flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold ${
                    i < step
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : i === step
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-zinc-300 bg-white text-zinc-400"
                  }`}
                  data-testid={`step-indicator-${s.key}`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </div>
                <span className={`hidden text-[10px] sm:block ${i === step ? "text-indigo-600" : "text-zinc-400"}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`mx-1 h-0.5 flex-1 ${i < step ? "bg-emerald-500" : "bg-zinc-200"}`} />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-7">
          {current === "personal" && (
            <div className="space-y-4" data-testid="step-personal">
              <h2 className="font-heading text-xl font-semibold text-zinc-900">Tell us about you</h2>
              <Field label="Full name">
                <Input value={form.full_name || ""} onChange={(e) => set("full_name", e.target.value)} data-testid="input-full_name" />
              </Field>
              <Field label="Nationality">
                <Input value={form.nationality || ""} onChange={(e) => set("nationality", e.target.value)} placeholder="e.g. India" data-testid="input-nationality" />
              </Field>
              <Field label="Current country of residence">
                <Input value={form.current_country || ""} onChange={(e) => set("current_country", e.target.value)} data-testid="input-current_country" />
              </Field>
            </div>
          )}

          {current === "academics" && (
            <div className="space-y-4" data-testid="step-academics">
              <h2 className="font-heading text-xl font-semibold text-zinc-900">Your academics</h2>
              <div className="grid grid-cols-2 gap-3">
                <Field label="GPA">
                  <Input type="number" step="0.01" value={form.gpa ?? ""} onChange={(e) => set("gpa", e.target.value)} placeholder="e.g. 3.7" data-testid="input-gpa" />
                </Field>
                <Field label="GPA scale">
                  <Select value={String(form.gpa_scale || 4)} onValueChange={(v) => set("gpa_scale", Number(v))}>
                    <SelectTrigger data-testid="select-gpa_scale"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4.0</SelectItem>
                      <SelectItem value="5">5.0</SelectItem>
                      <SelectItem value="10">10.0</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Current education level">
                <Select value={form.education_level || ""} onValueChange={(v) => set("education_level", v)}>
                  <SelectTrigger data-testid="select-education_level"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High School">High School</SelectItem>
                    <SelectItem value="Bachelor">Bachelor's</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Graduation year">
                <Input type="number" value={form.graduation_year ?? ""} onChange={(e) => set("graduation_year", e.target.value)} placeholder="e.g. 2026" data-testid="input-graduation_year" />
              </Field>
            </div>
          )}

          {current === "english" && (
            <div className="space-y-4" data-testid="step-english">
              <h2 className="font-heading text-xl font-semibold text-zinc-900">English proficiency</h2>
              <p className="text-sm text-zinc-500">Leave blank if you haven't taken a test yet — we'll flag those matches as estimated.</p>
              <Field label="Test type">
                <Select value={form.english_test || ""} onValueChange={(v) => set("english_test", v)}>
                  <SelectTrigger data-testid="select-english_test"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IELTS">IELTS</SelectItem>
                    <SelectItem value="TOEFL">TOEFL</SelectItem>
                    <SelectItem value="None">Not taken yet</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {form.english_test && form.english_test !== "None" && (
                <Field label={`${form.english_test} score`}>
                  <Input type="number" step="0.5" value={form.english_score ?? ""} onChange={(e) => set("english_score", e.target.value)} placeholder={form.english_test === "IELTS" ? "e.g. 7.5" : "e.g. 100"} data-testid="input-english_score" />
                </Field>
              )}
            </div>
          )}

          {current === "interest" && (
            <div className="space-y-4" data-testid="step-interest">
              <h2 className="font-heading text-xl font-semibold text-zinc-900">What do you want to study?</h2>
              <Field label="Field of study">
                <Select value={form.field_of_study || ""} onValueChange={(v) => set("field_of_study", v)}>
                  <SelectTrigger data-testid="select-field_of_study"><SelectValue placeholder="Select a field" /></SelectTrigger>
                  <SelectContent>
                    {meta.fields.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Degree level">
                <Select value={form.degree_level || ""} onValueChange={(v) => set("degree_level", v)}>
                  <SelectTrigger data-testid="select-degree_level"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {meta.degree_levels.map((d) => <SelectItem key={d} value={d}>{d}'s</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          {current === "destinations" && (
            <div className="space-y-4" data-testid="step-destinations">
              <h2 className="font-heading text-xl font-semibold text-zinc-900">Preferred destinations</h2>
              <p className="text-sm text-zinc-500">Pick any that appeal — you can still see matches elsewhere.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {meta.countries.map((c) => {
                  const on = (form.preferred_countries || []).includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCountry(c)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        on ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                      }`}
                      data-testid={`country-${c}`}
                    >
                      <Checkbox checked={on} className="pointer-events-none" />
                      <span className="truncate">{c}</span>
                    </button>
                  );
                })}
              </div>
              {/* Custom country input */}
              <div className="flex items-center gap-2 pt-2 border-t border-dashed border-zinc-200">
                <Input
                  placeholder="Add a country not in the list..."
                  value={customCountryInput}
                  onChange={(e) => setCustomCountryInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomCountry())}
                  className="flex-1 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomCountry}
                  disabled={addingCountry || !customCountryInput.trim()}
                >
                  {addingCountry ? "Adding..." : "Add Country"}
                </Button>
              </div>
            </div>
          )}

          {current === "budget" && (
            <div className="space-y-4" data-testid="step-budget">
              <h2 className="font-heading text-xl font-semibold text-zinc-900">Budget & funding</h2>
              <Field label="Maximum annual budget (USD, tuition + living)">
                <Input type="number" value={form.budget_per_year ?? ""} onChange={(e) => set("budget_per_year", e.target.value)} placeholder="e.g. 40000" data-testid="input-budget_per_year" />
              </Field>
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-3">
                <div>
                  <p className="text-sm font-medium text-zinc-800">I need financial aid / scholarships</p>
                  <p className="text-xs text-zinc-500">Boosts need-based scholarship matching.</p>
                </div>
                <Switch checked={!!form.needs_funding} onCheckedChange={(v) => set("needs_funding", v)} data-testid="switch-needs_funding" />
              </div>
            </div>
          )}

          <div className="mt-7 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} data-testid="wizard-back">
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button onClick={next} disabled={saving} className="gap-1 bg-indigo-600 hover:bg-indigo-700" data-testid="wizard-next">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {step === STEPS.length - 1 ? "Finish" : "Continue"}
              {step < STEPS.length - 1 && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
