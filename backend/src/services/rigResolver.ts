/**
 * Shared Rig Resolver — finds a user's canonical rig.
 *
 * Checks: rigs owned by the user, rigs where user is a RigPilot, rigs where
 * user is a RigCoPilot. De-dups by id. Scores candidates so the real rig
 * (with name, cover photo, followers, content) always wins over a stub.
 *
 * Usage:
 *   const rig = await resolveUserRig(userId);                    // minimal select
 *   const rig = await resolveUserRig(userId, { id: true, ... }); // custom select
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

/** Minimal select for quick lookups (id + slug + key fields) */
const defaultSelect = {
  id: true,
  slug: true,
  ownerId: true,
  rigName: true,
  heroPhoto: true,
  coverPhotoUrl: true,
  rigClass: true,
  followerCount: true,
  totalMilesAllTime: true,
  year: true,
  make: true,
  model: true,
};

function rigScore(r: any): number {
  let s = 0;
  if (r.rigName) s += 100;
  if (r.heroPhoto || r.coverPhotoUrl) s += 50;
  if (r.followerCount) s += r.followerCount;
  if (r.totalMilesAllTime) s += 10;
  if (r.posts?.length) s += r.posts.length * 5;
  return s;
}

/**
 * Resolve the canonical rig for a user (owned OR co-pilot).
 * Returns the best-scoring rig, or null if the user has no rig at all.
 */
export async function resolveUserRig(userId: string, select?: Record<string, any>): Promise<any | null> {
  const sel = select || defaultSelect;

  const [ownedRigs, pilotRigs, coPilotRigs] = await Promise.all([
    prisma.rig.findMany({ where: { ownerId: userId }, select: sel }),
    prisma.rigPilot.findMany({ where: { userId }, select: { rig: { select: sel } } }),
    prisma.rigCoPilot.findMany({ where: { userId }, select: { rig: { select: sel } } }),
  ]);

  const candidates: any[] = [
    ...ownedRigs,
    ...pilotRigs.map((p: any) => p.rig),
    ...coPilotRigs.map((p: any) => p.rig),
  ];

  // De-dup by id
  const seen = new Map<string, any>();
  for (const r of candidates) {
    if (r?.id && !seen.has(r.id)) seen.set(r.id, r);
  }

  const unique = Array.from(seen.values());
  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0];

  // Score and pick best
  unique.sort((a, b) => rigScore(b) - rigScore(a));
  return unique[0];
}

/**
 * Quick resolver — just returns { id, slug } or null.
 * Useful for lookups that only need the rig ID.
 */
export async function resolveUserRigId(userId: string): Promise<{ id: string; slug: string } | null> {
  return resolveUserRig(userId, { id: true, slug: true, rigName: true, heroPhoto: true, coverPhotoUrl: true, followerCount: true, totalMilesAllTime: true });
}
