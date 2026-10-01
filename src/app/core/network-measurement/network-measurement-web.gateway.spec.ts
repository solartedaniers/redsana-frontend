import { NetworkMeasurementWebGateway } from './network-measurement-web.gateway';

describe('NetworkMeasurementWebGateway', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cuenta como perdidas las peticiones fallidas o no exitosas, nunca las inventa', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const result = await new NetworkMeasurementWebGateway().measure();

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
    expect(result.packetLossPercent).toBe(40);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
