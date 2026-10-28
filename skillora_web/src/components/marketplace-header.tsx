"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import {
  Bell,
  Bot,
  ChevronDown,
  Heart,
  LogOut,
  Menu,
  Search,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { authApi, commerceApi, courseApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

function initials(name?: string) {
  return (name ?? "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const navLinks = [
  { href: "/", label: "Browse" },
  { href: "/chat", label: "Skillora AI", auth: true },
  { href: "/dashboard", label: "My Learning", auth: true, roles: ["STUDENT"] },
  {
    href: "/instructor",
    label: "Instructor",
    auth: true,
    roles: ["INSTRUCTOR"],
  },
  { href: "/admin", label: "Admin", auth: true, roles: ["ADMIN"] },
];

export function MarketplaceHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = React.useState("");
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false);

  const { data: user } = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authApi.me(),
    retry: false,
  });

  const { data: cart } = useQuery({
    queryKey: queryKeys.cart,
    queryFn: () => commerceApi.getCart(),
    retry: false,
    enabled: user?.roles?.includes("STUDENT") ?? false,
  });

  const logout = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.clear();
      toast.success("Signed out");
      router.push("/login");
    },
    onError: () => {
      queryClient.clear();
      router.push("/login");
    },
  });

  const cartCount = cart?.items?.length ?? 0;
  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => courseApi.categories(),
  });

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (searchValue.trim()) {
      router.push(`/?search=${encodeURIComponent(searchValue.trim())}`);
      setMobileOpen(false);
      setMobileSearchOpen(false);
    }
  };

  const visibleLinks = navLinks.filter((link) => {
    if (!link.auth) return true;
    if (!user) return false;
    if (!link.roles) return true;
    return user.roles?.some((role) => link.roles?.includes(role));
  });

  return (
    <header className="marketplace-header sticky top-0 z-40 w-full border-b bg-background">
      <div className="mx-auto flex h-[4.5rem] max-w-[1600px] items-center gap-2 px-4 md:gap-4 md:px-6">
        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden hover:bg-accent/60"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(22rem,calc(100vw-2rem))]">
            <SheetTitle>
              <BrandLogo size="md" variant="full" />
            </SheetTitle>
            <SheetDescription className="sr-only">
              Browse courses and open your Skillora workspace.
            </SheetDescription>
            <nav className="mt-6 grid gap-1">
              {visibleLinks.map((link) => {
                const active =
                  pathname === link.href ||
                  (link.href !== "/" && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center rounded-[var(--radius-button)] px-3 text-sm font-semibold text-muted-foreground transition-all hover:bg-accent hover:text-foreground",
                      active && "bg-primary/10 text-primary",
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-5 grid gap-1 border-t pt-4">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/?categoryId=${category.id}`}
                  onClick={() => setMobileOpen(false)}
                  className="min-h-11 rounded-md px-3 py-3 text-sm hover:bg-accent"
                >
                  {category.name}
                </Link>
              ))}
              {!user ? (
                <>
                  <Link href="/login" className="px-3 py-3 font-semibold">
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    className="px-3 py-3 font-semibold text-primary"
                  >
                    Sign up
                  </Link>
                </>
              ) : null}
              <div className="flex items-center justify-between px-3 py-2 text-sm">
                Appearance <ThemeToggle />
              </div>
            </div>
            <form onSubmit={handleSearch} className="mt-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search courses..."
                  aria-label="Search courses in menu"
                  className="h-11 rounded-[var(--radius-input)] pl-9 text-sm"
                />
              </div>
            </form>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <BrandLogo
          size="md"
          variant="full"
          href="/"
          className="shrink-0 hidden md:inline-flex"
        />
        <BrandLogo
          size="sm"
          variant="full"
          href="/"
          className="shrink-0 md:hidden"
        />

        {/* Desktop nav links */}
        <nav className="hidden items-center gap-1 md:flex">
          {visibleLinks
            .filter((link) => link.href === "/")
            .map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-2 py-3 text-sm font-medium text-foreground transition-colors hover:text-primary",
                    active && "bg-accent/70 text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Course categories"
              >
                <ChevronDown aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Explore a subject</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {categories.map((category) => (
                <DropdownMenuItem key={category.id} asChild>
                  <Link href={`/?categoryId=${category.id}`}>
                    {category.name}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem asChild>
                <Link href="/">All courses</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="hidden min-w-0 flex-1 md:block"
          role="search"
        >
          <div className="relative group">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search for anything..."
              aria-label="Search for anything"
              className="h-12 rounded-full border border-foreground/50 bg-muted/30 pl-11 text-sm focus-visible:bg-background"
            />
          </div>
        </form>

        <div className="flex-1 md:hidden" />

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          <nav
            className="hidden items-center xl:flex"
            aria-label="Your workspaces"
          >
            {visibleLinks
              .filter((link) => link.href !== "/")
              .map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="whitespace-nowrap px-3 py-3 text-sm font-medium hover:text-primary"
                >
                  {link.label}
                </Link>
              ))}
          </nav>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search courses"
            className="rounded-full hover:bg-accent/50 md:hidden"
            onClick={() => setMobileSearchOpen((open) => !open)}
          >
            {mobileSearchOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>

          {user ? (
            <Button
              asChild
              variant="ghost"
              size="icon"
              aria-label="Ask AI"
              className="hidden rounded-full hover:bg-accent/50 lg:inline-flex xl:hidden"
            >
              <Link href="/chat">
                <Bot className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}

          {user?.roles?.includes("STUDENT") ? (
            <>
              <Button
                asChild
                variant="ghost"
                size="icon"
                aria-label="Wishlist"
                className="hidden rounded-full hover:bg-accent/50 sm:inline-flex"
              >
                <Link href="/wishlist">
                  <Heart className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="icon"
                aria-label="Cart"
                className="relative hover:bg-accent/50 rounded-full"
              >
                <Link href="/cart">
                  <ShoppingCart className="h-4 w-4" />
                  {cartCount > 0 ? (
                    <Badge
                      variant="destructive"
                      className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-xs border-none font-bold"
                    >
                      {cartCount}
                    </Badge>
                  ) : null}
                </Link>
              </Button>
            </>
          ) : null}

          {user ? (
            <Button
              asChild
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="hidden rounded-full hover:bg-accent/50 sm:inline-flex"
            >
              <Link href="/notifications">
                <Bell className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}

          <div className="hidden md:block">
            <ThemeToggle />
          </div>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label={user.fullName}
                  className="h-11 gap-2 px-2 hover:bg-accent/50 rounded-[var(--radius-button)]"
                >
                  <Avatar className="h-7 w-7 border border-border/60">
                    <AvatarImage
                      src={user.avatarUrl ?? undefined}
                      alt={user.fullName}
                    />
                    <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                      {initials(user.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-32 truncate text-sm font-semibold 2xl:inline">
                    {user.fullName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-[var(--radius-card)] shadow-xl border border-border/80"
              >
                <DropdownMenuLabel className="pb-2">
                  <span className="block truncate text-sm font-bold">
                    {user.fullName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground font-medium">
                    {user.email}
                  </span>
                  <Badge className="mt-1 text-xs font-bold px-1.5 py-0 bg-primary/10 text-primary border-none hover:bg-primary/10">
                    {user.roles.join(", ")}
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {visibleLinks
                  .filter((link) => link.href !== "/")
                  .map((link) => (
                    <DropdownMenuItem asChild key={link.href}>
                      <Link href={link.href}>{link.label}</Link>
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuItem asChild>
                  <Link href="/notifications">Notifications</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="rounded-[var(--radius-button)] focus:bg-accent"
                >
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                {user.roles?.includes("STUDENT") ? (
                  <>
                    <DropdownMenuItem
                      asChild
                      className="rounded-[var(--radius-button)] focus:bg-accent"
                    >
                      <Link href="/dashboard">My Learning Workspace</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      asChild
                      className="rounded-[var(--radius-button)] focus:bg-accent"
                    >
                      <Link href="/orders">Order Billing</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      asChild
                      className="rounded-[var(--radius-button)] focus:bg-accent"
                    >
                      <Link href="/wishlist">
                        <Heart className="mr-2 h-4 w-4 text-muted-foreground" />
                        My Wishlist
                      </Link>
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout.mutate()}
                  className="rounded-[var(--radius-button)] text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="hidden rounded-[var(--radius-button)] font-semibold text-sm md:inline-flex"
              >
                <Link href="/login">Sign in</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="rounded-[var(--radius-button)] font-semibold text-sm"
              >
                <Link href="/register">Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {mobileSearchOpen ? (
        <div className="border-t border-border/70 bg-background/98 px-4 py-3 shadow-[0_18px_35px_-28px_rgba(15,23,42,0.6)] md:hidden">
          <form
            onSubmit={handleSearch}
            className="mx-auto flex max-w-[1400px] gap-2"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search courses..."
                aria-label="Search courses on mobile"
                className="h-11 rounded-[var(--radius-input)] pl-10 text-sm"
              />
            </div>
            <Button type="submit" className="h-11 px-4 text-sm">
              Search
            </Button>
          </form>
        </div>
      ) : null}
    </header>
  );
}
