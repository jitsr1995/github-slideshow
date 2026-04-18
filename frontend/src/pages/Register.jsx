import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Register() {
  const { register, error, setError } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await register(form.name, form.email, form.password);
    setBusy(false);
    if (ok) nav("/");
  };

  const upd = (k) => (e) => { setError(null); setForm({ ...form, [k]: e.target.value }); };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="login-art hidden lg:block" />
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-12">
            <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-heading font-bold text-lg">
              L
            </div>
            <div className="font-heading font-bold text-2xl text-primary">Ledgerly</div>
          </div>
          <h1 className="font-heading text-4xl font-bold text-primary mb-2">Open your books.</h1>
          <p className="text-muted-foreground mb-10">Create an account in seconds. No credit card needed.</p>

          <form onSubmit={submit} className="space-y-5" data-testid="register-form">
            <div>
              <Label htmlFor="name">Your name</Label>
              <Input id="name" value={form.name} onChange={upd("name")} required data-testid="register-name-input" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={upd("email")} required data-testid="register-email-input" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={upd("password")} required minLength={6} data-testid="register-password-input" />
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2" data-testid="register-error">
                {error}
              </div>
            )}
            <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11" data-testid="register-submit-btn">
              {busy ? "Creating..." : "Create account"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground mt-8">
            Already have an account?{" "}
            <Link to="/login" className="text-accent font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
