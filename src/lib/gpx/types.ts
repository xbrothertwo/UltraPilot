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
  averagePower: number | null;
  normalizedPower: number | null;
  averageCadence: number | null;
};

export type TrackPoint = {
  latitude: number;
  longitude: number;
  elevation: number | null;
  time: Date;
  heartRate: number | null;
};
