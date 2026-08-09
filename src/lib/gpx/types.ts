export type GpxMetrics = {
  distanceMeters: number;
  elapsedTimeSeconds: number;
  movingTimeSeconds: number;
  averageSpeedKmh: number;
  elevationGainMeters: number;
  startTime: string;
  averageHeartRate: number | null;
  maximumHeartRate: number | null;
  heartRateSampleCount: number;
  trackPointCount: number;
  /** Trackpoints dropped as exact-duplicate timestamps or implausible GPS jumps, not counted toward trackPointCount. */
  discardedTrackPointCount: number;
  averagePower: number | null;
  normalizedPower: number | null;
  averageCadence: number | null;
  /** Identifies which parser/calculation rules produced this activity's metrics, so later rule changes stay traceable per activity. */
  parserVersion: string;
};

export type TrackPoint = {
  latitude: number;
  longitude: number;
  elevation: number | null;
  time: Date;
  heartRate: number | null;
};
