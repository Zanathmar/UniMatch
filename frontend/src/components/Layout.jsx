import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCompare } from "../context/CompareContext";
import {
  LayoutDashboard,
  Compass,
  User,
  Bookmark,
  CalendarClock,
  Award,
  LogOut,
  GitCompare,
  X,
  Globe,
  School,
  Menu,
} from "lucide-react";
import { Button } from "./ui/button";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/universities", label: "Universities", icon: School },
  { to: "/scholarships", label: "Scholarships", icon: Award },
  // { to: "/research", label: "Web Research", icon: Globe },
  { to: "/saved", label: "Shortlist", icon: Bookmark },
  { to: "/timeline", label: "Timeline", icon: CalendarClock },
  { to: "/onboarding", label: "My Profile", icon: User },
];

function getInitial(name, email) {
  const source = name || email || "";
  return source.trim().charAt(0).toUpperCase() || "?";
}

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const compare = useCompare();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);

  const isActivePath = (to) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const visibleSlugs = compare.slugs.slice(0, 4);
  const extraSlugCount = compare.slugs.length - visibleSlugs.length;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-60 flex-col border-r border-zinc-200 bg-white lg:flex">
        <div className="flex items-center gap-2 border-b border-zinc-200 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 overflow-hidden">
            <img src="/assets/logo.png" alt="UniMatch" className="size-8 object-contain" />
          </div>
          <span className="font-heading text-lg font-bold tracking-tight text-zinc-900">UniMatch</span>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={`nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg py-2 pl-3 pr-3 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-indigo-600 transition-opacity duration-150 ${
                      isActive ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <n.icon
                    className={`h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                      isActive ? "text-indigo-600" : "text-zinc-400 group-hover:text-zinc-600"
                    }`}
                    strokeWidth={1.75}
                  />
                  <span className="truncate">{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-zinc-200 p-3">
          <div className="mb-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">
              {getInitial(user?.name, user?.email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight text-zinc-800">
                {user?.name || "Student"}
              </p>
              <p className="truncate text-xs leading-tight text-zinc-500">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            data-testid="logout-btn"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 outline-none transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div
        ref={mobileMenuRef}
        className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-sm lg:hidden"
      >
        <div className="flex h-16 items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md overflow-hidden">
              <img src="/assets/logo.png" alt="UniMatch" className="size-7 object-contain" />
            </div>
            <span className="font-heading font-bold text-zinc-900">UniMatch</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            data-testid="mobile-menu-toggle"
            className="rounded-md p-1.5 text-zinc-600 outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div
            role="menu"
            className="max-h-[95vh] overflow-y-auto border-t border-zinc-200 bg-white px-2 pb-2 pt-2 shadow-lg"
          >
            {nav.map((n) => {
              const active = isActivePath(n.to);
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  role="menuitem"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid={`mobile-nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                    active ? "bg-indigo-50 text-indigo-700" : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  <span
                    className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-indigo-600 transition-opacity duration-150 ${
                      active ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <n.icon
                    className={`h-[18px] w-[18px] shrink-0 ${
                      active ? "text-indigo-600" : "text-zinc-400"
                    }`}
                    strokeWidth={1.75}
                  />
                  {n.label}
                </NavLink>
              );
            })}

            <div className="my-2 border-t border-zinc-200" />

            <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">
                {getInitial(user?.name, user?.email)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-tight text-zinc-800">
                  {user?.name || "Student"}
                </p>
                <p className="truncate text-xs leading-tight text-zinc-500">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={logout}
              role="menuitem"
              data-testid="logout-btn-mobile"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-600 outline-none transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <main className="lg:pl-60">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>

      {/* Compare floating bar */}
      {compare.slugs.length > 0 && (
        <div
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl transition-all duration-200 lg:left-[calc(50%+7.5rem)] lg:right-auto lg:-translate-x-1/2"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-300 bg-white px-4 py-3 shadow-lg shadow-zinc-900/5">
            <GitCompare className="h-5 w-5 shrink-0 text-indigo-600" />
            <span className="text-sm font-medium text-zinc-800">
              {compare.slugs.length} selected to compare
            </span>
            <span className="hidden flex-wrap gap-1 sm:flex">
              {visibleSlugs.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-600"
                >
                  {s}
                </span>
              ))}
              {extraSlugCount > 0 && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
                  +{extraSlugCount}
                </span>
              )}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={compare.clear}
                data-testid="compare-clear-btn"
                aria-label="Clear comparison"
              >
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