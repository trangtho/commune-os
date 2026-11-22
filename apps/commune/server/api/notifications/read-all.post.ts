// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { coreRpc } from '../../utils/core-api'
export default defineEventHandler((event) => coreRpc(event, 'read_all_staff_notifications', {}))
