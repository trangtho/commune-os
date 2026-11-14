// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import pg, { type PoolClient, type QueryResultRow } from 'pg'
import type { H3Event } from 'h3'
import { requireStaff } from './session'
let singleton: pg.Pool | undefined
export function db() {
  if (!singleton) {
    const config = useRuntimeConfig()
    singleton = new pg.Pool({
      host: String(config.dbHost), port: Number(config.dbPort), database: String(config.dbName),
      user: String(config.dbUser), password: String(config.dbPassword), max: 10,
      idleTimeoutMillis: 15_000, connectionTimeoutMillis: 3_000
    })
  }
  return singleton
}
export async function publicQuery<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []): Promise<T[]> {
  return (await db().query<T>(sql, values)).rows
}
export async function staffTx<T>(event: H3Event, work: (client: PoolClient, actor:{id:string;tenantId:string;name:string;role:string})=>Promise<T>): Promise<T> {
  const actor = requireStaff(event)
  const client = await db().connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT set_config($1,$2,true), set_config($3,$4,true), set_config($5,$6,true)',
      ['app.staff_id',actor.id,'app.tenant_id',actor.tenantId,'app.staff_role',actor.role])
    const result = await work(client,actor)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(()=>undefined)
    throw error
  } finally { client.release() }
}
