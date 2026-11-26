// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Đặt hoặc bỏ ngày hết hạn của một phiên bản giấy tờ (api.citizen_vault_version_update của lõi).
import { z } from 'zod'
import { citizenRpc } from '../../../../utils/identity'
import { expirySchema } from '../../../../utils/vault'
import { validate } from '../../../../utils/validation'
export default defineEventHandler(async event=>{
 const id=validate(z.string().uuid(),getRouterParam(event,'id'))
 const body=validate(z.object({expiresOn:expirySchema}).strict(),await readBody(event))
 return citizenRpc(event,'citizen_vault_version_update',{p_version_id:id,p_expires_on:body.expiresOn})
})
