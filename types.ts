
export interface GazeDataPoint {
  timestamp: number;
  isLooking: boolean;
}

export interface SessionSnapshot {
  timestamp: number;
  isLooking: boolean;
  blinkCount: number;
  fidgetCount: number;
  noiseLevel: number;
  browFurrowCount: number;
  brightness: number;
  systemStress: number;
  thumpCount: number;
  headTilt: number;
  focusScore: number; // Rolling engagement up to this point
}

export interface SessionStats {
  totalLooks: number;
  totalTimeSeconds: number;
  averageFocusDuration: number;
  engagementScore: number;
  totalBlinks: number;
  handFidgetCount: number;
  avgNoiseLevel: number;
  voiceTimeSeconds: number;
  thumpCount: number;
  headTiltDegrees: number;
  browFurrowCount: number;
  avgBrightness: number;
  systemStressScore: number;
  location?: { latitude: number; longitude: number };
}

export interface AIAnalysis {
  summary: string;
  tips: string[];
  engagementLevel: 'High' | 'Medium' | 'Low';
  localWeather?: string;
}

export enum TrackingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR'
}
