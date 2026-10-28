"use client";

import Link from "next/link";

import { MarketplaceHeader } from "@/components/marketplace-header";
import { BrandLogo } from "@/components/brand-logo";

export function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-surface flex min-h-[100dvh] flex-col bg-background">
      <MarketplaceHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <footer className="border-t bg-muted/40">
        <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-10 md:grid-cols-[1fr_auto] md:px-6 lg:px-10">
          <div>
            <BrandLogo href="/" size="md" />
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              Make room for what you want to learn next.
            </p>
          </div>
          <nav
            className="flex flex-wrap items-start gap-x-8 gap-y-4 text-sm font-medium"
            aria-label="Footer"
          >
            <Link
              href="/terms"
              className="transition-colors hover:text-foreground"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="/help"
              className="transition-colors hover:text-foreground"
            >
              Help
            </Link>
          </nav>
          <p className="text-xs text-muted-foreground md:col-span-2">
            &copy; {new Date().getFullYear()} Skillora. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
