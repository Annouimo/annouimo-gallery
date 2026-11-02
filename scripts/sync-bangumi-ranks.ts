/**
 * Build a forced order for works whose Bangumi completion date is unknown.
 *
 * Only the 2023-05-28 / 2023-06-04 bulk-import batch uses this. Other imported
 * works have usable dates and keep the normal year/date order.
 *
 * Usage:
 *   bun run scripts/sync-bangumi-ranks.ts --fetch
 *
 * Output (archive/ is gitignored):
 *   archive/bangumi/ranks/ranks.json
 *   archive/bangumi/ranks/backfill.sql
 *   archive/bangumi/ranks/manifest.json
 *   archive/bangumi/ranks/README.md
 */

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

const ROOT = process.cwd()
const WORKS_PATH = join(ROOT, 'archive/bangumi/import/works.json')
const LOGS_PATH = join(ROOT, 'archive/bangumi/import/logs.json')
const OUT_DIR = join(ROOT, 'archive/bangumi/ranks')
const PAGES_DIR = join(OUT_DIR, 'collect')
const USER_ID = '793266'
const BASE_URL = 'https://bgm.tv'
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const UNKNOWN_DATES = (process.env.BGM_UNKNOWN_DATES ?? '2023-05-28,2023-06-04')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const MAX_PAGES = 30
const execFileAsync = promisify(execFile)

type Work = {
  id: string
  title: string
  type: string
  finished_on?: string
}

type Log = {
  work_id: string
  seq: number
  status: string
  logged_on: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function fail(message: string): never {
  throw new Error(message)
}

async function fetchPage(page: number): Promise<string> {
  const url = `${BASE_URL}/anime/list/${USER_ID}/collect?page=${page}`
  let lastError: unknown = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { stdout } = await execFileAsync(
        'curl',
        [
          '-sS',
          '--http1.1',
          '--compressed',
          '-m',
          '40',
          '-A',
          BROWSER_UA,
          '-H',
          'Accept: text/html,application/xhtml+xml',
          url,
        ],
        { maxBuffer: 10 * 1024 * 1024 },
      )
      if (!stdout.includes('item_')) fail(`No collection items parsed from ${url}`)
      return stdout
    } catch (error) {
      lastError = error
      if (attempt < 3) await sleep(2_000 * attempt)
    }
  }
  fail(`Failed to fetch ${url}: ${String(lastError)}`)
}

async function ensurePages(): Promise<string[]> {
  mkdirSync(PAGES_DIR, { recursive: true })
  const forceFetch = process.argv.includes('--fetch')
  const files = readdirSync(PAGES_DIR).filter((name) => /^\d+\.html$/.test(name))
  if (!forceFetch && files.length > 0) {
    return files.sort((a, b) => Number(a.split('.')[0]) - Number(b.split('.')[0]))
  }

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const html = await fetchPage(page)
    const count = (html.match(/id="item_\d+"/g) ?? []).length
    writeFileSync(join(PAGES_DIR, `${page}.html`), html)
    if (count === 0) break
    await sleep(1_200)
  }
  return readdirSync(PAGES_DIR)
    .filter((name) => /^\d+\.html$/.test(name))
    .sort((a, b) => Number(a.split('.')[0]) - Number(b.split('.')[0]))
}

