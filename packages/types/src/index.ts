// ============================================================
// Core Domain Types
// ============================================================

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
}

export interface IngestToken {
  id: string;
  projectId: string;
  tokenHash: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface ApiEvent {
  id: string;
  projectId: string;
  eventId: string | null;
  provider: string;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  ts: Date;
  rateLimitRemaining: number | null;
  createdAt: Date;
}

export interface MinuteAggregate {
  projectId: string;
  bucketStart: Date;
  provider: string;
  endpointGroup: string;
  requestCount: number;
  errorCount: number;
  count429: number;
  avgLatencyMs: number;
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
  projectId: string;
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
  errorRate: number;
}

export interface LatencyDataPoint {
  bucketStart: string;
  provider: string;
  endpointGroup: string;
  avgLatencyMs: number;
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
  createdAt: Date;
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
