import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

function useRedirectIfAuthed(to) {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) navigate(to, { replace: true });
    // run once on mount: redirect only pre-existing sessions, not fresh submits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#fafafa]overflow-hidden">
            <img src="/assets/logo.png" alt="UniMatch" className="size-8 object-contain" />
          </div>
          <span className="font-heading text-xl font-bold tracking-tight text-zinc-900">UniMatch</span>
        </Link>
        <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  useRedirectIfAuthed("/dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Sign in" subtitle="Continue building your university shortlist.">
      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" data-testid="login-email" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-indigo-600 hover:underline" data-testid="forgot-link">
              Forgot?
            </Link>
          </div>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1.5" data-testid="login-password" />
        </div>
        {error && <p className="text-sm text-red-600" data-testid="login-error">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="login-submit">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-zinc-500">
        New here?{" "}
        <Link to="/register" className="font-medium text-indigo-600 hover:underline" data-testid="to-register">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  useRedirectIfAuthed("/dashboard");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, name);
      toast.success("Account created!");
      navigate("/onboarding");
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Free. Takes under a minute.">
      <form onSubmit={submit} className="space-y-4" data-testid="register-form">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" data-testid="register-name" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" data-testid="register-email" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-1.5" data-testid="register-password" />
          <p className="mt-1 text-xs text-zinc-400">At least 6 characters.</p>
        </div>
        {error && <p className="text-sm text-red-600" data-testid="register-error">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="register-submit">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create account
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-indigo-600 hover:underline" data-testid="to-login">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const api = (await import("../lib/api")).default;
      const { data } = await api.post("/auth/forgot-password", { email });
      setSent(true);
      if (data.debug_token) setToken(data.debug_token);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset password" subtitle="We'll send you a reset link if the email exists.">
      {sent ? (
        <div className="space-y-4" data-testid="forgot-sent">
          <p className="text-sm text-zinc-600">
            If an account exists for <b>{email}</b>, a reset link has been generated.
          </p>
          {token && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="mb-1 font-medium">Demo mode — use this reset link:</p>
              <Link to={`/reset-password?token=${token}`} className="break-all font-mono text-indigo-700 underline" data-testid="reset-demo-link">
                /reset-password?token={token}
              </Link>
            </div>
          )}
          <Link to="/login" className="block text-center text-sm font-medium text-indigo-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" data-testid="forgot-form">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" data-testid="forgot-email" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="forgot-submit">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send reset link
          </Button>
          <Link to="/login" className="block text-center text-sm font-medium text-indigo-600 hover:underline">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const [token] = useState(params.get("token") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const api = (await import("../lib/api")).default;
      await api.post("/auth/reset-password", { token, password });
      toast.success("Password updated. Please sign in.");
      navigate("/login");
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you'll remember.">
      <form onSubmit={submit} className="space-y-4" data-testid="reset-form">
        <div>
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-1.5" data-testid="reset-password" />
        </div>
        {error && <p className="text-sm text-red-600" data-testid="reset-error">{error}</p>}
        <Button type="submit" disabled={loading || !token} className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="reset-submit">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update password
        </Button>
      </form>
    </AuthShell>
  );
}
