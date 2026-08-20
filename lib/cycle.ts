export function calculateCycleDay(
  periodStartedToday: boolean | null,
  periodStartedYesterday: boolean | null,
  checkInDate: string,
  priorCheckIns: { checkInDate: string; periodStartedToday: boolean | null; periodStartedYesterday?: boolean | null }[]
): number | null {
  if (periodStartedToday === null) return null
  if (periodStartedToday === true) return 1
  if (periodStartedYesterday === true) return 2

  const anchor = priorCheckIns
    .filter((c) => c.periodStartedToday === true || c.periodStartedYesterday === true)
    .sort((a, b) => b.checkInDate.slice(0, 10).localeCompare(a.checkInDate.slice(0, 10)))[0]

  if (!anchor) return null

  const msPerDay = 1000 * 60 * 60 * 24
  const anchorMs = new Date(anchor.checkInDate.slice(0, 10)).getTime()
    - (anchor.periodStartedYesterday === true && anchor.periodStartedToday !== true ? msPerDay : 0)
  const checkInMs = new Date(checkInDate.slice(0, 10)).getTime()

  return Math.round((checkInMs - anchorMs) / msPerDay) + 1
}
