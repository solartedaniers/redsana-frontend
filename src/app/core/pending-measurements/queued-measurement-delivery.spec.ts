import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { NetworkMetricsRepository } from '../repositories/network-metrics.repository';
import { PENDING_MEASUREMENTS_CONFIG, PendingMeasurement } from './pending-measurement';
import { PendingMeasurementRepository } from './pending-measurement.repository';
import { QueuedMeasurementDelivery } from './queued-measurement-delivery';

const START = Date.parse('2026-10-24T12:00:00Z');
const OFFLINE = new HttpErrorResponse({ status: 0 });

function at(minute: number, ownerId = 'owner-1'): PendingMeasurement {
  return {
    ownerId,
    recordedAt: new Date(START + minute * 60_000).toISOString(),
    measurement: { latencyMs: 20, jitterMs: 1, packetLossPercent: minute % 2 === 0 ? 0 : 100 },
    source: 'native',
    networkFingerprint: null,
  };
}

/** Imita el archivo de la app de escritorio: lo guardado sobrevive a crear otra instancia (cerrar y abrir la app). */
class FakeStorage extends PendingMeasurementRepository {
  saved: PendingMeasurement[] = [];
  load = () => Promise.resolve([...this.saved]);
  save = (items: PendingMeasurement[]) => {
    this.saved = [...items];
    return Promise.resolve();
  };
}

/** Backend de prueba: anota lo que recibe y responde según `online` o una regla por medición. */
class FakeBackend {
  online = true;
  rejects = new Set<string>();
  received: string[] = [];
  record = (_m: unknown, _s: unknown, _f: unknown, recordedAt: string): Observable<object> => {
    if (!this.online) {
      return throwError(() => OFFLINE);
    }
    if (this.rejects.has(recordedAt)) {
      return throwError(() => new HttpErrorResponse({ status: HttpStatusCode.UnprocessableEntity }));
    }
    this.received.push(recordedAt);
    return of({});
  };
}

function openApp(storage: FakeStorage, backend: FakeBackend): QueuedMeasurementDelivery {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      QueuedMeasurementDelivery,
      { provide: PendingMeasurementRepository, useValue: storage },
      { provide: NetworkMetricsRepository, useValue: backend },
    ],
  });
  return TestBed.inject(QueuedMeasurementDelivery);
}

