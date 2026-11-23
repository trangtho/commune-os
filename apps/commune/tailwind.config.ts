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
        brand: { 50:'#f0fdfa',100:'#ccfbf1',200:'#99f6e4',300:'#5eead4',400:'#2dd4bf',500:'#14b8a6',600:'#0d9488',700:'#0f766e',800:'#115e59',900:'#134e4a' },
        ink: '#183252',
        muted: '#475f5c'
      },
      boxShadow: { panel: '0 5px 23px rgba(25,72,140,.08)' },
      borderRadius: { panel: '16px' }
    }
  }
}
