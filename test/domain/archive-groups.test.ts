import { describe, expect, it } from 'vitest'
import type { DatePrecision, PublicWork } from '../../shared/types'
import { groupArchive } from '../../src/lib/archive-groups'

function work(
  id: string,
  finishedOn: string | null,
  datePrecision: DatePrecision = 'day',
  sortRank: number | null = null,
): PublicWork {
  return {
    id,
    title: id,
    finished_on: finishedOn,
    date_precision: datePrecision,
    sort_rank: sortRank,
  } as unknown as PublicWork
}

describe('archive year groups', () => {
  it('keeps dated works in year order and appends unknown dates last', () => {
    const groups = groupArchive([
      work('a', '2025-08-01'),
      work('b', '2024-07-01'),
      work('c', '2023-09-01'),
      work('d', '2023-05-28', 'unknown', 2),
      work('e', '2023-05-28', 'unknown', 1),
    ])

    expect(groups.map((group) => group.label)).toEqual([
      '2025',
      '2024',
      '2023',
      '未记年月',
    ])
    expect(groups.at(-1)?.works.map((item) => item.id)).toEqual(['e', 'd'])
    expect(groups.at(-1)?.unknown).toBe(true)
  })

  it('puts unknown dates without a rank at the end of the unknown group', () => {
    const groups = groupArchive([
      work('ranked', '2023-05-28', 'unknown', 3),
      work('unranked', '2023-05-28', 'unknown'),
      work('dated', '2024-01-01'),
    ])

    expect(groups.at(-1)?.works.map((item) => item.id)).toEqual(['ranked', 'unranked'])
  })

  it('omits the unknown group when every work has a usable date', () => {
    const groups = groupArchive([work('a', '2025-01-01')])
    expect(groups).toHaveLength(1)
    expect(groups[0].unknown).toBe(false)
  })
})
