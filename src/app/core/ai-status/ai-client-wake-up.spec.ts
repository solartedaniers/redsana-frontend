import { TestBed } from '@angular/core/testing';
import { AI_SERVICE_HEALTH_URL, AiClientWakeUp } from './ai-client-wake-up';

const HEALTH_URL = 'https://ai.example.com/health';

function setup(healthUrl: string, fetchMock = vi.fn(() => Promise.resolve(new Response()))) {
  vi.stubGlobal('fetch', fetchMock);
  TestBed.configureTestingModule({ providers: [{ provide: AI_SERVICE_HEALTH_URL, useValue: healthUrl }] });
  return { wakeUp: TestBed.inject(AiClientWakeUp), fetchMock };
}

describe('AiClientWakeUp', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('hace un GET no-cors al /health público con tiempo límite', () => {
    const { wakeUp, fetchMock } = setup(HEALTH_URL);

    wakeUp.wakeUp();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(HEALTH_URL, expect.objectContaining({ mode: 'no-cors', signal: expect.any(AbortSignal) }));
  });

  it('sin la dirección configurada no hace nada', () => {
    const { wakeUp, fetchMock } = setup('');

    expect(() => wakeUp.wakeUp()).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('si la petición falla no lanza ni deja un rechazo sin atender', async () => {
    const failing = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    const { wakeUp } = setup(HEALTH_URL, failing);

    expect(() => wakeUp.wakeUp()).not.toThrow();
    await Promise.resolve();
    expect(failing).toHaveBeenCalledOnce();
  });
});
