export type NormalizedDailyMetric = {
  readinessScore?: number
  hrvAvg?: number
  restingHeartRate?: number
  sleepScore?: number
  sleepDurationMinutes?: number
  deepSleepMinutes?: number
  remSleepMinutes?: number
  sleepEfficiency?: number
  bodyTempDeviation?: number
}

export type WearableBaseline = NormalizedDailyMetric

export type WearableMetrics = NormalizedDailyMetric

export type MetricThresholdConfig = {
  report_threshold_pct: number | null
  higher_is: 'better' | 'worse' | null
}

export type WearableThresholds = Record<string, MetricThresholdConfig>
