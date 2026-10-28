import { Suspense } from "react";
import { connection } from "next/server";
import { CatalogPage } from "@/features/catalog/catalog-page";
import { PageSkeleton } from "@/components/data-state";

export default async function HomePage() {
  await connection();
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <CatalogPage />
    </Suspense>
  );
}

