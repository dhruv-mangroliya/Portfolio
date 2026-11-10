// Typed HTTP errors. Anything thrown inside a route ends up in middleware/errorHandler.js,
// which turns it into { error: { code, message, fields?, requestId } }.
export class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const BadRequest = (message = 'Bad request.') => new AppError(400, 'BAD_REQUEST', message);
export const ValidationFailed = (message, fields) => new AppError(400, 'VALIDATION_ERROR', message, { fields });
export const Unauthorized = (message = 'Please sign in to continue.') => new AppError(401, 'UNAUTHORIZED', message);
export const NotFound = (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message);
export const ServiceUnavailable = (message = 'The database is temporarily unavailable. Please try again shortly.') =>
  new AppError(503, 'SERVICE_UNAVAILABLE', message);
