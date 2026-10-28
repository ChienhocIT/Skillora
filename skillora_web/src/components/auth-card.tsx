import Link from "next/link";
import Image from "next/image";

import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main
      id="main-content"
      className="relative grid min-h-[100dvh] lg:grid-cols-2"
    >
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <aside className="hidden flex-col justify-between border-r bg-muted/40 p-10 lg:flex xl:p-16">
        <BrandLogo href="/" size="lg" />
        <div className="my-10 max-w-xl">
          <div className="relative mb-8 aspect-[3/2] overflow-hidden rounded-xl">
            <Image
              src="/images/learning-hero-v2.png"
              alt="Learning with a laptop and notebook"
              fill
              priority
              sizes="50vw"
              className="object-cover"
            />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">
            Your next chapter starts here.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
            Discover a new interest, build practical skills, and learn at your
            own pace.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-semibold text-primary hover:underline"
        >
          Back to all courses
        </Link>
      </aside>
      <section className="flex min-h-[100dvh] items-center justify-center px-6 py-20">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <BrandLogo href="/" size="lg" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mb-8 mt-3 text-base leading-7 text-muted-foreground">
            {description}
          </p>
          <noscript><p className="mb-4 text-sm text-destructive">Enable JavaScript in your browser to use this form.</p></noscript>
          <div className="space-y-6">{children}</div>
          {footer ? (
            <div className="mt-7 border-t pt-6 text-sm leading-6 text-muted-foreground">
              {footer}
            </div>
          ) : null}
          <p className="mt-10 text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Skillora. All rights reserved.
          </p>
        </div>
      </section>
    </main>
  );
}
