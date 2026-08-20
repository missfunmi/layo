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
  const anchorDate = anchor.periodStartedYesterday === true
    ? (() => {
        const d = new Date(anchor.checkInDate.slice(0, 10))
        d.setUTCDate(d.getUTCDate() - 1)
        return d.toISOString().slice(0, 10)
      })()
    : anchor.checkInDate.slice(0, 10)
  const anchorMs = new Date(anchorDate).getTime()
  const checkInMs = new Date(checkInDate.slice(0, 10)).getTime()

  return Math.round((checkInMs - anchorMs) / msPerDay) + 1
}
