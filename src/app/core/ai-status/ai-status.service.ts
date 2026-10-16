import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  Observable,
  Subject,
  catchError,
  concat,
  concatMap,
  distinctUntilChanged,
  from,
  of,
  startWith,
  switchMap,
  takeWhile,
  timer,
} from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AiAvailability } from '../models/ai.model';
import { AiStatusRepository } from '../repositories/ai-status.repository';
import { AI_STATUS_CONFIG, buildPollDelays } from './ai-status.config';

/** idle: sin sesión no hay IA que mostrar. */
export type AiStatusState = AiAvailability | 'idle';

/**
 * Tras iniciar sesión despierto la IA y consulto su estado con backoff hasta que esté lista o se agote el tope.
 * Como las mediciones, switchMap corta el ciclo al cerrar sesión o al reintentar, sin dejar consultas vivas.
 */
@Injectable({ providedIn: 'root' })
export class AiStatusService {
  private readonly repository = inject(AiStatusRepository);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly isAuthenticated$ = toObservable(inject(AuthService).isAuthenticated);
  private readonly restart$ = new Subject<void>();
  private readonly pollDelays = buildPollDelays(AI_STATUS_CONFIG);

  readonly status = signal<AiStatusState>('idle');
  readonly isReady = computed(() => this.status() === 'ready');

  start(): void {
    // Al prerenderizar no hay sesión ni red, y un temporizador vivo no dejaría terminar el prerender.
    if (!this.isBrowser) {
      return;
    }
    this.isAuthenticated$
      .pipe(
        switchMap((isAuthenticated) =>
          isAuthenticated
            ? this.restart$.pipe(
                startWith(undefined),
                switchMap(() => this.warmUpCycle())
              )
            : of<AiStatusState>('idle')
        )
      )
      .subscribe((status) => this.status.set(status));
  }

  /** El botón de reintentar tras "no disponible". */
  retry(): void {
    this.restart$.next();
  }

  /** El chat recibió "encendiendo": la IA volvió a dormirse, así que la despierto otra vez. */
  reportWarmingUp(): void {
    if (this.status() !== 'warming_up') {
      this.restart$.next();
    }
  }

  private warmUpCycle(): Observable<AiAvailability> {
    const polls$ = from(this.pollDelays).pipe(
      concatMap((delayMs) => timer(delayMs).pipe(switchMap(() => this.orWarmingUp(this.repository.getStatus()))))
    );
    // Si se agotan los intentos sin respuesta lista, la doy por no disponible (con botón de reintentar).
    return concat(of<AiAvailability>('warming_up'), this.orWarmingUp(this.repository.warmUp()), polls$, of<AiAvailability>('unavailable')).pipe(
      takeWhile((status) => status === 'warming_up', true),
      distinctUntilChanged()
    );
  }

  /** Un error de red es lo normal mientras Render despierta el backend: sigo esperando en vez de fallar. */
  private orWarmingUp(source: Observable<AiAvailability>): Observable<AiAvailability> {
    return source.pipe(catchError(() => of<AiAvailability>('warming_up')));
  }
}
