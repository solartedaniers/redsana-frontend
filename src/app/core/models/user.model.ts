export type UserRole = 'standard' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: UserRole;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  expiresAt: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
}

/** Sin email: el correo se muestra en el perfil pero no se edita. */
export interface ProfileUpdatePayload {
  fullName: string;
}

export interface PasswordChangePayload {
  currentPassword: string;
  newPassword: string;
}

export type ManagedUserStatus = 'active' | 'suspended';

export interface ManagedUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: ManagedUserStatus;
  createdAt: string;
}

export interface ManagedUserCreatePayload {
  fullName: string;
  email: string;
  role: UserRole;
}

export type ManagedUserUpdatePayload = Partial<
  Pick<ManagedUser, 'fullName' | 'email' | 'role' | 'status'>
>;
