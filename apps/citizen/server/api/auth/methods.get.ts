// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { configOidc } from '../../utils/oidc'
export default defineEventHandler(() => ({ demo: useRuntimeConfig().public.demoMode, oidc: configOidc().configured }))
