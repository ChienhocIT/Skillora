import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: React.ReactNode;
  detail?: string;
  icon?: LucideIcon;
}) {
  return (
    <Card className="bg-card shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground">{title}</CardTitle>
        {Icon ? (
          <span className="rounded-[var(--radius-button)] bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-[-0.035em] tabular-nums">{value}</div>
        {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}
