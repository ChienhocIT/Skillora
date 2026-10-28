"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckSquare } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/data-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { notificationApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(0);
  const [unreadOnly, setUnreadOnly] = React.useState(false);

  const notifications = useQuery({
    queryKey: queryKeys.notifications({ page, size: 20, unreadOnly }),
    queryFn: () => notificationApi.list({ page, size: 20, unreadOnly }),
  });

  React.useEffect(() => {
    const source = new EventSource(notificationApi.streamUrl());
    const onNotification = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationsRoot });
    };
    source.addEventListener("notification", onNotification);
    return () => {
      source.removeEventListener("notification", onNotification);
      source.close();
    };
  }, [queryClient]);

  const markRead = useMutation({
    mutationFn: (id: number) => notificationApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationsRoot });
      toast.success("Notification marked as read");
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationsRoot });
      toast.success("All notifications marked as read");
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const pageData = notifications.data ?? {
    content: [],
    page: 0,
    size: 0,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  };

  const list = pageData.content;
  const unreadCount = list.filter((n) => !n.read).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Notifications"
          description={`You have ${unreadCount} unread message${unreadCount !== 1 ? "s" : ""}.`}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant={unreadOnly ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setUnreadOnly((value) => !value);
              setPage(0);
            }}
          >
            {unreadOnly ? "Showing unread" : "Unread only"}
          </Button>
          {unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              Mark All Read
            </Button>
          ) : null}
        </div>
      </div>

      {notifications.isLoading ? <PageSkeleton rows={5} /> : null}
      {notifications.isError ? (
        <ErrorState
          message={(notifications.error as Error).message}
          onRetry={() => notifications.refetch()}
        />
      ) : null}

      {notifications.isSuccess && list.length === 0 ? (
        <EmptyState
          title="All caught up"
          message="No notifications or updates for your account at this time."
        />
      ) : null}

      {list.length > 0 ? (
        <div className="grid gap-3">
          {list.map((item) => (
            <Card key={item.id} className={item.read ? "bg-card" : "bg-primary/5 border-primary/20"}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-sm sm:text-base">{item.title ?? "Update"}</p>
                    {!item.read ? (
                      <Badge className="bg-primary hover:bg-primary/95 text-[10px] h-4 py-0">
                        New
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.content ?? item.message}</p>
                  {item.linkUrl ? (
                    <a
                      href={item.linkUrl}
                      className="inline-flex text-xs font-medium text-primary hover:underline"
                    >
                      Open related item
                    </a>
                  ) : null}
                  <p className="text-xs text-muted-foreground pt-1">{formatDate(item.createdAt)}</p>
                </div>
                {!item.read ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    onClick={() => markRead.mutate(item.id)}
                    disabled={markRead.isPending}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Mark Read
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {pageData.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {pageData.page + 1} of {pageData.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pageData.first}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pageData.last}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
