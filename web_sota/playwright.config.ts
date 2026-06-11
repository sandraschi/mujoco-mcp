import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    timeout: 60000,
    retries: 1,
    use: {
        baseURL: "http://localhost:11047",
        headless: true,
        screenshot: "only-on-failure",
    },
    webServer: [
        {
            command: "uv run uvicorn web_sota.backend.server:app --host 127.0.0.1 --port 11046 --log-level warning",
            port: 11046,
            cwd: "../",
            timeout: 30000,
            reuseExistingServer: true,
        },
        {
            command: "npx vite --port 11047 --host",
            port: 11047,
            cwd: ".",
            timeout: 30000,
            reuseExistingServer: true,
        },
    ],
});
