import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash, PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";

const EMPTY_IMG = "https://static.prod-images.emergentagent.com/jobs/65ceb719-6bb6-4b6e-ac14-27d56f86879c/images/dc5ad9658e7dcdc2c44624486da479824f2f6f1c4e202fbae5dc0d75dd9a201f.png";

export default function ContactList({ kind }) {
  // kind: 'customer' | 'vendor'
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const nav = useNavigate();
  const params = useParams();
  const path = typeof window !== "undefined" ? window.location.pathname : "";

  const empty = { type: kind, name: "", email: "", phone: "", company: "", address: "", gstin: "", notes: "" };
  const [form, setForm] = useState(empty);

  const load = () => api.get("/contacts", { params: { type: kind } }).then((r) => setItems(r.data));
  useEffect(() => { load(); setForm({ ...empty, type: kind }); /* eslint-disable-next-line */ }, [kind]);
  useEffect(() => { if (path.endsWith("/new")) setOpen(true); }, [path]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/contacts/${editing}`, form);
        toast.success("Contact updated");
      } else {
        await api.post("/contacts", form);
        toast.success("Contact created");
      }
      setOpen(false); setEditing(null); setForm({ ...empty, type: kind });
      load();
      if (path.endsWith("/new")) nav(kind === "customer" ? "/customers" : "/vendors");
    } catch (e) { toast.error(apiError(e)); }
  };

  const edit = (c) => { setEditing(c.id); setForm({ ...c }); setOpen(true); };
  const remove = async (id) => {
    if (!window.confirm("Delete contact?")) return;
    await api.delete(`/contacts/${id}`);
    load();
  };

  if (!items) return <div className="text-muted-foreground">Loading...</div>;
  const title = kind === "customer" ? "Customers" : "Vendors";
  const sub = kind === "customer" ? "People and companies that pay you" : "People and companies you pay";

  return (
    <div data-testid={`${kind}s-page`}>
      <PageHeader title={title} subtitle={sub} actions={
        <Button className="bg-primary hover:bg-primary/90" onClick={() => { setEditing(null); setForm({ ...empty, type: kind }); setOpen(true); }} data-testid={`new-${kind}-btn`}>
          <Plus size={16} className="mr-1" /> New {kind === "customer" ? "Customer" : "Vendor"}
        </Button>
      } />

      {items.length === 0 ? (
        <EmptyState image={EMPTY_IMG} title={`No ${kind}s yet`} description={`Add your first ${kind} to start tracking ${kind === "customer" ? "invoices" : "bills"}.`} actionLabel={`Add ${kind === "customer" ? "Customer" : "Vendor"}`} onAction={() => setOpen(true)} />
      ) : (
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="fin-table">
            <thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th></th></tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td className="text-muted-foreground">{c.company || "—"}</td>
                  <td className="text-muted-foreground">{c.email || "—"}</td>
                  <td className="text-muted-foreground">{c.phone || "—"}</td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => edit(c)}><PencilSimple size={14} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v && path.endsWith("/new")) nav(kind === "customer" ? "/customers" : "/vendors"); }}>
        <DialogContent data-testid={`${kind}-dialog`}>
          <DialogHeader><DialogTitle className="font-heading">{editing ? "Edit" : "New"} {kind === "customer" ? "Customer" : "Vendor"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid={`${kind}-name-input`} /></div>
              <div><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Tax ID / GSTIN</Label><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" data-testid={`${kind}-submit-btn`}>{editing ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
