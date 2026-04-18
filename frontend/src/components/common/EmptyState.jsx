import { Button } from "@/components/ui/button";

export default function EmptyState({ image, title, description, actionLabel, onAction, testid }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-lg bg-card"
      data-testid={testid || "empty-state"}
    >
      {image && (
        <img
          src={image}
          alt=""
          className="w-40 h-40 object-contain mb-6 opacity-90"
        />
      )}
      <h3 className="font-heading text-xl font-semibold text-primary mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="empty-state-action"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
