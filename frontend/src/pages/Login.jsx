import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login, error, setError } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@ledgerly.app");
  const [password, setPassword] = useState("admin123");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await login(email, password);
    setBusy(false);
    if (ok) nav("/");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="login-art hidden lg:block" data-testid="login-art" />
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-12">
            <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-heading font-bold text-lg">
              L
            </div>
            <div className="font-heading font-bold text-2xl text-primary">Ledgerly</div>
          </div>
          <h1 className="font-heading text-4xl font-bold text-primary mb-2">Welcome back.</h1>
          <p className="text-muted-foreground mb-10">
            Sign in to manage your books with calm confidence.
          </p>

          <form onSubmit={submit} className="space-y-5" data-testid="login-form">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setError(null); setEmail(e.target.value); }}
                data-testid="login-email-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setError(null); setPassword(e.target.value); }}
                data-testid="login-password-input"
                required
              />
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2" data-testid="login-error">
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11"
              data-testid="login-submit-btn"
            >
              {busy ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground mt-8">
            New to Ledgerly?{" "}
            <Link to="/register" className="text-accent font-medium hover:underline" data-testid="login-register-link">
              Create an account
            </Link>
          </p>

          <div className="mt-10 p-4 bg-muted/40 border border-border rounded-md text-xs text-muted-foreground">
            <div className="font-semibold text-foreground mb-1">Demo credentials</div>
            admin@ledgerly.app / admin123
          </div>
        </div>
      </div>
    </div>
  );
}
