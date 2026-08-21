import type { DashboardData } from '../dashboard/types';
import { apiRequest } from './apiClient';

export const dashboardService = {
  async getData(): Promise<DashboardData> {
    return apiRequest<DashboardData>(`/api/coordenacao/dashboard?_=${Date.now()}`, { cache: 'no-store' });
  },
};
