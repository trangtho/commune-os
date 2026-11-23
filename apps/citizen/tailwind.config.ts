// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import type { Config } from 'tailwindcss'
export default <Partial<Config>>{
  content: ['./components/**/*.{vue,js,ts}', './layouts/**/*.vue', './pages/**/*.vue', './app.vue', './composables/**/*.{js,ts}'],
  theme: {
    extend: {
      // Thang chữ thống nhất (UI-01): bỏ độ đậm 800/900 vốn dùng tràn lan, chữ phụ đậm hơn để đạt tương phản 4,5:1.
      fontFamily: { sans: ['"Be Vietnam Pro"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Arial', 'sans-serif'] },
      fontWeight: { extrabold: '700', black: '700' },
      colors: {
        slate: { 400: '#64748b', 500: '#475569' },
        brand: { 50:'#eff7ff',100:'#dceeff',200:'#b8ddff',300:'#86c2ff',400:'#489cf6',500:'#1378e7',600:'#0765d5',700:'#0751af',800:'#123f86',900:'#173462' },
        ink: '#183252',
        muted: '#4a5f7a'
      },
      boxShadow: { panel: '0 5px 23px rgba(25,72,140,.08)' },
      borderRadius: { panel: '16px' }
    }
  }
}
