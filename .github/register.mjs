// ثبت‌نام دانشجو: از issue «ثبت‌نام» شمارهٔ دانشجویی را می‌خواند، مخزن خصوصی ie1405-<شماره> را در سازمان می‌سازد،
// نویسندهٔ issue را با دسترسی نوشتن دعوت می‌کند، پاسخ می‌دهد و issue را می‌بندد.
// متن issue فقط به‌صورت داده خوانده می‌شود؛ هیچ بخشی از آن اجرا نمی‌شود.
import { readFileSync } from 'node:fs'

const API = process.env.GITHUB_API_URL || 'https://api.github.com'
const here = process.env.GITHUB_REPOSITORY // مثلاً ie1405-scu/ie1405-scu.github.io
const org = here.split('/')[0]
const prefix = process.env.REPO_PREFIX || 'ie1405-'
const guide = `https://${org}.github.io/exercises/`
const { issue } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
const user = issue.user.login

async function call(token, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json', 'user-agent': 'ie1405-register' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null; try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, data }
}
async function reply(text, done) {
  // نویسندهٔ issue خودکار از پاسخ‌ها خبردار می‌شود، پس mention لازم نیست (و در متن راست‌به‌چپ به هم می‌ریزد).
  // GitHub متن را چپ‌چین نشان می‌دهد؛ ظرف dir="rtl" لازم است. بلوک کد بیرون از آن می‌ماند تا چپ‌به‌راست بماند.
  const [rtl, code] = Array.isArray(text) ? text : [text, '']
  const body = `<div dir="rtl">\n\n${rtl}\n\n</div>${code ? `\n\n${code}\n` : ''}`
  await call(process.env.GITHUB_TOKEN, 'POST', `/repos/${here}/issues/${issue.number}/comments`, { body })
  await call(process.env.GITHUB_TOKEN, 'PATCH', `/repos/${here}/issues/${issue.number}`, { state: 'closed', state_reason: done ? 'completed' : 'not_planned' })
}
async function broken(why) {
  console.error(why)
  await reply(`ثبت‌نام الان انجام نشد. مشکل از طرف ماست، نه شما. لطفاً به حل‌تمرین خبر بدهید.`, false)
  process.exit(1)
}

// فرم issue هر کادر را زیر یک «### عنوان» می‌گذارد
const field = (label) => {
  const part = String(issue.body || '').split(/^### /m).find(p => p.startsWith(label))
  const v = part ? part.slice(label.length).trim() : ''
  return v === '_No response_' ? '' : v
}
// شماره با رقم فارسی یا عربی هم پذیرفته می‌شود
const digits = s => s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
const id = digits(field('شمارهٔ دانشجویی') || String(issue.body || '')).match(/(?<!\d)(\d{7,12})(?!\d)/)?.[1]
// نام فقط متن ساده و کوتاه؛ در توضیح مخزن می‌نشیند و حل‌تمرین از همان‌جا می‌خواندش
const fullName = field('نام و نام خانوادگی').replace(/<[^>]*>/g, ' ').replace(/[\r\n<>`*_#\[\]()|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
const description = `تحویل تمرین‌های مهندسی اینترنت — ${fullName || 'بی‌نام'} (${id})`
if (!id) { await reply(`شمارهٔ دانشجویی را در این فرم پیدا نکردم. لطفاً از همان پیوند ثبت‌نام یک فرم تازه باز کنید و فقط شماره را با رقم بنویسید.`, false); process.exit(0) }
const token = process.env.ORG_TOKEN
if (!token) await broken('ORG_TOKEN تعریف نشده است')

const name = `${prefix}${id}`, repo = `${org}/${name}`
let r = await call(token, 'GET', `/repos/${repo}`)
if (r.status === 404) {
  r = await call(token, 'POST', `/orgs/${org}/repos`, { name, private: true, auto_init: true, description, has_wiki: false, has_projects: false })
  if (r.status !== 201) await broken(`ساختن ${repo}: ${r.status} ${JSON.stringify(r.data)}`)
}
else if (r.status === 200) {
  // این شماره قبلاً ثبت شده: اگر مال کس دیگری است، دست نمی‌زنیم
  const c = await call(token, 'GET', `/repos/${repo}/collaborators?affiliation=direct&per_page=100`)
  const inv = await call(token, 'GET', `/repos/${repo}/invitations?per_page=100`)
  const people = [...(c.data || []).map(x => x.login), ...(inv.data || []).map(x => x.invitee?.login)].filter(Boolean).map(x => x.toLowerCase())
  if (people.length && !people.includes(user.toLowerCase())) {
    await reply(`این شمارهٔ دانشجویی قبلاً با حساب GitHub دیگری ثبت شده است. اگر شمارهٔ خودتان است، به حل‌تمرین خبر بدهید.`, false)
    process.exit(0)
  }
}
else await broken(`خواندن ${repo}: ${r.status} ${JSON.stringify(r.data)}`)

// ثبت‌نام دوباره با همان حساب: نام تازه جایگزین می‌شود
await call(token, 'PATCH', `/repos/${repo}`, { description })
r = await call(token, 'PUT', `/repos/${repo}/collaborators/${user}`, { permission: 'push' })
if (r.status !== 201 && r.status !== 204) await broken(`دعوت ${user} به ${repo}: ${r.status} ${JSON.stringify(r.data)}`)

await reply([`### ✓ مخزن شما آماده است

مخزن خصوصی تحویل تمرین‌هایتان ساخته شد: **[${name}](https://github.com/${repo})**

1. **دعوت را قبول کنید.** ایمیلی را که GitHub فرستاده باز کنید، یا [این پیوند](https://github.com/${repo}/invitations) را.
2. **مخزن را روی کامپیوترتان بیاورید** با دستور زیر.
3. **ادامه در [راهنمای تمرین‌ها](${guide}).**

<sub>این مخزن خصوصی است و فقط شما، مدرس و حل‌تمرین آن را می‌بینید.</sub>`, '```sh\ngit clone https://github.com/' + repo + '.git\n```'], true)
console.log(`✓ ${repo} ← ${user}`)
