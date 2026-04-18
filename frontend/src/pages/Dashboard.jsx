import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { api, fmtMoney, fmtDate } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import KpiCard from "@/components/common/KpiCard";
import StatusBadge from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus } from "@phosphor-icons/react";

const PIE_COLORS = [
  "hsl(40 50% 60%)",
  "hsl(200 60% 55%)",
  "hsl(140 40% 45%)",
  "hsl(10 63% 60%)",
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    api.get("/dashboard/summary").then((r) => setData(r.data)).catch(() => setData({}));
  }, []);

  if (!data) {
    return <div className="text-muted-foreground" data-testid="dashboard-loading">Loading dashboard...</div>;
  }

  const kpis = data.kpis || {};
  const cashFlow = data.cash_flow || [];
  const statusBreakdown = Object.entries(data.invoice_status || {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v }));

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle="A calm overview of your business finances"
        actions={
          <Button className="bg-primary hover:bg-primary/90" onClick={() => nav("/invoices/new")} data-testid="dashboard-new-invoice-btn">
            <Plus size={16} weight="bold" className="mr-1" /> New Invoice
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="dashboard-kpis">
        <KpiCard label="Total Receivables" value={kpis.total_receivables} caption="Outstanding invoices" testid="kpi-receivables" accent />
        <KpiCard label="Total Payables" value={kpis.total_payables} caption="Unpaid bills" testid="kpi-payables" />
        <KpiCard label="Cash Balance" value={kpis.cash_balance} caption="Across bank accounts" testid="kpi-cash" />
        <KpiCard label="Net Profit" value={kpis.net_profit} caption="Income minus expenses" testid="kpi-profit" trend={kpis.net_profit >= 0 ? "up" : "down"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-md p-6" data-testid="dashboard-cashflow-chart">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-heading text-lg font-semibold text-primary">Cash Flow</h3>
              <p className="text-xs text-muted-foreground">Last 6 months of money in vs money out</p>
            </div>
          </div>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={cashFlow} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="hsl(40 15% 92%)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(108 10% 46%)" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="hsl(108 10% 46%)" />
                <Tooltip
                  contentStyle={{ background: "white", border: "1px solid hsl(40 15% 88%)", borderRadius: 6, fontSize: 12 }}
                  formatter={(v) => fmtMoney(v)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" fill="hsl(158 35% 18%)" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expense" fill="hsl(10 63% 60%)" radius={[4, 4, 0, 0]} name="Expense" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-md p-6" data-testid="dashboard-invoice-status">
          <h3 className="font-heading text-lg font-semibold text-primary">Invoice Status</h3>
          <p className="text-xs text-muted-foreground mb-4">By count</p>
          {statusBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No invoices yet</p>
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {statusBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "white", border: "1px solid hsl(40 15% 88%)", borderRadius: 6, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-md overflow-hidden" data-testid="dashboard-recent-invoices">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-heading text-lg font-semibold text-primary">Recent Invoices</h3>
            <button className="text-xs text-accent hover:underline" onClick={() => nav("/invoices")}>View all</button>
          </div>
          <table className="fin-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Customer</th>
                <th>Status</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {(data.recent_invoices || []).length === 0 ? (
                <tr><td colSpan={4} className="text-center text-muted-foreground py-10">No invoices yet</td></tr>
              ) : (
                data.recent_invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="font-mono text-xs">{i.invoice_number}</td>
                    <td>{i.customer_name}</td>
                    <td><StatusBadge status={i.status} /></td>
                    <td className="num">{fmtMoney(i.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-card border border-border rounded-md overflow-hidden" data-testid="dashboard-recent-expenses">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-heading text-lg font-semibold text-primary">Recent Expenses</h3>
            <button className="text-xs text-accent hover:underline" onClick={() => nav("/expenses")}>View all</button>
          </div>
          <table className="fin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Vendor</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(data.recent_expenses || []).length === 0 ? (
                <tr><td colSpan={4} className="text-center text-muted-foreground py-10">No expenses yet</td></tr>
              ) : (
                data.recent_expenses.map((e) => (
                  <tr key={e.id}>
                    <td>{fmtDate(e.date)}</td>
                    <td>{e.category}</td>
                    <td className="text-muted-foreground">{e.vendor_name || "—"}</td>
                    <td className="num">{fmtMoney(e.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
