import { ArrowUp, ArrowDown } from "@phosphor-icons/react";
import { fmtMoney } from "@/lib/api";

export default function KpiCard({ label, value, caption, trend, testid, money = true, accent = false }) {
  return (
    <div
      className={`bg-card border border-border rounded-md p-5 flex flex-col gap-2 hover:-translate-y-0.5 hover:shadow-sm transition ${accent ? "ring-1 ring-accent/30" : ""}`}
      data-testid={testid}
    >
      <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground font-medium">{label}</div>
      <div className="font-heading text-3xl font-bold text-primary tabular-nums">
        {money ? fmtMoney(value) : value}
      </div>
      {caption && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {trend === "up" && <ArrowUp size={12} className="text-[hsl(140_40%_35%)]" />}
          {trend === "down" && <ArrowDown size={12} className="text-[hsl(0_65%_45%)]" />}
          {caption}
        </div>
      )}
    </div>
  );
}
