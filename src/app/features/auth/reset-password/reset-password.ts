import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { MIN_PASSWORD_LENGTH } from '../../../core/auth/password-policy';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { passwordsMatchValidator } from '../../../core/validators/passwords-match.validator';
import { STRONG_PASSWORD_ERROR, strongPasswordValidator } from '../../../core/validators/strong-password.validator';
import { Icon } from '../../../shared/components/icon/icon';
import { PasswordStrengthMeter } from '../../../shared/components/password-strength-meter/password-strength-meter';

/** checking: leyendo el enlace del correo; invalidLink: vencido o ya usado; done: contraseña cambiada. */
type ResetPasswordState = 'checking' | 'invalidLink' | 'form' | 'done';

// Destino del enlace del correo de recuperación: supabase-js ya abrió la sesión
// de recuperación con el token de la URL, aquí solo se fija la contraseña nueva.
@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, Icon, PasswordStrengthMeter],
  templateUrl: './reset-password.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPassword {
  protected readonly paths = APP_PATHS;
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly state = signal<ResetPasswordState>('checking');
  protected readonly strongPasswordError = STRONG_PASSWORD_ERROR;
  protected readonly isSubmitting = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH), strongPasswordValidator()]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator('password', 'confirmPassword') }
  );

  constructor() {
    this.auth.hasRecoverySession().subscribe((hasSession) => this.state.set(hasSession ? 'form' : 'invalidLink'));
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.errorKey.set(null);
    this.auth.resetPassword(this.form.getRawValue().password).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.state.set('done');
      },
      error: (error: Error) => {
        this.isSubmitting.set(false);
        this.errorKey.set(error.message);
      },
    });
  }
}
