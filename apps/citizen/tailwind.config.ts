// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import type { Config } from 'tailwindcss'
export default <Partial<Config>>{
  content: ['./components/**/*.{vue,js,ts}', './layouts/**/*.vue', './pages/**/*.vue', './app.vue', './composables/**/*.{js,ts}'],
  theme: {
    extend: {
      colors: {
        brand: { 50:'#eff7ff',100:'#dceeff',200:'#b8ddff',300:'#86c2ff',400:'#489cf6',500:'#1378e7',600:'#0765d5',700:'#0751af',800:'#123f86',900:'#173462' },
        ink: '#183252',
        muted: '#657e9c'
      },
      boxShadow: { panel: '0 5px 23px rgba(25,72,140,.08)' },
      borderRadius: { panel: '16px' }
    }
  }
}
