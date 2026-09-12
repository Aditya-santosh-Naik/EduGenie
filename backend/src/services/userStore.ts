// Local-first user store — plain JSON on disk, no cloud, no Docker.
// Replaces Firebase Auth + Firestore user profiles.

import { randomUUID, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

const DATA_DIR = path.resolve(process.cwd(), '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

export interface StoredUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string; // "salt:hash", both hex
  createdAt: string;
  xp: number;
  level: number;
  streak: number;
}

/** Shape sent to the client — never includes the password hash. */
export interface PublicUser {
  uid: string;
  email: string | null;
  displayName: string;
  isGuest: boolean;
  createdAt: string;
}

export function toPublicUser(user: StoredUser): PublicUser {
  return {
    uid: user.id,
    email: user.email,
    displayName: user.displayName,
    isGuest: false,
    createdAt: user.createdAt
  };
}

// ── Persistence ────────────────────────────────────────────────
// Reads are served from memory after first load; writes are serialized
// through `writeChain` so two concurrent signups can't clobber each other.

let cache: StoredUser[] | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

async function load(): Promise<StoredUser[]> {
  if (cache) return cache;
  try {
    const raw = await readFile(USERS_FILE, 'utf8');
    cache = JSON.parse(raw) as StoredUser[];
  } catch {
    // First run, or the file was removed — start empty.
    cache = [];
  }
  return cache;
}

async function persist(users: StoredUser[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  // Write to a temp file then rename, so a crash mid-write can't truncate
  // the user database.
  const tmp = `${USERS_FILE}.${randomUUID().slice(0, 8)}.tmp`;
  await writeFile(tmp, JSON.stringify(users, null, 2), 'utf8');
  await rename(tmp, USERS_FILE);
}

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task, task);
  writeChain = run.catch(() => {});
  return run;
}

// ── Password hashing ───────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ── Public API ─────────────────────────────────────────────────

export async function findByEmail(email: string): Promise<StoredUser | undefined> {
  const users = await load();
  const needle = email.trim().toLowerCase();
  return users.find((u) => u.email === needle);
}

export async function findById(id: string): Promise<StoredUser | undefined> {
  const users = await load();
  return users.find((u) => u.id === id);
}

export class EmailTakenError extends Error {
  constructor() {
    super('An account with this email already exists');
    this.name = 'EmailTakenError';
  }
}

export async function createUser(
  email: string,
  password: string,
  displayName: string
): Promise<StoredUser> {
  const normalized = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  return serialize(async () => {
    const users = await load();
    // Re-check inside the serialized section — two simultaneous signups with
    // the same email would both pass an earlier check.
    if (users.some((u) => u.email === normalized)) throw new EmailTakenError();

    const user: StoredUser = {
      id: randomUUID(),
      email: normalized,
      displayName: displayName.trim() || 'Student',
      passwordHash,
      createdAt: new Date().toISOString(),
      xp: 0,
      level: 1,
      streak: 0
    };

    users.push(user);
    await persist(users);
    return user;
  });
}

export async function verifyCredentials(
  email: string,
  password: string
): Promise<StoredUser | null> {
  const user = await findByEmail(email);
  if (!user) return null;
  const ok = await checkPassword(password, user.passwordHash);
  return ok ? user : null;
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<StoredUser, 'displayName' | 'xp' | 'level' | 'streak'>>
): Promise<StoredUser | null> {
  return serialize(async () => {
    const users = await load();
    const user = users.find((u) => u.id === id);
    if (!user) return null;
    Object.assign(user, patch);
    await persist(users);
    return user;
  });
}
