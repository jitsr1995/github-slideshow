import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash, PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";

const TYPE_STYLES = {
  asset: "bg-[hsl(140_50%_94%)] text-[hsl(140_40%_25%)] border-[hsl(140_40%_80%)]",
  liability: "bg-[hsl(10_63%_94%)] text-[hsl(10_63%_35%)] border-[hsl(10_63%_80%)]",
  equity: "bg-[hsl(200_60%_94%)] text-[hsl(200_60%_30%)] border-[hsl(200_60%_80%)]",
  income: "bg-[hsl(158_35%_90%)] text-[hsl(158_35%_18%)] border-[hsl(158_35%_70%)]",
  expense: "bg-[hsl(40_50%_92%)] text-[hsl(40_50%_25%)] border-[hsl(40_50%_75%)]",
};
const EMPTY = { code: "", name: "", type: "asset", description: "" };

export default function Accounts() {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const load = () => api.get("/accounts").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/accounts/${editing}`, form);
      else await api.post("/accounts", form);
      setOpen(false); setEditing(null); setForm(EMPTY); load();
      toast.success("Account saved");
    } catch (e) { toast.error(apiError(e)); }
  };
  const edit = (a) => { setEditing(a.id); setForm(a); setOpen(true); };
  const remove = async (id) => { if (!window.confirm("Delete account?")) return; await api.delete(`/accounts/${id}`); load(); };

  if (!items) return <div className="text-muted-foreground">Loading...</div>;

  const grouped = items.reduce((acc, a) => {
    (acc[a.type] ||= []).push(a);
    return acc;
  }, {});
  const order = ["asset", "liability", "equity", "income", "expense"];

  return (
    <div data-testid="accounts-page">
      <PageHeader title="Chart of Accounts" subtitle="The backbone of your bookkeeping" actions={
        <Button className="bg-primary hover:bg-primary/90" onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }} data-testid="new-account-btn">
          <Plus size={16} className="mr-1" /> New Account
        </Button>
      } />

      <div className="space-y-6">
        {order.map((t) => (
          grouped[t]?.length ? (
            <div key={t} className="bg-card border border-border rounded-md overflow-hidden">
              <div className="px-6 py-3 border-b border-border bg-muted/30">
                <div className="font-heading font-semibold text-primary capitalize">{t} Accounts</div>
              </div>
              <table className="fin-table">
                <thead><tr><th style={{width:"12%"}}>Code</th><th>Name</th><th>Type</th><th>Description</th><th></th></tr></thead>
                <tbody>
                  {grouped[t].map((a) => (
                    <tr key={a.id}>
                      <td className="font-mono text-xs">{a.code}</td>
                      <td className="font-medium">{a.name}</td>
                      <td><Badge variant="outline" className={`${TYPE_STYLES[a.type]} capitalize rounded-full`}>{a.type}</Badge></td>
                      <td className="text-muted-foreground">{a.description || "—"}</td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => edit(a)}><PencilSimple size={14} /></Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash size={14} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">{editing ? "Edit" : "New"} Account</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required data-testid="account-code-input" /></div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {order.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="account-name-input" /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" data-testid="account-submit-btn">{editing ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
