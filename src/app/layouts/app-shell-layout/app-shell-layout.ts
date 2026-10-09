import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { routeTransitionAnimation } from '../../core/animations/route-transition.animation';
import { SidebarNav } from '../../shared/components/sidebar-nav/sidebar-nav';
import { NavItem } from '../../shared/components/sidebar-nav/nav-item.model';
import { TopBar } from '../../shared/components/top-bar/top-bar';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { RuntimeEnvironmentService } from '../../core/runtime/runtime-environment.service';
import { APP_PATHS } from '../../core/routing/app-paths';

const USER_NAV_ITEMS: NavItem[] = [
  { labelKey: 'user.dashboard.title', route: APP_PATHS.userDashboard, icon: 'dashboard' },
  { labelKey: 'user.securityAssistant.title', route: APP_PATHS.securityAssistant, icon: 'shield' },
  { labelKey: 'user.alertsCenter.title', route: APP_PATHS.alerts, icon: 'bell' },
  { labelKey: 'user.devicesMap.title', route: APP_PATHS.devices, icon: 'devices' },
  { labelKey: 'user.familyMode.title', route: APP_PATHS.familyMode, icon: 'home' },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { labelKey: 'admin.dashboard.title', route: APP_PATHS.adminDashboard, icon: 'dashboard' },
  { labelKey: 'admin.networkSupervision.title', route: APP_PATHS.networkSupervision, icon: 'home' },
  { labelKey: 'admin.userManagement.title', route: APP_PATHS.adminUsers, icon: 'users' },
];

const DOWNLOAD_NAV_ITEM: NavItem = { labelKey: 'user.download.title', route: APP_PATHS.download, icon: 'download' };

const PROFILE_NAV_ITEM: NavItem = {
  labelKey: 'auth.profile.title',
  route: APP_PATHS.profile,
  icon: 'user',
};

// Shell común para usuario y admin: lo único que cambia es qué opciones de menú se muestran.
@Component({
  selector: 'app-shell-layout',
  imports: [RouterOutlet, SidebarNav, TopBar, TranslatePipe],
  templateUrl: './app-shell-layout.html',
  styleUrl: './app-shell-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [routeTransitionAnimation],
})
export class AppShellLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly isDesktop = inject(RuntimeEnvironmentService).isDesktop;

  protected readonly navItems = computed<NavItem[]>(() => {
    if (this.auth.role() === 'admin') {
      return [...ADMIN_NAV_ITEMS, PROFILE_NAV_ITEM];
    }
    // "Descargar" solo en la web: en el escritorio la app ya está instalada.
    const downloadItems = this.isDesktop ? [] : [DOWNLOAD_NAV_ITEM];
    return [...USER_NAV_ITEMS, ...downloadItems, PROFILE_NAV_ITEM];
  });

  /** Menú lateral como cajón en pantallas angostas; en escritorio siempre se ve y esto no hace nada. */
  protected readonly isNavOpen = signal(false);

  constructor() {
    // Al elegir una sección cierro el cajón para que se vea la pantalla elegida.
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.isNavOpen.set(false));
  }

  protected toggleNav(): void {
    this.isNavOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.isNavOpen.set(false);
  }

  protected onSignOut(): void {
    this.auth.signOut().subscribe(() => this.router.navigateByUrl(APP_PATHS.login));
  }
}
