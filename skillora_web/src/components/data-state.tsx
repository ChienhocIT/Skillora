import { AlertCircle, Inbox } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid gap-5">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: Math.min(rows, 3) }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-[var(--radius-card)]" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={`row-${index}`} className="h-14 rounded-[var(--radius-input)]" />
      ))}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive" className="rounded-[var(--radius-card)] border-destructive/30 bg-destructive/5 p-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2 flex flex-col gap-3">
        <span>{message ?? "Please try again in a moment."}</span>
        {onRetry ? (
          <Button type="button" variant="outline" className="w-fit" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed bg-card/70">
      <CardContent className="flex min-h-56 flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="rounded-[var(--radius-card)] border bg-muted/70 p-4 text-muted-foreground">
          <Inbox className="h-5 w-5" />
        </div>
        <div className="space-y-1.5">
          <h3 className="font-semibold tracking-tight">{title}</h3>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">{message}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
