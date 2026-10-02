import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export const OPERATOR_COOKIE = 'her-operator';
export const SESSION_MS = 8 * 60 * 60 * 1000;
const hex = /^[a-f0-9]{64}$/;
const hashPattern = /^scrypt\$32768\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/;
const equal = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, Buffer.from(salt, 'hex'), 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}
export function validOperatorKey(key: string, configured: string) { return hex.test(configured) && hex.test(key) && equal(key, configured); }
export function authConfigured(hash: string, secret: string) { return hashPattern.test(hash) && hex.test(secret); }
export async function passwordHash(password: string) {
  if (password.length < 24 || password.length > 256) throw new Error('Use a unique password of at least 24 characters.');
  const salt = randomBytes(16).toString('hex');
  return `scrypt$32768$8$1$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function passwordMatches(password: unknown, hash: string) {
  const parsed = hashPattern.exec(hash);
  if (!parsed || typeof password !== 'string' || password.length < 24 || password.length > 256) return false;
  return timingSafeEqual(await derive(password, parsed[1]), Buffer.from(parsed[2], 'hex'));
}
function sign(value: string, secret: string, hash: string) { return createHmac('sha256', secret).update(`${hash}:${value}`).digest('hex'); }
export function newSession(secret: string, hash: string, now = Date.now()) {
  if (!authConfigured(hash, secret)) throw new Error('Operator authentication is not configured.');
  const value = `${now + SESSION_MS}.${randomBytes(32).toString('hex')}`;
  return `${value}.${sign(value, secret, hash)}`;
}
export function sessionValid(cookie: string | null, secret: string, hash: string, now = Date.now()) {
  if (!authConfigured(hash, secret)) return false;
  const raw = cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${OPERATOR_COOKIE}=`))?.slice(OPERATOR_COOKIE.length + 1) || '';
  const parsed = /^(\d{13})\.([a-f0-9]{64})\.([a-f0-9]{64})$/.exec(raw);
  if (!parsed || +parsed[1] <= now || +parsed[1] > now + SESSION_MS) return false;
  return equal(parsed[3], sign(`${parsed[1]}.${parsed[2]}`, secret, hash));
}
export function sessionCookie(key: string, value: string, secure: boolean) {
  return `${OPERATOR_COOKIE}=${value}; Path=/operator/${key}; HttpOnly; SameSite=Strict; Max-Age=${value ? SESSION_MS / 1000 : 0}${secure ? '; Secure' : ''}`;
}
export function throttleKey(ip: string, secret: string) { return createHmac('sha256', secret).update(ip).digest('hex'); }
