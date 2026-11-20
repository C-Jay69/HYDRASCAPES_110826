/** Booking-domain errors, mapped to HTTP statuses by the API routes. */

export class BookingConflictError extends Error {
  constructor(message = 'Those dates are no longer available') {
    super(message);
    this.name = 'BookingConflictError';
  }
}

export class BookingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingValidationError';
  }
}

export class BookingNotFoundError extends Error {
  constructor(message = 'Booking not found') {
    super(message);
    this.name = 'BookingNotFoundError';
  }
}

export class BookingPermissionError extends Error {
  constructor(message = 'You do not have permission to change this booking') {
    super(message);
    this.name = 'BookingPermissionError';
  }
}
