import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/backend/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/auth/me")) {
      await route.fulfill({ status: 401, json: { success: false } });
      return;
    }
    const categories = [
      { id: 1, name: "Backend" },
      { id: 2, name: "Frontend" },
    ];
    const data = url.pathname.endsWith("/categories")
      ? categories
      : {
          content: [
            {
              id: 101,
              title: "Practical Java",
              instructorName: "Skillora Instructor",
              status: "PUBLISHED",
              price: 190000,
              currency: "VND",
              totalLessons: 12,
              totalDurationSeconds: 7200,
            },
          ],
          totalElements: 1,
          totalPages: 1,
          page: 0,
          size: 12,
          first: true,
          last: true,
        };
    await route.fulfill({ json: { success: true, data } });
  });
});

test("catalog sends its first-screen content before JavaScript hydration", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain("Skills for your next chapter");
  expect(html).toContain("learning-hero-v2.png");
  expect(html).not.toContain("BAILOUT_TO_CLIENT_SIDE_RENDERING");
});

test("header search and category links update an already mounted catalog", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Practical Java" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search for anything", exact: true })
    .fill("java");
  await page
    .getByRole("textbox", { name: "Search for anything", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: 'Results for "java"' }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Search keywords", exact: true }),
  ).toHaveValue("java");
  await page
    .getByRole("button", { name: "Course categories", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Frontend", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Frontend", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("textbox", { name: "Search keywords", exact: true }),
  ).toHaveValue("");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: 'Results for "java"' }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear all filters", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "All courses", exact: true }),
  ).toBeVisible();
});

test("category selection supports keyboard activation", async ({ page }) => {
  await page.goto("/");
  const category = page.getByRole("button", { name: "Backend", exact: true });
  await category.focus();
  await page.keyboard.press("Enter");
  await expect(category).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/categoryId=1/);
});

test("auth forms cannot send credentials through a native GET before hydration", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const path of [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password?token=example-reset-token",
  ]) {
    await page.goto(`${baseURL}${path}`);
    await expect(page.locator("form")).toHaveAttribute("method", "post");
    await expect(page.locator("form fieldset")).toHaveAttribute("disabled", "");
    await expect(page.locator('form button[type="submit"]')).toBeDisabled();
  }
  await context.close();
});

test("mobile navigation, filter labels and dark mode stay usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(
    page.getByRole("heading", { name: "Practical Java" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("textbox", { name: "Search keywords", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
