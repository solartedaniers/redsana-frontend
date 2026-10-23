import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthUser, ManagedUser } from '../../../core/models/user.model';
import { UsersRepository } from '../../../core/repositories/users.repository';
import { UserManagement } from './user-management';

const ME: ManagedUser = { id: 'me', fullName: 'Yo', email: 'yo@example.invalid', role: 'admin', status: 'active', createdAt: '2026-10-01T00:00:00Z' };
const OTHER: ManagedUser = { ...ME, id: 'other', fullName: 'Otra', email: 'otra@example.invalid', role: 'standard' };

async function render() {
  // jsdom no implementa <dialog>: basta con que abrirlo no falle.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  const currentUser = signal<AuthUser | null>({ id: ME.id, email: ME.email, fullName: ME.fullName, avatarUrl: null, role: 'admin' });
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { currentUser: computed(() => currentUser()) } },
      { provide: UsersRepository, useValue: { getUsers: vi.fn(() => of([ME, OTHER])), deleteUser: vi.fn(() => of(undefined)) } },
    ],
  });
  const fixture = TestBed.createComponent(UserManagement);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const row = (name: string) => [...element.querySelectorAll('tbody tr')].find((tr) => tr.textContent?.includes(name))!;
  const openEdit = (name: string) => {
    row(name).querySelector<HTMLButtonElement>('.link-button:not(.danger)')!.click();
    fixture.detectChanges();
  };
  return { fixture, element, row, openEdit };
}

describe('UserManagement: el admin sobre sí mismo', () => {
  it('oculta Borrar solo en la fila del admin que está dentro', async () => {
    const { row } = await render();

    expect(row(ME.fullName).querySelector('.danger')).toBeNull();
    expect(row(OTHER.fullName).querySelector('.danger')).not.toBeNull();
  });

  it('al editarse a sí mismo el rol queda bloqueado y explica por qué', async () => {
    const { element, openEdit } = await render();

    openEdit(ME.fullName);

    expect(element.querySelector<HTMLSelectElement>('select')!.disabled).toBe(true);
    expect(element.querySelector('.field-note')?.textContent?.trim()).toBe('admin.userManagement.form.ownRoleLocked');
  });

  it('al editar a otro usuario después el rol vuelve a poder cambiarse', async () => {
    const { element, openEdit } = await render();

    openEdit(ME.fullName);
    openEdit(OTHER.fullName);

    expect(element.querySelector<HTMLSelectElement>('select')!.disabled).toBe(false);
    expect(element.querySelector('.field-note')).toBeNull();
  });
});
