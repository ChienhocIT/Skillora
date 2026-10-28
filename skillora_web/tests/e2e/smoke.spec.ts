import { expect, test } from "@playwright/test";

const baseUrl = process.env.SKILLORA_E2E_BASE_URL ?? "http://127.0.0.1:3000";

const pageResponse = {
  content: [
    {
      id: 101,
      title: "Spring Boot Production Course",
      slug: "spring-boot-production-course",
      subtitle: "Build secure learning APIs with production workflows.",
      level: "INTERMEDIATE",
      price: 1200000,
      discountPrice: 890000,
      currency: "VND",
      status: "PUBLISHED",
      instructorName: "Skillora Instructor",
      totalLessons: 24,
      totalDurationSeconds: 28800,
      totalEnrollments: 132,
      avgRating: 4.7,
      totalReviews: 18,
    },
  ],
  page: 0,
  size: 12,
  totalElements: 1,
  totalPages: 1,
  first: true,
  last: true,
};

const mockCourse = {
  ...pageResponse.content[0],
  description: "Production-ready Spring Boot APIs.",
  requirements: ["Java basics"],
  outcomes: ["Build APIs"],
  categories: [{ id: 1, name: "Backend", slug: "backend" }],
};

const sectionsResponse = [
  {
    id: 501,
    courseId: 101,
    title: "Practice Module",
    orderIndex: 0,
    published: true,
    lessons: [
      {
        id: 42,
        sectionId: 501,
        title: "Capstone Task",
        type: "ASSIGNMENT",
        durationSeconds: 900,
        orderIndex: 0,
        preview: false,
        published: true,
        assignmentId: 777,
      },
    ],
  },
];

function sessionCookie(roles: string[]) {
  return {
    name: "skillora_user",
    value: encodeURIComponent(
      JSON.stringify({
        id: 900,
        email: "mock@skillora.test",
        fullName: "Mock Skillora User",
        roles,
      }),
    ),
    url: baseUrl,
    httpOnly: true,
    sameSite: "Lax" as const,
  };
}

function userFromCookie(cookieHeader: string | undefined) {
  const match = /(?:^|;\s*)skillora_user=([^;]+)/.exec(cookieHeader ?? "");
  if (!match) {
    return null;
  }

  return JSON.parse(decodeURIComponent(match[1])) as {
    id: number;
    email: string;
    fullName: string;
    roles: string[];
  };
}

