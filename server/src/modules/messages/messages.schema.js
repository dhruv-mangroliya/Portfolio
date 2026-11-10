import { z } from 'zod';
import { zBool, zObjectId } from '../../utils/validators.js';

export const listQuery = z.object({
  status: z.enum(['all', 'unread']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const idParams = z.object({ id: zObjectId });
export const updateSchema = z.object({ read: zBool });
