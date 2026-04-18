export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between mb-8 gap-6 flex-wrap" data-testid="page-header">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-primary">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