function parsePageIds(file: string): string[] {
  const html = readFileSync(file, 'utf8')
  return [...html.matchAll(/id="item_(\d+)"/g)].map((match) => `bgm-${match[1]}`)
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function main(): Promise<void> {
  const works = JSON.parse(readFileSync(WORKS_PATH, 'utf8')) as Work[]
  const logs = JSON.parse(readFileSync(LOGS_PATH, 'utf8')) as Log[]
  const workById = new Map(works.map((work) => [work.id, work]))

  const finishedOn = new Map<string, string>()
  for (const log of logs) {
    if (log.status !== 'done') continue
    const previous = finishedOn.get(log.work_id)
    if (!previous || log.logged_on > previous) finishedOn.set(log.work_id, log.logged_on)
  }

  const oldWorks = new Map<string, Work>()
  for (const work of works) {
    const finished = finishedOn.get(work.id)
    if (finished && UNKNOWN_DATES.includes(finished)) {
      oldWorks.set(work.id, { ...work, finished_on: finished })
    }
  }

  const pages = await ensurePages()
  const pageOrder = pages.flatMap((file) => parsePageIds(join(PAGES_DIR, file)))
  const pageOld = pageOrder.filter((id) => oldWorks.has(id))
  const pageOldSet = new Set(pageOld)
  const extras = [...oldWorks.values()]
    .filter((work) => !pageOldSet.has(work.id))
    .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))

  if (pageOrder.length === 0) fail('No collection items parsed from Bangumi pages')
  if (pageOld.length === 0) fail(`No collection-page works matched unknown dates: ${UNKNOWN_DATES.join(', ')}`)

  // Only works that actually appear on the collection page get a rank. An
  // old-date work that is not on the page is data that needs review (for
  // example a mistaken "done" log), not an extra to append silently.
  const ranked = pageOld.map((id, index) => {
    const work = oldWorks.get(id) as Work
    return {
      work_id: work.id,
      rank: index + 1,
      title: work.title,
      finished_on: work.finished_on ?? null,
    }
  })

  mkdirSync(OUT_DIR, { recursive: true })
  const ranksJson = `${JSON.stringify(ranked, null, 2)}\n`
  const sql = [
    '-- Forced order for works whose completion date is unknown.',
    `-- Generated for dates: ${UNKNOWN_DATES.join(', ')}.`,
    `-- ${ranked.length} rows from the Bangumi collection page.`,
    '-- Apply after migrations/0002_work_date_precision.sql.',
    '',
    ...ranked.map(
      (row) =>
        `UPDATE works SET date_precision = 'unknown', sort_rank = ${row.rank} WHERE id = ${sqlString(row.work_id)};`,
    ),
    '',
  ].join('\n')
  const manifest = {
    generated_at: new Date().toISOString(),
    dates: UNKNOWN_DATES,
    collection_pages: pages.length,
    collection_items: pageOrder.length,
    matched_old_works: oldWorks.size,
    ranked_works: ranked.length,
    skipped_extras: extras.map((work) => work.id),
    ranks_sha256: sha256(ranksJson),
  }
  const readme = `# 未记年月的强制排序

只给完成日期不可考的作品（默认 ${UNKNOWN_DATES.join(' / ')}）设置：

- \`date_precision = 'unknown'\`
- \`sort_rank = 1..${ranked.length}\`

其中 ${pageOld.length} 条来自 Bangumi “看过”收藏页的顺序；${extras.length} 条收藏页之外的作品跳过，不自动排名。

## 应用

\`\`\`bash
bunx wrangler d1 execute media-tracker-db --local  --file=archive/bangumi/ranks/backfill.sql
bunx wrangler d1 execute media-tracker-db --remote --file=archive/bangumi/ranks/backfill.sql
\`\`\`

生产环境先执行 \`migrations/0002_work_date_precision.sql\`。

## 重新生成

\`\`\`bash
bun run scripts/sync-bangumi-ranks.ts --fetch
\`\`\`
`

  writeFileSync(join(OUT_DIR, 'ranks.json'), ranksJson)
  writeFileSync(join(OUT_DIR, 'backfill.sql'), sql)
  writeFileSync(join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  writeFileSync(join(OUT_DIR, 'README.md'), readme)

  console.log('Bangumi unknown-date ranks built')
  console.log(`  matched old works: ${oldWorks.size}`)
  console.log(`  ranked from collection page: ${ranked.length}`)
  console.log(`  skipped extras: ${extras.length}`)
  console.log(`  output: ${OUT_DIR}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
