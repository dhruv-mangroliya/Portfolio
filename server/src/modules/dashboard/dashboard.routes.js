// Admin overview: content counts and latest enquiries.
import { Router } from 'express';
import { Message, Profile } from '../../models/index.js';
import { COLLECTIONS } from '../collections/collections.registry.js';

async function getOverview() {
  const keys = Object.keys(COLLECTIONS);
  const [counts, total, unread, recent, profile] = await Promise.all([
    Promise.all(
      keys.map(async (k) => {
        const Model = COLLECTIONS[k].Model;
        const [all, hidden] = await Promise.all([Model.countDocuments(), Model.countDocuments({ hidden: true })]);
        return [k, { total: all, hidden }];
      })
    ),
    Message.countDocuments(),
    Message.countDocuments({ read: false }),
    Message.find().sort({ createdAt: -1 }).limit(5),
    Profile.findOne({ key: 'main' }).select('name updatedAt'),
  ]);
  return {
    counts: Object.fromEntries(counts),
    messages: { total, unread },
    recentMessages: recent,
    profile: profile && { name: profile.name, updatedAt: profile.updatedAt },
  };
}

export const dashboardRoutes = Router().get('/', async (_req, res) => res.json(await getOverview()));
