// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Token giao diện của bảng quản trị: màu chủ đạo chàm, cùng thang chữ và phông với hai ứng dụng còn lại.
import type { Config } from 'tailwindcss'
export default <Partial<Config>>{
  content: ['./app/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Be Vietnam Pro"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Arial', 'sans-serif'] },
      fontWeight: { extrabold: '700', black: '700' },
      colors: {
        slate: { 400: '#64748b', 500: '#475569' },
        brand: { 50:'#f2f2fd',100:'#e4e3fb',200:'#c9c7f6',300:'#a5a2ee',400:'#7f7be3',500:'#5d58d4',600:'#4a45c6',700:'#3f3cbb',800:'#332f96',900:'#2b2878' },
      },
    },
  },
}
