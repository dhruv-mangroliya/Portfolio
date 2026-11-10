// Password hashing with Node's built-in scrypt. Stored format: "scrypt:<salt hex>:<hash hex>".
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const KEY_LEN = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, KEY_LEN);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [alg, salt, hex] = String(stored ?? '').split(':');
  if (alg !== 'scrypt' || !salt || !hex) return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = await scrypt(password, salt, expected.length || KEY_LEN);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
