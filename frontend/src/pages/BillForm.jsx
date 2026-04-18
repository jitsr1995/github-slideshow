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

export default function BillForm() {
  const nav = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    vendor_id: "",
    issue_date: todayISO(),
    due_date: todayISO(),
    notes: "",
    status: "open",
    line_items: [{ ...empty }],
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/contacts", { params: { type: "vendor" } }).then((r) => setVendors(r.data));
    api.get("/items").then((r) => setItems(r.data));
  }, []);

  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    form.line_items.forEach((li) => {
      const s = (Number(li.quantity) || 0) * (Number(li.rate) || 0);
      sub += s;
      tax += s * (Number(li.tax_rate) || 0) / 100;
    });
    return { sub: r(sub), tax: r(tax), total: r(sub + tax) };
  }, [form.line_items]);

  const updLine = (i, k, v) => {
    const c = [...form.line_items];
    c[i] = { ...c[i], [k]: v };
    setForm({ ...form, line_items: c });
  };
  const applyItem = (idx, id) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const c = [...form.line_items];
    c[idx] = { ...c[idx], item_id: id, description: it.name, rate: it.purchase_price || it.sale_price, tax_rate: it.tax_rate };
    setForm({ ...form, line_items: c });
  };
  const addLine = () => setForm({ ...form, line_items: [...form.line_items, { ...empty }] });
  const rmLine = (i) => setForm({ ...form, line_items: form.line_items.filter((_, j) => j !== i) });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.vendor_id) { toast.error("Select a vendor"); return; }
    setBusy(true);
    try {
      await api.post("/bills", {
        ...form,
        line_items: form.line_items.map((li) => ({
          item_id: li.item_id || null,
          description: li.description,
          quantity: Number(li.quantity),
          rate: Number(li.rate),
          tax_rate: Number(li.tax_rate),
        })),
      });
      toast.success("Bill created");
      nav("/bills");
    } catch (e) {
      toast.error(apiError(e));
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} data-testid="bill-form">
      <PageHeader title="New Bill" subtitle="Record a bill from a vendor" actions={
        <>
          <Button type="button" variant="outline" onClick={() => nav("/bills")}><ArrowLeft size={14} className="mr-1" /> Back</Button>
          <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90" data-testid="bill-save-btn">{busy ? "Saving..." : "Save Bill"}</Button>
        </>
      } />

      <div className="bg-card border border-border rounded-md p-6 grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div>
          <Label>Vendor</Label>
          <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
            <SelectTrigger data-testid="bill-vendor-select"><SelectValue placeholder="Select vendor" /></SelectTrigger>
            <SelectContent>
              {vendors.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Issue Date</Label>
          <Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
        </div>
        <div>
          <Label>Due Date</Label>
          <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-md overflow-hidden mb-6">
        <table className="fin-table">
          <thead>
            <tr><th style={{width:"40%"}}>Description</th><th style={{width:"15%"}}>Item</th><th className="num" style={{width:"10%"}}>Qty</th><th className="num" style={{width:"15%"}}>Rate</th><th className="num" style={{width:"10%"}}>Tax %</th><th className="num" style={{width:"10%"}}>Amount</th><th></th></tr>
          </thead>
          <tbody>
            {form.line_items.map((li, idx) => {
              const amount = (Number(li.quantity) || 0) * (Number(li.rate) || 0) * (1 + (Number(li.tax_rate) || 0)/100);
              return (
                <tr key={idx}>
                  <td><Input value={li.description} onChange={(e) => updLine(idx, "description", e.target.value)} data-testid={`bill-desc-${idx}`} /></td>
                  <td>
                    <Select value={li.item_id || ""} onValueChange={(v) => applyItem(idx, v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td><Input type="number" step="0.01" className="num" value={li.quantity} onChange={(e) => updLine(idx, "quantity", e.target.value)} /></td>
                  <td><Input type="number" step="0.01" className="num" value={li.rate} onChange={(e) => updLine(idx, "rate", e.target.value)} /></td>
                  <td><Input type="number" step="0.01" className="num" value={li.tax_rate} onChange={(e) => updLine(idx, "tax_rate", e.target.value)} /></td>
                  <td className="num tabular-nums">{fmtMoney(amount)}</td>
                  <td><Button type="button" variant="ghost" size="sm" onClick={() => rmLine(idx)}><Trash size={14} /></Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="p-4 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus size={14} className="mr-1" /> Add line</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-md p-6">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="bg-card border border-border rounded-md p-6">
          <div className="flex justify-between py-2 text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{fmtMoney(totals.sub)}</span></div>
          <div className="flex justify-between py-2 text-sm"><span className="text-muted-foreground">Tax</span><span className="font-mono">{fmtMoney(totals.tax)}</span></div>
          <div className="flex justify-between pt-4 border-t border-border text-lg"><span className="font-heading font-bold text-primary">Total</span><span className="font-heading font-bold text-primary">{fmtMoney(totals.total)}</span></div>
        </div>
      </div>
    </form>
  );
}

function r(n){return Math.round(n*100)/100;}
