export type UserRole = "USER" | "ADMIN";

export interface AuthContext {
  clerkUserId: string;
  role: UserRole;
  email?: string;
  claims?: Record<string, unknown>;
}

