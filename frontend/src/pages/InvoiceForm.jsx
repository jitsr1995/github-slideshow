import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmtMoney, todayISO, apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash, ArrowLeft } from "@phosphor-icons/react";
import { toast } from "sonner";

const empty = { description: "", quantity: 1, rate: 0, tax_rate: 0 };

export default function InvoiceForm() {
  const nav = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    customer_id: "",
    issue_date: todayISO(),
    due_date: todayISO(),
    notes: "",
    terms: "Due on receipt",
    status: "draft",
    line_items: [{ ...empty }],
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/contacts", { params: { type: "customer" } }).then((r) => setCustomers(r.data));
    api.get("/items").then((r) => setItems(r.data));
  }, []);

  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    form.line_items.forEach((li) => {
      const s = (Number(li.quantity) || 0) * (Number(li.rate) || 0);
      sub += s;
      tax += s * (Number(li.tax_rate) || 0) / 100;
    });
    return { sub: round(sub), tax: round(tax), total: round(sub + tax) };
  }, [form.line_items]);

  const updLine = (idx, key, val) => {
    const copy = [...form.line_items];
    copy[idx] = { ...copy[idx], [key]: val };
    setForm({ ...form, line_items: copy });
  };

  const applyItem = (idx, itemId) => {
    const it = items.find((x) => x.id === itemId);
    if (!it) return;
    const copy = [...form.line_items];
    copy[idx] = {
      ...copy[idx],
      item_id: itemId,
      description: it.name + (it.description ? ` — ${it.description}` : ""),
      rate: it.sale_price,
      tax_rate: it.tax_rate,
    };
    setForm({ ...form, line_items: copy });
  };

  const addLine = () => setForm({ ...form, line_items: [...form.line_items, { ...empty }] });
  const rmLine = (idx) => setForm({ ...form, line_items: form.line_items.filter((_, i) => i !== idx) });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.customer_id) { toast.error("Select a customer"); return; }
    if (form.line_items.length === 0) { toast.error("Add at least one line"); return; }
    setBusy(true);
    try {
      const payload = {
        ...form,
        line_items: form.line_items.map((li) => ({
          item_id: li.item_id || null,
          description: li.description,
          quantity: Number(li.quantity),
          rate: Number(li.rate),
          tax_rate: Number(li.tax_rate),
        })),
      };
      await api.post("/invoices", payload);
      toast.success("Invoice created");
      nav("/invoices");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} data-testid="invoice-form">
      <PageHeader
        title="New Invoice"
        subtitle="Bill a customer for goods or services"
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => nav("/invoices")} data-testid="invoice-cancel-btn">
              <ArrowLeft size={14} className="mr-1" /> Back
            </Button>
            <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90" data-testid="invoice-save-btn">
              {busy ? "Saving..." : "Save Invoice"}
            </Button>
          </>
        }
      />

      <div className="bg-card border border-border rounded-md p-6 grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div>
          <Label>Customer</Label>
          <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
            <SelectTrigger data-testid="invoice-customer-select"><SelectValue placeholder="Select customer" /></SelectTrigger>
            <SelectContent>
              {customers.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No customers. Create one first.</div>}
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Issue Date</Label>
          <Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} data-testid="invoice-issue-date" />
        </div>
        <div>
          <Label>Due Date</Label>
          <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} data-testid="invoice-due-date" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-md overflow-hidden mb-6">
        <table className="fin-table">
          <thead>
            <tr>
              <th style={{ width: "40%" }}>Description</th>
              <th style={{ width: "15%" }}>Item</th>
              <th className="num" style={{ width: "10%" }}>Qty</th>
              <th className="num" style={{ width: "15%" }}>Rate</th>
              <th className="num" style={{ width: "10%" }}>Tax %</th>
              <th className="num" style={{ width: "10%" }}>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {form.line_items.map((li, idx) => {
              const amount = (Number(li.quantity) || 0) * (Number(li.rate) || 0) * (1 + (Number(li.tax_rate) || 0) / 100);
              return (
                <tr key={idx} data-testid={`line-row-${idx}`}>
                  <td>
                    <Input
                      value={li.description}
                      onChange={(e) => updLine(idx, "description", e.target.value)}
                      placeholder="Description of goods / service"
                      data-testid={`line-desc-${idx}`}
                    />
                  </td>
                  <td>
                    <Select value={li.item_id || ""} onValueChange={(v) => applyItem(idx, v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {items.map((it) => (
                          <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td><Input type="number" step="0.01" className="num" value={li.quantity} onChange={(e) => updLine(idx, "quantity", e.target.value)} /></td>
                  <td><Input type="number" step="0.01" className="num" value={li.rate} onChange={(e) => updLine(idx, "rate", e.target.value)} /></td>
                  <td><Input type="number" step="0.01" className="num" value={li.tax_rate} onChange={(e) => updLine(idx, "tax_rate", e.target.value)} /></td>
                  <td className="num tabular-nums">{fmtMoney(amount)}</td>
                  <td>
                    <Button type="button" variant="ghost" size="sm" onClick={() => rmLine(idx)} data-testid={`line-remove-${idx}`}>
                      <Trash size={14} />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="p-4 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={addLine} data-testid="invoice-add-line-btn">
            <Plus size={14} className="mr-1" /> Add line
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-md p-6 space-y-4">
          <div>
            <Label>Terms</Label>
            <Input value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} data-testid="invoice-terms" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="invoice-notes" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-md p-6" data-testid="invoice-totals">
          <div className="flex justify-between py-2 text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono tabular-nums">{fmtMoney(totals.sub)}</span>
          </div>
          <div className="flex justify-between py-2 text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span className="font-mono tabular-nums">{fmtMoney(totals.tax)}</span>
          </div>
          <div className="flex justify-between pt-4 border-t border-border text-lg">
            <span className="font-heading font-bold text-primary">Total</span>
            <span className="font-heading font-bold text-primary tabular-nums" data-testid="invoice-total-amount">{fmtMoney(totals.total)}</span>
          </div>
        </div>
      </div>
    </form>
  );
}

function round(n) { return Math.round(n * 100) / 100; }
