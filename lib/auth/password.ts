import "server-only";
import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Minimum bar for a workplace tool: 8+ chars, at least one letter and one
 * number. Not NIST-grade entropy scoring — deliberately simple so
 * non-technical technicians can actually remember their password, per the
 * spec's "simple enough for non-technical technicians" requirement.
 */
export function isPasswordStrongEnough(plain: string): boolean {
  return plain.length >= 8 && /[a-zA-Z]/.test(plain) && /[0-9]/.test(plain);
}
