import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NetworkMetricSample } from '../../../core/models/network.model';

const VIEWBOX_WIDTH = 300;
const VIEWBOX_HEIGHT = 80;

@Component({
  selector: 'app-history-chart',
  imports: [],
  templateUrl: './history-chart.html',
  styleUrl: './history-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryChart {
  readonly samples = input.required<NetworkMetricSample[]>();

  protected readonly polylinePoints = computed(() =>
    this.buildPoints()
      .map((point) => `${point.x},${point.y}`)
      .join(' ')
  );

  // Escala los puntos al viewBox usando min/max de la propia muestra: no hay
  // eje fijo porque la latencia esperada varía demasiado entre hogares.
  private buildPoints(): { x: number; y: number }[] {
    const data = this.samples();
    if (data.length === 0) {
      return [];
    }
    const latencies = data.map((sample) => sample.latencyMs);
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    const range = max - min || 1;
    const step = VIEWBOX_WIDTH / (data.length - 1 || 1);

    return data.map((sample, index) => ({
      x: index * step,
      y: VIEWBOX_HEIGHT - ((sample.latencyMs - min) / range) * VIEWBOX_HEIGHT,
    }));
  }
}
