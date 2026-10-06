import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { routeTransitionAnimation } from '../../core/animations/route-transition.animation';
import { SidebarNav } from '../../shared/components/sidebar-nav/sidebar-nav';
import { NavItem } from '../../shared/components/sidebar-nav/nav-item.model';
import { TopBar } from '../../shared/components/top-bar/top-bar';
import { NetworkBackground } from '../../shared/components/network-background/network-background';
import { RuntimeEnvironmentService } from '../../core/runtime/runtime-environment.service';

const USER_NAV_ITEMS: NavItem[] = [
  { labelKey: 'user.dashboard.title', route: '/user/dashboard', icon: 'dashboard' },
  { labelKey: 'user.securityAssistant.title', route: '/user/security-assistant', icon: 'shield' },
  { labelKey: 'user.alertsCenter.title', route: '/user/alerts', icon: 'bell' },
  { labelKey: 'user.devicesMap.title', route: '/user/devices', icon: 'devices' },
  { labelKey: 'user.familyMode.title', route: '/user/family-mode', icon: 'home' },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { labelKey: 'admin.dashboard.title', route: '/admin/dashboard', icon: 'dashboard' },
  { labelKey: 'admin.networkSupervision.title', route: '/admin/network-supervision', icon: 'home' },
  { labelKey: 'admin.userManagement.title', route: '/admin/users', icon: 'users' },
];

const DOWNLOAD_NAV_ITEM: NavItem = { labelKey: 'user.download.title', route: '/user/download', icon: 'download' };

const PROFILE_NAV_ITEM: NavItem = {
  labelKey: 'auth.profile.title',
  route: '/account/profile',
  icon: 'user',
};

// Shell compartido por usuario estándar y admin: la única diferencia entre
// ambos roles es qué items de navegación se muestran, no la estructura.
@Component({
  selector: 'app-shell-layout',
  imports: [RouterOutlet, SidebarNav, TopBar, NetworkBackground],
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

  protected onSignOut(): void {
    this.auth.signOut().subscribe(() => this.router.navigateByUrl('/auth/login'));
  }
}