describe('QueuedMeasurementDelivery (cola local del escritorio)', () => {
  let storage: FakeStorage;
  let backend: FakeBackend;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = new FakeStorage();
    backend = new FakeBackend();
  });
  afterEach(() => vi.useRealTimers());

  /** Las pausas entre envíos usan setTimeout: avanzo el reloj falso hasta que termine. */
  async function settle(promise: Promise<void>): Promise<void> {
    let done = false;
    void promise.finally(() => (done = true));
    while (!done) {
      await vi.advanceTimersByTimeAsync(PENDING_MEASUREMENTS_CONFIG.flushPauseMs);
    }
  }

  it('con la red en línea envía al momento y la cola queda vacía', async () => {
    const delivery = openApp(storage, backend);

    await settle(delivery.deliver(at(0)));

    expect(backend.received).toEqual([at(0).recordedAt]);
    expect(storage.saved).toEqual([]);
  });

  it('sin red guarda las mediciones en el equipo, con su hora original', async () => {
    backend.online = false;
    const delivery = openApp(storage, backend);

    for (const minute of [0, 1, 2]) {
      await settle(delivery.deliver(at(minute)));
    }

    expect(backend.received).toEqual([]);
    expect(storage.saved.map((item) => item.recordedAt)).toEqual([0, 1, 2].map((m) => at(m).recordedAt));
  });

  it('al volver la red envía lo pendiente en orden, de la más vieja a la más nueva', async () => {
    backend.online = false;
    const delivery = openApp(storage, backend);
    for (const minute of [0, 1, 2]) {
      await settle(delivery.deliver(at(minute)));
    }

    backend.online = true;
    await settle(delivery.deliver(at(3)));

    expect(backend.received).toEqual([0, 1, 2, 3].map((m) => at(m).recordedAt));
    expect(storage.saved).toEqual([]);
  });

  it('sobrevive a cerrar la app: otra instancia envía lo que quedó guardado', async () => {
    backend.online = false;
    await settle(openApp(storage, backend).deliver(at(0)));

    backend.online = true;
    await settle(openApp(storage, backend).deliver(at(1)));

    expect(backend.received).toEqual([at(0).recordedAt, at(1).recordedAt]);
  });

  it('si la red se cae a mitad del reenvío, se detiene y conserva el resto sin repetir lo enviado', async () => {
    backend.online = false;
    const delivery = openApp(storage, backend);
    for (const minute of [0, 1, 2, 3]) {
      await settle(delivery.deliver(at(minute)));
    }
    backend.online = true;
    const original = backend.record;
    backend.record = (...args) => {
      if (backend.received.length === 2) {
        backend.online = false;
      }
      return original(...args);
    };

    await settle(delivery.deliver(at(4)));
    expect(backend.received).toEqual([at(0).recordedAt, at(1).recordedAt]);
    expect(storage.saved.map((item) => item.recordedAt)).toEqual([2, 3, 4].map((m) => at(m).recordedAt));

    backend.record = original;
    backend.online = true;
    await settle(delivery.deliver(at(5)));
    expect(backend.received).toEqual([0, 1, 2, 3, 4, 5].map((m) => at(m).recordedAt));
  });

  it('dos entregas a la vez no envían la misma medición dos veces', async () => {
    backend.online = false;
    const delivery = openApp(storage, backend);
    await settle(delivery.deliver(at(0)));
    backend.online = true;

    await settle(Promise.all([delivery.deliver(at(1)), delivery.deliver(at(2))]).then(() => undefined));
    await settle(delivery.deliver(at(3)));

    expect(backend.received).toEqual([0, 1, 2, 3].map((m) => at(m).recordedAt));
  });

  it('envía por lotes: al volver la red no manda todo de golpe', async () => {
    backend.online = false;
    const delivery = openApp(storage, backend);
    const backlog = PENDING_MEASUREMENTS_CONFIG.flushBatchSize + 5;
    for (let minute = 0; minute < backlog; minute++) {
      await settle(delivery.deliver(at(minute)));
    }

    backend.online = true;
    await settle(delivery.deliver(at(backlog)));

    expect(backend.received).toHaveLength(PENDING_MEASUREMENTS_CONFIG.flushBatchSize);
    expect(backend.received[0]).toBe(at(0).recordedAt);
    expect(storage.saved).toHaveLength(6);
  });

  it('con la cola llena descarta las más viejas', async () => {
    backend.online = false;
    storage.saved = Array.from({ length: PENDING_MEASUREMENTS_CONFIG.maxItems }, (_, minute) => at(minute));
    const delivery = openApp(storage, backend);

    await settle(delivery.deliver(at(PENDING_MEASUREMENTS_CONFIG.maxItems)));

    expect(storage.saved).toHaveLength(PENDING_MEASUREMENTS_CONFIG.maxItems);
    expect(storage.saved[0].recordedAt).toBe(at(1).recordedAt);
    expect(storage.saved.at(-1)?.recordedAt).toBe(at(PENDING_MEASUREMENTS_CONFIG.maxItems).recordedAt);
  });

  it('descarta lo que pasó la edad máxima: el backend ya no la aceptaría', async () => {
    const maxAgeMinutes = PENDING_MEASUREMENTS_CONFIG.maxAgeMs / 60_000;
    storage.saved = [at(0), at(1)];
    backend.online = false;
    const delivery = openApp(storage, backend);

    await settle(delivery.deliver(at(maxAgeMinutes + 1)));

    expect(storage.saved.map((item) => item.recordedAt)).toEqual([at(1).recordedAt, at(maxAgeMinutes + 1).recordedAt]);
  });

  it('una medición que el backend rechaza (422) se descarta y no traba la cola', async () => {
    backend.online = false;
    const delivery = openApp(storage, backend);
    await settle(delivery.deliver(at(0)));
    backend.online = true;
    backend.rejects.add(at(0).recordedAt);

    await settle(delivery.deliver(at(1)));

    expect(backend.received).toEqual([at(1).recordedAt]);
    expect(storage.saved).toEqual([]);
  });

  it('no envía mediciones de otra cuenta con la sesión actual', async () => {
    storage.saved = [at(0, 'owner-2')];
    const delivery = openApp(storage, backend);

    await settle(delivery.deliver(at(1)));

    expect(backend.received).toEqual([at(1).recordedAt]);
    expect(storage.saved).toEqual([at(0, 'owner-2')]);
  });
});
