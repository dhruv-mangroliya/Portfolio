import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { NotFound } from '../../utils/errors.js';
import * as ctrl from './collections.controller.js';
import { COLLECTIONS } from './collections.registry.js';
import { idParams, reorderSchema } from './collections.schema.js';

const byId = validate({ params: idParams });

export const collectionRoutes = Router({ mergeParams: true })
  .use((req, _res, next) => {
    req.collection = COLLECTIONS[req.params.collection];
    next(req.collection ? undefined : NotFound(`Unknown collection "${req.params.collection}".`));
  })
  .get('/', ctrl.list)
  .post('/', ctrl.create)
  .put('/order', validate({ body: reorderSchema }), ctrl.reorder)
  .get('/:id', byId, ctrl.get)
  .patch('/:id', byId, ctrl.update)
  .delete('/:id', byId, ctrl.remove);
