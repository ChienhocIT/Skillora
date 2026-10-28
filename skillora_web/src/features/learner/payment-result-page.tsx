"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock, CreditCard } from "lucide-react";
import { toast } from "sonner";

import { MarketplaceLayout } from "@/components/marketplace-layout";
import { ErrorState, PageSkeleton } from "@/components/data-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { commerceApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { PaymentCreateResponse } from "@/lib/types";

export function PaymentResultPage() {
  const params = useSearchParams();
  const orderId = params.get("orderId");
  const gateway = params.get("gateway");
  const code = params.get("code");
  const numericOrderId = orderId ? Number(orderId) : null;
  const hasValidOrderId = typeof numericOrderId === "number" && Number.isSafeInteger(numericOrderId) && numericOrderId > 0;

  const order = useQuery({
    queryKey: queryKeys.order(numericOrderId),
    queryFn: () => commerceApi.getOrder(numericOrderId!),
    enabled: hasValidOrderId,
    refetchInterval: (query) => query.state.data?.status === "PENDING" ? 3000 : false,
  });

  const paid = order.data?.status === "PAID";
  const failed = order.data?.status === "FAILED" || order.data?.status === "CANCELLED";

  const retry = useMutation({
    mutationFn: (selectedGateway: "vnpay" | "momo") =>
      commerceApi.createPayment(selectedGateway, numericOrderId!),
    onSuccess: (payment: PaymentCreateResponse) => {
      if (payment.payUrl) {
        window.location.href = payment.payUrl;
      } else {
        toast.error("Could not generate payment URL");
      }
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const canRetry = order.data?.status === "PENDING";

  return (
    <MarketplaceLayout>
      <div className="mx-auto max-w-[600px] px-4 py-12 md:py-16">
        <Card className="shadow-lg">
          <CardContent className="flex flex-col items-center justify-center gap-6 p-8 text-center">
            <div className="rounded-full border bg-muted p-4">
              {paid ? (
                <CheckCircle2 className="h-10 w-10 text-primary" />
              ) : failed ? (
                <AlertCircle className="h-10 w-10 text-destructive" />
              ) : (
                <Clock className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            
            <div className="space-y-1">
              <span className="inline-block">
                <StatusBadge status={paid ? "PAID" : failed ? "FAILED" : "PENDING"} />
              </span>
              <h1 className="text-2xl font-bold tracking-tight mt-2">
                {paid ? "Payment Successful" : failed ? "Payment Failed" : "Pending Gateway Confirmation"}
              </h1>
              <p className="text-sm text-muted-foreground max-w-md">
                {paid
                  ? "Your enrollment is confirmed! The courses are now available in your dashboard."
                  : failed
                    ? "We couldn't process your payment. You can safely retry paying for this order."
                    : "The gateway has not confirmed the transaction. Please wait or refresh to verify."}
              </p>
            </div>

            <div className="grid gap-1.5 text-xs text-muted-foreground bg-muted/30 w-full rounded-md p-3">
              {hasValidOrderId ? <span>Order Reference: #{numericOrderId}</span> : null}
              {gateway ? <span>Gateway: {gateway}</span> : null}
              {code ? <span>Response Code: {code}</span> : null}
              {order.data?.failureReason ? (
                <span className="text-destructive mt-1 block">Reason: {order.data.failureReason}</span>
              ) : null}
            </div>

            {order.isLoading ? <PageSkeleton rows={2} /> : null}
            
            {order.isError ? (
              <ErrorState
                message={(order.error as Error).message}
                onRetry={() => order.refetch()}
              />
            ) : null}

            {canRetry ? (
              <div className="grid gap-2 w-full pt-2 sm:grid-cols-2">
                <Button disabled={retry.isPending} onClick={() => retry.mutate("vnpay")}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Retry VNPay
                </Button>
                <Button variant="outline" disabled={retry.isPending} onClick={() => retry.mutate("momo")}>
                  Retry MoMo
                </Button>
              </div>
            ) : null}

            <Separator />

            <div className="flex flex-wrap gap-2 justify-center w-full">
              {hasValidOrderId ? (
                <Button asChild className="flex-1 min-w-[120px]">
                  <Link href={`/orders/${numericOrderId}`}>View Order</Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" className="flex-1 min-w-[120px]">
                <Link href="/dashboard">My Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MarketplaceLayout>
  );
}
