// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { portalSession } from './portal-session'
export const adminSession = portalSession('admin', info => Boolean(info.sub && info.realm_access?.roles?.includes('sys_admin')))
