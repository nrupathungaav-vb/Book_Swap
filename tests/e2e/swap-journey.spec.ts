import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * The complete BookSwap journey with two real users:
 * register A → list book (with photo) → wishlist → register B → list book →
 * wishlist → mutual match → request → accept → reserved → chat (realtime) →
 * meeting suggestion → accept → both complete → swapped → notifications.
 */

const run = crypto.randomUUID().slice(0, 6);
const BOOK_A = `E2E Garden of Words ${run}`;
const BOOK_B = `E2E Tide Atlas ${run}`;
const PASSWORD = "BookSwap#2026";

// 1×1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function register(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/register");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(`${name.toLowerCase()}-${run}@bookswap.test`);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile/);
  return page;
}

async function listBook(page: Page, title: string, author: string, withPhoto: boolean) {
  await page.goto("/books/new");
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Author", { exact: true }).fill(author);
  await page.getByLabel("Genre").fill("Fiction");
  if (withPhoto) {
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: "copy.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByAltText("Preview of your book photo")).toBeVisible();
  }
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  if (withPhoto) await expect(page.getByText("Photo of the actual copy")).toBeVisible();
}

async function wish(page: Page, title: string) {
  await page.goto("/wishlist");
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Add to wishlist" }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

test("full two-user swap journey", async ({ browser }) => {
  // ---- User A
  const alice = await register(browser, "Alice");
  await listBook(alice, BOOK_A, "Ada Writer", true);
  await wish(alice, BOOK_B);

  // ---- User B
  const bob = await register(browser, "Bob");
  await listBook(bob, BOOK_B, "Ben Author", false);
  await wish(bob, BOOK_A);

  // ---- Mutual match appears for B
  await bob.goto("/matches");
  const match = bob.getByRole("article").filter({ hasText: BOOK_A });
  await expect(match).toBeVisible();
  await expect(match.getByText("Ready to swap")).toBeVisible();

  // ---- B sends the swap request from the match card
  await match.getByRole("button", { name: "Propose this swap" }).click();
  await bob.getByRole("button", { name: "Send request" }).click();
  await expect(bob).toHaveURL(/\/swaps\/[0-9a-f-]{36}/);
  const swapUrl = bob.url();

  // ---- A accepts → both books reserved
  await alice.goto("/swaps");
  await alice.getByRole("button", { name: "Accept" }).first().click();
  await expect(alice.getByText(/both books are now reserved/i)).toBeVisible();
  await alice.goto("/books");
  await expect(alice.getByRole("heading", { name: /Reserved in an active swap/ })).toBeVisible();

  // ---- Workspace + realtime chat
  await alice.goto(swapUrl);
  await bob.goto(swapUrl);
  await expect(bob.getByText("Live")).toBeVisible();
  await alice.getByLabel("Message").fill("Hi Bob! Saturday at the library?");
  await alice.getByRole("button", { name: "Send message" }).click();
  await expect(bob.getByText("Hi Bob! Saturday at the library?")).toBeVisible(); // arrives without reload

  // ---- Meeting location: B suggests, A accepts
  await bob.locator(".leaflet-container").click({ position: { x: 150, y: 120 } });
  await bob.getByLabel("Place name").fill("City Library entrance");
  await bob.getByRole("button", { name: /Suggest to/ }).click();
  await expect(alice.getByText("City Library entrance")).toBeVisible();
  await alice
    .getByRole("list", { name: "Meeting suggestions" })
    .getByRole("button", { name: "Accept" })
    .click();
  await expect(alice.getByText("Agreed")).toBeVisible();

  // ---- Complete: both confirm
  alice.on("dialog", (d) => void d.accept());
  bob.on("dialog", (d) => void d.accept());
  await alice.getByRole("button", { name: "We've swapped" }).click();
  await expect(alice.getByText(/Waiting for the other reader/)).toBeVisible();
  await bob.reload();
  await bob.getByRole("button", { name: "We've swapped" }).click();
  await expect(bob.getByText("Swap completed — happy reading!")).toBeVisible();

  // ---- Books are swapped and gone from discovery
  await alice.goto("/books");
  await expect(alice.getByRole("heading", { name: /Swapped — history/ })).toBeVisible();
  await alice.goto(`/discover?q=${encodeURIComponent(BOOK_B)}`);
  await expect(alice.getByText("No books found.")).toBeVisible();

  // ---- Notifications were created
  await alice.goto("/notifications");
  await expect(alice.getByText("Swap completed").first()).toBeVisible();
  await expect(alice.getByText("New mutual match!").first()).toBeVisible();
  await expect(alice.getByText("Meeting spot suggested").first()).toBeVisible();
});

test("protected routes redirect to login @mobile", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});

test("landing page renders key sections @mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("next favourite");
  await expect(page.getByRole("link", { name: /Start Swapping/ }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Four steps from shelf to swap" })).toBeVisible();
});
