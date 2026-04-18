import { useEffect, useState } from "react";
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

const IMG = "https://static.prod-images.emergentagent.com/jobs/65ceb719-6bb6-4b6e-ac14-27d56f86879c/images/ce1cc7b2fd252ee23ac90d7cf1d071dbbb8370ff99058e7c140606ee22de2e48.png";

export default function Banking() {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: todayISO(), description: "", amount: 0, reference: "", category: "", direction: "in" });

  const load = () => api.get("/banking/transactions").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const signedAmount = form.direction === "in" ? Math.abs(Number(form.amount)) : -Math.abs(Number(form.amount));
      await api.post("/banking/transactions", {
        date: form.date,
        description: form.description,
        amount: signedAmount,
        reference: form.reference,
        category: form.category,
      });
      toast.success("Transaction recorded");
      setOpen(false);
      setForm({ date: todayISO(), description: "", amount: 0, reference: "", category: "", direction: "in" });
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const remove = async (id) => { if (!window.confirm("Delete transaction?")) return; await api.delete(`/banking/transactions/${id}`); load(); };

  if (!items) return <div className="text-muted-foreground">Loading...</div>;

  const balance = items.reduce((s, t) => s + (t.amount || 0), 0);
  const inflow = items.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflow = items.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div data-testid="banking-page">
      <PageHeader title="Banking" subtitle="Reconcile money in and out of your accounts" actions={
        <Button className="bg-primary hover:bg-primary/90" onClick={() => setOpen(true)} data-testid="new-txn-btn">
          <Plus size={16} className="mr-1" /> New Transaction
        </Button>
      } />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-md p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Current Balance</div>
          <div className="font-heading text-3xl font-bold text-primary mt-2" data-testid="banking-balance">{fmtMoney(balance)}</div>
        </div>
        <div className="bg-card border border-border rounded-md p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Money In</div>
          <div className="font-heading text-3xl font-bold text-[hsl(158_35%_25%)] mt-2">{fmtMoney(inflow)}</div>
        </div>
        <div className="bg-card border border-border rounded-md p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Money Out</div>
          <div className="font-heading text-3xl font-bold text-[hsl(10_63%_45%)] mt-2">{fmtMoney(outflow)}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState image={IMG} title="No transactions yet" description="Record deposits, withdrawals, and transfers." actionLabel="Record Transaction" onAction={() => setOpen(true)} />
      ) : (
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="fin-table">
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Reference</th><th className="num">Amount</th><th></th></tr></thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td>{fmtDate(t.date)}</td>
                  <td className="font-medium">{t.description}</td>
                  <td className="text-muted-foreground">{t.category || "—"}</td>
                  <td className="text-muted-foreground font-mono text-xs">{t.reference || "—"}</td>
                  <td className={`num ${t.amount >= 0 ? "text-[hsl(158_35%_25%)]" : "text-[hsl(10_63%_45%)]"}`}>
                    {t.amount >= 0 ? "+" : "−"}{fmtMoney(Math.abs(t.amount))}
                  </td>
                  <td><Button variant="ghost" size="sm" onClick={() => remove(t.id)}><Trash size={14} /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">New Transaction</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div>
                <Label>Type</Label>
                <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Deposit (money in)</SelectItem>
                    <SelectItem value="out">Withdrawal (money out)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required data-testid="txn-desc-input" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required data-testid="txn-amount-input" /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            </div>
            <div><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" data-testid="txn-submit-btn">Record</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
