// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {copyFileSync} from 'node:fs'
import {resolve} from 'node:path'
const root = resolve(import.meta.dirname, '..')
for (const app of ['citizen','commune','admin']) {
  copyFileSync(resolve(root,'packages/auth/cookie-policy.ts'),resolve(root,`apps/${app}/server/utils/cookie-policy.ts`))
  copyFileSync(resolve(root,'packages/auth/token-seal.ts'),resolve(root,`apps/${app}/server/utils/token-seal.ts`))
  if (app !== 'citizen') copyFileSync(resolve(root,'packages/auth/portal-session.ts'),resolve(root,`apps/${app}/server/utils/portal-session.ts`))
  copyFileSync(resolve(root,'packages/ui/tokens.css'),resolve(root,`apps/${app}/${app === 'admin' ? 'app/assets/css' : 'assets/css'}/shared-tokens.css`))
}
console.log('Shared portal sources synchronized.')
