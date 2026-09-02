import { GraphQLError } from 'graphql';

/**
 * ────────────────────────────────────────────────────────────────────────────
 * APP ERROR HIERARCHY
 * ────────────────────────────────────────────────────────────────────────────
 * Every intentional failure thrown anywhere in the backend is one of these.
 * Each carries a stable GraphQL `extensions.code` the client can switch on.
 */
export class AppError extends GraphQLError {
  constructor(message: string, code: string) {
    super(message, { extensions: { code } });
    this.name = new.target.name;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required.') {
    super(message, 'UNAUTHENTICATED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied.') {
    super(message, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed.') {
    super(message, 'BAD_USER_INPUT');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found.') {
    super(message, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict with existing data.') {
    super(message, 'CONFLICT');
  }
}

export class VPNDetectedError extends AppError {
  constructor(message = 'VPN or Proxy detected.') {
    super(message, 'VPN_DETECTED');
  }
}

/** Fingerprint (WebAuthn) mode is ON but the staff has not enrolled a passkey yet. */
export class FingerprintNotRegisteredError extends AppError {
  constructor(message = 'Fingerprint not registered yet.') {
    super(message, 'FINGERPRINT_NOT_REGISTERED');
  }
}

/** FINGERPRINT mode requires a fresh WebAuthn assertion before a punch. */
export class FingerprintRequiredError extends AppError {
  constructor(message = 'Fingerprint verification is required to punch.') {
    super(message, 'FINGERPRINT_REQUIRED');
  }
}

export class GeofenceError extends AppError {
  constructor(message = 'Outside geofence boundary.') {
    super(message, 'GEOFENCE_VIOLATION');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many attempts. Please try again in a few minutes.') {
    super(message, 'TOO_MANY_ATTEMPTS');
  }
}

export class ApprovalPendingError extends AppError {
  constructor(message: string) {
    super(message, 'APPROVAL_PENDING');
  }
}

export class ApprovalRejectedError extends AppError {
  constructor(message: string) {
    super(message, 'APPROVAL_REJECTED');
  }
}

/** Thrown by the shared query executor when a DB operation fails. */
export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed.', original?: unknown) {
    super(message, 'INTERNAL_SERVER_ERROR');
    if (original) (this as { original?: unknown }).original = original;
  }

  /** Normalize any driver error into an AppError the client can consume. */
  public static from(error: unknown): AppError {
    if (error instanceof AppError) return error;

    const anyErr = error as { code?: number | string; message?: string; cause?: { code?: number | string } };
    // Postgres surfaces the SQLSTATE on the error itself and/or on `.cause`
    // (drizzle wraps the driver error). 23505 = unique_violation.
    const code = anyErr?.code ?? anyErr?.cause?.code;
    // Mongo duplicate-key (11000) OR Postgres unique_violation (23505).
    if (code === 11000 || code === '23505') {
      return new ConflictError('A record with these unique details already exists.');
    }
    return new DatabaseError(anyErr?.message || 'Database operation failed.', error);
  }
}
