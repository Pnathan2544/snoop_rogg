// ============================================================
// API Response Types
// ============================================================

export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

// ============================================================
// DTOs - Ingest
// ============================================================

export interface IngestEventDto {
  eventId?: string | null;
  provider: string;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  ts: string; // ISO timestamp
  rateLimitRemaining?: number | null;
}

export interface IngestBatchDto {
  events: IngestEventDto[];
}

export interface IngestResponseDto {
  accepted: number;
  queued: boolean;
}

// ============================================================
// DTOs - Metrics
// ============================================================

export interface MetricsQueryDto {
  projectId: string;
  from: string; // ISO timestamp
  to: string;   // ISO timestamp
  provider?: string;
}

export interface VolumeDataPoint {
  bucketStart: string;
  provider: string;
  endpointGroup: string;
  requestCount: number;
}

export interface ErrorDataPoint {
  bucketStart: string;
  provider: string;
  endpointGroup: string;
  errorCount: number;
  count429: number;
  requestCount: number;
  errorRate: number;
}

export interface LatencyDataPoint {
  bucketStart: string;
  provider: string;
  endpointGroup: string;
  avgLatencyMs: number;
  requestCount: number;
}

export interface TopEndpointDataPoint {
  provider: string;
  endpointGroup: string;
  requestCount: number;
  errorCount: number;
  count429: number;
  avgLatencyMs: number;
}

// ============================================================
// DTOs - Projects
// ============================================================

export interface CreateProjectDto {
  name: string;
}

export interface CreateTokenDto {
  name: string;
}

export interface TokenCreatedDto {
  id: string;
  name: string;
  token: string; // raw token - only shown once
  createdAt: string;
}

// ============================================================
// BullMQ Job Types
// ============================================================

export interface EventBatchJob {
  projectId: string;
  events: IngestEventDto[];
  enqueuedAt: string;
}

// ============================================================
// Chart / Dashboard Types
// ============================================================

export interface TimeSeriesPoint {
  time: string;
  value: number;
  label?: string;
}

export interface ChartSeries {
  name: string;
  data: TimeSeriesPoint[];
  color?: string;
}
