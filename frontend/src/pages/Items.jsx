import { useEffect, useState } from "react";
import { api, fmtMoney, apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash, PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";

const EMPTY = { name: "", description: "", type: "service", sku: "", unit: "unit", sale_price: 0, purchase_price: 0, tax_rate: 0 };
const IMG = "https://static.prod-images.emergentagent.com/jobs/65ceb719-6bb6-4b6e-ac14-27d56f86879c/images/dc5ad9658e7dcdc2c44624486da479824f2f6f1c4e202fbae5dc0d75dd9a201f.png";

export default function Items() {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const loc = useLocation();
  const nav = useNavigate();

  const load = () => api.get("/items").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);
  useEffect(() => { if (loc.pathname.endsWith("/new")) setOpen(true); }, [loc.pathname]);

  const submit = async (e) => {
    e.preventDefault();
    const payload = { ...form, sale_price: Number(form.sale_price), purchase_price: Number(form.purchase_price), tax_rate: Number(form.tax_rate) };
    try {
      if (editing) await api.put(`/items/${editing}`, payload);
      else await api.post("/items", payload);
      toast.success("Item saved");
      setOpen(false); setEditing(null); setForm(EMPTY); load();
      if (loc.pathname.endsWith("/new")) nav("/items");
    } catch (e) { toast.error(apiError(e)); }
  };

  const edit = (i) => { setEditing(i.id); setForm(i); setOpen(true); };
  const remove = async (id) => { if (!window.confirm("Delete item?")) return; await api.delete(`/items/${id}`); load(); };

  if (!items) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div data-testid="items-page">
      <PageHeader title="Items & Services" subtitle="Your product catalog for invoices and bills" actions={
        <Button className="bg-primary hover:bg-primary/90" onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }} data-testid="new-item-btn">
          <Plus size={16} className="mr-1" /> New Item
        </Button>
      } />
      {items.length === 0 ? (
        <EmptyState image={IMG} title="No items yet" description="Add products or services you frequently sell." actionLabel="Add Item" onAction={() => setOpen(true)} />
      ) : (
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="fin-table">
            <thead><tr><th>Name</th><th>Type</th><th>SKU</th><th className="num">Sale</th><th className="num">Purchase</th><th className="num">Tax</th><th></th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="font-medium">{i.name}</td>
                  <td className="text-muted-foreground capitalize">{i.type}</td>
                  <td className="text-muted-foreground font-mono text-xs">{i.sku || "—"}</td>
                  <td className="num">{fmtMoney(i.sale_price)}</td>
                  <td className="num">{fmtMoney(i.purchase_price)}</td>
                  <td className="num">{i.tax_rate}%</td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => edit(i)}><PencilSimple size={14} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(i.id)}><Trash size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v && loc.pathname.endsWith("/new")) nav("/items"); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">{editing ? "Edit" : "New"} Item</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="item-name-input" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="goods">Goods</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div><Label>Sale Price</Label><Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} data-testid="item-sale-input" /></div>
              <div><Label>Purchase Price</Label><Input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} /></div>
              <div><Label>Tax Rate %</Label><Input type="number" step="0.01" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} /></div>
              <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" data-testid="item-submit-btn">{editing ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
