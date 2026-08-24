import type { DashboardData } from '../dashboard/types';
import { apiRequest } from './apiClient';

const CACHE_TTL_MS = 30_000;
let cachedData: DashboardData | null = null;
let cachedAt = 0;
let pendingRequest: Promise<DashboardData> | null = null;
let cacheGeneration = 0;

export function invalidateDashboardCache() {
  cacheGeneration += 1;
  cachedData = null;
  cachedAt = 0;
  pendingRequest = null;
}

export const dashboardService = {
  async getData(forceRefresh = false): Promise<DashboardData> {
    const now = Date.now();
    if (!forceRefresh && cachedData && now - cachedAt < CACHE_TTL_MS) return cachedData;
    if (!forceRefresh && pendingRequest) return pendingRequest;

    const requestGeneration = cacheGeneration;
    const request = apiRequest<DashboardData>('/api/coordenacao/dashboard', { cache: 'no-store' })
      .then((data) => {
        if (requestGeneration === cacheGeneration) {
          cachedData = data;
          cachedAt = Date.now();
        }
        return data;
      })
      .finally(() => {
        if (pendingRequest === request) pendingRequest = null;
      });

    pendingRequest = request;

    return pendingRequest;
  },
};
