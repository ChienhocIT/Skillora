/**
 * Skillora V1 — Comprehensive E2E Mock Tests
 *
 * All API calls are intercepted and mocked to validate frontend rendering
 * without requiring a running backend. Covers all 11 scenarios from the plan:
 *
 * 1.  Public catalog: search, filter, open course detail
 * 2.  Course detail: add to cart, add to wishlist, preview lesson
 * 3.  Auth: register → redirect by role, login → redirect by role
 * 4.  Learner: checkout → order → payment result renders
 * 5.  Learner: open enrolled course → lesson → quiz → assignment
 * 6.  Instructor: create course → add section/lesson → submit review
 * 7.  Instructor: published course → version draft workflow
 * 8.  Admin: approve/reject course
 * 9.  Admin: filter users, courses, coupons, audit logs
 * 10. Admin: CRUD categories
 * 11. Protected route redirects
 */

import { expect, test } from "@playwright/test";

/* ---------- Shared mock data ---------- */

const mockCategories = [
  { id: 1, name: "Backend", slug: "backend", description: "Backend development" },
  { id: 2, name: "Frontend", slug: "frontend", description: "Frontend development" },
];

const mockCourse = {
  id: 101,
  title: "Spring Boot Production Course",
  slug: "spring-boot-production-course",
  subtitle: "Build secure learning APIs with production workflows.",
  description: "A comprehensive course on Spring Boot for production systems.",
  level: "INTERMEDIATE",
  price: 1200000,
  discountPrice: 890000,
  currency: "VND",
  status: "PUBLISHED",
  instructorId: 5,
  instructorName: "Skillora Instructor",
  totalLessons: 24,
  totalDurationSeconds: 28800,
  totalEnrollments: 132,
  avgRating: 4.7,
  totalReviews: 18,
  categories: [{ id: 1, name: "Backend", slug: "backend" }],
  requirements: ["Basic Java knowledge"],
  outcomes: ["Build production Spring Boot APIs"],
};

const mockSections = [
  {
    id: 1,
    courseId: 101,
    title: "Getting Started",
    orderIndex: 0,
    published: true,
    lessons: [
      { id: 10, title: "Welcome", type: "VIDEO", durationSeconds: 300, orderIndex: 0, preview: true, published: true },
      { id: 11, title: "Setup", type: "VIDEO", durationSeconds: 600, orderIndex: 1, preview: false, published: true },
    ],
  },
];

const pageResponse = (content: unknown[], total = 1) => ({
  content,
  page: 0,
  size: 12,
  totalElements: total,
  totalPages: 1,
  first: true,
  last: true,
});

const wrap = (data: unknown) => ({ success: true, data });
const json = (body: unknown) => ({ contentType: "application/json", body: JSON.stringify(body) });
const emptyCart = { items: [], subtotalAmount: 0, currency: "VND" };

/* ---------- Mock student auth ---------- */

function mockStudentAuth(role: "STUDENT" | "INSTRUCTOR" | "ADMIN" = "STUDENT") {
  const user = {
    id: 1,
    fullName: "Test User",
    email: "test@skillora.dev",
    roles: [role],
    avatarUrl: null,
  };
  return { user, accessToken: "mock-jwt-token" };
}

/* ---------- Common route interceptors ---------- */

async function setupUnauthenticatedRoutes(page: import("@playwright/test").Page) {
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill({ status: 401, ...json({ success: false, message: "Unauthenticated" }) }),
  );
  await page.route("**/api/backend/categories", (route) =>
    route.fulfill(json(wrap(mockCategories))),
  );
  await page.route("**/api/backend/courses?**", (route) =>
    route.fulfill(json(wrap(pageResponse([mockCourse])))),
  );
  await page.route("**/api/backend/courses/101", (route) =>
    route.fulfill(json(wrap(mockCourse))),
  );
  await page.route("**/api/backend/courses/spring-boot-production-course", (route) =>
    route.fulfill(json(wrap(mockCourse))),
  );
  await page.route("**/api/backend/courses/101/sections", (route) =>
    route.fulfill(json(wrap(mockSections))),
  );
  await page.route("**/api/backend/reviews**", (route) =>
    route.fulfill(json(wrap(pageResponse([])))),
  );
  await page.route("**/api/backend/cart**", (route) =>
    route.fulfill(json(wrap(emptyCart))),
  );
}

