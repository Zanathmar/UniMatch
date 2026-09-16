import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { Layout } from "../components/Layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ExternalLink, Key, AlertCircle, Globe, Search, Trash2, Zap } from "lucide-react";

export default function Research() {
  const [settings, setSettings] = useState(null);
  const [keyInput, setKeyInput] = useState("");
  const [keySaving, setKeySaving] = useState(false);
  const [keyError, setKeyError] = useState("");

  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [limits, setLimits] = useState(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [searched, setSearched] = useState(false);
  const [savedSlugs, setSavedSlugs] = useState({}); // slug -> true

  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState("");
  const [customCountry, setCustomCountry] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [field, setField] = useState("Any");
  const [degree, setDegree] = useState("Any");
  const [query, setQuery] = useState("");

  // Load settings on mount
  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data)).catch(() => setSettings(null));
  }, []);

  // Load countries list for dropdown
  useEffect(() => {
    api.get("/meta").then((r) => {
      const list = r.data.countries || [];
      setCountries(list);
      if (list.length > 0) setCountry(list[0]);
    }).catch(() => {});
  }, []);

  const hasKey = settings?.serp_api_key_set || settings?.global_key_set;

  async function saveKey() {
    setKeySaving(true);
    setKeyError("");
    try {
      const payload = keyInput.trim() === "" ? { serp_api_key: "" } : { serp_api_key: keyInput.trim() };
      await api.put("/settings", payload);
      const r = await api.get("/settings");
      setSettings(r.data);
      setKeyInput("");
    } catch (e) {
      setKeyError(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setKeySaving(false);
    }
  }

  async function doSearch(e) {
    e.preventDefault();
    if (!country) return;
    setSearching(true);
    setSearchError("");
    setResults(null);
    setLimits(null);
    setSetupNeeded(false);
    setSearched(true);
    try {
      const effectiveCountry = showCustom ? customCountry.trim() : country;
      const params = { country: effectiveCountry, field, degree, num: 10 };
      if (query.trim()) params.query = query.trim();
      const r = await api.get("/research/scholarships", { params });
      setResults(r.data.results || []);
      setLimits(r.data.limits);
      setSetupNeeded(r.data.setup_needed === true);
      if (r.data.results?.length === 0 && r.data.setup_needed) {
        setSearchError("No API key configured — search requires a SerpAPI key.");
      }
    } catch (err) {
      setSearchError(formatApiErrorDetail(err.response?.data?.detail) || "Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  }

  async function saveScholarship(r) {
    const slug = r.link || r.title;
    if (savedSlugs[slug]) return; // already saved
    try {
      await api.post("/custom/scholarships", {
        name: r.title,
        provider: r.domain || "",
        coverage_text: r.snippet || "",
        link: r.link || "",
        degree_level: degree !== "Any" ? degree : "Any",
        field: field !== "Any" ? field : "Any",
        source: "custom",
        verified: false,
      });
      setSavedSlugs((prev) => ({ ...prev, [slug]: true }));
    } catch (e) {
      // silently fail — user can retry
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-zinc-900">Web Research</h1>
        <p className="mt-1 text-sm text-zinc-500">Search for scholarships across the web using Google search.</p>
      </div>

      {/* Setup Banner — shown when no API key is configured */}
      {!hasKey && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 flex gap-4">
          <div className="mt-0.5 shrink-0">
            <Zap className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-base font-semibold text-amber-900">Set up search to get started</h2>
            <p className="mt-1 text-sm text-amber-700">
              Web search requires a free SerpAPI key. It gives you <strong>100 searches per month</strong> at no cost.
            </p>
            <div className="mt-3 flex flex-col sm:flex-row gap-3 sm:items-center">
              <Input
                type="text"
                placeholder="Paste your SerpAPI key here"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="flex-1 font-mono text-sm border-amber-300 focus:border-amber-500"
              />
              <Button
                onClick={saveKey}
                disabled={keySaving || !keyInput.trim()}
                className="shrink-0 bg-amber-600 hover:bg-amber-700"
              >
                {keySaving ? "Saving..." : "Save Key"}
              </Button>
              <a
                href="https://serpapi.com"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm text-amber-700 hover:text-amber-900 flex items-center gap-1 underline"
              >
                Get free key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {keyError && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> {keyError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Search Form */}
      <form onSubmit={doSearch} className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="font-heading text-base font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-zinc-400" />
          Search Scholarships
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Country</label>
            <Select value={showCustom ? "__custom__" : country} onValueChange={(v) => {
              if (v === "__custom__") { setShowCustom(true); setCustomCountry(""); }
              else { setShowCustom(false); setCountry(v); }
            }}>
              <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent>
                {countries.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                <SelectItem value="__custom__">Other (specify)...</SelectItem>
              </SelectContent>
            </Select>
            {showCustom && (
              <Input
                placeholder="Type country name..."
                value={customCountry}
                onChange={(e) => setCustomCountry(e.target.value)}
                className="flex-1 text-sm mt-2"
                autoFocus
              />
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Field of Study</label>
            <Select value={field} onValueChange={setField}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Any", "Computer Science", "Engineering", "Business", "Medicine", "Law", "Arts", "Economics", "Data Science"].map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Degree Level</label>
            <Select value={degree} onValueChange={setDegree}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Any", "Bachelor", "Master", "PhD"].map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Custom query (optional)</label>
            <Input
              placeholder="e.g. fully funded, tuition waiver..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" disabled={searching || (!country && !customCountry.trim())}>
            {searching ? "Searching..." : "Search"}
          </Button>
          {searchError && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" /> {searchError}
            </p>
          )}
        </div>
      </form>

      {/* Usage Stats */}
      {limits && (
        <div className="mb-4 flex items-center gap-3 text-xs text-zinc-500">
          <span>Today: <b>{limits.searches_used}</b> / {limits.searches_limit} searches used</span>
          {limits.resets_at && (
            <span>· Resets {new Date(limits.resets_at).toLocaleDateString()}</span>
          )}
          {limits.api_key_source && (
            <span className={`rounded border px-1.5 py-0.5 ${
              limits.api_key_source === "user" ? "bg-blue-50 text-blue-600 border-blue-200" :
              limits.api_key_source === "global" ? "bg-amber-50 text-amber-600 border-amber-200" :
              "bg-zinc-100 text-zinc-500 border-zinc-200"
            }`}>
              {limits.api_key_source === "user" ? "Your key" :
               limits.api_key_source === "global" ? "Global key" : "No key"}
            </span>
          )}
        </div>
      )}

      {/* Empty state before search */}
      {!searched && !searching && (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 py-16 text-center">
          <Globe className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
          <p className="text-sm text-zinc-400">Select a country and click Search to find scholarships</p>
        </div>
      )}

      {/* No results */}
      {searched && results !== null && results.length === 0 && !searching && (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 py-16 text-center">
          {setupNeeded ? (
            <>
              <Zap className="mx-auto h-8 w-8 text-amber-400 mb-2" />
              <p className="text-sm font-medium text-zinc-700">No API key configured</p>
              <p className="mt-1 text-sm text-zinc-500">Add your free SerpAPI key above to enable search. You get 100 searches/month free.</p>
              <a
                href="https://serpapi.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
              >
                Get free key at serpapi.com <ExternalLink className="h-3 w-3" />
              </a>
            </>
          ) : (
            <>
              <Globe className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
              <p className="text-sm text-zinc-400">No scholarships found for this search. Try a different country or query.</p>
            </>
          )}
        </div>
      )}

      {/* Results */}
      {results !== null && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-500">{results.length} result{results.length !== 1 ? "s" : ""} found</p>
          {results.map((r, i) => {
            const src = r.source || "web";
            const sourceLabel = {
              google: { text: "Google", cls: "bg-blue-50 text-blue-700 border-blue-200" },
              scholarshipportal: { text: "Portal", cls: "bg-green-50 text-green-700 border-green-200" },
              bing: { text: "Bing", cls: "bg-sky-50 text-sky-700 border-sky-200" },
            };
            const label = sourceLabel[src] || { text: src, cls: "bg-zinc-50 text-zinc-600 border-zinc-200" };
            return (
              <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading text-sm font-semibold text-zinc-900 leading-snug">{r.title}</h3>
                    <span className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-xs font-medium ${label.cls}`}>
                      {label.text}
                    </span>
                    {r.domain && (
                      <span className="ml-1.5 text-xs text-zinc-400">{r.domain}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => saveScholarship(r)}
                      disabled={savedSlugs[r.link || r.title]}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        savedSlugs[r.link || r.title]
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200 cursor-default"
                          : "border-zinc-200 text-zinc-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600"
                      }`}
                    >
                      {savedSlugs[r.link || r.title] ? "Saved" : "Save"}
                    </button>
                    {r.link && (
                      <a
                        href={r.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-zinc-200 p-2 hover:bg-zinc-50 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4 text-zinc-400" />
                      </a>
                    )}
                  </div>
                </div>
                {r.snippet && (
                  <p className="mt-2 text-xs text-zinc-600 leading-relaxed">{r.snippet}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
