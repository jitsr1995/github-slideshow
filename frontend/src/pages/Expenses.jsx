import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmtMoney, fmtDate, todayISO, apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

const EMPTY_IMG = "https://static.prod-images.emergentagent.com/jobs/65ceb719-6bb6-4b6e-ac14-27d56f86879c/images/ce1cc7b2fd252ee23ac90d7cf1d071dbbb8370ff99058e7c140606ee22de2e48.png";

const CATEGORIES = ["Travel", "Meals & Entertainment", "Office Supplies", "Rent", "Utilities", "Marketing", "Software & Subscriptions", "Professional Services", "Other"];

export default function Expenses() {
  const [items, setItems] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const path = typeof window !== "undefined" ? window.location.pathname : "";

  const [form, setForm] = useState({
    date: todayISO(),
    category: "Office Supplies",
    amount: 0,
    vendor_id: "",
    payment_method: "bank",
    notes: "",
    reference: "",
  });

  const load = () => api.get("/expenses").then((r) => setItems(r.data));

  useEffect(() => { load(); api.get("/contacts", { params: { type: "vendor" } }).then((r) => setVendors(r.data)); }, []);
  useEffect(() => { if (path.endsWith("/new")) setOpen(true); }, [path]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/expenses", { ...form, amount: Number(form.amount), vendor_id: form.vendor_id || null });
      toast.success("Expense recorded");
      setOpen(false);
      setForm({ ...form, amount: 0, notes: "", reference: "" });
      load();
      if (path.endsWith("/new")) nav("/expenses");
    } catch (e) { toast.error(apiError(e)); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete expense?")) return;
    await api.delete(`/expenses/${id}`);
    load();
  };

  if (!items) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div data-testid="expenses-page">
      <PageHeader
        title="Expenses"
        subtitle="Log day-to-day business expenses"
        actions={
          <Button className="bg-primary hover:bg-primary/90" onClick={() => setOpen(true)} data-testid="new-expense-btn">
            <Plus size={16} className="mr-1" /> New Expense
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState image={EMPTY_IMG} title="No expenses yet" description="Track every dollar. Log your first business expense." actionLabel="Record Expense" onAction={() => setOpen(true)} testid="expenses-empty" />
      ) : (
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="fin-table" data-testid="expenses-table">
            <thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Method</th><th>Reference</th><th className="num">Amount</th><th></th></tr></thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.date)}</td>
                  <td>{e.category}</td>
                  <td className="text-muted-foreground">{e.vendor_name || "—"}</td>
                  <td className="text-muted-foreground capitalize">{e.payment_method}</td>
                  <td className="text-muted-foreground font-mono text-xs">{e.reference || "—"}</td>
                  <td className="num">{fmtMoney(e.amount)}</td>
                  <td><Button variant="ghost" size="sm" onClick={() => remove(e.id)} data-testid={`expense-delete-${e.id}`}><Trash size={14} /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v && path.endsWith("/new")) nav("/expenses"); }}>
        <DialogContent data-testid="expense-dialog">
          <DialogHeader><DialogTitle className="font-heading">Record Expense</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
              <div><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required data-testid="expense-amount-input" /></div>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="expense-category-select"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vendor (optional)</Label>
              <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Receipt # or note" /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" data-testid="expense-submit-btn">Save Expense</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
