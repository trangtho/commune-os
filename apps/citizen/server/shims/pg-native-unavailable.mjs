// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// pg-native is an optional native add-on. CommuneOS uses the pure-JS `pg`
// driver; if native mode is explicitly requested, fail instead of silently
// changing database behavior.
export default class PgNativeUnavailable {
  constructor() {
    throw new Error('pg-native cannot run in this deployment; use the JavaScript pg client')
  }
}
