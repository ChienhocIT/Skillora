"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { MarketplaceLayout } from "@/components/marketplace-layout";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/data-state";
import { PageHeader } from "@/components/page-header";
import { CourseThumbnail } from "@/components/course-thumbnail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { commerceApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";


export function CartPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [couponCode, setCouponCode] = React.useState("");
  const [appliedCoupon, setAppliedCoupon] = React.useState<{
    code: string;
    discountType?: string;
    discountValue?: number | string;
  } | null>(null);

  const cart = useQuery({
    queryKey: queryKeys.cart,
    queryFn: () => commerceApi.getCart(),
  });

  const remove = useMutation({
    mutationFn: (courseId: number) => commerceApi.removeFromCart(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      toast.success("Removed from cart");
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const validateCoupon = useMutation({
    mutationFn: (code: string) => commerceApi.validateCoupon(code),
    onSuccess: (data) => {
      setAppliedCoupon({
        code: couponCode.toUpperCase(),
        discountType: data.discountType,
        discountValue: data.discountValue,
      });
      toast.success("Coupon applied successfully");
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const checkout = useMutation({
    mutationFn: () =>
      commerceApi.checkout({ couponCode: appliedCoupon?.code || undefined }),
    onSuccess: (order) => {
      toast.success("Order created");
      queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      queryClient.invalidateQueries({ queryKey: queryKeys.ordersRoot });
      router.push(`/orders/${order.id}`);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    validateCoupon.mutate(couponCode.trim());
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  const cartData = cart.data;
  const items = cartData?.items ?? [];

  // Calculate discount amount based on total/subtotal
  const subtotal = Number(cartData?.subtotal ?? 0);
  let total = Number(cartData?.total ?? subtotal);
  let discountAmount = 0;

  if (appliedCoupon && subtotal > 0) {
    const val = Number(appliedCoupon.discountValue ?? 0);
    if (appliedCoupon.discountType === "PERCENT") {
      discountAmount = (subtotal * val) / 100;
    } else if (appliedCoupon.discountType === "FIXED") {
      discountAmount = val;
    }
    total = Math.max(0, subtotal - discountAmount);
  }

  return (
    <MarketplaceLayout>
      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6">
        <PageHeader
          title="Shopping Cart"
          description="Review your selected courses and proceed to secure checkout."
        />

        {cart.isLoading ? <PageSkeleton rows={4} /> : null}
        {cart.isError ? (
          <ErrorState
            message={(cart.error as Error).message}
            onRetry={() => cart.refetch()}
          />
        ) : null}

        {cart.isSuccess && items.length === 0 ? (
          <EmptyState
            title="Your cart is empty"
            message="Explore our collection of courses and add them to your cart."
            action={
              <Button asChild>
                <Link href="/">Browse courses</Link>
              </Button>
            }
          />
        ) : null}

        {items.length > 0 ? (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
            <section className="space-y-4" aria-label="Selected courses">
              {items.map((item) => (
                <Card key={item.courseId}>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <Link href={`/courses/${item.courseId}`} className="relative hidden aspect-video w-32 shrink-0 overflow-hidden rounded-md sm:block" tabIndex={-1} aria-hidden="true"><CourseThumbnail src={item.thumbnailUrl} title={item.title} sizes="128px" /></Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/courses/${item.courseId}`}
                        className="font-semibold hover:text-primary transition-colors line-clamp-2 text-base"
                      >
                        {item.title}
                      </Link>
                      <p className="text-sm font-semibold mt-1">
                        {formatMoney(item.discountPrice ?? item.price, item.currency)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove.mutate(item.courseId)}
                      disabled={remove.isPending}
                      aria-label={`Remove ${item.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </section>

            <aside className="space-y-5 lg:sticky lg:top-24" aria-label="Checkout summary">
              {/* Coupon card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-primary" />
                    Promo Code
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
                      <div className="font-medium truncate">
                        Applied: {appliedCoupon.code}
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs h-auto p-0 text-destructive hover:no-underline"
                        onClick={handleRemoveCoupon}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleApplyCoupon} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <Label htmlFor="cart-coupon" className="col-span-2">Coupon code</Label>
                      <Input
                        id="cart-coupon"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="Enter coupon code"
                        className="h-11 uppercase"
                        disabled={validateCoupon.isPending}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!couponCode.trim() || validateCoupon.isPending}
                      >
                        Apply
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>

              {/* Order total card */}
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-base">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Original price</span>
                      <span>{formatMoney(subtotal, cartData?.currency)}</span>
                    </div>
                    {discountAmount > 0 ? (
                      <div className="flex justify-between text-primary">
                        <span>Discount</span>
                        <span>-{formatMoney(discountAmount, cartData?.currency)}</span>
                      </div>
                    ) : null}
                  </div>
                  <Separator />
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold text-sm">Total</span>
                    <span className="text-xl font-bold text-foreground">
                      {formatMoney(total, cartData?.currency)}
                    </span>
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={checkout.isPending}
                    onClick={() => checkout.mutate()}
                  >
                    Proceed to Checkout
                  </Button>
                </CardContent>
              </Card>
            </aside>
          </div>
        ) : null}
      </div>
    </MarketplaceLayout>
  );
}
