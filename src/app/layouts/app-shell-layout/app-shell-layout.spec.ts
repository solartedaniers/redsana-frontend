import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/models/user.model';
import { RuntimeEnvironmentService } from '../../core/runtime/runtime-environment.service';
import { AppShellLayout } from './app-shell-layout';

class TestableShell extends AppShellLayout {
  routes(): string[] {
    return this.navItems().map((item) => item.route);
  }
}

function navRoutes(role: UserRole, isDesktop: boolean): string[] {
  TestBed.configureTestingModule({
    providers: [
      TestableShell,
      { provide: AuthService, useValue: { role: signal(role) } },
      { provide: RuntimeEnvironmentService, useValue: { isDesktop } },
    ],
  });
  return TestBed.inject(TestableShell).routes();
}

describe('AppShellLayout navigation', () => {
  it('el usuario en la web ve "Descargar"', () => {
    expect(navRoutes('standard', false)).toContain('/user/download');
  });

  it('en la app de escritorio no aparece (ya está instalada)', () => {
    expect(navRoutes('standard', true)).not.toContain('/user/download');
  });

  it('el menú del admin no cambia', () => {
    expect(navRoutes('admin', false)).not.toContain('/user/download');
  });
});
