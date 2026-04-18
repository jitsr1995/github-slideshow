import { Badge } from "@/components/ui/badge";

const STYLES = {
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-[hsl(200_60%_96%)] text-[hsl(200_60%_30%)] border-[hsl(200_60%_85%)]",
  open: "bg-[hsl(200_60%_96%)] text-[hsl(200_60%_30%)] border-[hsl(200_60%_85%)]",
  paid: "bg-[hsl(140_50%_94%)] text-[hsl(140_40%_25%)] border-[hsl(140_40%_80%)]",
  overdue: "bg-[hsl(0_70%_96%)] text-[hsl(0_65%_38%)] border-[hsl(0_70%_85%)]",
};

const LABELS = {
  draft: "Draft",
  sent: "Sent",
  open: "Open",
  paid: "Paid",
  overdue: "Overdue",
};

export default function StatusBadge({ status }) {
  const key = (status || "draft").toLowerCase();
  return (
    <Badge
      variant="outline"
      className={`${STYLES[key] || STYLES.draft} rounded-full px-2.5 py-0.5 font-medium`}
      data-testid={`status-badge-${key}`}
    >
      {LABELS[key] || status}
    </Badge>
  );
}
