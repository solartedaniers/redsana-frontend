import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NetworkSupervisionRepository } from '../../../core/repositories/network-supervision.repository';
import { MonitoredHousehold } from '../../../core/models/admin.model';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { NetworkStatusLight } from '../../../shared/components/network-status-light/network-status-light';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-network-supervision',
  imports: [DatePipe, RouterLink, PageHeader, NetworkStatusLight, TranslatePipe],
  templateUrl: './network-supervision.html',
  styleUrl: './network-supervision.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkSupervision {
  private readonly repository = inject(NetworkSupervisionRepository);

  protected readonly households = signal<MonitoredHousehold[]>([]);

  constructor() {
    this.repository.getHouseholds().subscribe((households) => this.households.set(households));
  }
}
