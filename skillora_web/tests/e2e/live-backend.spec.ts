import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

const liveEnabled = process.env.SKILLORA_E2E_LIVE === "true";
const backendUrl = process.env.SKILLORA_E2E_BACKEND_URL ?? "http://127.0.0.1:8080";
const seedPassword = process.env.SKILLORA_E2E_PASSWORD ?? "Skillora@12345";
const requireRedisDetails = process.env.SKILLORA_E2E_EXPECT_REDIS_DETAILS !== "false";
const runId = process.env.SKILLORA_E2E_RUN_ID ?? Date.now().toString(36);

const users = {
  admin: {
    email: process.env.SKILLORA_E2E_ADMIN_EMAIL ?? "admin@skillora.test",
    password: process.env.SKILLORA_E2E_ADMIN_PASSWORD ?? seedPassword,
  },
  instructor: {
    email: process.env.SKILLORA_E2E_INSTRUCTOR_EMAIL ?? "instructor@skillora.test",
    password: process.env.SKILLORA_E2E_INSTRUCTOR_PASSWORD ?? seedPassword,
  },
  learner: {
    email: process.env.SKILLORA_E2E_LEARNER_EMAIL ?? "learner@skillora.test",
    password: process.env.SKILLORA_E2E_LEARNER_PASSWORD ?? seedPassword,
  },
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type PageData<T> = {
  content: T[];
  totalElements?: number;
  totalPages?: number;
};

type CourseSummaryData = {
  id: number;
  title: string;
  slug?: string;
  status?: string;
};

type SectionData = {
  id: number;
  title: string;
  lessons?: Array<{
    id: number;
    title: string;
    quizId?: number | null;
    assignmentId?: number | null;
  }>;
};

type UatCourseContext = {
  courseId: number;
  title: string;
  quizId: number;
  assignmentId: number;
};

let generatedCourse: UatCourseContext | null = null;

async function signIn(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(admin|instructor|dashboard)(\/|\?|$)/);
}

async function expectNoRequestFailure(page: Page) {
  await expect(page.locator("body")).not.toContainText("Request failed");
  await expect(page.locator("body")).not.toContainText("Backend service is unavailable");
}

async function expectBackendReady(request: APIRequestContext) {
  const readiness = await request.get(`${backendUrl}/actuator/health/readiness`);
  expect(readiness.ok(), await readiness.text()).toBeTruthy();

  const payload = await readiness.json();
  expect(payload.status).toBe("UP");

  if (requireRedisDetails) {
    expect(payload.components?.redis?.status).toBe("UP");
  }
}

async function api<T>(
  page: Page,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const options = body === undefined ? undefined : { data: body };
  const response =
    method === "GET"
      ? await page.request.get(`/api/backend${path}`)
      : method === "POST"
        ? await page.request.post(`/api/backend${path}`, options)
        : method === "PATCH"
          ? await page.request.patch(`/api/backend${path}`, options)
          : await page.request.delete(`/api/backend${path}`, options);

  expect(response.ok(), await response.text()).toBeTruthy();
  const payload = (await response.json()) as ApiEnvelope<T>;
  expect(payload.success).toBeTruthy();
  return payload.data;
}

async function findPublishedSeedCourse(page: Page) {
  const courses = await api<PageData<CourseSummaryData>>(
    page,
    "GET",
    "/courses?search=Spring%20Boot&page=0&size=12",
  );
  const course = courses.content.find((item) => item.title === "Spring Boot Production APIs");
  expect(course, "Seed course should exist").toBeTruthy();
  return course!;
}

