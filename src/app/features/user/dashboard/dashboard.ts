import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map, timer } from 'rxjs';
import { NetworkMetricsRepository } from '../../../core/repositories/network-metrics.repository';
import {
  AnomalyDetectionStatus,
  NetworkMetricSample,
  NetworkMetricSnapshot,
  NetworkStatus,
} from '../../../core/models/network.model';
import { LatencySeverity } from '../../../core/domain/latency-severity';
import { latencyLabelKey } from '../../../core/domain/network-status-label';
import { hasMeasurement, isLiveMeasurement } from '../../../core/domain/measurement-freshness';
import { injectMeasurementClock } from '../../../core/network-measurement/measurement-clock';
import { MeasurementEmptyState } from '../../../shared/components/measurement-empty-state/measurement-empty-state';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { NetworkStatusLight } from '../../../shared/components/network-status-light/network-status-light';
import { NetworkStatusBadge } from '../../../shared/components/network-status-badge/network-status-badge';
import { MetricCard } from '../../../shared/components/metric-card/metric-card';
import { HistoryChart } from '../../../shared/components/history-chart/history-chart';
import { NetworkDiagnosisPanel } from '../../../shared/components/network-diagnosis-panel/network-diagnosis-panel';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { RuntimeEnvironmentService } from '../../../core/runtime/runtime-environment.service';
import { LocalNetworkDiagnosisService } from '../../../core/local-diagnosis/local-network-diagnosis.service';
import { LOCAL_DIAGNOSIS_CONFIG } from '../../../core/local-diagnosis/local-diagnosis.config';

const STATUS_AURA: Record<NetworkStatus, LatencySeverity | null> = {
  good: 'healthy',
  warning: 'warning',
  critical: 'critical',
  unknown: null,
};

@Component({
  selector: 'app-dashboard',
  imports: [
    PageHeader,
    NetworkStatusLight,
    NetworkStatusBadge,
    MetricCard,
    HistoryChart,
    NetworkDiagnosisPanel,
    MeasurementEmptyState,
    TranslatePipe,
    DatePipe,
    NgTemplateOutlet,
    RouterLink,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-severity]': 'aura()' },
})
export class Dashboard {
  protected readonly paths = APP_PATHS;
  protected readonly latencyLabelKey = latencyLabelKey;
  private readonly metricsRepository = inject(NetworkMetricsRepository);
  private readonly isDesktop = inject(RuntimeEnvironmentService).isDesktop;
  private readonly localDiagnosis = inject(LocalNetworkDiagnosisService);

  protected readonly snapshot = signal<NetworkMetricSnapshot | null>(null);
  protected readonly history = signal<NetworkMetricSample[]>([]);
  protected readonly anomalyStatus = signal<AnomalyDetectionStatus | null>(null);
  /** Tinte del aura ambiental; ninguno hasta que haya una medición real. */
  private readonly clock = injectMeasurementClock();
  /** false mientras el backend no tenga ninguna medición real (responde "unknown" con ceros). */
  protected readonly hasData = computed(() => hasMeasurement(this.snapshot()));
  protected readonly isLive = computed(() => isLiveMeasurement(this.snapshot(), Math.max(this.clock(), Date.now())));
  protected readonly aura = computed(() => STATUS_AURA[this.snapshot()?.status ?? 'unknown']);
  /** Hora local de la última respuesta del servidor (null si no llegó ninguna desde que se abrió esta pantalla): se
   * compara con la medición del equipo, que usa el mismo reloj. */
  private readonly snapshotReceivedAt = signal<number | null>(null);
  private readonly openedAt = Date.now();
  /** Solo escritorio: vuelve a evaluar el diagnóstico local cuando se cumple el silencio tras abrir la pantalla (el
   * reloj de medición avanza cada minuto). */
  private readonly silenceSinceOpening = this.isDesktop
    ? toSignal(timer(LOCAL_DIAGNOSIS_CONFIG.serverSilentAfterMs).pipe(map(() => true)), { initialValue: false })
    : signal(false);
  /**
   * Solo escritorio: con el servidor sin responder (internet caído o backend caído) el panel usa el diagnóstico hecho
   * en el equipo con su última medición, aunque desde que se abrió la pantalla no haya llegado ninguna respuesta del
   * servidor (se abrió durante el corte). Las tarjetas siguen mostrando lo último que guardó el servidor.
   */
  protected readonly offlineDiagnosis = computed(() => {
    const local = this.isDesktop ? this.localDiagnosis.current() : null;
    if (!local) {
      return null;
    }
    this.silenceSinceOpening();
    const receivedAt = this.snapshotReceivedAt();
    const silentSince = receivedAt ?? this.openedAt;
    const serverSilent = Math.max(this.clock(), Date.now()) - silentSince >= LOCAL_DIAGNOSIS_CONFIG.serverSilentAfterMs;
    const newerThanServer = receivedAt === null || Date.parse(local.recordedAt) > receivedAt;
    return serverSilent && newerThanServer ? local : null;
  });

  constructor() {
    // watchSnapshot ya reconsulta solo; takeUntilDestroyed evita que cada visita deje otro sondeo vivo para siempre.
    this.metricsRepository
      .watchSnapshot()
      .pipe(takeUntilDestroyed())
      .subscribe((snapshot) => {
        this.snapshot.set(snapshot);
        this.snapshotReceivedAt.set(Date.now());
      });
    // Si fallan, el panel queda como sin datos (gráfico vacío, sin aviso de calibración) en vez de dejar un error sin
    // manejar; el snapshot sigue sondeando por su cuenta.
    this.metricsRepository.getHistory().subscribe({
      next: (history) => this.history.set(history),
      error: () => this.history.set([]),
    });
    // Lo consulto una sola vez: el conteo solo importa mientras calibra.
    this.metricsRepository.getAnomalyStatus().subscribe({
      next: (status) => this.anomalyStatus.set(status),
      error: () => this.anomalyStatus.set(null),
    });
  }
}
