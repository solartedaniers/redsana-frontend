import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../icon/icon';
import { NavItem } from './nav-item.model';

// Presentacional a propósito: quién ve qué item (rol admin/standard) lo
// decide el layout que la usa, no este componente.
@Component({
  selector: 'app-sidebar-nav',
  imports: [RouterLink, RouterLinkActive, TranslatePipe, Icon],
  templateUrl: './sidebar-nav.html',
  styleUrl: './sidebar-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarNav {
  readonly items = input.required<NavItem[]>();
}
