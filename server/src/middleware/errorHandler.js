// Central error handling: every error becomes { error: { code, message, fields?, requestId } }.
import mongoose from 'mongoose';
import { AppError } from '../utils/errors.js';

export function notFound(req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found.`));
}

/** Maps known library errors to AppErrors; returns null for unexpected errors. */
function normalise(err) {
  if (err instanceof AppError) return err;
  if (err instanceof mongoose.Error.ValidationError) {
    const fields = Object.fromEntries(Object.entries(err.errors).map(([k, e]) => [k, e.message]));
    return new AppError(400, 'VALIDATION_ERROR', Object.values(fields)[0] ?? 'Invalid data.', { fields });
  }
  if (err instanceof mongoose.Error.CastError) {
    return err.path === '_id'
      ? new AppError(404, 'NOT_FOUND', 'Item not found.')
      : new AppError(400, 'BAD_REQUEST', `Invalid value for "${err.path}".`);
  }
  if (err?.code === 11000) return new AppError(409, 'CONFLICT', 'That item already exists.');
  if (err?.type === 'entity.too.large') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request is too large.');
  if (err?.type === 'entity.parse.failed') return new AppError(400, 'BAD_REQUEST', 'Malformed JSON body.');
  if (/^Mongo(ServerSelection|Network|NotConnected)Error$/.test(err?.name ?? '')) {
    return new AppError(503, 'SERVICE_UNAVAILABLE', 'The database is temporarily unavailable.');
  }
  return null;
}

// Express recognises error handlers by their 4 arguments.
export function errorHandler(err, req, res, _next) {
  const known = normalise(err);
  if (!known) req.log?.error({ err }, 'Unhandled error');
  else req.log?.debug(`${known.code}: ${known.message}`);

  if (res.headersSent) return;
  res.status(known?.status ?? 500).json({
    error: {
      code: known?.code ?? 'INTERNAL_ERROR',
      message: known?.message ?? 'Something went wrong on our side. Please try again.',
      ...(known?.details?.fields && { fields: known.details.fields }),
      requestId: req.id,
    },
  });
}
