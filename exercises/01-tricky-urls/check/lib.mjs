// ابزار مشترک خودآزمایی تمرین ۱. این فایل عمومی است؛ آزمون‌های پنهان در grader/ جداست.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

// هشت URL تمرین و آنچه guard درست با هرکدام می‌کند: [ورودی، قبول؟، url خروجی]
export const cases = [
  ['http://scu.test@evil.test/login', false],
  ['http://evil.test\\@scu.test/', false],
  ['http://SCU.test:80/a/./b/../c', true, 'http://scu.test/a/c'],
  ['http://scu.test./', false],
  ['http://scu.test:0080/', true, 'http://scu.test/'],
  ['http://[0:0::1]:8080/x', false],
  ['http://2130706433/scu.test', false],
  ['http://scu.test/%2e%2e/admin', true, 'http://scu.test/admin'],
]
export const nums = cases.map((_, i) => String(i + 1))

export const readJson = (dir, name) => { try { return JSON.parse(readFileSync(join(dir, name), 'utf8')) } catch { return null } }
const filled = v => typeof v === 'string' && v.trim() !== ''

// هر تابع فهرست ایرادها را برمی‌گرداند؛ فهرست خالی یعنی درست
export function observedProblems(o) {
  if (!o || typeof o !== 'object' || !o.urls) return ['observed.json پیدا نشد؛ node observe.mjs را اجرا کنید']
  const bad = []
  if (!filled(o.versions?.curl) || !filled(o.versions?.node)) bad.push('نسخهٔ curl و Node در observed.json نیست')
  for (const n of nums) {
    const e = o.urls[n]
    if (e?.url !== cases[n - 1][0]) bad.push(`ردیف ${n} در observed.json با urls.txt تمرین نمی‌خواند`)
    else if (!filled(e.browser?.host) || !(filled(e.curl?.host) || filled(e.curl?.error))) bad.push(`ردیف ${n} در observed.json ناقص است`)
  }
  return bad
}
export const answerKeys = ['other_origin', 'wrongly_blocked', 'parsers_differ']
export function answersProblems(a) {
  if (!a || typeof a !== 'object') return ['answers.json پیدا نشد یا JSON درستی نیست']
  return answerKeys.filter(k => !Array.isArray(a[k]) || a[k].some(x => !Number.isInteger(x) || x < 1 || x > cases.length))
    .map(k => `در answers.json، ${k} باید آرایه‌ای از شماره‌های ۱ تا ۸ باشد`)
}
// هر سؤال دست‌کم یک پاسخ دارد؛ آرایهٔ خالی یعنی هنوز پاسخ داده نشده
export const answersEmpty = a => answerKeys.filter(k => Array.isArray(a?.[k]) && !a[k].length).map(k => `در answers.json، ${k} هنوز خالی است`)

// guard دانشجو را در پردازهٔ جدا اجرا می‌کند تا خطا، حلقهٔ بی‌پایان یا چاپ اضافه آزمون را خراب نکند
export function runGuard(dir, inputs) {
  const file = resolve(dir, 'guard.mjs')
  if (!existsSync(file)) return { error: 'guard.mjs پیدا نشد' }
  const r = spawnSync(process.execPath, [join(here, 'run-guard.mjs'), file], { input: JSON.stringify(inputs), encoding: 'utf8', timeout: 15000 })
  const at = (r.stdout || '').lastIndexOf('@@RESULT@@')
  if (at < 0) return { error: r.error?.code === 'ETIMEDOUT' ? 'guard در ۱۵ ثانیه تمام نشد' : `guard اجرا نشد: ${(r.stderr || '').trim().split('\n').pop() || 'بدون خروجی'}` }
  const results = JSON.parse(r.stdout.slice(at + 10))
  return Array.isArray(results) ? { results } : { error: `guard.mjs بار نشد: ${results.error}` }
}

// نتیجهٔ guard را با جدول مقایسه می‌کند. نمره min دو نسبت است تا «همه را رد کن» یا «همه را قبول کن» نمره نگیرد.
export function judge(list, results) {
  const failed = []; const hit = { true: 0, false: 0 }; const all = { true: 0, false: 0 }
  list.forEach(([input, ok, url], i) => {
    const r = results[i] || {}; all[ok]++
    let why = ''; let credit = 0
    if (r.threw) why = `خطا داد: ${r.threw}`
    else if (ok && !r.ok) why = 'باید قبول شود'
    else if (!ok && r.ok) why = 'باید رد شود'
    else if (ok && r.url !== url) { why = `url خروجی باید ${url} باشد، نه ${r.url}`; credit = 0.5 }  // تصمیم درست، خروجی نادرست: نصف
    else credit = 1
    if (why) failed.push({ input, why })
    hit[ok] += credit
  })
  return { failed, score: Math.min(hit.true / (all.true || 1), hit.false / (all.false || 1)) }
}
