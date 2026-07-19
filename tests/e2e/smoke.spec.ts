import { expect, test } from "@playwright/test";

test("public pages and auth guards render", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Primary navigation").getByRole("link", { name: "Cyber AI" })).toBeVisible();
  await expect(page.getByText(/Security tools, Cyber AI/i)).toBeVisible();

  await page.goto("/tools/openapi-risk-analyzer", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "OpenAPI Risk Analyzer" })).toBeVisible();

  await page.goto("/assistant/cyber-ai", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Cyber AI Analyst" })).toBeVisible();
  await expect(page.getByText(/Login is required/i)).toBeVisible();

  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login/);
});

test("registration creates an account and account page loads", async ({ page }) => {
  const email = `smoke-${Date.now()}@example.com`;
  await page.goto("/register", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("SmokeTest123!");
  await page.getByRole("button", { name: /Create account/i }).click();
  await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });
  await expect(page.getByText(email)).toBeVisible();
});
