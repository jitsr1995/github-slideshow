import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API, fmtMoney, fmtDate } from "@/lib/api";
import StatusBadge from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { DownloadSimple } from "@phosphor-icons/react";

export default function PublicInvoice() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API}/public/invoices/${token}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.response?.status === 404 ? "This invoice link is no longer valid." : "Unable to load invoice"));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-muted/30">
        <div className="bg-card border border-border rounded-md p-10 max-w-md text-center">
          <h1 className="font-heading text-2xl font-bold text-primary mb-2">Invoice unavailable</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading invoice...</div>;
  }

  const { invoice: inv, customer, organization } = data;

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4" data-testid="public-invoice-page">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-heading font-bold">L</div>
            <div className="font-heading font-bold text-lg text-primary">{organization.name}</div>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90" data-testid="public-download-pdf-btn">
            <a href={`${API}/public/invoices/${token}/pdf`} target="_blank" rel="noopener noreferrer">
              <DownloadSimple size={16} className="mr-1" /> Download PDF
            </a>
          </Button>
        </div>

        <div className="bg-card border border-border rounded-md overflow-hidden">
          <div className="p-8 border-b border-border flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Invoice</div>
              <div className="font-heading text-3xl font-bold text-primary" data-testid="public-invoice-number">{inv.invoice_number}</div>
            </div>
            <StatusBadge status={inv.status} />
          </div>

          <div className="p-8 grid grid-cols-2 gap-6 border-b border-border">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Bill To</div>
              <div className="font-medium">{customer.name}</div>
              {customer.company && <div className="text-sm text-muted-foreground">{customer.company}</div>}
              {customer.email && <div className="text-sm text-muted-foreground">{customer.email}</div>}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Issue Date</div>
                <div>{fmtDate(inv.issue_date)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Due Date</div>
                <div>{fmtDate(inv.due_date)}</div>
              </div>
            </div>
          </div>

          <table className="fin-table">
            <thead><tr><th>Description</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Tax</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {inv.line_items.map((li, i) => {
                const sub = (li.quantity || 0) * (li.rate || 0);
                const amt = sub * (1 + (li.tax_rate || 0) / 100);
                return (
                  <tr key={i}>
                    <td>{li.description}</td>
                    <td className="num">{li.quantity}</td>
                    <td className="num">{fmtMoney(li.rate)}</td>
                    <td className="num">{li.tax_rate}%</td>
                    <td className="num">{fmtMoney(amt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="p-8 border-t border-border">
            <div className="ml-auto max-w-xs space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{fmtMoney(inv.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="font-mono">{fmtMoney(inv.tax_total)}</span></div>
              <div className="flex justify-between pt-2 border-t border-border text-lg">
                <span className="font-heading font-bold text-primary">Total</span>
                <span className="font-heading font-bold text-primary tabular-nums">{fmtMoney(inv.total)}</span>
              </div>
              {inv.amount_paid > 0 && (
                <>
                  <div className="flex justify-between text-muted-foreground"><span>Paid</span><span className="font-mono">-{fmtMoney(inv.amount_paid)}</span></div>
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="font-heading font-bold text-accent">Balance Due</span>
                    <span className="font-heading font-bold text-accent tabular-nums">{fmtMoney(inv.balance_due)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {(inv.notes || inv.terms) && (
            <div className="p-8 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/20">
              {inv.notes && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
                  <div className="text-sm whitespace-pre-wrap">{inv.notes}</div>
                </div>
              )}
              {inv.terms && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Terms</div>
                  <div className="text-sm whitespace-pre-wrap">{inv.terms}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-center text-xs text-muted-foreground mt-8">
          Invoice generated by Ledgerly
        </div>
      </div>
    </div>
  );
}
