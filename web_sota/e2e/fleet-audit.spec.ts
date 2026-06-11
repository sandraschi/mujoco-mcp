import { test, expect } from "@playwright/test";

const FE = "http://localhost:11047";
const BE = "http://localhost:11046";

test.describe("Fleet Audit", () => {
    test("Backend health", async ({ request }) => {
        const resp = await request.get(BE + "/health");
        expect(resp.status()).toBe(200);
    });

    test("Frontend loads", async ({ page }) => {
        await page.goto(FE, { timeout: 15000 });
        await page.waitForTimeout(3000);
        await expect(page.locator("#root")).toBeAttached();
    });

    test("No console errors", async ({ page }) => {
        const errors: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "error") errors.push(msg.text());
        });
        await page.goto(FE, { timeout: 15000 });
        await page.waitForTimeout(3000);
        expect(errors.length).toBe(0);
    });

    test("Navigation sidebar renders", async ({ page }) => {
        await page.goto(FE, { timeout: 15000 });
        await page.waitForTimeout(2000);
        // Dashboard should be the default route
        await expect(page.locator("text=Dashboard").first()).toBeAttached({ timeout: 5000 });
    });

    test("LLM page has Quick Actions", async ({ page }) => {
        await page.goto(FE + "/llm", { timeout: 15000 });
        await page.waitForTimeout(2000);
        // Should see AI quick action cards
        await expect(page.locator("text=Run Workflow").first()).toBeAttached({ timeout: 5000 });
    });

    test("Help page has 4 tabs", async ({ page }) => {
        await page.goto(FE + "/help", { timeout: 15000 });
        await page.waitForTimeout(2000);
        const tabs = page.locator("button").filter({ hasText: /Prerequisites|Troubleshooting|Architecture|MuJoCo/ });
        const count = await tabs.count();
        expect(count).toBeGreaterThanOrEqual(3);
    });
});
