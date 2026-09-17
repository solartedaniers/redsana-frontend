import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { passwordsMatchValidator } from '../../../core/validators/passwords-match.validator';

const MIN_PASSWORD_LENGTH = 8;

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, TranslatePipe, PageHeader],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile {
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);

  protected readonly isSavingProfile = signal(false);
  protected readonly profileErrorKey = signal<string | null>(null);
  protected readonly profileSaved = signal(false);

  protected readonly isChangingPassword = signal(false);
  protected readonly passwordErrorKey = signal<string | null>(null);
  protected readonly passwordChanged = signal(false);

  protected readonly profileForm = this.fb.nonNullable.group({
    fullName: [this.auth.currentUser()?.fullName ?? '', [Validators.required]],
    email: [this.auth.currentUser()?.email ?? '', [Validators.required, Validators.email]],
  });

  protected readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
      confirmNewPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator('newPassword', 'confirmNewPassword') }
  );

  protected saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.isSavingProfile.set(true);
    this.profileErrorKey.set(null);
    this.profileSaved.set(false);
    this.auth.updateProfile(this.profileForm.getRawValue()).subscribe({
      next: () => {
        this.isSavingProfile.set(false);
        this.profileSaved.set(true);
      },
      error: (error: Error) => {
        this.isSavingProfile.set(false);
        this.profileErrorKey.set(error.message);
      },
    });
  }

  protected changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.isChangingPassword.set(true);
    this.passwordErrorKey.set(null);
    this.passwordChanged.set(false);
    this.auth.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.isChangingPassword.set(false);
        this.passwordChanged.set(true);
        this.passwordForm.reset();
      },
      error: (error: Error) => {
        this.isChangingPassword.set(false);
        this.passwordErrorKey.set(error.message);
      },
    });
  }
}
