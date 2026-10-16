import { latencyLabelKey, networkStatusLabelKey } from './network-status-label';

describe('networkStatusLabelKey', () => {
  it('habla de latencia al servidor cuando la medición es de la web', () => {
    expect(networkStatusLabelKey('critical', 'web')).toBe('common.serverLatencyStatus.critical');
    expect(latencyLabelKey('web')).toBe('user.dashboard.serverLatency');
  });

  it('mantiene el estado de la red con el ping del escritorio o si el backend no dice la fuente', () => {
    expect(networkStatusLabelKey('critical', 'native')).toBe('common.networkStatus.critical');
    expect(networkStatusLabelKey('good', undefined)).toBe('common.networkStatus.good');
    expect(latencyLabelKey(undefined)).toBe('user.dashboard.latency');
  });
});
