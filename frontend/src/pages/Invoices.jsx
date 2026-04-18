import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmtMoney, fmtDate } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import EmptyState from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Plus, Trash, PaperPlaneTilt, CurrencyDollar, DownloadSimple, LinkSimple, Envelope } from "@phosphor-icons/react";
import { toast } from "sonner";
import { API } from "@/lib/api";

const EMPTY_IMG = "https://static.prod-images.emergentagent.com/jobs/65ceb719-6bb6-4b6e-ac14-27d56f86879c/images/dc5ad9658e7dcdc2c44624486da479824f2f6f1c4e202fbae5dc0d75dd9a201f.png";

export default function Invoices() {
  const [items, setItems] = useState(null);
  const nav = useNavigate();

  const load = () => api.get("/invoices").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const markSent = async (id) => {
    await api.post(`/invoices/${id}/send`);
    toast.success("Invoice marked as sent");
    load();
  };

  const recordPayment = async (inv) => {
    const amount = prompt(`Record payment for ${inv.invoice_number}. Amount due: ${fmtMoney(inv.balance_due)}`, inv.balance_due);
    if (!amount) return;
    await api.post(`/invoices/${inv.id}/pay`, null, { params: { amount: parseFloat(amount) } });
    toast.success("Payment recorded");
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this invoice?")) return;
    await api.delete(`/invoices/${id}`);
    toast.success("Invoice deleted");
    load();
  };

  const downloadPdf = async (inv) => {
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${API}/invoices/${inv.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { toast.error("Failed to download PDF"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inv.invoice_number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyShareLink = async (inv) => {
    try {
      const { data } = await api.post(`/invoices/${inv.id}/share`);
      const url = `${window.location.origin}/share/invoice/${data.share_token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied", { description: url });
    } catch (e) {
      toast.error("Could not create share link");
    }
  };

  const emailInvoice = async (inv) => {
    try {
      await api.post(`/invoices/${inv.id}/email`);
      toast.success("Invoice emailed");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Unable to send email";
      toast.info("Email not configured", { description: msg });
    }
  };

  if (!items) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div data-testid="invoices-page">
      <PageHeader
        title="Invoices"
        subtitle="Create, send and track invoices to your customers"
        actions={
          <Button className="bg-primary hover:bg-primary/90" onClick={() => nav("/invoices/new")} data-testid="new-invoice-btn">
            <Plus size={16} weight="bold" className="mr-1" /> New Invoice
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          image={EMPTY_IMG}
          title="No invoices yet"
          description="Get paid faster. Create your first invoice and send it in seconds."
          actionLabel="Create Invoice"
          onAction={() => nav("/invoices/new")}
          testid="invoices-empty"
        />
      ) : (
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="fin-table" data-testid="invoices-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Customer</th>
                <th>Issue</th>
                <th>Due</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th className="num">Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((inv) => (
                <tr key={inv.id} data-testid={`invoice-row-${inv.id}`}>
                  <td className="font-mono text-xs">{inv.invoice_number}</td>
                  <td className="font-medium">{inv.customer_name}</td>
                  <td className="text-muted-foreground">{fmtDate(inv.issue_date)}</td>
                  <td className="text-muted-foreground">{fmtDate(inv.due_date)}</td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td className="num">{fmtMoney(inv.total)}</td>
                  <td className="num">{fmtMoney(inv.balance_due)}</td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => downloadPdf(inv)} title="Download PDF" data-testid={`invoice-pdf-${inv.id}`}>
                        <DownloadSimple size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => copyShareLink(inv)} title="Copy share link" data-testid={`invoice-share-${inv.id}`}>
                        <LinkSimple size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => emailInvoice(inv)} title="Email to customer" data-testid={`invoice-email-${inv.id}`}>
                        <Envelope size={14} />
                      </Button>
                      {inv.status === "draft" && (
                        <Button size="sm" variant="ghost" onClick={() => markSent(inv.id)} title="Mark as sent" data-testid={`invoice-send-${inv.id}`}>
                          <PaperPlaneTilt size={14} />
                        </Button>
                      )}
                      {inv.balance_due > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => recordPayment(inv)} title="Record payment" data-testid={`invoice-pay-${inv.id}`}>
                          <CurrencyDollar size={14} />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => remove(inv.id)} title="Delete" data-testid={`invoice-delete-${inv.id}`}>
                        <Trash size={14} />
                      </Button>
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
