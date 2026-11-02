import { UNKNOWN_DATE_LABEL } from '../../shared/constants'
import type { PublicWork } from '../../shared/types'

export type ArchiveGroup = {
  key: string
  label: string
  works: PublicWork[]
  unknown: boolean
}

function byDateDesc(a: PublicWork, b: PublicWork): number {
  return (b.finished_on ?? '').localeCompare(a.finished_on ?? '')
}

function byRank(a: PublicWork, b: PublicWork): number {
  const rankA = a.sort_rank ?? Number.MAX_SAFE_INTEGER
  const rankB = b.sort_rank ?? Number.MAX_SAFE_INTEGER
  return rankA - rankB || a.title.localeCompare(b.title, 'zh-CN')
}

/**
 * Split the flat archive into year groups, then append the works whose
 * completion date is unknown as one final group.
 *
 * Works with date_precision !== 'day' are ordered by sort_rank; works with a
 * usable date keep the normal finished_on order.
 */
export function groupArchive(works: PublicWork[]): ArchiveGroup[] {
  const dated = works.filter((work) => work.date_precision === 'day').sort(byDateDesc)
  const unknown = works.filter((work) => work.date_precision !== 'day').sort(byRank)

  const groups: ArchiveGroup[] = []
  for (const work of dated) {
    const year = work.finished_on?.slice(0, 4) ?? ''
    const last = groups.at(-1)
    if (last && last.key === year && !last.unknown) {
      last.works.push(work)
    } else {
      groups.push({ key: year, label: year, works: [work], unknown: false })
    }
  }

  if (unknown.length > 0) {
    groups.push({
      key: 'unknown-date',
      label: UNKNOWN_DATE_LABEL,
      works: unknown,
      unknown: true,
    })
  }

  return groups
}
