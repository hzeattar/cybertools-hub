import { expect, test } from "@playwright/test";

test("public pages and auth guards render", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Primary navigation").getByRole("link", { name: "Cyber AI" })).toBeVisible();
  await expect(page.getByText(/Security tools, Cyber AI/i)).toBeVisible();

  await page.goto("/tools/openapi-risk-analyzer", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "OpenAPI Risk Analyzer" })).toBeVisible();

  await page.goto("/assistant/cyber-ai", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Login to use the full AI workspace" })).toBeVisible();
  await expect(page.getByText(/CyberTools AI Workspace/i)).toBeVisible();

  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login/);
});

test("registration creates an account and account page loads", async ({ page }, testInfo) => {
  const email = `smoke-${Date.now()}@example.com`;
  await page.goto("/register", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("SmokeTest123!");
  await page.getByRole("button", { name: /Create account/i }).click();
  await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });
  await expect(page.getByText(email)).toBeVisible();

  await page.goto("/assistant/cyber-ai", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ai-workspace")).toBeVisible();
  await expect(page.getByText(/Start a new chat|Conversation loaded/i)).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("Provider").selectOption("local");
  await page.getByLabel("Message Cyber AI").fill(
    "Remember my project stack uses Next.js and Railway. Review missing Content-Security-Policy on my own app.",
  );
  await expect(page.getByRole("button", { name: /^Send$/i })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("button", { name: /^Send$/i }).click();
  await expect(page.getByText("Offline CyberTools Analyst")).toBeVisible({ timeout: 30_000 });
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Toggle context panel" }).click();
  }
  await expect(page.getByText(/Memory suggestions/i)).toBeVisible();
  const approveResponse = page.waitForResponse(
    (response) => response.url().includes("/api/ai/memories/") && response.url().includes("/approve"),
  );
  await page.getByLabel("Approve memory").first().click();
  await expect((await approveResponse).ok()).toBeTruthy();
  await expect(page.getByText("Memory approved. It will be reused in future chats.")).toBeVisible({ timeout: 30_000 });
});
