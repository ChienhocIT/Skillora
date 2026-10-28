"use client";

import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Heart, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { StarRating } from "@/components/course-card";
import { MarketplaceLayout } from "@/components/marketplace-layout";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/data-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { commerceApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

export function WishlistPage() {
  const queryClient = useQueryClient();

  const wishlist = useQuery({
    queryKey: queryKeys.wishlist,
    queryFn: () => commerceApi.getWishlist(),
  });

  const remove = useMutation({
    mutationFn: (courseId: number) => commerceApi.removeFromWishlist(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist });
      toast.success("Removed from wishlist");
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const addToCart = useMutation({
    mutationFn: (courseId: number) => commerceApi.addToCart(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      toast.success("Added to cart");
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const items = wishlist.data ?? [];

  return (
    <MarketplaceLayout>
      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6">
        <PageHeader
          title="Wishlist"
          description={`${items.length} course${items.length !== 1 ? "s" : ""} saved`}
        />

        {wishlist.isLoading ? <PageSkeleton rows={4} /> : null}
        {wishlist.isError ? (
          <ErrorState
            message={(wishlist.error as Error).message}
            onRetry={() => wishlist.refetch()}
          />
        ) : null}

        {wishlist.isSuccess && items.length === 0 ? (
          <EmptyState
            title="Your wishlist is empty"
            message="Browse the catalog and save courses you're interested in."
            action={
              <Button asChild>
                <Link href="/">
                  <Heart className="mr-2 h-4 w-4" />
                  Browse courses
                </Link>
              </Button>
            }
          />
        ) : null}

        <div className="grid gap-4">
          {items.map((item, index) => (
            <Card key={item.courseId} className="course-card">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
                <Link
                  href={`/courses/${item.slug ?? item.courseId}`}
                  className="relative aspect-video w-full shrink-0 overflow-hidden rounded-[var(--radius-input)] bg-muted sm:w-44"
                >
                  {item.thumbnailUrl ? (
                    <Image
                      src={item.thumbnailUrl}
                      alt={item.title}
                      fill
                      sizes="(min-width: 640px) 176px, 100vw"
                      priority={index < 2}
                      className="course-card-image object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <BookOpen className="h-6 w-6" />
                    </div>
                  )}
                </Link>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/courses/${item.slug ?? item.courseId}`}
                        className="font-semibold hover:text-primary transition-colors line-clamp-1"
                      >
                        {item.title}
                      </Link>
                      {item.instructorName ? (
                        <p className="text-xs text-muted-foreground">{item.instructorName}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="font-bold">
                        {formatMoney(item.discountPrice ?? item.price, item.currency)}
                      </p>
                      {item.discountPrice ? (
                        <p className="text-xs text-muted-foreground line-through">
                          {formatMoney(item.price, item.currency)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StarRating rating={item.avgRating} count={item.totalReviews} />
                    {item.level ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {item.level.replace("_", " ")}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => addToCart.mutate(item.courseId)}
                      disabled={addToCart.isPending}
                    >
                      <ShoppingCart className="mr-2 h-3.5 w-3.5" />
                      Add to cart
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove.mutate(item.courseId)}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MarketplaceLayout>
  );
}
