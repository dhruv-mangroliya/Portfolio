import { parse } from '../../utils/validators.js';
import * as svc from './collections.service.js';

export const list = async (req, res) => res.json({ items: await svc.list(req.collection.Model) });

export const get = async (req, res) => res.json({ item: await svc.get(req.collection.Model, req.valid.params.id) });

export async function create(req, res) {
  const item = await svc.create(req.collection.Model, parse(req.collection.create, req.body));
  res.status(201).location(`${req.baseUrl}/${item.id}`).json({ item });
}

export async function update(req, res) {
  const { Model, update: schema } = req.collection;
  res.json({ item: await svc.update(Model, req.valid.params.id, parse(schema, req.body)) });
}

export async function remove(req, res) {
  await svc.remove(req.collection.Model, req.valid.params.id);
  res.status(204).end();
}

export const reorder = async (req, res) =>
  res.json({ items: await svc.reorder(req.collection.Model, req.valid.body.ids) });
