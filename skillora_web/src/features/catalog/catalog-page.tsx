"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { CourseCard } from "@/components/course-card";
import { MarketplaceLayout } from "@/components/marketplace-layout";
import { EmptyState, ErrorState } from "@/components/data-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { courseApi, emptyPage } from "@/lib/api";
import { PAGE_SIZE } from "@/lib/config";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { Category, CourseLevel, CourseSummary } from "@/lib/types";

const levels: { label: string; value: CourseLevel | "ALL" }[] = [
  { label: "All levels", value: "ALL" },
  { label: "Beginner", value: "BEGINNER" },
  { label: "Intermediate", value: "INTERMEDIATE" },
  { label: "Advanced", value: "ADVANCED" },
  { label: "All levels course", value: "ALL_LEVELS" },
];

const sortOptions = [
  { label: "Newest", value: "createdAt,desc" },
  { label: "Popular", value: "totalEnrollments,desc" },
  { label: "Rating", value: "avgRating,desc" },
  { label: "Price: Low to High", value: "price,asc" },
  { label: "Price: High to Low", value: "price,desc" },
];

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function FilterPanel({
  search,
  setSearch,
  level,
  setLevel,
  categoryId,
  setCategoryId,
  sort,
  setSort,
  categories,
}: {
  search: string;
  setSearch: (value: string) => void;
  level: string;
  setLevel: (value: string) => void;
  categoryId: string;
  setCategoryId: (value: string) => void;
  sort: string;
  setSort: (value: string) => void;
  categories: Category[];
}) {
  const filterId = React.useId();
  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label
          htmlFor={`${filterId}-search`}
          className="text-sm font-bold text-foreground"
        >
          Search keywords
        </Label>
        <div className="relative group/input">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within/input:text-primary transition-colors" />
          <Input
            id={`${filterId}-search`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search keywords..."
            className="h-11 pl-9 text-sm"
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${filterId}-level`} className="text-sm font-bold text-foreground">
          Course Level
        </Label>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger id={`${filterId}-level`} className="min-h-11 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {levels.map((item) => (
              <SelectItem
                key={item.value}
                value={item.value}
                className="text-sm"
              >
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${filterId}-category`} className="text-sm font-bold text-foreground">Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger id={`${filterId}-category`} className="min-h-11 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-sm">
              All categories
            </SelectItem>
            {categories.map((category) => (
              <SelectItem
                key={category.id}
                value={String(category.id)}
                className="text-sm"
              >
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${filterId}-sort`} className="text-sm font-bold text-foreground">Sort order</Label>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger id={`${filterId}-sort`} className="min-h-11 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((item) => (
              <SelectItem
                key={item.value}
                value={item.value}
                className="text-sm"
              >
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section
      className="mx-auto max-w-[1400px] px-4 pt-6 md:px-6 lg:px-10"
      aria-label="Discover Skillora"
    >
      <div className="catalog-hero grid overflow-hidden rounded-xl md:grid-cols-2">
        <div className="flex flex-col items-start justify-center px-6 py-8 md:px-10 lg:px-12">
          <p className="mb-4 text-sm font-semibold text-primary">
            A little learning. A lot of possibility.
          </p>
          <h1 className="max-w-[15ch] text-[2.25rem] font-bold leading-[1.1] tracking-tight lg:text-5xl">
            Skills for your next chapter.
          </h1>
          <p className="mt-5 max-w-[36ch] text-base leading-7 text-muted-foreground">
            Learn something new, put it into practice, and make your next move
            with confidence.
          </p>
          <Button asChild size="lg" className="mt-7 h-12 px-6">
            <a href="#courses">
              Explore courses <ArrowRight aria-hidden="true" />
            </a>
          </Button>
        </div>
        <div className="relative aspect-[16/9] md:aspect-auto md:min-h-[380px]">
          <Image
            src="/images/learning-hero-v2.png"
            alt="A learner working with a laptop and notebook"
            fill
            priority
            fetchPriority="high"
            sizes="(min-width: 1400px) 660px, (min-width: 768px) 50vw, 100vw"
            className="object-cover object-[65%_center]"
          />
        </div>
      </div>
    </section>
  );
}

function CategoryChips({
  categories,
  selected,
  onSelect,
}: {
  categories: Category[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-2"
      aria-label="Course categories"
    >
      {[
        { id: "ALL", name: "All Fields" },
        ...categories.map((c) => ({ id: String(c.id), name: c.name })),
      ].map((category) => (
        <button
          key={category.id}
          type="button"
          aria-pressed={selected === category.id}
          onClick={() => onSelect(category.id)}
          className={cn(
            "min-h-11 shrink-0 rounded-full border px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            selected === category.id
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background text-muted-foreground hover:border-foreground hover:text-foreground",
          )}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}

function CourseGridSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-[var(--radius-card)] border p-0 overflow-hidden bg-card"
        >
          <Skeleton className="aspect-video w-full" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
            <div className="pt-2 flex justify-between">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CatalogPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";
  const initialLevel = searchParams.get("level") ?? "ALL";
  const initialCategoryId = searchParams.get("categoryId") ?? "ALL";
  const initialSort = searchParams.get("sort") ?? "createdAt,desc";
  const initialPage = Number(searchParams.get("page") ?? 0);

  const [search, setSearch] = React.useState(initialSearch);
  const [level, setLevel] = React.useState(initialLevel);
  const [categoryId, setCategoryId] = React.useState(initialCategoryId);
  const [sort, setSort] = React.useState(initialSort);
  const [page, setPage] = React.useState(
    Number.isFinite(initialPage) && initialPage > 0 ? initialPage : 0,
  );

  const debouncedSearch = useDebounce(search, 300);
  const urlState = searchParams.toString();
  const lastInternalUrl = React.useRef(urlState);

  React.useEffect(() => {
    if (urlState === lastInternalUrl.current) return;
    setSearch(initialSearch);
    setLevel(initialLevel);
    setCategoryId(initialCategoryId);
    setSort(initialSort);
    setPage(Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 0);
  }, [
    initialCategoryId,
    initialLevel,
    initialPage,
    initialSearch,
    initialSort,
    urlState,
  ]);

  React.useEffect(() => {
    if (debouncedSearch !== search) return;
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (level !== "ALL") params.set("level", level);
    if (categoryId !== "ALL") params.set("categoryId", categoryId);
    if (sort !== "createdAt,desc") params.set("sort", sort);
    if (page > 0) params.set("page", String(page));
    const next = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;
    lastInternalUrl.current = params.toString();
    router.replace(next, { scroll: false });
  }, [
    categoryId,
    debouncedSearch,
    level,
    page,
    pathname,
    router,
    search,
    sort,
  ]);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => courseApi.categories(),
  });

  const courseFilters = {
    search: debouncedSearch || undefined,
    level: level === "ALL" ? undefined : level,
    categoryId: categoryId === "ALL" ? undefined : categoryId,
    page,
    size: PAGE_SIZE,
    sort,
  };

  const coursesQuery = useQuery({
    queryKey: queryKeys.courses(courseFilters),
    queryFn: () => courseApi.list(courseFilters),
  });

  const courses = coursesQuery.data ?? emptyPage<CourseSummary>();
  const categories = categoriesQuery.data ?? [];

  const resetPage = () => setPage(0);

  const activeFilters = [
    level !== "ALL" && level,
    categoryId !== "ALL" &&
      categories.find((c) => String(c.id) === categoryId)?.name,
    debouncedSearch,
  ].filter(Boolean);

  const filters = (
    <FilterPanel
      search={search}
      setSearch={(value) => {
        setSearch(value);
        resetPage();
      }}
      level={level}
      setLevel={(value) => {
        setLevel(value);
        resetPage();
      }}
      categoryId={categoryId}
      setCategoryId={(value) => {
        setCategoryId(value);
        resetPage();
      }}
      sort={sort}
      setSort={(value) => {
        setSort(value);
        resetPage();
      }}
      categories={categories}
    />
  );

  return (
    <MarketplaceLayout>
      {!debouncedSearch &&
      level === "ALL" &&
      categoryId === "ALL" &&
      page === 0 ? (
        <HeroSection />
      ) : null}
      <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-6 lg:px-10">
        <section className="mb-8" aria-label="Browse by subject">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            What will you learn next?
          </h2>
          <p className="mb-6 mt-2 text-base text-muted-foreground">
            Explore a new interest. Build on what you know.
          </p>
          {categoriesQuery.isError ? (
            <ErrorState
              message="Categories could not be loaded."
              onRetry={() => categoriesQuery.refetch()}
            />
          ) : null}
          <CategoryChips
            categories={categories}
            selected={categoryId}
            onSelect={(id) => {
              setCategoryId(id);
              resetPage();
            }}
          />
        </section>
        <section
          id="courses"
          className="scroll-mt-24 border-t pt-8"
          aria-label="Course catalog"
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {debouncedSearch
                  ? `Results for "${debouncedSearch}"`
                  : "All courses"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground" role="status">
                {coursesQuery.isSuccess
                  ? `${courses.totalElements.toLocaleString()} result${courses.totalElements !== 1 ? "s" : ""}`
                  : "Finding courses for you..."}
              </p>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-11 md:hidden">
                  <SlidersHorizontal aria-hidden="true" /> Filters
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>
                    Find a course that fits your goals.
                  </SheetDescription>
                </SheetHeader>
                <div className="p-5">{filters}</div>
              </SheetContent>
            </Sheet>
          </div>
          {activeFilters.length || sort !== "createdAt,desc" ? (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {activeFilters.map((filter) => (
                <Button
                  key={String(filter)}
                  variant="secondary"
                  className="h-11 max-w-full text-sm"
                  aria-label={`Remove ${filter} filter`}
                  onClick={() => {
                    if (filter === debouncedSearch) setSearch("");
                    if (filter === level) setLevel("ALL");
                    if (categories.some((c) => c.name === filter))
                      setCategoryId("ALL");
                    resetPage();
                  }}
                >
                  <span className="truncate">{String(filter)}</span>
                  <X aria-hidden="true" />
                </Button>
              ))}
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setLevel("ALL");
                  setCategoryId("ALL");
                  setSort("createdAt,desc");
                  resetPage();
                }}
              >
                Clear all filters
              </Button>
            </div>
          ) : null}
          <div className="grid gap-8 md:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
            <aside
              className="hidden border-r pr-6 md:block"
              aria-label="Filters"
            >
              <h3 className="mb-6 flex items-center gap-2 font-semibold">
                <SlidersHorizontal aria-hidden="true" className="size-4" />{" "}
                Filters
              </h3>
              {filters}
            </aside>
            <div className="min-w-0">
              {coursesQuery.isLoading ? <CourseGridSkeleton /> : null}
              {coursesQuery.isError ? (
                <ErrorState
                  message={(coursesQuery.error as Error).message}
                  onRetry={() => coursesQuery.refetch()}
                />
              ) : null}
              {coursesQuery.isSuccess && !courses.content.length ? (
                <EmptyState
                  title="No courses found"
                  message="Try a different keyword or clear your filters to explore more courses."
                  action={
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearch("");
                        setLevel("ALL");
                        setCategoryId("ALL");
                        resetPage();
                      }}
                    >
                      Clear all filters
                    </Button>
                  }
                />
              ) : null}
              {coursesQuery.isSuccess && courses.content.length > 0 ? (
                <>
                  <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
                    {courses.content.map((course, index) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        priority={index < 3}
                      />
                    ))}
                  </div>
                  <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
                    <p className="text-sm text-muted-foreground">
                      Showing Page {courses.page + 1} of{" "}
                      {Math.max(courses.totalPages, 1)}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={courses.first}
                        onClick={() => setPage((v) => Math.max(0, v - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        disabled={courses.last}
                        onClick={() => setPage((v) => v + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>
        <section className="mt-14 grid items-center gap-6 rounded-xl border bg-accent/40 p-6 md:grid-cols-[auto_1fr_auto] md:p-8">
          <div className="flex size-14 items-center justify-center rounded-full bg-background text-primary">
            <BookOpen aria-hidden="true" className="size-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Share what you know.
            </h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Turn your experience into a course and help learners take their
              next step.
            </p>
          </div>
          <Button asChild variant="outline" className="h-12 justify-self-start">
            <a href="/register">
              Start teaching <ArrowRight aria-hidden="true" />
            </a>
          </Button>
        </section>
      </div>
    </MarketplaceLayout>
  );
}