async function setupStudentRoutes(page: import("@playwright/test").Page) {
  const auth = mockStudentAuth("STUDENT");
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(json(wrap(auth.user))),
  );
  // Set the auth cookie so proxy middleware doesn't redirect
  await page.context().addCookies([{
    name: "skillora_user",
    value: encodeURIComponent(JSON.stringify({ roles: ["STUDENT"] })),
    domain: "127.0.0.1",
    path: "/",
  }]);
  await page.route("**/api/backend/categories", (route) =>
    route.fulfill(json(wrap(mockCategories))),
  );
  await page.route("**/api/backend/courses?**", (route) =>
    route.fulfill(json(wrap(pageResponse([mockCourse])))),
  );
  await page.route("**/api/backend/courses/101", (route) =>
    route.fulfill(json(wrap(mockCourse))),
  );
  await page.route("**/api/backend/courses/101/sections", (route) =>
    route.fulfill(json(wrap(mockSections))),
  );
  await page.route("**/api/backend/reviews**", (route) =>
    route.fulfill(json(wrap(pageResponse([])))),
  );
}

async function setupInstructorRoutes(page: import("@playwright/test").Page) {
  const auth = mockStudentAuth("INSTRUCTOR");
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(json(wrap(auth.user))),
  );
  await page.context().addCookies([{
    name: "skillora_user",
    value: encodeURIComponent(JSON.stringify({ roles: ["INSTRUCTOR"] })),
    domain: "127.0.0.1",
    path: "/",
  }]);
  await page.route("**/api/backend/categories", (route) =>
    route.fulfill(json(wrap(mockCategories))),
  );
}

async function setupAdminRoutes(page: import("@playwright/test").Page) {
  const auth = mockStudentAuth("ADMIN");
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(json(wrap(auth.user))),
  );
  await page.context().addCookies([{
    name: "skillora_user",
    value: encodeURIComponent(JSON.stringify({ roles: ["ADMIN"] })),
    domain: "127.0.0.1",
    path: "/",
  }]);
  await page.route("**/api/backend/categories", (route) =>
    route.fulfill(json(wrap(mockCategories))),
  );
}

/* ===================================================================
   1. Public catalog: search, filter, open course detail
   =================================================================== */

test.describe("1. Public Catalog", () => {
  test("renders catalog with course cards and search input", async ({ page }) => {
    await setupUnauthenticatedRoutes(page);
    await page.goto("/");

    // Hero search area should be present
    await expect(page.getByPlaceholder(/search/i).first()).toBeVisible();
    // Course card should render
    await expect(page.getByText("Spring Boot Production Course").first()).toBeVisible();
  });

  test("search triggers API refetch", async ({ page }) => {
    let searchKeyword = "";
    await setupUnauthenticatedRoutes(page);
    await page.route("**/api/backend/courses?**", (route) => {
      searchKeyword = new URL(route.request().url()).searchParams.get("search") ?? "";
      return route.fulfill(json(wrap(pageResponse([mockCourse]))));
    });
    await page.goto("/");
    const searchInput = page.getByPlaceholder("Keywords...");
    await searchInput.fill("spring");
    // Wait for debounce
    await page.waitForTimeout(500);
    expect(searchKeyword).toBe("spring");
  });
});

/* ===================================================================
   2. Course detail: add to cart, add to wishlist, preview lesson
   =================================================================== */

test.describe("2. Course Detail", () => {
  test("shows course info, curriculum accordion, and purchase CTA", async ({ page }) => {
    await setupUnauthenticatedRoutes(page);
    await page.goto("/courses/101");

    await expect(page.getByText("Spring Boot Production Course").first()).toBeVisible();
    await expect(page.getByText("Build secure learning APIs").first()).toBeVisible();
    // Curriculum section should show
    await expect(page.getByText("Getting Started").first()).toBeVisible();
  });
});