test.beforeEach(async ({ context }) => {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === "/api/backend/auth/me") {
      const user = userFromCookie(route.request().headers().cookie);
      if (user) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: user }),
        });
        return;
      }

      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Unauthenticated" }),
      });
      return;
    }

    if (url.pathname === "/api/backend/categories") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [{ id: 1, name: "Backend", slug: "backend" }],
        }),
      });
      return;
    }

    if (url.pathname.startsWith("/api/backend/cart")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { items: [], subtotalAmount: 0, currency: "VND" },
        }),
      });
      return;
    }

    if (url.pathname === "/api/backend/courses") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: pageResponse }),
      });
      return;
    }

    if (url.pathname === "/api/backend/courses/me") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: pageResponse }),
      });
      return;
    }

    if (url.pathname === "/api/backend/courses/101") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: mockCourse }),
      });
      return;
    }

    if (url.pathname === "/api/backend/courses/101/sections") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: sectionsResponse }),
      });
      return;
    }

    if (url.pathname === "/api/backend/lessons/42") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: 42,
            sectionId: 501,
            courseId: 101,
            assignmentId: 777,
            title: "Capstone Task",
            type: "VIDEO",
            content: "Work through the capstone exercise.",
            durationSeconds: 900,
            preview: false,
            published: true,
            orderIndex: 0,
            video: {
              status: "READY",
              embedUrl: `${baseUrl}/player/bunny/video-guid-123?token=signed&expires=9999999999`,
              playbackUrl: null,
            },
            resources: [
              {
                id: 88,
                lessonId: 42,
                name: "Starter ZIP",
                fileUrl: "https://cdn.skillora.test/starter.zip",
                resourceType: "ZIP",
                sizeBytes: 2048,
                orderIndex: 0,
              },
            ],
          },
        }),
      });
      return;
    }

    if (url.pathname === "/api/backend/lessons/43") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: 43,
            sectionId: 501,
            courseId: 101,
            title: "Processing Video",
            type: "VIDEO",
            durationSeconds: 900,
            preview: false,
            published: true,
            orderIndex: 1,
            video: { status: "PROCESSING" },
            resources: [],
          },
        }),
      });
      return;
    }

    if (url.pathname === "/api/backend/lessons/44") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: 44,
            sectionId: 501,
            courseId: 101,
            title: "Failed Video",
            type: "VIDEO",
            durationSeconds: 900,
            preview: false,
            published: true,
            orderIndex: 2,
            video: { status: "FAILED", errorMessage: "Encoder failed" },
            resources: [],
          },
        }),
      });
      return;
    }

    if (url.pathname === "/api/backend/assignments/777/submissions") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            content: [],
            page: 0,
            size: 100,
            totalElements: 0,
            totalPages: 0,
            first: true,
            last: true,
          },
        }),
      });
      return;
    }

    if (url.pathname === "/api/backend/orders/77") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: 77,
            status: "PENDING",
            totalAmount: 890000,
            currency: "VND",
            failureReason: "Gateway rejected the attempt",
            createdAt: "2026-07-05T08:00:00Z",
            items: [{ courseId: 101, courseTitleSnapshot: "Spring Boot Production Course", finalPrice: 890000 }],
          },
        }),
      });
      return;
    }

    if (url.pathname === "/api/backend/orders/88") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: 88,
            status: "PAID",
            totalAmount: 890000,
            currency: "VND",
            paidAt: "2026-07-05T08:30:00Z",
            createdAt: "2026-07-05T08:00:00Z",
            items: [{ courseId: 101, courseTitleSnapshot: "Spring Boot Production Course", finalPrice: 890000 }],
          },
        }),
      });
      return;
    }

    if (url.pathname === "/api/backend/payments/vnpay/create") {
      const body = route.request().postDataJSON() as { orderId?: number } | null;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            orderId: body?.orderId ?? 77,
            paymentTransactionId: 7001,
            gateway: "VNPAY",
            amount: 890000,
            currency: "VND",
            payUrl: `${baseUrl}/gateway/vnpay?orderId=${body?.orderId ?? 77}`,
          },
        }),
      });
      return;
    }

    if (url.pathname === "/api/backend/payments/momo/create") {
      const body = route.request().postDataJSON() as { orderId?: number } | null;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            orderId: body?.orderId ?? 77,
            paymentTransactionId: 7002,
            gateway: "MOMO",
            amount: 890000,
            currency: "VND",
            payUrl: `${baseUrl}/gateway/momo?orderId=${body?.orderId ?? 77}`,
          },
        }),
      });
      return;
    }

    if (url.pathname === "/api/backend/chat/conversations") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            content: [
              {
                id: 300,
                courseId: 101,
                courseTitle: "Spring Boot Production Course",
                title: "Course study plan",
                createdAt: "2026-07-05T08:00:00Z",
                updatedAt: "2026-07-05T08:30:00Z",
              },
            ],
            page: 0,
            size: 20,
            totalElements: 1,
            totalPages: 1,
            first: true,
            last: true,
          },
        }),
      });
      return;
    }

    if (url.pathname === "/api/backend/chat/conversations/300/messages") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            content: [
              {
                id: 301,
                conversationId: 300,
                role: "USER",
                content: "Create a study plan.",
                createdAt: "2026-07-05T08:00:00Z",
              },
              {
                id: 302,
                conversationId: 300,
                role: "ASSISTANT",
                content: "Here is a study plan with focused practice blocks.",
                model: "gemini-test",
                tokensUsed: 128,
                createdAt: "2026-07-05T08:00:03Z",
              },
            ],
            page: 0,
            size: 80,
            totalElements: 2,
            totalPages: 1,
            first: true,
            last: true,
          },
        }),
      });
      return;
    }

    await route.continue();
  });
});

