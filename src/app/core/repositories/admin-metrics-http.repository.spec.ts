import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminMetricsHttpRepository } from './admin-metrics-http.repository';

describe('AdminMetricsHttpRepository', () => {
  const url = `${environment.apiBaseUrl}/api/admin/metrics`;
  const legacy = { total_users: 2, monitored_households: 1, active_alerts: 0, average_security_score: 50 };

  function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), AdminMetricsHttpRepository] });
    return { repository: TestBed.inject(AdminMetricsHttpRepository), http: TestBed.inject(HttpTestingController) };
  }

  it('mapea los conteos nuevos de hogares con y sin puntaje real', async () => {
    const { repository, http } = setup();
    const result = firstValueFrom(repository.getPlatformMetrics());
    http.expectOne(url).flush({ ...legacy, real_scored_households: 1, unevaluated_households: 0 });

    expect(await result).toEqual({ totalUsers: 2, monitoredHouseholds: 1, activeAlerts: 0, averageSecurityScore: 50, realScoredHouseholds: 1, unevaluatedHouseholds: 0 });
  });

  it('con un backend anterior sin esos campos los deja en null en vez de inventarlos', async () => {
    const { repository, http } = setup();
    const result = firstValueFrom(repository.getPlatformMetrics());
    http.expectOne(url).flush(legacy);

    expect((await result).realScoredHouseholds).toBeNull();
    expect((await result).unevaluatedHouseholds).toBeNull();
  });
});
