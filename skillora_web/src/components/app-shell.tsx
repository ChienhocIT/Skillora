"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  Bot,
  ClipboardCheck,
  GraduationCap,
  Layers,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  TicketPercent,
  Users,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { authApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Catalog", icon: Search, roles: null },
  { href: "/chat", label: "Skillora AI", icon: Bot, roles: ["STUDENT", "INSTRUCTOR", "ADMIN"] },
  { href: "/dashboard", label: "Learning", icon: GraduationCap, roles: ["STUDENT"] },
  { href: "/cart", label: "Cart", icon: ShoppingCart, roles: ["STUDENT"] },
  { href: "/instructor", label: "Instructor", icon: BookOpen, roles: ["INSTRUCTOR"] },
  { href: "/admin", label: "Admin", icon: ShieldCheck, roles: ["ADMIN"] },
];

const adminNav = [
  { href: "/admin/review-queue", label: "Review queue", icon: ClipboardCheck },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/courses", label: "All courses", icon: BookOpen },
  { href: "/admin/categories", label: "Categories", icon: Layers },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/admin/audit-logs", label: "Audit logs", icon: Settings },
];

function initials(name?: string) {
  return (name ?? "Skillora")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function canSee(user: User | undefined, roles: string[] | null) {
  if (!roles) {
    return true;
  }
  return user?.roles?.some((role) => roles.includes(role)) ?? false;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authApi.me(),
    retry: false,
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

  const items = nav.filter((item) => canSee(user, item.roles));
  const isAdmin = user?.roles?.includes("ADMIN");

  const navContent = (
    <nav className="grid gap-1">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active && "bg-primary/10 text-primary",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
      {isAdmin ? (
        <div className="mt-4 grid gap-1 border-t pt-4">
          {adminNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  active && "bg-primary/10 text-primary",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </nav>
  );

  return (
    <div className="app-surface min-h-[100dvh]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border/70 bg-card lg:block">
        <div className="flex h-[4.5rem] items-center gap-3 border-b border-border/70 px-5">
          <BrandLogo size="md" variant="full" href="/" />
        </div>
        <div className="p-4">{navContent}</div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[4.5rem] items-center justify-between border-b border-border/70 bg-background px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetTitle><BrandLogo size="md" variant="full" /></SheetTitle>
                <div className="mt-6">{navContent}</div>
              </SheetContent>
            </Sheet>
            <BrandLogo size="sm" variant="full" href="/" className="lg:hidden" />
            <span className="hidden text-sm font-semibold text-muted-foreground lg:block">{pathname.startsWith("/admin") ? "Administration" : pathname.startsWith("/instructor") ? "Instructor workspace" : "Learning workspace"}</span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild variant="ghost" size="icon" aria-label="Ask AI">
                <Link href="/chat">
                  <Bot className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="icon" aria-label="Notifications">
              <Link href="/notifications">
                <Bell className="h-4 w-4" />
              </Link>
            </Button>
            <ThemeToggle />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 gap-2 px-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.avatarUrl ?? undefined} alt={user.fullName} />
                      <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-32 truncate text-sm md:inline">{user.fullName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <span className="block truncate">{user.email}</span>
                    <span className="text-xs font-normal text-muted-foreground">{user.roles.join(", ")}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile">Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => logout.mutate()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </header>
        <main id="main-content" className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-7 px-4 py-7 md:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
