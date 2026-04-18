import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmtMoney, fmtDate } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import EmptyState from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Plus, Trash, CurrencyDollar } from "@phosphor-icons/react";
import { toast } from "sonner";

const EMPTY_IMG = "https://static.prod-images.emergentagent.com/jobs/65ceb719-6bb6-4b6e-ac14-27d56f86879c/images/dc5ad9658e7dcdc2c44624486da479824f2f6f1c4e202fbae5dc0d75dd9a201f.png";

export default function Bills() {
  const [items, setItems] = useState(null);
  const nav = useNavigate();
  const load = () => api.get("/bills").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const pay = async (bill) => {
    const amt = prompt(`Pay bill ${bill.bill_number}. Balance: ${fmtMoney(bill.balance_due)}`, bill.balance_due);
    if (!amt) return;
    await api.post(`/bills/${bill.id}/pay`, null, { params: { amount: parseFloat(amt) } });
    toast.success("Bill payment recorded");
    load();
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this bill?")) return;
    await api.delete(`/bills/${id}`);
    load();
  };

  if (!items) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div data-testid="bills-page">
      <PageHeader
        title="Bills"
        subtitle="Track bills from your vendors"
        actions={
          <Button className="bg-primary hover:bg-primary/90" onClick={() => nav("/bills/new")} data-testid="new-bill-btn">
            <Plus size={16} className="mr-1" /> New Bill
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState image={EMPTY_IMG} title="No bills yet" description="Record bills from vendors to keep payables in order." actionLabel="Create Bill" onAction={() => nav("/bills/new")} testid="bills-empty" />
      ) : (
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="fin-table" data-testid="bills-table">
            <thead>
              <tr><th>Number</th><th>Vendor</th><th>Issue</th><th>Due</th><th>Status</th><th className="num">Total</th><th className="num">Balance</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} data-testid={`bill-row-${b.id}`}>
                  <td className="font-mono text-xs">{b.bill_number}</td>
                  <td className="font-medium">{b.vendor_name}</td>
                  <td className="text-muted-foreground">{fmtDate(b.issue_date)}</td>
                  <td className="text-muted-foreground">{fmtDate(b.due_date)}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td className="num">{fmtMoney(b.total)}</td>
                  <td className="num">{fmtMoney(b.balance_due)}</td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      {b.balance_due > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => pay(b)} data-testid={`bill-pay-${b.id}`}><CurrencyDollar size={14} /></Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => remove(b.id)} data-testid={`bill-delete-${b.id}`}><Trash size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
