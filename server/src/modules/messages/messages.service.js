import { Message } from '../../models/index.js';
import { NotFound } from '../../utils/errors.js';

export const createMessage = (data) => Message.create(data);

export async function listMessages({ status, page, limit }) {
  const filter = status === 'unread' ? { read: false } : {};
  const [items, total, unread] = await Promise.all([
    Message.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Message.countDocuments(filter),
    Message.countDocuments({ read: false }),
  ]);
  return { items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), unread };
}

export async function setRead(id, read) {
  const msg = await Message.findByIdAndUpdate(id, { read }, { new: true });
  if (!msg) throw NotFound('Message not found.');
  return msg;
}

export async function deleteMessage(id) {
  if (!(await Message.findByIdAndDelete(id))) throw NotFound('Message not found.');
}
