// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', timeout: 90_000, expect: {timeout: 15_000}, fullyParallel:false,
  retries: 0, reporter: 'list', use: {...devices['Desktop Chrome'],baseURL:process.env.E2E_BASE_URL || 'http://localhost:3000',trace:'retain-on-failure'},
  // E2E runs against an already running Docker/nuxt stack with seeded demo data.
})
