import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Layout } from "../components/Layout";
import { UniversityCard } from "../components/UniversityCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { SlidersHorizontal, Info, Search, X } from "lucide-react";
import { Input } from "../components/ui/input";

export default function Discover() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState({ countries: [], fields: [] });
  const [data, setData] = useState(null);
  const [country, setCountry] = useState("all");
  const [field, setField] = useState("all");
  const [sort, setSort] = useState("fit");
  const [minFit, setMinFit] = useState("0");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/meta").then((r) => setMeta(r.data));
  }, []);

  useEffect(() => {
    setData(null);
    const params = { sort, min_fit: Number(minFit) };
    if (country !== "all") params.country = country;
    if (field !== "all") params.field = field;
    api.get("/recommendations", { params }).then((r) => setData(r.data));
  }, [country, field, sort, minFit]);

  const q = search.trim().toLowerCase();
  const filteredItems = data && q
    ? data.items.filter((item) =>
        [
          item.university?.name,
          item.university?.country,
          item.university?.city,
          item.top_program?.name,
          item.top_program?.field,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : data?.items;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-zinc-900">Discover universities</h1>
        <p className="mt-1 text-sm text-zinc-500">Ranked by how well they fit your profile. Select up to 5 to compare.</p>
      </div>

      {data && data.completeness.percent < 100 && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" data-testid="estimated-notice">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Your profile is {data.completeness.percent}% complete, so some Fit Scores are marked <b>Estimated</b>.{" "}
          <button className="font-medium underline" onClick={() => navigate("/onboarding")}>Complete it</button> for precise scores.
        </div>
      )}

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search universities or programs…"
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
        <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-500">
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </div>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-40" data-testid="filter-country"><SelectValue placeholder="Country" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {meta.countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={field} onValueChange={setField}>
          <SelectTrigger className="w-44" data-testid="filter-field"><SelectValue placeholder="Field" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All fields</SelectItem>
            {meta.fields.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={minFit} onValueChange={setMinFit}>
          <SelectTrigger className="w-36" data-testid="filter-minfit"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any fit</SelectItem>
            <SelectItem value="70">Fit 70+</SelectItem>
            <SelectItem value="85">Fit 85+</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="ml-auto w-40" data-testid="filter-sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fit">Sort: Best fit</SelectItem>
            <SelectItem value="ranking">Sort: QS ranking</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <p className="text-zinc-600">
            {q && data.items.length > 0
              ? `Nothing matches "${search}".`
              : "No universities match these filters."}
          </p>
          <Button variant="outline" className="mt-3" onClick={() => { setCountry("all"); setField("all"); setMinFit("0"); setSearch(""); }}>Reset filters</Button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-zinc-500" data-testid="results-count">
            {q ? `${filteredItems.length} of ${data.total} matches` : `${data.total} matches`}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <UniversityCard key={item.university.slug} item={item} onOpen={(slug) => navigate(`/university/${slug}`)} />
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
