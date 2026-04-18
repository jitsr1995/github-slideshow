import { useEffect, useState } from "react";
import { api, API, apiError, fmtDate } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash, ShieldCheck } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

const ROLE_STYLES = {
  admin: "bg-[hsl(158_35%_90%)] text-[hsl(158_35%_18%)] border-[hsl(158_35%_70%)]",
  accountant: "bg-[hsl(40_50%_92%)] text-[hsl(40_50%_25%)] border-[hsl(40_50%_75%)]",
  viewer: "bg-muted text-muted-foreground border-border",
};
const ROLE_DESC = {
  admin: "Full access, can manage team",
  accountant: "Full access to books, no team management",
  viewer: "Read-only access",
};

const EMPTY = { name: "", email: "", password: "", role: "accountant" };

export default function Team() {
  const { user: me } = useAuth();
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = () => api.get("/team").then((r) => setItems(r.data));
  useEffect(() => { if (me && me.role === "admin") load(); }, [me]);

  if (me && me.role !== "admin") return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/team", form);
      toast.success("Team member added");
      setOpen(false); setForm(EMPTY); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const setRole = async (u, role) => {
    try {
      await api.put(`/team/${u.id}/role`, { role });
      toast.success("Role updated");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const remove = async (u) => {
    if (!window.confirm(`Remove ${u.name}?`)) return;
    try {
      await api.delete(`/team/${u.id}`);
      toast.success("Member removed");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  if (!items) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div data-testid="team-page">
      <PageHeader
        title="Team"
        subtitle="Invite teammates and manage their access to your books"
        actions={
          <Button className="bg-primary hover:bg-primary/90" onClick={() => setOpen(true)} data-testid="invite-member-btn">
            <Plus size={16} className="mr-1" /> Add Member
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Object.entries(ROLE_DESC).map(([role, desc]) => (
          <div key={role} className="bg-card border border-border rounded-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={16} className="text-primary" weight="duotone" />
              <Badge variant="outline" className={`${ROLE_STYLES[role]} capitalize rounded-full`}>{role}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-md overflow-hidden">
        <table className="fin-table" data-testid="team-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th></th></tr></thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} data-testid={`team-row-${u.id}`}>
                <td className="font-medium">
                  {u.name} {u.id === me?.id && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                </td>
                <td className="text-muted-foreground">{u.email}</td>
                <td>
                  <Select value={u.role} onValueChange={(v) => setRole(u, v)} disabled={u.id === me?.id}>
                    <SelectTrigger className="h-8 w-36" data-testid={`team-role-${u.id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="accountant">Accountant</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="text-muted-foreground text-sm">{fmtDate(u.created_at)}</td>
                <td>
                  <div className="flex justify-end">
                    {u.id !== me?.id && (
                      <Button variant="ghost" size="sm" onClick={() => remove(u)} data-testid={`team-delete-${u.id}`}><Trash size={14} /></Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="team-dialog">
          <DialogHeader><DialogTitle className="font-heading">Add Team Member</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="team-name-input" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required data-testid="team-email-input" /></div>
            <div><Label>Initial Password</Label><Input type="text" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required data-testid="team-password-input" /><p className="text-xs text-muted-foreground mt-1">Share this securely. They can change it after first login.</p></div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — Full access, team management</SelectItem>
                  <SelectItem value="accountant">Accountant — Full books access</SelectItem>
                  <SelectItem value="viewer">Viewer — Read-only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" data-testid="team-submit-btn">Add Member</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
