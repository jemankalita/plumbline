import { expect, test } from "@playwright/test";

const CHECK_TIMEOUT_MS = 70_000;

// The main path: a creator checks a draft, fixes something, sends it on, and an approver is held back by blockers.
test("a draft is checked, fixed, saved and held back from approval by its blockers", async ({ page }) => {
  await page.goto("/new");
  await page.getByRole("button", { name: "Festive push notification" }).click();
  await page.getByRole("button", { name: "Run the brand check" }).click();
  await page.waitForURL(/\/s\/s_/, { timeout: CHECK_TIMEOUT_MS });

  const saved = page.waitForResponse((r) => r.url().includes("/api/findings/") && r.request().method() === "PATCH");
  await page.getByRole("button", { name: "Accept fix" }).first().click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByText(/Done\s*1/).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(/Done\s*1/).first()).toBeVisible();

  await page.getByRole("button", { name: "Save and check again" }).click();
  await expect(page.getByText(/Version\s*2/).first()).toBeVisible({ timeout: CHECK_TIMEOUT_MS });

  const sent = page.waitForResponse((r) => r.url().includes("/status") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Send for approval" }).click();
  await sent;

  await page.locator("header button[aria-haspopup=menu]").click();
  const roleChanged = page.waitForResponse((r) => r.url().includes("/api/role"));
  await page.getByRole("menuitemradio", { name: /Approver/ }).click();
  await roleChanged;

  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeDisabled();
  await expect(page.getByText(/Override a blocker with a reason/)).toBeVisible();
});