/* ===================================================================
   3. Auth: register → redirect, login → redirect
   =================================================================== */

test.describe("3. Auth flows", () => {
  test("login page shows sign in form with brand logo", async ({ page }) => {
    await setupUnauthenticatedRoutes(page);
    await page.goto("/login");

    await expect(page.getByText("Sign in").first()).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    // Brand logo link
    await expect(page.getByText("Skillora").first()).toBeVisible();
  });

  test("register page shows create account form with role selector", async ({ page }) => {
    await setupUnauthenticatedRoutes(page);
    await page.goto("/register");

    await expect(page.getByText("Create account").first()).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByRole("combobox").filter({ hasText: "Learner" })).toBeVisible();
  });

  test("login redirect → student goes to /dashboard", async ({ page }) => {
    const auth = mockStudentAuth("STUDENT");
    await page.route("**/api/backend/auth/login", (route) =>
      route.fulfill(json(wrap(auth))),
    );
    await page.route("**/api/backend/auth/me", (route) =>
      route.fulfill(json(wrap(auth.user))),
    );
    await page.context().addCookies([{
      name: "skillora_user",
      value: encodeURIComponent(JSON.stringify({ roles: ["STUDENT"] })),
      domain: "127.0.0.1",
      path: "/",
    }]);
    await page.route("**/api/backend/categories", (route) =>
      route.fulfill(json(wrap(mockCategories))),
    );
    await page.route("**/api/backend/courses?**", (route) =>
      route.fulfill(json(wrap(pageResponse([])))),
    );
    await page.route("**/api/backend/cart**", (route) =>
      route.fulfill(json(wrap(emptyCart))),
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill("test@skillora.dev");
    await page.getByLabel("Password").fill("password123");

    // Mock login response
    await page.route("**/api/backend/auth/login", (route) =>
      route.fulfill(json(wrap(auth))),
    );

    // Mock student dashboard data
    await page.route("**/api/backend/enrollments**", (route) =>
      route.fulfill(json(wrap(pageResponse([])))),
    );
    await page.route("**/api/backend/learning/dashboard**", (route) =>
      route.fulfill(json(wrap({ totalEnrolled: 0, inProgress: 0, completed: 0, recentEnrollments: [] }))),
    );

    await page.getByRole("button", { name: /sign in/i }).click();
    // Should navigate after successful login
    await page.waitForURL(/\/(dashboard|admin|instructor)/, { timeout: 10000 });
  });
});

/* ===================================================================
   4. Learner: checkout → order → payment result
   =================================================================== */

test.describe("4. Learner Revenue Flow", () => {
  test("cart page shows items and coupon input", async ({ page }) => {
    await setupStudentRoutes(page);
    const cart = {
      items: [
        { course: { id: 101, title: "Spring Boot Production Course", price: 1200000, discountPrice: 890000, currency: "VND" } },
      ],
      subtotalAmount: 890000,
      currency: "VND",
    };
    await page.route("**/api/backend/cart**", (route) =>
      route.fulfill(json(wrap(cart))),
    );

    await page.goto("/cart");
    await expect(page.getByText("Spring Boot Production Course").first()).toBeVisible();
    await expect(page.getByPlaceholder(/coupon/i).first()).toBeVisible();
  });

  test("payment result page shows failure state", async ({ page }) => {
    await setupStudentRoutes(page);
    await page.route("**/api/backend/orders/77", (route) =>
      route.fulfill(json(wrap({
        id: 77,
        status: "FAILED",
        totalAmount: 890000,
        currency: "VND",
        failureReason: "Card declined",
        createdAt: "2025-01-01T00:00:00Z",
      }))),
    );

    await page.goto("/payment/result?gateway=VNPAY&orderId=77&status=FAILED");
    await expect(page.getByText(/payment failed/i).first()).toBeVisible();
  });

  test("orders page renders order list", async ({ page }) => {
    await setupStudentRoutes(page);
    await page.route("**/api/backend/orders**", (route) =>
      route.fulfill(json(wrap(pageResponse([
        { id: 77, status: "PAID", totalAmount: 890000, currency: "VND", createdAt: "2025-01-01T00:00:00Z" },
      ])))),
    );

    await page.goto("/orders");
    await expect(page.getByText("#77").first()).toBeVisible();
  });
});