test.describe("live backend UAT release gate", () => {
  test.skip(!liveEnabled, "Set SKILLORA_E2E_LIVE=true to run against a real Skillora backend.");
  test.describe.configure({ mode: "serial" });

  test("precheck confirms frontend proxy, backend readiness, Redis, and seed data", async ({ request }) => {
    const frontendHealth = await request.get("/api/health");
    expect(frontendHealth.ok(), await frontendHealth.text()).toBeTruthy();
    await expectBackendReady(request);

    const unauthMe = await request.get("/api/backend/auth/me");
    expect(unauthMe.status()).toBe(401);
    await expect(unauthMe.json()).resolves.toMatchObject({ success: false });

    const courses = await request.get("/api/backend/courses?search=Spring%20Boot&page=0&size=12");
    expect(courses.ok(), await courses.text()).toBeTruthy();
    const coursesBody = await courses.json();
    expect(coursesBody.data?.content ?? []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Spring Boot Production APIs", status: "PUBLISHED" }),
      ]),
    );
  });

  test("public catalog loads through the Next proxy", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Skills for your future/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "All courses" })).toBeVisible();
    await page.getByRole("textbox", { name: "Search keywords", exact: true }).fill("Spring Boot Production APIs");
    await expect(page.getByRole("heading", { name: "Spring Boot Production APIs", exact: true })).toBeVisible();
    await expectNoRequestFailure(page);
  });

  test("learner can sign in, open dashboard, and see seeded progress", async ({ page }) => {
    await signIn(page, users.learner.email, users.learner.password);

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Learning dashboard" })).toBeVisible();
    await expect(page.getByText("Spring Boot Production APIs")).toBeVisible();
    await expectNoRequestFailure(page);

    const enrollments = await api<PageData<{ id: number; courseTitle: string }>>(
      page, "GET", "/enrollments/me?page=0&size=100",
    );
    const seeded = enrollments.content.find((item) => item.courseTitle === "Spring Boot Production APIs");
    expect(seeded, "Seed enrollment should exist").toBeTruthy();
    await page.locator(`a[href="/learn/${seeded!.id}"]`).filter({ hasText: "Resume" }).click();
    await expect(page).toHaveURL(/\/learn\/\d+/);
    await expect(page.getByRole("heading", { name: "Course progress" })).toBeVisible();
    await expect(page.getByText("Welcome and platform walkthrough")).toBeVisible();
    await expect(page.getByText("Course access control rules")).toBeVisible();
    await expectNoRequestFailure(page);
  });

  test("instructor can sign in and see owned courses for review workflow", async ({ page }) => {
    await signIn(page, users.instructor.email, users.instructor.password);

    await expect(page).toHaveURL(/\/instructor/);
    await expect(page.getByRole("heading", { name: "Instructor workspace" })).toBeVisible();
    await expect(page.getByText("Spring Boot Production APIs")).toBeVisible();
    await expect(page.getByText("Kubernetes Deployment Playbook")).toBeVisible();
    await expect(page.getByRole("link", { name: "New course" })).toBeVisible();
    await expectNoRequestFailure(page);
  });

  test("admin can sign in and review seeded admin data", async ({ page }) => {
    await signIn(page, users.admin.email, users.admin.password);

    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
    await expect(page.getByText("pending review")).toBeVisible();
    await expectNoRequestFailure(page);

    await page.goto("/admin/courses");
    await expect(page.getByRole("heading", { name: "All Courses" })).toBeVisible();
    await expect(page.getByText("Kubernetes Deployment Playbook")).toBeVisible();
    const seededCourseRow = page.getByRole("row").filter({ hasText: "Kubernetes Deployment Playbook" });
    await expect(seededCourseRow.getByText("REVIEWING", { exact: true })).toBeVisible();
    await expect(seededCourseRow.getByRole("button", { name: "Approve", exact: true })).toBeEnabled();
    await expectNoRequestFailure(page);

    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Users Management" })).toBeVisible();
    await expect(page.getByText("admin@skillora.test")).toBeVisible();
    await expect(page.getByText("instructor@skillora.test")).toBeVisible();
    await expect(page.getByText("learner@skillora.test")).toBeVisible();
    await expectNoRequestFailure(page);

    await page.goto("/admin/coupons");
    await expect(page.getByRole("heading", { name: "Promo Coupons" })).toBeVisible();
    await expect(page.getByText("SKILLORA20")).toBeVisible();
    await expectNoRequestFailure(page);
  });

  test("instructor creates a real course, admin approves it, learner can cart and checkout", async ({ page }) => {
    const title = `E2E Production Checkout ${runId}`;

    await signIn(page, users.instructor.email, users.instructor.password);
    await expect(page).toHaveURL(/\/instructor/);

    const categories = await api<Array<{ id: number }>>(page, "GET", "/categories");
    const categoryId = categories[0]?.id;
    expect(categoryId, "At least one category is required").toBeTruthy();

    const course = await api<{ id: number; status: string }>(page, "POST", "/courses", {
      title,
      subtitle: "Live UAT checkout course",
      description: "Generated by live UAT to verify frontend-backend contracts.",
      level: "BEGINNER",
      language: "vi",
      price: 240000,
      discountPrice: 190000,
      currency: "VND",
      categoryIds: [categoryId],
      requirements: ["Live UAT account"],
      outcomes: ["Verify Skillora purchase flow"],
    });

    const section = await api<{ id: number }>(page, "POST", `/courses/${course.id}/sections`, {
      title: "Live UAT section",
      description: "Generated section",
      orderIndex: 1,
      published: true,
    });

    await api(page, "POST", `/sections/${section.id}/lessons`, {
      title: "Live UAT preview lesson",
      type: "TEXT",
      content: "Preview content generated during live UAT.",
      durationSeconds: 300,
      preview: true,
      published: true,
      orderIndex: 1,
    });

    const quizLesson = await api<{ id: number }>(page, "POST", `/sections/${section.id}/lessons`, {
      title: "Live UAT quiz lesson",
      type: "QUIZ",
      content: "Quiz lesson generated during live UAT.",
      durationSeconds: 300,
      preview: false,
      published: true,
      orderIndex: 2,
    });

    const assignmentLesson = await api<{ id: number }>(page, "POST", `/sections/${section.id}/lessons`, {
      title: "Live UAT assignment lesson",
      type: "ASSIGNMENT",
      content: "Assignment lesson generated during live UAT.",
      durationSeconds: 300,
      preview: false,
      published: true,
      orderIndex: 3,
    });

    const quiz = await api<{ id: number }>(page, "POST", "/quizzes", {
      lessonId: quizLesson.id,
      title: "Live UAT quiz",
      description: "Contract check quiz",
      passScore: 70,
      timeLimitMins: 5,
      maxAttempts: 5,
      shuffleQuestions: false,
      questions: [
        {
          content: "Which stack is Skillora using for this backend?",
          type: "SINGLE",
          points: 10,
          orderIndex: 1,
          explanation: "Skillora backend is Spring Boot.",
          answerOptions: [
            { content: "Spring Boot", correct: true, orderIndex: 1 },
            { content: "Laravel", correct: false, orderIndex: 2 },
          ],
        },
      ],
    });

    const assignment = await api<{ id: number }>(page, "POST", "/assignments", {
      lessonId: assignmentLesson.id,
      title: "Live UAT assignment",
      instructions: "Submit a short note proving the flow works.",
      maxScore: 100,
      dueDays: 7,
    });

    const submitted = await api<{ status: string }>(page, "PATCH", `/courses/${course.id}/publish`);
    expect(submitted.status).toBe("REVIEWING");

    await page.goto(`/instructor/courses/${course.id}`);
    await expect(page.getByText(title)).toBeVisible();
    await expectNoRequestFailure(page);

    await signIn(page, users.admin.email, users.admin.password);
    await page.goto("/admin/review-queue");
    await expect(page.getByText(title)).toBeVisible();
    await api(page, "PATCH", `/admin/courses/${course.id}/approve`);

    await page.goto("/admin/courses");
    await page.getByRole("tab", { name: "Published", exact: true }).click();
    await expect(page.getByText(title)).toBeVisible();
    await expectNoRequestFailure(page);

    generatedCourse = {
      courseId: course.id,
      title,
      quizId: quiz.id,
      assignmentId: assignment.id,
    };

    await signIn(page, users.learner.email, users.learner.password);
    await page.goto(`/courses/${course.id}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await page.getByRole("button", { name: "Save to wishlist" }).click();
    await page.getByRole("button", { name: "Add to cart" }).first().click();

    await page.goto("/wishlist");
    await expect(page.getByText(title)).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByText(title)).toBeVisible();
    await page.getByPlaceholder("Enter coupon code").fill("SKILLORA20");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Discount")).toBeVisible();
    await page.getByRole("button", { name: "Proceed to Checkout" }).click();
    await expect(page).toHaveURL(/\/orders\/\d+/);
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay with VNPay" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay with MoMo" })).toBeVisible();
    await expectNoRequestFailure(page);
  });

  test("learner completes seeded lesson, quiz, assignment, review, notifications, and chat checks", async ({ page }) => {
    await signIn(page, users.learner.email, users.learner.password);
    const seedCourse = await findPublishedSeedCourse(page);
    const sections = await api<SectionData[]>(page, "GET", `/courses/${seedCourse.id}/sections`);
    const lessons = sections.flatMap((section) => section.lessons ?? []);
    const quizLesson = lessons.find((lesson) => lesson.quizId);
    const assignmentLesson = lessons.find((lesson) => lesson.assignmentId);
    expect(quizLesson?.quizId, "Seed quiz lesson should expose quizId").toBeTruthy();
    expect(assignmentLesson?.assignmentId, "Seed assignment lesson should expose assignmentId").toBeTruthy();

    const enrollments = await api<PageData<{ id: number; courseId: number }>>(
      page,
      "GET",
      "/enrollments/me?page=0&size=20",
    );
    const enrollment = enrollments.content.find((item) => item.courseId === seedCourse.id);
    expect(enrollment, "Learner should be enrolled in seed course").toBeTruthy();

    await page.goto(`/learn/${enrollment!.id}`);
    await expect(page.getByText("Welcome and platform walkthrough")).toBeVisible();
    const textLesson = lessons.find((lesson) => lesson.title === "Course access control rules");
    expect(textLesson, "Seed text lesson should exist").toBeTruthy();
    await page.locator(`a[href="/learn/${enrollment!.id}/lessons/${textLesson!.id}"]`).click();
    await expect(page).toHaveURL(/\/learn\/\d+\/lessons\/\d+/);
    await expect(page.getByRole("heading", { name: "Course access control rules" })).toBeVisible();
    const markComplete = page.getByRole("button", { name: "Mark Complete" });
    if (await markComplete.isVisible().catch(() => false)) {
      await markComplete.click();
      await expect(page.getByText("Lesson marked as complete", { exact: true })).toBeVisible({ timeout: 8_000 });
    }
    const progress = await api<Array<{ lessonId: number; completed: boolean }>>(
      page, "GET", `/enrollments/${enrollment!.id}/progress`,
    );
    expect(progress.find((item) => item.lessonId === textLesson!.id)?.completed).toBe(true);

    const quiz = await api<{ maxAttempts?: number }>(page, "GET", `/quizzes/${quizLesson!.quizId}`);
    const attempts = await api<Array<{ id: number }>>(page, "GET", `/quizzes/${quizLesson!.quizId}/attempts`);
    await page.goto(`/quizzes/${quizLesson!.quizId}`);
    await expect(page.getByRole("heading", { name: "Access control quiz" })).toBeVisible();
    if (attempts.length < (quiz.maxAttempts ?? 3)) {
      await page.getByRole("button", { name: /Start Quiz|Retake Quiz/ }).click();
      await page.getByText("The learner has ACTIVE or COMPLETED enrollment").click();
      await page.getByRole("button", { name: "Submit Quiz" }).click();
      await expect(page.getByRole("heading", { name: /Quiz Completed!|Quiz Failed/ })).toBeVisible();
      const updatedAttempts = await api<Array<{ id: number }>>(page, "GET", `/quizzes/${quizLesson!.quizId}/attempts`);
      expect(updatedAttempts).toHaveLength(attempts.length + 1);
    } else {
      await expect(page.getByText(/Attempt/).first()).toBeVisible();
    }

    await page.goto(`/assignments/${assignmentLesson!.assignmentId}`);
    await expect(page.getByRole("heading", { name: "Payment retry implementation note" })).toBeVisible();
    const submitAssignment = page.getByRole("button", { name: "Submit Assignment" });
    if (await submitAssignment.isVisible().catch(() => false)) {
      await page.getByLabel("Submission notes / description").fill(`Live UAT submission ${runId}`);
      await page.getByLabel("File URL (e.g. Google Drive, GitHub repo)").fill("https://example.com/skillora-live-uat");
      await submitAssignment.click();
      await expect(page.getByText("Submission Recorded", { exact: true })).toBeVisible();
    } else {
      await expect(page.getByText("Submission Recorded", { exact: true })).toBeVisible();
    }

    await page.goto(`/courses/${seedCourse.id}`);
    await expect(page.getByRole("heading", { name: "Spring Boot Production APIs" })).toBeVisible();
    const writeReview = page.getByRole("button", { name: "Write a review" });
    if (await writeReview.isVisible().catch(() => false)) {
      await writeReview.click();
    }
    const feedback = page.getByLabel("Written feedback (optional)");
    if (await feedback.isVisible().catch(() => false)) {
      await feedback.fill(`Live UAT review ${runId}`);
      await page.getByRole("button", { name: /Submit Review|Save Review/ }).click();
      await expect(page.getByText(/review/i).first()).toBeVisible();
    }
    const likeButton = page.getByRole("button", { name: /Like|Liked/ }).first();
    if (await likeButton.isVisible().catch(() => false)) {
      await likeButton.click();
    }

    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await page.getByRole("button", { name: "Unread only" }).click();
    await expectNoRequestFailure(page);

    await page.goto("/chat");
    await expect(page.getByRole("heading", { name: "Skillora AI Assistant" })).toBeVisible();
    await expectNoRequestFailure(page);
  });

  test("admin filters users, coupons, audit logs, and reviews generated course artifacts", async ({ page }) => {
    await signIn(page, users.admin.email, users.admin.password);

    await page.goto("/admin/users");
    await page.getByPlaceholder("Name or email...").fill("learner");
    await page.getByRole("combobox").filter({ hasText: "All Roles" }).click();
    await page.getByRole("option", { name: "Student" }).click();
    await expect(page.getByText("learner@skillora.test")).toBeVisible();

    await page.goto("/admin/coupons");
    await expect(page.getByText("SKILLORA20")).toBeVisible();

    await page.goto("/admin/audit-logs");
    await page.getByPlaceholder("APPROVE_COURSE").fill("APPROVE");
    await expect(page.getByRole("heading", { name: "Audit Logs" })).toBeVisible();

    if (generatedCourse) {
      const adminCourse = await api<{ course: { status: string } }>(page, "GET", `/admin/courses/${generatedCourse.courseId}`);
      expect(adminCourse.course.status).toBe("PUBLISHED");
    }

    await expectNoRequestFailure(page);
  });
  test("timed TEXT quiz and explicit assignment pass gate one certificate", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page, users.instructor.email, users.instructor.password);
    const categories = await api<Array<{ id: number }>>(page, "GET", "/categories");
    const courseTitle = `E2E Quiz Session ${runId}`;
    const course = await api<{ id: number }>(page, "POST", "/courses", {
      title: courseTitle, subtitle: "Quiz session UAT", description: "Real server deadline and TEXT grading",
      level: "BEGINNER", language: "vi", price: 0, currency: "VND", categoryIds: [categories[0].id],
      requirements: ["Test account"], outcomes: ["Complete a timed quiz"],
    });
    const section = await api<{ id: number }>(page, "POST", `/courses/${course.id}/sections`, {
      title: "Quiz session section", orderIndex: 0, published: true,
    });
    const lesson = await api<{ id: number }>(page, "POST", `/sections/${section.id}/lessons`, {
      title: "Timed TEXT practice", type: "QUIZ", content: "Quiz", orderIndex: 0, published: true, preview: false,
    });
    const quiz = await api<{ id: number; questions: Array<{ id: number; answerOptions: Array<{ id: number }> }> }>(page, "POST", "/quizzes", {
      lessonId: lesson.id, title: "Timed TEXT practice", passScore: 100, timeLimitMins: 5, maxAttempts: 1,
      questions: [
        { content: "Choose the backend", type: "SINGLE", points: 10, orderIndex: 0, answerOptions: [
          { content: "Spring Boot", correct: true, orderIndex: 0 }, { content: "Other", correct: false, orderIndex: 1 },
        ] },
        { content: "Name the backend framework", type: "TEXT", points: 10, orderIndex: 1,
          answerOptions: [{ content: "Spring Boot", correct: true, orderIndex: 0 }] },
      ],
    });
    const textLesson = await api<{ id: number }>(page, "POST", `/sections/${section.id}/lessons`, {
      title: "Completion policy text", type: "TEXT", content: "Read before certification", orderIndex: 1, published: true,
    });
    const assignmentLesson = await api<{ id: number }>(page, "POST", `/sections/${section.id}/lessons`, {
      title: "Explicit pass assignment", type: "ASSIGNMENT", content: "Submit for instructor decision", orderIndex: 2, published: true,
    });
    const assignment = await api<{ id: number }>(page, "POST", "/assignments", {
      lessonId: assignmentLesson.id, title: "Explicit pass assignment", instructions: "Show your work", maxScore: 100,
    });
    await api(page, "PATCH", `/courses/${course.id}/publish`);
    await signIn(page, users.admin.email, users.admin.password);
    await api(page, "PATCH", `/admin/courses/${course.id}/approve`);
    await signIn(page, users.learner.email, users.learner.password);
    const enrollment = await api<{ id: number }>(page, "POST", `/courses/${course.id}/enroll`);
    const fakeCompletion = await page.request.patch(`/api/backend/enrollments/${enrollment.id}/lessons/${lesson.id}/progress`, {
      data: { completed: true, watchedSeconds: 9999 },
    });
    expect(fakeCompletion.status()).toBe(409);
    await api(page, "PATCH", `/enrollments/${enrollment.id}/lessons/${textLesson.id}/progress`, { completed: true });
    expect((await page.request.get(`/api/backend/enrollments/${enrollment.id}/certificate`)).status()).toBe(400);
    const before = await api<{ questions: unknown[] }>(page, "GET", `/quizzes/${quiz.id}`);
    expect(before.questions).toHaveLength(0);
    await page.goto(`/quizzes/${quiz.id}`);
    await page.getByRole("button", { name: "Start Quiz", exact: true }).click();
    await expect(page.getByRole("timer")).toBeVisible();
    const first = await api<Array<{ id: number; deadlineAt: string }>>(page, "GET", `/quizzes/${quiz.id}/attempts`);
    expect(first).toHaveLength(1);
    const view = await api<{ questions: Array<{ answerOptions: unknown[] }> }>(page, "GET", `/quizzes/${quiz.id}`);
    expect(view.questions[1].answerOptions).toHaveLength(0);
    await page.getByText("Spring Boot", { exact: true }).click();
    await page.getByLabel("Your answer for question 2").fill(" spring boot ");
    await page.reload();
    await expect(page.getByLabel("Your answer for question 2")).toHaveValue(" spring boot ");
    const resumed = await api<Array<{ id: number; deadlineAt: string }>>(page, "GET", `/quizzes/${quiz.id}/attempts`);
    expect(resumed).toEqual(first.map((a) => expect.objectContaining({ id: a.id, deadlineAt: a.deadlineAt })));
    await page.getByRole("button", { name: "Submit Quiz", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Quiz Completed!" })).toBeVisible();
    const result = await api<{ id: number; score: number }>(page, "POST", `/quizzes/${quiz.id}/submit`, {
      attemptId: first[0].id, answers: [
        { questionId: quiz.questions[0].id, selectedOptionIds: [quiz.questions[0].answerOptions[0].id] },
        { questionId: quiz.questions[1].id, textAnswer: "spring boot" },
      ],
    });
    expect(result.id).toBe(first[0].id);
    expect(Number(result.score)).toBe(100);
    expect(await api<unknown[]>(page, "GET", `/quizzes/${quiz.id}/attempts`)).toHaveLength(1);
    await expect(page.getByRole("button", { name: "Retake Quiz", exact: true })).toBeDisabled();
    expect((await page.request.get(`/api/backend/enrollments/${enrollment.id}/certificate`)).status()).toBe(400);
    const submission = await api<{ id: number }>(page, "POST", `/assignments/${assignment.id}/submit`, {
      content: `Policy submission ${runId}`,
    });
    await signIn(page, users.instructor.email, users.instructor.password);
    await api(page, "PATCH", `/submissions/${submission.id}/grade`, { status: "GRADED", score: 100, passed: false, feedback: "Needs review" });
    await signIn(page, users.learner.email, users.learner.password);
    expect((await page.request.get(`/api/backend/enrollments/${enrollment.id}/certificate`)).status()).toBe(400);
    await signIn(page, users.instructor.email, users.instructor.password);
    const openGrading = async () => {
      await page.goto("/instructor/grading");
      await page.getByRole("combobox").filter({ hasText: "Select course..." }).click();
      await page.getByRole("option", { name: courseTitle, exact: true }).click();
      await page.getByRole("combobox").filter({ hasText: "Select assignment..." }).click();
      await page.getByRole("option", { name: "Assignment: Explicit pass assignment", exact: true }).click();
      return page.getByRole("row").filter({ hasText: `Policy submission ${runId}` });
    };
    const returnedRow = await openGrading();
    await returnedRow.getByRole("button", { name: "Return for revision", exact: true }).click();
    await expect(page.getByText("Submission returned for revision", { exact: true })).toBeVisible();
    await signIn(page, users.learner.email, users.learner.password);
    await page.goto(`/assignments/${assignment.id}`);
    await page.getByLabel("Submission notes / description").fill(`Policy submission ${runId} revised`);
    await page.getByRole("button", { name: "Submit Assignment", exact: true }).click();
    await expect(page.getByText("Submission Recorded", { exact: true })).toBeVisible();
    await signIn(page, users.instructor.email, users.instructor.password);
    const row = await openGrading();
    await expect(row.getByRole("button", { name: "Grade", exact: true })).toBeDisabled();
    await row.getByRole("combobox").click();
    await page.getByRole("option", { name: "Pass", exact: true }).click();
    await row.getByRole("spinbutton").fill("0");
    await row.getByRole("button", { name: "Grade", exact: true }).click();
    await expect(page.getByText("Submission graded", { exact: true })).toBeVisible();
    await signIn(page, users.learner.email, users.learner.password);
    const certificate = await api<{ certificateCode: string }>(page, "GET", `/enrollments/${enrollment.id}/certificate`);
    expect(certificate.certificateCode).toMatch(/^CERT-/);
    const repeated = await api<{ certificateCode: string }>(page, "GET", `/enrollments/${enrollment.id}/certificate`);
    expect(repeated.certificateCode).toBe(certificate.certificateCode);
    await page.goto(`/assignments/${assignment.id}`);
    await expect(page.getByText("Passed", { exact: true })).toBeVisible();

  });

});
