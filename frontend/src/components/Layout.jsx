import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCompare } from "../context/CompareContext";
import {
  LayoutDashboard,
  Compass,
  GraduationCap,
  Bookmark,
  CalendarClock,
  Award,
  LogOut,
  GitCompare,
  X,
} from "lucide-react";
import { Button } from "./ui/button";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/scholarships", label: "Scholarships", icon: Award },
  { to: "/saved", label: "Shortlist", icon: Bookmark },
  { to: "/timeline", label: "Timeline", icon: CalendarClock },
  { to: "/onboarding", label: "My Profile", icon: GraduationCap },
];

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const compare = useCompare();

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-60 flex-col border-r border-zinc-200 bg-white lg:flex">
        <div className="flex items-center gap-2 border-b border-zinc-200 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="font-heading text-lg font-bold tracking-tight text-zinc-900">UniMatch</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={`nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`
              }
            >
              <n.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-zinc-200 p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium text-zinc-800">{user?.name || "Student"}</p>
            <p className="truncate text-xs text-zinc-500">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            data-testid="logout-btn"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="font-heading font-bold text-zinc-900">UniMatch</span>
        </div>
        <button onClick={logout} className="text-zinc-500" data-testid="logout-btn-mobile">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
      <nav className="sticky top-[53px] z-30 flex gap-1 overflow-x-auto border-b border-zinc-200 bg-white px-2 py-2 lg:hidden">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${
                isActive ? "bg-indigo-50 text-indigo-700" : "text-zinc-600"
              }`
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>

      {/* Content */}
      <main className="lg:pl-60">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>

      {/* Compare floating bar */}
      {compare.slugs.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 lg:left-[calc(50%+7.5rem)]">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-300 bg-white px-4 py-3 shadow-lg">
            <GitCompare className="h-5 w-5 text-indigo-600" />
            <span className="text-sm font-medium text-zinc-800">
              {compare.slugs.length} selected to compare
            </span>
            <span className="hidden gap-1 sm:flex">
              {compare.slugs.map((s) => (
                <span key={s} className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
                  {s}
                </span>
              ))}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={compare.clear} data-testid="compare-clear-btn">
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={compare.slugs.length < 2}
                onClick={() => navigate(`/compare?slugs=${compare.slugs.join(",")}`)}
                data-testid="compare-go-btn"
              >
                Compare
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Layout;
