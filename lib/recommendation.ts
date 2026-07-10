export type RecommendationType = 'as_written' | 'modify' | 'rest'

const STATE_HEADINGS: Partial<Record<RecommendationType, string>> = {
  as_written: 'Do your workout as planned.',
  rest: 'Take a rest day today.',
}

export function getRecommendationHeading(
  recommendationType: RecommendationType,
  modificationDetail?: string | null
): string {
  return STATE_HEADINGS[recommendationType] ?? modificationDetail ?? ''
}
