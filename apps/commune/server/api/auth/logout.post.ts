// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { signOut } from '../../utils/session'
export default defineEventHandler((event)=>{signOut(event);return {ok:true}})