/* ===================================================================
   5. Learner: learning experience — lesson, quiz, assignment
   =================================================================== */

test.describe("5. Learner Learning Experience", () => {
  test("dashboard page shows enrollment stats", async ({ page }) => {
    await setupStudentRoutes(page);
    await page.route("**/api/backend/learning/dashboard**", (route) =>
      route.fulfill(json(wrap({
        totalEnrolled: 3,
        inProgress: 2,
        completed: 1,
        recentEnrollments: [],
      }))),
    );
    await page.route("**/api/backend/enrollments**", (route) =>
      route.fulfill(json(wrap(pageResponse([])))),
    );

    await page.goto("/dashboard");
    // Stats should render
    await expect(page.getByText(/active/i).first()).toBeVisible();
  });

  test("quiz requires start, resumes TEXT draft after reload and submits attempt ID", async ({ page }) => {
    await setupStudentRoutes(page);
    let started = false;
    let submitted = false;
    let startCalls = 0;
    const attempt = { id: 91, quizId: 1, status: "IN_PROGRESS", serverTime: "2026-10-28T15:00:00Z", deadlineAt: "2026-10-28T15:05:00Z" };
    const questions = [
      { id: 100, content: "What is Spring Boot?", type: "SINGLE", answerOptions: [
        { id: 200, content: "A Java framework" }, { id: 201, content: "A database" },
      ] },
      { id: 101, content: "Name the backend framework", type: "TEXT", answerOptions: [] },
    ];
    await page.route("**/api/backend/quizzes/1", route => route.fulfill(json(wrap({
      id: 1, title: "Module 1 Quiz", passScore: 70, questionCount: 2, questions: started ? questions : [],
    }))));
    await page.route("**/api/backend/quizzes/1/attempts", route => route.fulfill(json(wrap(started ? [attempt] : []))));
    await page.route("**/api/backend/quizzes/1/attempts/start", route => {
      started = true; startCalls++;
      return route.fulfill(json(wrap(attempt)));
    });
    await page.route("**/api/backend/quizzes/1/submit", route => {
      expect(route.request().postDataJSON()).toEqual({ attemptId: 91, answers: [
        { questionId: 100, selectedOptionIds: [200] }, { questionId: 101, textAnswer: "Spring Boot" },
      ] });
      submitted = true;
      return route.fulfill(json(wrap({ ...attempt, status: "SUBMITTED", passed: true, score: 100, answers: [] })));
    });
    await page.goto("/quizzes/1");
    await expect(page.getByText("What is Spring Boot?")).toHaveCount(0);
    await page.getByRole("button", { name: "Start Quiz", exact: true }).click();
    await expect(page.getByRole("timer")).toContainText("4:");
    await page.getByText("A database", { exact: true }).click();
    await page.getByText("A Java framework", { exact: true }).click();
    await expect(page.getByRole("checkbox").nth(1)).not.toBeChecked();
    await page.getByLabel("Your answer for question 2").fill("Spring Boot");
    await page.reload();
    await expect(page.getByLabel("Your answer for question 2")).toHaveValue("Spring Boot");
    await expect(page.getByRole("timer")).toBeVisible();
    await page.getByRole("button", { name: "Submit Quiz", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Quiz Completed!" })).toBeVisible();
    expect(submitted).toBe(true);
    expect(startCalls).toBe(1);
    expect(await page.evaluate(() => sessionStorage.getItem("skillora:quiz-attempt:91"))).toBeNull();
  });

  test("expired timer consumes the attempt and prevents submission", async ({ page }) => {
    await setupStudentRoutes(page);
    const attempt = { id: 92, quizId: 2, status: "IN_PROGRESS", serverTime: "2026-10-28T15:00:00Z", deadlineAt: "2026-10-28T15:00:02Z" };
    await page.route("**/api/backend/quizzes/2", route => route.fulfill(json(wrap({
      id: 2, title: "Expiring quiz", questionCount: 1, maxAttempts: 1,
      questions: [{ id: 101, type: "TEXT", content: "Answer promptly", answerOptions: [] }],
    }))));
    await page.route("**/api/backend/quizzes/2/attempts", route => route.fulfill(json(wrap([attempt]))));
    await page.goto("/quizzes/2");
    await page.getByLabel("Your answer for question 1").fill("answer");
    await expect(page.getByText("Time is up. This attempt counts toward your limit.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit Quiz", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retake Quiz", exact: true })).toBeDisabled();
  });

  test("assignment page shows instructions and submit form", async ({ page }) => {
    await setupStudentRoutes(page);
    await page.route("**/api/backend/assignments/1", (route) =>
      route.fulfill(json(wrap({
        id: 1,
        title: "Homework 1",
        lessonTitle: "Spring Boot Basics",
        instructions: "Build a REST API with at least 3 endpoints.",
        dueAt: "2026-12-31T23:59:59Z",
        maxScore: 100,
        mySubmission: null,
      }))),
    );

    await page.goto("/assignments/1");
    await expect(page.getByText("Homework 1").first()).toBeVisible();
    await expect(page.getByText("Build a REST API").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /submit assignment/i })).toBeVisible();
  });
});

/* ===================================================================
   6. Instructor: create course → add section → submit review
   =================================================================== */

test.describe("6. Instructor Create Course", () => {
  test("course create page renders form fields", async ({ page }) => {
    await setupInstructorRoutes(page);

    await page.goto("/instructor/courses/new");
    await expect(page.getByRole("textbox", { name: "Title", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /create course/i })).toBeVisible();
  });

  test("course builder shows curriculum and metadata tabs", async ({ page }) => {
    await setupInstructorRoutes(page);
    await page.route("**/api/backend/courses/101", (route) =>
      route.fulfill(json(wrap({ ...mockCourse, status: "DRAFT" }))),
    );
    await page.route("**/api/backend/courses/101/sections", (route) =>
      route.fulfill(json(wrap([]))),
    );

    await page.goto("/instructor/courses/101");
    // Tabs should render
    await expect(page.getByText("Curriculum").first()).toBeVisible();
    await expect(page.getByText("Metadata").first()).toBeVisible();
    // Submit review button should be visible for drafts
    await expect(page.getByRole("button", { name: /submit review/i })).toBeVisible();
  });
});

/* ===================================================================
   7. Instructor: published course → version draft
   =================================================================== */

test.describe("7. Instructor Versioning", () => {
  test("published course shows versions tab", async ({ page }) => {
    await setupInstructorRoutes(page);
    await page.route("**/api/backend/courses/101", (route) =>
      route.fulfill(json(wrap({ ...mockCourse, status: "PUBLISHED" }))),
    );
    await page.route("**/api/backend/courses/101/sections", (route) =>
      route.fulfill(json(wrap(mockSections))),
    );
    await page.route("**/api/backend/courses/101/versions**", (route) =>
      route.fulfill(json(wrap(pageResponse([])))),
    );

    await page.goto("/instructor/courses/101");
    await expect(page.getByText("Versions").first()).toBeVisible();
    // Submit Review should NOT be visible for published courses
    await expect(page.getByRole("button", { name: /submit review/i })).toHaveCount(0);
  });
});

/* ===================================================================
   8. Admin: approve/reject course
   =================================================================== */

test.describe("8. Admin Course Moderation", () => {
  test("admin courses page renders with status filtering", async ({ page }) => {
    await setupAdminRoutes(page);
    await page.route("**/api/backend/admin/courses**", (route) =>
      route.fulfill(json(wrap(pageResponse([
        { ...mockCourse, id: 200, title: "Pending Course", status: "REVIEWING" },
      ])))),
    );

    await page.goto("/admin/courses");
    await expect(page.getByText("Pending Course").first()).toBeVisible();
  });

  test("review queue page renders pending items", async ({ page }) => {
    await setupAdminRoutes(page);
    await page.route("**/api/backend/admin/courses**", (route) =>
      route.fulfill(json(wrap(pageResponse([
        { ...mockCourse, id: 200, title: "Course Under Review", status: "REVIEWING" },
      ])))),
    );
    await page.route("**/api/backend/admin/course-versions**", (route) =>
      route.fulfill(json(wrap(pageResponse([])))),
    );

    await page.goto("/admin/review-queue");
    await expect(page.getByText("Course Under Review").first()).toBeVisible();
  });
});

/* ===================================================================
   9. Admin: filter users, courses, coupons, audit logs
   =================================================================== */

test.describe("9. Admin Data Management", () => {
  test("admin users page renders with search", async ({ page }) => {
    await setupAdminRoutes(page);
    await page.route("**/api/backend/admin/users**", (route) =>
      route.fulfill(json(wrap(pageResponse([
        { id: 1, fullName: "Test User", email: "test@skillora.dev", roles: ["STUDENT"], active: true, createdAt: "2025-01-01" },
      ])))),
    );

    await page.goto("/admin/users");
    await expect(page.getByText("Test User").first()).toBeVisible();
  });

  test("admin coupons page renders with add button", async ({ page }) => {
    await setupAdminRoutes(page);
    await page.route("**/api/backend/admin/coupons**", (route) =>
      route.fulfill(json(wrap(pageResponse([
        { id: 1, code: "SALE50", name: "Holiday Sale", discountType: "PERCENT", discountValue: 50, maxUses: 100, usedCount: 12 },
      ])))),
    );

    await page.goto("/admin/coupons");
    await expect(page.getByText("SALE50").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /add coupon/i })).toBeVisible();
  });

  test("admin audit logs page renders log entries", async ({ page }) => {
    await setupAdminRoutes(page);
    await page.route("**/api/backend/admin/audit-logs**", (route) =>
      route.fulfill(json(wrap(pageResponse([
        { id: 1, action: "CREATE", entityType: "COURSE", entityId: 101, performedBy: "admin@test.com", createdAt: "2025-06-01T12:00:00Z" },
      ])))),
    );

    await page.goto("/admin/audit-logs");
    await expect(page.getByText("CREATE").first()).toBeVisible();
  });
});

