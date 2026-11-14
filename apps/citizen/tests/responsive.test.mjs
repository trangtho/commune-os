// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {resolve, dirname} from 'node:path'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root,path),'utf8')

test('Lock browser viewport and preserve independent, accessible inner scrolling', () => {
 const css = read('assets/css/main.css')
 const layout = read('layouts/default.vue')
 const blank = read('layouts/blank.vue')
 assert.match(css, /html, body, #__nuxt\s*\{[^}]*overflow:\s*hidden/s)
 assert.match(css, /\.citizen-app-shell\s*\{[^}]*100dvh/s)
 assert.match(css, /\.citizen-inner-scroll\s*\{[^}]*overscroll-behavior:\s*contain/s)
 assert.match(css, /\.citizen-inner-scroll::-webkit-scrollbar/)
 assert.match(layout, /citizen-app-shell[^"\n]*overflow-hidden/)
 assert.match(layout, /citizen-workspace[^"\n]*flex-1[^"\n]*overflow-hidden/)
 assert.match(layout, /<main ref="mainScroll"[^>]*overflow-y-auto[^>]*tabindex="0"/)
 assert.match(layout, /mainScroll\.value\.scrollTop=0/)
 assert.match(layout, /citizen-inner-scroll[^"\n]*overflow-y-auto[^"\n]*2xl:block/)
 assert.match(blank, /citizen-inner-scroll[^"\n]*overflow-y-auto/)
})

test('Navigation adapts to tablets and mobile and supports menu access', () => {
 const layout = read('layouts/default.vue')
 assert.match(layout, /2xl:flex/)
 assert.match(layout, /2xl:hidden/)
 assert.match(layout, /aria-expanded="showMobile"/)
 assert.match(layout, /scrollbar-hide[^"\n]*overflow-x-auto/)
 assert.match(layout, /xl:grid-cols-\[205px_minmax\(0,1fr\)\]/)
})

test('Case list uses cards on mobile and a table on desktop', () => {
 const list = read('pages/ho-so/index.vue')
 assert.match(list, /lg:hidden/)
 assert.match(list, /hidden max-w-full overflow-x-auto lg:block/)
 assert.match(list, /v-for="c in filtered"/)
})

test('Forms, chat and document uploads adapt to narrow screens', () => {
 assert.match(read('pages/nop-ho-so/[slug].vue'), /flex-col gap-2 border-t pt-4 sm:flex-row/)
 assert.match(read('components/DocUploader.vue'), /sm:w-auto/)
 assert.match(read('pages/tro-ly.vue'), /scrollbar-hide/)
})
