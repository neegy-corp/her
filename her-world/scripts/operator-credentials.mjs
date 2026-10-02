import { randomBytes } from 'node:crypto';
import { passwordHash } from '../lib/operator-auth.ts';

const password = randomBytes(32).toString('base64url');
console.log('Store the password in your password manager. Only the hash goes into Vercel.');
console.log(`Operator password: ${password}`);
console.log(`HER_OPERATOR_PATH_KEY=${randomBytes(32).toString('hex')}`);
console.log(`HER_OPERATOR_PASSWORD_HASH=${await passwordHash(password)}`);
console.log(`HER_OPERATOR_SESSION_SECRET=${randomBytes(32).toString('hex')}`);
console.log(`HER_WALLET_READ_TOKEN=${randomBytes(32).toString('hex')}`);
