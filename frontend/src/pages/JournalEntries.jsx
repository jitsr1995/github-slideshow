import { useEffect, useMemo, useState } from "react";
import { api, fmtMoney, fmtDate, todayISO, apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

const IMG = "https://static.prod-images.emergentagent.com/jobs/65ceb719-6bb6-4b6e-ac14-27d56f86879c/images/dc5ad9658e7dcdc2c44624486da479824f2f6f1c4e202fbae5dc0d75dd9a201f.png";

export default function JournalEntries() {
  const [items, setItems] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    date: todayISO(),
    reference: "",
    narration: "",
    lines: [
      { account_id: "", debit: 0, credit: 0, description: "" },
      { account_id: "", debit: 0, credit: 0, description: "" },
    ],
  });

  const load = () => api.get("/journal-entries").then((r) => setItems(r.data));
  useEffect(() => {
    load();
    api.get("/accounts").then((r) => setAccounts(r.data));
  }, []);

  const totals = useMemo(() => {
    const d = form.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const c = form.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { d, c, balanced: Math.round(d * 100) === Math.round(c * 100) && d > 0 };
  }, [form.lines]);

  const updLine = (i, k, v) => {
    const c = [...form.lines];
    c[i] = { ...c[i], [k]: v };
    setForm({ ...form, lines: c });
  };
  const addLine = () => setForm({ ...form, lines: [...form.lines, { account_id: "", debit: 0, credit: 0, description: "" }] });
  const rmLine = (i) => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) });

  const submit = async (e) => {
    e.preventDefault();
    if (!totals.balanced) { toast.error("Debits and credits must be equal and non-zero"); return; }
    try {
      await api.post("/journal-entries", {
        date: form.date,
        reference: form.reference,
        narration: form.narration,
        lines: form.lines.map((l) => ({
          account_id: l.account_id,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description,
        })),
      });
      toast.success("Journal entry posted");
      setOpen(false);
      setForm({ date: todayISO(), reference: "", narration: "", lines: [{ account_id: "", debit: 0, credit: 0, description: "" }, { account_id: "", debit: 0, credit: 0, description: "" }] });
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const remove = async (id) => { if (!window.confirm("Delete entry?")) return; await api.delete(`/journal-entries/${id}`); load(); };
  const acctName = (id) => accounts.find((a) => a.id === id)?.name || "—";

  if (!items) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div data-testid="journal-page">
      <PageHeader title="Journal Entries" subtitle="Manual double-entry bookkeeping" actions={
        <Button className="bg-primary hover:bg-primary/90" onClick={() => setOpen(true)} data-testid="new-journal-btn">
          <Plus size={16} className="mr-1" /> New Entry
        </Button>
      } />

      {items.length === 0 ? (
        <EmptyState image={IMG} title="No journal entries" description="Post manual journal entries for adjustments and opening balances." actionLabel="Create Entry" onAction={() => setOpen(true)} />
      ) : (
        <div className="space-y-4">
          {items.map((j) => (
            <div key={j.id} className="bg-card border border-border rounded-md overflow-hidden">
              <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-muted/20">
                <div>
                  <div className="font-mono text-xs text-muted-foreground">{fmtDate(j.date)} · {j.reference || "—"}</div>
                  <div className="font-medium">{j.narration || "(no narration)"}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">Total: <span className="font-mono font-semibold text-primary">{fmtMoney(j.total)}</span></div>
                  <Button variant="ghost" size="sm" onClick={() => remove(j.id)}><Trash size={14} /></Button>
                </div>
              </div>
              <table className="fin-table">
                <thead><tr><th>Account</th><th>Description</th><th className="num">Debit</th><th className="num">Credit</th></tr></thead>
                <tbody>
                  {j.lines.map((l, idx) => (
                    <tr key={idx}>
                      <td>{acctName(l.account_id)}</td>
                      <td className="text-muted-foreground">{l.description || "—"}</td>
                      <td className="num">{l.debit > 0 ? fmtMoney(l.debit) : "—"}</td>
                      <td className="num">{l.credit > 0 ? fmtMoney(l.credit) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle className="font-heading">New Journal Entry</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
              <div><Label>Narration</Label><Input value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} /></div>
            </div>
            <div className="border border-border rounded-md overflow-hidden">
              <table className="fin-table">
                <thead><tr><th style={{width:"30%"}}>Account</th><th style={{width:"30%"}}>Description</th><th className="num" style={{width:"17%"}}>Debit</th><th className="num" style={{width:"17%"}}>Credit</th><th></th></tr></thead>
                <tbody>
                  {form.lines.map((l, idx) => (
                    <tr key={idx}>
                      <td>
                        <Select value={l.account_id} onValueChange={(v) => updLine(idx, "account_id", v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td><Input value={l.description} onChange={(e) => updLine(idx, "description", e.target.value)} /></td>
                      <td><Input type="number" step="0.01" className="num" value={l.debit} onChange={(e) => updLine(idx, "debit", e.target.value)} /></td>
                      <td><Input type="number" step="0.01" className="num" value={l.credit} onChange={(e) => updLine(idx, "credit", e.target.value)} /></td>
                      <td><Button type="button" variant="ghost" size="sm" onClick={() => rmLine(idx)}><Trash size={14} /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus size={14} className="mr-1" /> Add line</Button>

            <div className={`flex items-center justify-between p-3 rounded-md text-sm ${totals.balanced ? "bg-[hsl(140_50%_94%)] text-[hsl(140_40%_25%)]" : "bg-[hsl(0_70%_96%)] text-[hsl(0_65%_38%)]"}`}>
              <span>Debits: <span className="font-mono font-semibold">{fmtMoney(totals.d)}</span> · Credits: <span className="font-mono font-semibold">{fmtMoney(totals.c)}</span></span>
              <span className="font-semibold">{totals.balanced ? "Balanced" : "Not balanced"}</span>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={!totals.balanced} data-testid="journal-submit-btn">Post Entry</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
