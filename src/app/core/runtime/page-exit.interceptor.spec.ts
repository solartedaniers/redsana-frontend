import { PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PAGE_EXIT_CANCEL_WINDOW_MS } from './page-exit.config';
import { pageExitInterceptor } from './page-exit.interceptor';
import { PageExitService } from './page-exit.service';

const URL = '/api/network-metrics/anomaly-status';

function setup(platform: 'browser' | 'server' = 'browser') {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([pageExitInterceptor])),
      provideHttpClientTesting(),
      { provide: PLATFORM_ID, useValue: platform },
    ],
  });
  const page = TestBed.inject(PageExitService);
  const http = TestBed.inject(HttpTestingController);
  const outcome = { error: undefined as unknown, value: undefined as unknown, completed: false };
  TestBed.inject(HttpClient)
    .get(URL)
    .subscribe({
      next: (value) => (outcome.value = value),
      error: (error) => (outcome.error = error),
      complete: () => (outcome.completed = true),
    });
  return { page, http, outcome };
}

// Lo que entrega el navegador cuando la petición se corta sin respuesta (recarga o red caída): status 0.
const cancel = (http: HttpTestingController) => http.expectOne(URL).error(new ProgressEvent('error'));
const fire = (type: string) => window.dispatchEvent(new Event(type));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  fire('pageshow');
  vi.useRealTimers();
});

describe('pageExitInterceptor', () => {
  it('al recargar, la cancelación que WebKit entrega entre beforeunload y pagehide no llega como error', () => {
    const { http, outcome } = setup();

    fire('beforeunload');
    cancel(http);
    fire('pagehide');

    expect(outcome).toEqual({ error: undefined, value: undefined, completed: false });
    http.verify();
  });

  it('una cancelación que llega después de pagehide tampoco cuenta como error', () => {
    const { http, outcome } = setup();

    fire('pagehide');
    cancel(http);

    expect(outcome.error).toBeUndefined();
  });

  it('con la página abierta, un status 0 (red caída) se sigue reportando', () => {
    const { http, outcome } = setup();

    cancel(http);

    expect(outcome.error).toBeInstanceOf(HttpErrorResponse);
    expect((outcome.error as HttpErrorResponse).status).toBe(0);
  });

  it('si beforeunload no terminó en salida (una descarga), pasado el margen un status 0 se vuelve a reportar', () => {
    const { http, outcome } = setup();

    fire('beforeunload');
    vi.advanceTimersByTime(PAGE_EXIT_CANCEL_WINDOW_MS);
    cancel(http);

    expect((outcome.error as HttpErrorResponse).status).toBe(0);
  });

  it('aunque la página se esté yendo, un error del servidor se sigue reportando', () => {
    const { http, outcome } = setup();

    fire('beforeunload');
    fire('pagehide');
    http.expectOne(URL).flush({ detail: 'boom' }, { status: 500, statusText: 'Internal Server Error' });

    expect((outcome.error as HttpErrorResponse).status).toBe(500);
  });

  it('las respuestas correctas pasan sin cambios', () => {
    const { http, outcome } = setup();

    http.expectOne(URL).flush({ status: 'ready' });

    expect(outcome).toEqual({ error: undefined, value: { status: 'ready' }, completed: true });
  });
});

describe('PageExitService', () => {
  it('pagehide la marca como saliendo y pageshow (vuelta desde la caché del navegador) lo deshace', () => {
    const { page, http } = setup();
    http.expectOne(URL).flush({});

    expect(page.isLeaving()).toBe(false);
    fire('beforeunload');
    fire('pagehide');
    vi.advanceTimersByTime(PAGE_EXIT_CANCEL_WINDOW_MS);
    expect(page.isLeaving()).toBe(true);
    fire('pageshow');
    expect(page.isLeaving()).toBe(false);
  });

  it('al prerenderizar no escucha la ventana', () => {
    const { page, http } = setup('server');
    http.expectOne(URL).flush({});

    fire('beforeunload');
    fire('pagehide');

    expect(page.isLeaving()).toBe(false);
  });
});