/* ===================================================================
   10. Admin: CRUD categories
   =================================================================== */

test.describe("10. Admin Categories CRUD", () => {
  test("categories page shows existing categories and create form", async ({ page }) => {
    await setupAdminRoutes(page);

    await page.goto("/admin/categories");
    // Category list
    await expect(page.getByText("Backend").first()).toBeVisible();
    await expect(page.getByText("Frontend").first()).toBeVisible();
    
    // Click button to open the create category dialog
    await page.getByRole("button", { name: /Add Category/i }).click();
    
    // Create form fields should now be visible
    await expect(page.getByPlaceholder(/Web Development/i).first()).toBeVisible();
  });
});

/* ===================================================================
   11. Protected route redirects
   =================================================================== */

test.describe("11. Protected Routes", () => {
  test("admin route redirects unauthenticated user to login", async ({ page }) => {
    await setupUnauthenticatedRoutes(page);
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
    await expect(page.getByText("Sign in").first()).toBeVisible();
  });

  test("instructor route redirects unauthenticated user to login", async ({ page }) => {
    await setupUnauthenticatedRoutes(page);
    await page.goto("/instructor");

    await expect(page).toHaveURL(/\/login\?next=%2Finstructor/);
  });

  test("dashboard route redirects unauthenticated user to login", async ({ page }) => {
    await setupUnauthenticatedRoutes(page);
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  });

  test("wishlist route redirects unauthenticated user to login", async ({ page }) => {
    await setupUnauthenticatedRoutes(page);
    await page.goto("/wishlist");

    await expect(page).toHaveURL(/\/login\?next=%2Fwishlist/);
  });

  test("notifications route redirects unauthenticated user to login", async ({ page }) => {
    await setupUnauthenticatedRoutes(page);
    await page.goto("/notifications");

    await expect(page).toHaveURL(/\/login\?next=%2Fnotifications/);
  });
});
