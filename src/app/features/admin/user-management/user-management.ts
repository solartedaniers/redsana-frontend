import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { UsersRepository } from '../../../core/repositories/users.repository';
import { ManagedUser, UserRole } from '../../../core/models/user.model';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { I18nService } from '../../../core/i18n/i18n.service';

@Component({
  selector: 'app-user-management',
  imports: [ReactiveFormsModule, PageHeader, TranslatePipe],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserManagement {
  private readonly repository = inject(UsersRepository);
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('userDialog');

  protected readonly users = signal<ManagedUser[]>([]);
  protected readonly editingUserId = signal<string | null>(null);
  protected readonly errorKey = signal<string | null>(null);
  // El backend rechaza que el admin se quite su propio acceso (409); aquí ni se ofrece.
  protected readonly editingSelf = computed(() => this.editingUserId() === this.auth.currentUser()?.id);

  protected readonly form = this.formBuilder.nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['standard' as UserRole, Validators.required],
  });

  constructor() {
    this.reloadUsers();
  }

  protected openCreateDialog(): void {
    this.editingUserId.set(null);
    this.errorKey.set(null);
    this.form.reset({ fullName: '', email: '', role: 'standard' });
    this.form.controls.role.enable();
    this.dialogRef().nativeElement.showModal();
  }

  protected openEditDialog(user: ManagedUser): void {
    this.editingUserId.set(user.id);
    this.errorKey.set(null);
    this.form.reset({ fullName: user.fullName, email: user.email, role: user.role });
    if (this.isCurrentUser(user)) {
      this.form.controls.role.disable();
    } else {
      this.form.controls.role.enable();
    }
    this.dialogRef().nativeElement.showModal();
  }

  protected isCurrentUser(user: ManagedUser): boolean {
    return user.id === this.auth.currentUser()?.id;
  }

  protected closeDialog(): void {
    this.dialogRef().nativeElement.close();
  }

  protected submit(): void {
    if (this.form.invalid) {
      return;
    }
    this.errorKey.set(null);
    const payload = this.form.getRawValue();
    const editingId = this.editingUserId();

    const request = editingId
      ? this.repository.updateUser(editingId, payload)
      : this.repository.createUser(payload);

    request.subscribe({
      next: () => {
        this.closeDialog();
        this.reloadUsers();
      },
      error: (error: Error) => this.errorKey.set(error.message),
    });
  }

  protected deleteUser(user: ManagedUser): void {
    if (!confirm(this.i18n.translate('admin.userManagement.deleteConfirm'))) {
      return;
    }
    this.repository.deleteUser(user.id).subscribe(() => this.reloadUsers());
  }

  private reloadUsers(): void {
    this.repository.getUsers().subscribe((users) => this.users.set(users));
  }
}
