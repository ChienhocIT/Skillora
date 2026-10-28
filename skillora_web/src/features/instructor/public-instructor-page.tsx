"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Globe, MapPin, PlayCircle, UserRound } from "lucide-react";

import { EmptyState, ErrorState, PageSkeleton } from "@/components/data-state";
import { MarketplaceLayout } from "@/components/marketplace-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { publicInstructorApi } from "@/lib/api";

export function PublicInstructorPage({ instructorId }: { instructorId: number }) {
  const instructor = useQuery({
    queryKey: ["public-instructor", instructorId],
    queryFn: () => publicInstructorApi.get(instructorId),
    enabled: Number.isFinite(instructorId),
  });

  const profile = instructor.data;
  const displayName = profile?.fullName ?? "Skillora Instructor";

  return (
    <MarketplaceLayout>
      <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
        {instructor.isLoading ? <PageSkeleton rows={4} /> : null}
        {instructor.isError ? (
          <ErrorState
            message={(instructor.error as Error).message}
            onRetry={() => instructor.refetch()}
          />
        ) : null}
        {profile ? (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <Card>
              <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                {profile.avatarUrl ? (
                  <Image
                    src={profile.avatarUrl}
                    alt={displayName}
                    width={128}
                    height={128}
                    priority
                    className="h-32 w-32 rounded-[var(--radius-panel)] border object-cover"
                  />
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center rounded-[var(--radius-panel)] border bg-primary/10 text-primary">
                    <UserRound className="h-12 w-12" />
                  </div>
                )}
                <div className="space-y-1">
                  <h1 className="text-xl font-bold">{displayName}</h1>
                  {profile.title ?? profile.headline ? (
                    <p className="text-sm text-muted-foreground">{profile.title ?? profile.headline}</p>
                  ) : null}
                  {profile.verified ? <Badge>Verified instructor</Badge> : null}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardContent className="space-y-4 p-6">
                  <div>
                    <h2 className="text-lg font-semibold">About</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                      {profile.bio || profile.expertise || "This instructor has not added a bio yet."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {profile.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {profile.location}
                      </span>
                    ) : null}
                    {profile.website ? (
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Globe className="h-4 w-4" />
                        Website
                      </a>
                    ) : null}
                    {profile.introVideoUrl ? (
                      <a
                        href={profile.introVideoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <PlayCircle className="h-4 w-4" />
                        Intro video
                      </a>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
              <EmptyState
                title="Keep exploring"
                message="Discover more subjects and published courses in the Skillora catalog."
                action={
                  <Button asChild>
                    <Link href="/">Browse catalog</Link>
                  </Button>
                }
              />
            </div>
          </div>
        ) : null}
      </div>
    </MarketplaceLayout>
  );
}
