import { useEffect, useState } from "react";
import { api, fmtMoney } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function Reports() {
  const [pl, setPl] = useState(null);
  const [bs, setBs] = useState(null);
  const [cf, setCf] = useState(null);

  useEffect(() => {
    api.get("/reports/profit-loss").then((r) => setPl(r.data));
    api.get("/reports/balance-sheet").then((r) => setBs(r.data));
    api.get("/reports/cash-flow").then((r) => setCf(r.data));
  }, []);

  return (
    <div data-testid="reports-page">
      <PageHeader title="Reports" subtitle="Financial statements, on demand" />

      <Tabs defaultValue="pl" className="w-full">
        <TabsList className="bg-muted/40">
          <TabsTrigger value="pl" data-testid="tab-pl">Profit & Loss</TabsTrigger>
          <TabsTrigger value="bs" data-testid="tab-bs">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cf" data-testid="tab-cf">Cash Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="pl" className="mt-6">
          {!pl ? <div className="text-muted-foreground">Loading...</div> : (
            <div className="bg-card border border-border rounded-md overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="font-heading text-xl font-semibold text-primary">Profit & Loss</h2>
                <p className="text-xs text-muted-foreground">All time · USD</p>
              </div>
              <table className="fin-table">
                <thead><tr><th>Account</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  <tr><td colSpan={2} className="bg-muted/30 font-heading font-semibold text-primary">Income</td></tr>
                  {pl.income.map((i) => (<tr key={i.category}><td className="pl-8">{i.category}</td><td className="num">{fmtMoney(i.amount)}</td></tr>))}
                  <tr className="font-semibold"><td>Total Income</td><td className="num">{fmtMoney(pl.total_income)}</td></tr>
                  <tr><td colSpan={2} className="bg-muted/30 font-heading font-semibold text-primary">Expenses</td></tr>
                  {pl.expenses.map((e) => (<tr key={e.category}><td className="pl-8">{e.category}</td><td className="num">{fmtMoney(e.amount)}</td></tr>))}
                  <tr className="font-semibold"><td>Total Expenses</td><td className="num">{fmtMoney(pl.total_expenses)}</td></tr>
                  <tr className="border-t-2 border-primary">
                    <td className="font-heading text-lg font-bold text-primary">Net Profit</td>
                    <td className={`num font-heading text-lg font-bold ${pl.net_profit >= 0 ? "text-[hsl(158_35%_25%)]" : "text-[hsl(10_63%_45%)]"}`} data-testid="pl-net-profit">{fmtMoney(pl.net_profit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="bs" className="mt-6">
          {!bs ? <div className="text-muted-foreground">Loading...</div> : (
            <div className="bg-card border border-border rounded-md overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="font-heading text-xl font-semibold text-primary">Balance Sheet</h2>
                <p className="text-xs text-muted-foreground">As of today · USD</p>
              </div>
              <table className="fin-table">
                <tbody>
                  <tr><td colSpan={2} className="bg-muted/30 font-heading font-semibold text-primary">Assets</td></tr>
                  {bs.assets.map((a) => (<tr key={a.name}><td className="pl-8">{a.name}</td><td className="num">{fmtMoney(a.amount)}</td></tr>))}
                  <tr className="font-semibold"><td>Total Assets</td><td className="num" data-testid="bs-total-assets">{fmtMoney(bs.total_assets)}</td></tr>
                  <tr><td colSpan={2} className="bg-muted/30 font-heading font-semibold text-primary">Liabilities</td></tr>
                  {bs.liabilities.map((l) => (<tr key={l.name}><td className="pl-8">{l.name}</td><td className="num">{fmtMoney(l.amount)}</td></tr>))}
                  <tr className="font-semibold"><td>Total Liabilities</td><td className="num">{fmtMoney(bs.total_liabilities)}</td></tr>
                  <tr><td colSpan={2} className="bg-muted/30 font-heading font-semibold text-primary">Equity</td></tr>
                  {bs.equity.map((eq) => (<tr key={eq.name}><td className="pl-8">{eq.name}</td><td className="num">{fmtMoney(eq.amount)}</td></tr>))}
                  <tr className="font-semibold"><td>Total Equity</td><td className="num">{fmtMoney(bs.total_equity)}</td></tr>
                  <tr className="border-t-2 border-primary">
                    <td className="font-heading text-lg font-bold text-primary">Liabilities + Equity</td>
                    <td className="num font-heading text-lg font-bold text-primary">{fmtMoney(bs.total_liabilities + bs.total_equity)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cf" className="mt-6">
          {!cf ? <div className="text-muted-foreground">Loading...</div> : (
            <div className="bg-card border border-border rounded-md overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-xl font-semibold text-primary">Cash Flow</h2>
                  <p className="text-xs text-muted-foreground">All recorded bank transactions</p>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground mr-2">Net:</span>
                  <span className={`font-heading font-bold text-lg ${cf.net_cash_flow >= 0 ? "text-[hsl(158_35%_25%)]" : "text-[hsl(10_63%_45%)]"}`} data-testid="cf-net">{fmtMoney(cf.net_cash_flow)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 p-6 bg-muted/20 border-b border-border">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Total Inflow</div>
                  <div className="font-heading text-2xl font-bold text-[hsl(158_35%_25%)] mt-1">{fmtMoney(cf.total_inflow)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Total Outflow</div>
                  <div className="font-heading text-2xl font-bold text-[hsl(10_63%_45%)] mt-1">{fmtMoney(cf.total_outflow)}</div>
                </div>
              </div>
              <table className="fin-table">
                <thead><tr><th>Date</th><th>Description</th><th>Category</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {cf.transactions.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-muted-foreground py-10">No transactions</td></tr>
                  ) : cf.transactions.map((t) => (
                    <tr key={t.id}>
                      <td>{t.date?.slice(0, 10)}</td>
                      <td>{t.description}</td>
                      <td className="text-muted-foreground">{t.category || "—"}</td>
                      <td className={`num ${t.amount >= 0 ? "text-[hsl(158_35%_25%)]" : "text-[hsl(10_63%_45%)]"}`}>
                        {t.amount >= 0 ? "+" : "−"}{fmtMoney(Math.abs(t.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
