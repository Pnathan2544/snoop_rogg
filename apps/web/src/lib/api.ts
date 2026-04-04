import axios from 'axios';
import type {
  Project,
  CreateProjectDto,
  CreateTokenDto,
  TokenCreatedDto,
  VolumeDataPoint,
  ErrorDataPoint,
  LatencyDataPoint,
  TopEndpointDataPoint,
} from '@rate-snoop/types';

const API_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001')
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ---- Projects ----

export async function fetchProjects(): Promise<Project[]> {
  const res = await apiClient.get<Project[]>('/projects');
  return res.data;
}

export async function fetchProject(id: string): Promise<Project> {
  const res = await apiClient.get<Project>(`/projects/${id}`);
  return res.data;
}

export async function createProject(dto: CreateProjectDto): Promise<Project> {
  const res = await apiClient.post<Project>('/projects', dto);
  return res.data;
}

// ---- Tokens ----

export interface TokenInfo {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export async function fetchTokens(projectId: string): Promise<TokenInfo[]> {
  const res = await apiClient.get<TokenInfo[]>(`/projects/${projectId}/tokens`);
  return res.data;
}

export async function createToken(
  projectId: string,
  dto: CreateTokenDto,
): Promise<TokenCreatedDto> {
  const res = await apiClient.post<TokenCreatedDto>(
    `/projects/${projectId}/tokens`,
    dto,
  );
  return res.data;
}

// ---- Metrics ----

export interface MetricsParams {
  projectId: string;
  from: string;
  to: string;
  provider?: string;
}

export async function fetchVolumeMetrics(
  params: MetricsParams,
): Promise<VolumeDataPoint[]> {
  const res = await apiClient.get<VolumeDataPoint[]>('/metrics/volume', {
    params,
  });
  return res.data;
}

export async function fetchErrorMetrics(
  params: MetricsParams,
): Promise<ErrorDataPoint[]> {
  const res = await apiClient.get<ErrorDataPoint[]>('/metrics/errors', {
    params,
  });
  return res.data;
}

export async function fetchLatencyMetrics(
  params: MetricsParams,
): Promise<LatencyDataPoint[]> {
  const res = await apiClient.get<LatencyDataPoint[]>('/metrics/latency', {
    params,
  });
  return res.data;
}

export async function fetchTopEndpoints(
  params: MetricsParams,
): Promise<TopEndpointDataPoint[]> {
  const res = await apiClient.get<TopEndpointDataPoint[]>(
    '/metrics/top-endpoints',
    { params },
  );
  return res.data;
}
