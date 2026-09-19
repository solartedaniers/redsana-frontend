import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { AvatarStorageGateway } from '../../../core/avatar-storage/avatar-storage.gateway';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Icon } from '../../../shared/components/icon/icon';
import { passwordsMatchValidator } from '../../../core/validators/passwords-match.validator';

const MIN_PASSWORD_LENGTH = 8;

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, TranslatePipe, PageHeader, Icon],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile {
  private readonly fb = inject(FormBuilder);
  private readonly avatarStorage = inject(AvatarStorageGateway);
  protected readonly auth = inject(AuthService);

  protected readonly isSavingProfile = signal(false);
  protected readonly profileErrorKey = signal<string | null>(null);
  protected readonly profileSaved = signal(false);

  protected readonly isUploadingAvatar = signal(false);
  protected readonly avatarErrorKey = signal<string | null>(null);

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

  protected onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite volver a elegir el mismo archivo si falla
    if (!file) {
      return;
    }

    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      return;
    }

    this.isUploadingAvatar.set(true);
    this.avatarErrorKey.set(null);
    this.avatarStorage.uploadAvatar(userId, file).subscribe({
      next: (avatarUrl) => {
        this.auth.updateAvatar(avatarUrl).subscribe({
          next: () => this.isUploadingAvatar.set(false),
          error: (error: Error) => {
            this.isUploadingAvatar.set(false);
            this.avatarErrorKey.set(error.message);
          },
        });
      },
      error: (error: Error) => {
        this.isUploadingAvatar.set(false);
        this.avatarErrorKey.set(error.message);
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
