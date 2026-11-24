// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Family view is strictly a view of this citizen's own submissions (api.citizen_family của lõi).
// Even a verified representative has NO access to another citizen's private cases.
import { citizenRpc } from '../../utils/identity'
export default defineEventHandler(event => citizenRpc(event,'citizen_family'))
