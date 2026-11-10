import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { idParams, listQuery, updateSchema } from './messages.schema.js';
import * as svc from './messages.service.js';

export const messageRoutes = Router()
  .get('/', validate({ query: listQuery }), async (req, res) => res.json(await svc.listMessages(req.valid.query)))
  .patch('/:id', validate({ params: idParams, body: updateSchema }), async (req, res) =>
    res.json({ message: await svc.setRead(req.valid.params.id, req.valid.body.read) })
  )
  .delete('/:id', validate({ params: idParams }), async (req, res) => {
    await svc.deleteMessage(req.valid.params.id);
    res.status(204).end();
  });