test("catalog renders mocked published courses", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Skills for your next chapter/i })).toBeVisible();
  await expect(page.getByText("Spring Boot Production Course")).toBeVisible();
  await expect(page.getByText("Skillora Instructor")).toBeVisible();
  await expect(page.getByText("4.7")).toBeVisible();
});

test("protected admin route redirects to login without session", async ({ page }) => {
  for (const path of ["/admin", "/instructor", "/quizzes/1", "/assignments/1"]) {
    await page.goto(path);

    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`));
    await expect(page.getByText("Sign in").first()).toBeVisible();
  }
});

test("payment result explains retryable pending orders", async ({ page }) => {
  await page.goto("/payment/result?gateway=VNPAY&orderId=77&status=FAILED");

  await expect(page.getByRole("heading", { name: "Pending Gateway Confirmation" })).toBeVisible();
  await expect(page.getByText("The gateway has not confirmed the transaction. Please wait or refresh to verify.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry VNPay" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View Order" })).toHaveAttribute("href", "/orders/77");
});

test("order detail redirects to selected gateway pay URLs", async ({ context, page }) => {
  await context.addCookies([sessionCookie(["STUDENT"])]);

  await page.goto("/orders/77");
  await page.getByRole("button", { name: "Pay with VNPay" }).click();
  await expect(page).toHaveURL(`${baseUrl}/gateway/vnpay?orderId=77`);

  await page.goto("/orders/77");
  await page.getByRole("button", { name: "Pay with MoMo" }).click();
  await expect(page).toHaveURL(`${baseUrl}/gateway/momo?orderId=77`);
});

test("payment result confirms paid orders", async ({ page }) => {
  await page.goto("/payment/result?gateway=MOMO&orderId=88&status=PAID&code=0");

  await expect(page.getByRole("heading", { name: "Payment Successful" })).toBeVisible();
  await expect(page.getByText("Your enrollment is confirmed!")).toBeVisible();
  await expect(page.getByText("Order Reference: #88")).toBeVisible();
  await expect(page.getByRole("link", { name: "View Order" })).toHaveAttribute("href", "/orders/88");
});

test("payment result handles missing order id without retry controls", async ({ page }) => {
  await page.goto("/payment/result");

  await expect(page.getByRole("heading", { name: "Pending Gateway Confirmation" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Retry/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "View Order" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "My Dashboard" })).toHaveAttribute("href", "/dashboard");
});

test("lesson page renders backend-shaped resources", async ({ context, page }) => {
  await context.addCookies([sessionCookie(["STUDENT"])]);

  await page.goto("/learn/55/lessons/42");

  await expect(page.getByRole("heading", { name: "Capstone Task" })).toBeVisible();
  await expect(page.locator('iframe[title="Capstone Task"]')).toHaveAttribute(
    "src",
    `${baseUrl}/player/bunny/video-guid-123?token=signed&expires=9999999999`,
  );
  const resource = page.getByRole("link", { name: /Starter ZIP/ });
  await expect(resource).toBeVisible();
  await expect(resource).toHaveAttribute("href", "https://cdn.skillora.test/starter.zip");
});

test("lesson page explains video processing and failed states", async ({ context, page }) => {
  await context.addCookies([sessionCookie(["STUDENT"])]);

  await page.goto("/learn/55/lessons/43");
  await expect(page.getByRole("heading", { name: "Processing Video" })).toBeVisible();
  await expect(page.getByText("Video is processing")).toBeVisible();

  await page.goto("/learn/55/lessons/44");
  await expect(page.getByRole("heading", { name: "Failed Video" })).toBeVisible();
  await expect(page.getByText("Video processing failed")).toBeVisible();
  await expect(page.getByText("Encoder failed")).toBeVisible();
});

test("grading queue discovers assignments from lesson summaries", async ({ context, page }) => {
  await context.addCookies([sessionCookie(["INSTRUCTOR"])]);

  await page.goto("/instructor/grading");
  await page.locator('button[role="combobox"]').filter({ hasText: "Select course..." }).click();
  await page.getByRole("option", { name: "Spring Boot Production Course" }).click();
  await page.locator('button[role="combobox"]').filter({ hasText: "Select assignment..." }).click();

  await expect(page.getByRole("option", { name: "Assignment: Capstone Task" })).toBeVisible();
});

test("course builder sends file metadata when preparing video upload", async ({ context, page }) => {
  await context.addCookies([sessionCookie(["INSTRUCTOR"])]);

  let uploadBody: unknown = null;
  let videoStatus = "UPLOADING";
  await page.route("**/api/backend/courses/101", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { ...mockCourse, status: "DRAFT" } }),
    });
  });
  await page.route("**/api/backend/courses/101/sections", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          {
            ...sectionsResponse[0],
            lessons: [
              {
                id: 42,
                sectionId: 501,
                title: "Upload Lesson",
                type: "VIDEO",
                durationSeconds: 900,
                orderIndex: 0,
                preview: false,
                published: true,
                hasVideo: false,
                videoStatus: null,
              },
            ],
          },
        ],
      }),
    });
  });
  await page.route("**/api/backend/lessons/42", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id: 42,
          sectionId: 501,
          courseId: 101,
          title: "Upload Lesson",
          type: "VIDEO",
          content: "Upload a lesson video.",
          durationSeconds: 900,
          preview: false,
          published: true,
          orderIndex: 0,
          video: { status: videoStatus },
          resources: [],
        },
      }),
    });
  });
  await page.route("**/api/backend/lessons/42/video/upload-url", async (route) => {
    uploadBody = route.request().postDataJSON();
    videoStatus = "UPLOADING";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          lessonVideoId: 12,
          videoId: "video-guid-123",
          uploadUrl: `${baseUrl}/api/backend/tusupload`,
          headers: { VideoId: "video-guid-123", LibraryId: "12345" },
          metadata: { fileName: "lesson.mp4", filetype: "video/mp4" },
          expiresAt: "2026-07-06T10:00:00Z",
        },
      }),
    });
  });
  await page.route("**/api/backend/tusupload**", async (route) => {
    const method = route.request().method();

    if (method === "POST") {
      await route.fulfill({
        status: 201,
        headers: {
          Location: `${baseUrl}/api/backend/tusupload/video-guid-123`,
          "Tus-Resumable": "1.0.0",
        },
      });
      return;
    }

    if (method === "PATCH") {
      await route.fulfill({
        status: 204,
        headers: {
          "Tus-Resumable": "1.0.0",
          "Upload-Offset": "5",
        },
      });
      return;
    }

    if (method === "HEAD") {
      await route.fulfill({
        status: 200,
        headers: {
          "Tus-Resumable": "1.0.0",
          "Upload-Offset": "0",
        },
      });
      return;
    }

    await route.fulfill({ status: 204 });
  });

  await page.goto("/instructor/courses/101");
  await expect(page.getByText("Video lessons ready")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit Review" })).toBeDisabled();
  await page.locator("#lesson-video-file-42").setInputFiles({
    name: "lesson.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("video"),
  });
  await page.getByRole("button", { name: "Upload Video" }).click();

  await expect.poll(() => uploadBody).toEqual({
    fileName: "lesson.mp4",
    mimeType: "video/mp4",
    fileSizeBytes: 5,
  });
  await expect(page.getByText("Processing", { exact: true })).toBeVisible();
  const videoStatusBadge = page.getByText("Video status", { exact: true }).locator("..").locator('[data-slot="badge"]');
  videoStatus = "READY";
  await expect(videoStatusBadge).toHaveText("Ready", { timeout: 10_000 });

  await page.locator("#lesson-video-file-42").setInputFiles({
    name: "retry.mp4", mimeType: "video/mp4", buffer: Buffer.from("video"),
  });
  await page.getByRole("button", { name: "Upload Video" }).click();
  await expect.poll(() => uploadBody).toEqual({ fileName: "retry.mp4", mimeType: "video/mp4", fileSizeBytes: 5 });
  await expect(page.getByText("Processing", { exact: true })).toBeVisible();
  videoStatus = "FAILED";
  await expect(videoStatusBadge).toHaveText("Failed", { timeout: 10_000 });
});

test("chat workspace renders PageResponse conversations and appends assistant replies", async ({ context, page }) => {
  await context.addCookies([sessionCookie(["STUDENT"])]);

  let askBody: unknown = null;
  await page.route("**/api/backend/chat/ask", async (route) => {
    askBody = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          conversationId: 300,
          conversationTitle: "Course study plan",
          userMessage: {
            id: 303,
            conversationId: 300,
            role: "USER",
            content: "Can you quiz me?",
            createdAt: "2026-07-05T08:31:00Z",
          },
          assistantMessage: {
            id: 304,
            conversationId: 300,
            role: "ASSISTANT",
            content: "Let's practice with three short questions.",
            model: "gemini-test",
            tokensUsed: 96,
            createdAt: "2026-07-05T08:31:03Z",
          },
        },
      }),
    });
  });

  await page.goto("/chat?courseId=101&prompt=Explain%20this%20course");
  await expect(page.getByRole("heading", { name: "Skillora AI Assistant" })).toBeVisible();
  await expect(page.getByText("Spring Boot Production Course").first()).toBeVisible();

  await page.getByRole("button", { name: /Course study plan/ }).click();
  await expect(page.getByText("Here is a study plan with focused practice blocks.")).toBeVisible();

  await page
    .getByPlaceholder("Ask Skillora AI about a lesson, course, quiz, assignment, or review...")
    .fill("Can you quiz me?");
  await page.keyboard.press("Enter");

  await expect.poll(() => askBody).toEqual({
    message: "Can you quiz me?",
    conversationId: 300,
  });
  await expect(page.getByText("Let's practice with three short questions.")).toBeVisible();
});

test("course detail exposes a course-scoped AI entry point", async ({ context, page }) => {
  await context.addCookies([sessionCookie(["STUDENT"])]);

  await page.goto("/courses/101");

  const askAi = page.getByRole("link", { name: "Ask AI about this course" });
  await expect(askAi).toBeVisible();
  await expect(askAi).toHaveAttribute("href", /\/chat\?courseId=101&prompt=/);
});

test("payment confirmation follows the order API even when the callback query disagrees", async ({ page }) => {
  await page.goto("/payment/result?orderId=77&status=SUCCESS");
  await expect(page.getByRole("heading", { name: "Pending Gateway Confirmation" })).toBeVisible();
  await expect(page.getByText("Your enrollment is confirmed!")).toHaveCount(0);
  await page.goto("/payment/result?orderId=88&status=FAILED");
  await expect(page.getByRole("heading", { name: "Payment Successful" })).toBeVisible();
  await page.goto("/payment/result?status=SUCCESS");
  await expect(page.getByText("Your enrollment is confirmed!")).toHaveCount(0);
});

test("order API errors do not confirm a successful payment", async ({ page }) => {
  await page.route("**/api/backend/orders/99", route => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ success: false, message: "Order unavailable" }),
  }));
  await page.goto("/payment/result?orderId=99&status=SUCCESS");
  await expect(page.getByText("Order unavailable")).toBeVisible();
  await expect(page.getByText("Your enrollment is confirmed!")).toHaveCount(0);
});

test("named notification events refresh the list and reconnect after a closed stream", async ({ context, page }) => {
  await context.addCookies([sessionCookie(["STUDENT"])]);
  let streamConnections = 0;
  let listRequests = 0;
  await page.route("**/api/backend/notifications?*", route => {
    listRequests++;
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data: {
      content: [{ id: 1, title: `Update ${listRequests}`, content: "Notification received", read: false }],
      page: 0, size: 20, totalElements: 1, totalPages: 1, first: true, last: true,
    } }) });
  });
  await page.route("**/api/backend/notifications/stream", async route => {
    streamConnections++;
    // Close a real SSE response; native EventSource should reconnect rather than being closed by onerror.
    await route.fulfill({ contentType: "text/event-stream", body: "retry: 100\nevent: notification\ndata: {\"id\":1}\n\n" });
  });
  await page.goto("/notifications");
  await expect.poll(() => streamConnections).toBeGreaterThan(1);
  await expect.poll(() => listRequests).toBeGreaterThan(1);
  await expect(page.getByText("Notification received")).toBeVisible();
});
