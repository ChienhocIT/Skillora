export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/65 pb-6 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2.5">
        <h1 className="text-2xl font-black leading-tight tracking-[-0.03em] text-balance md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-base leading-7 text-pretty text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
