/**
 * Campfire Banter — Scheduler + Post/Broadcast (Phases 4 & 5)
 *
 * Sweeps every SWEEP_INTERVAL_MS. For each qualifying campground, generates
 * a banter beat and posts it with staggered delays into the public campfire.
 */

import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import { pickFact } from './factPicker';
import { generateBanter, BanterBeat } from './generateBanter';

const prisma = new PrismaClient() as any;

// ── Constants (named, tunable) ─────────────────────────────────────────
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;         // 5 minutes
const IDLE_GATE_MS = 15 * 60 * 1000;             // 15 min since last human message
const COOLDOWN_MS = 25 * 60 * 1000;              // 25 min between banter per campground
const MAX_CAMPGROUNDS_PER_SWEEP = 5;             // bound API cost
const JITTER_CHANCE = 0.6;                        // 60% chance a qualifying campground fires
const LINE_DELAY_MS = 2000;                       // 2s between posted lines
const REACTION_DELAY_MS = 1500;                   // 1.5s after last line for reaction

// Track last banter time per campground (in-memory; resets on deploy, which is fine)
const lastBanterMap = new Map<string, number>();

// ── Helpers ────────────────────────────────────────────────────────────

async function getIdleCampgrounds(): Promise<{ campgroundId: string; roomId: string; campgroundName: string }[]> {
  const now = Date.now();
  const idleSince = new Date(now - IDLE_GATE_MS);

  // Find active campfire rooms with checked-in users
  const activeRooms = await prisma.campfireRoom.findMany({
    where: { isActive: true },
    select: {
      id: true,
      campgroundId: true,
      campground: { select: { name: true } },
    },
  });

  const candidates: { campgroundId: string; roomId: string; campgroundName: string }[] = [];

  for (const room of activeRooms) {
    // Must have at least 1 checked-in camper
    const checkedInCount = await prisma.checkIn.count({
      where: { campgroundId: room.campgroundId, isActive: true },
    });
    if (checkedInCount < 1) continue;

    // Check idle gate: no human message in the last IDLE_GATE_MS
    const recentHumanMsg = await prisma.campfireMessage.findFirst({
      where: {
        roomId: room.id,
        isSystem: false,
        isHitch: false,
        isBanter: false,
        userId: { not: null },
        createdAt: { gt: idleSince },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recentHumanMsg) continue;

    // Check cooldown
    const lastBanter = lastBanterMap.get(room.campgroundId) || 0;
    if (now - lastBanter < COOLDOWN_MS) continue;

    // Jitter roll
    if (Math.random() > JITTER_CHANCE) continue;

    candidates.push({
      campgroundId: room.campgroundId,
      roomId: room.id,
      campgroundName: room.campground.name,
    });
  }

  // Cap per sweep
  return candidates.slice(0, MAX_CAMPGROUNDS_PER_SWEEP);
}

/** Re-check idle gate immediately before posting (race condition guard). */
async function isStillIdle(roomId: string): Promise<boolean> {
  const idleSince = new Date(Date.now() - IDLE_GATE_MS);
  const recentHuman = await prisma.campfireMessage.findFirst({
    where: {
      roomId,
      isSystem: false,
      isHitch: false,
      isBanter: false,
      userId: { not: null },
      createdAt: { gt: idleSince },
    },
  });
  return !recentHuman;
}

// ── Post + Broadcast (Phase 5) ─────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function postBanterBeat(
  io: Server,
  beat: BanterBeat,
  roomId: string,
  campgroundId: string,
): Promise<void> {
  const banterGroupId = `banter_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const campfire = io.of('/campfire');

  for (let i = 0; i < beat.lines.length; i++) {
    const line = beat.lines[i];

    // Re-check idle before each post
    if (i > 0) {
      const stillIdle = await isStillIdle(roomId);
      if (!stillIdle) {
        console.log(`[Banter] Human spoke mid-beat at ${campgroundId}, aborting.`);
        return;
      }
    }

    const msg = await prisma.campfireMessage.create({
      data: {
        roomId,
        userId: null,
        isSystem: true,
        isBanter: true,
        characterKey: line.character.toLowerCase(),
        banterGroupId,
        content: line.text,
      },
    });

    campfire.to(campgroundId).emit('message:new', {
      id: msg.id,
      content: msg.content,
      createdAt: msg.createdAt,
      isSystem: true,
      isHitch: false,
      isBanter: true,
      characterKey: line.character.toLowerCase(),
      banterGroupId,
    });

    if (i < beat.lines.length - 1 || beat.reaction) {
      await sleep(LINE_DELAY_MS);
    }
  }

  // Optional reaction
  if (beat.reaction) {
    const stillIdle = await isStillIdle(roomId);
    if (!stillIdle) return;

    await sleep(REACTION_DELAY_MS);

    const reactionMsg = await prisma.campfireMessage.create({
      data: {
        roomId,
        userId: null,
        isSystem: true,
        isBanter: true,
        characterKey: beat.reaction.character.toLowerCase(),
        banterGroupId,
        content: beat.reaction.text,
      },
    });

    campfire.to(campgroundId).emit('message:new', {
      id: reactionMsg.id,
      content: reactionMsg.content,
      createdAt: reactionMsg.createdAt,
      isSystem: true,
      isHitch: false,
      isBanter: true,
      characterKey: beat.reaction.character.toLowerCase(),
      banterGroupId,
      isReaction: true,
    });
  }
}

// ── Sweep ──────────────────────────────────────────────────────────────

async function runBanterSweep(io: Server): Promise<void> {
  try {
    const campgrounds = await getIdleCampgrounds();
    if (campgrounds.length === 0) return;

    console.log(`[Banter] Sweep found ${campgrounds.length} idle campground(s).`);

    for (const cg of campgrounds) {
      try {
        // Phase 2: pick fact
        const fact = await pickFact(cg.campgroundId);

        // Phase 3: generate beat
        const beat = await generateBanter({ campgroundName: cg.campgroundName, fact });
        if (!beat) continue;

        // Final idle check before posting
        const stillIdle = await isStillIdle(cg.roomId);
        if (!stillIdle) {
          console.log(`[Banter] ${cg.campgroundName} no longer idle, skipping.`);
          continue;
        }

        // Phase 5: post + broadcast
        await postBanterBeat(io, beat, cg.roomId, cg.campgroundId);

        // Record cooldown
        lastBanterMap.set(cg.campgroundId, Date.now());
        console.log(`[Banter] Posted beat at ${cg.campgroundName}.`);
      } catch (e: any) {
        console.error(`[Banter] Error for ${cg.campgroundName}:`, e?.message || e);
      }
    }
  } catch (e: any) {
    console.error('[Banter] Sweep error:', e?.message || e);
  }
}

// ── Registration (called from index.ts) ────────────────────────────────

export function registerBanterScheduler(io: Server): void {
  console.log('[Banter] Scheduler registered — sweep every 5 min.');
  setInterval(() => runBanterSweep(io), SWEEP_INTERVAL_MS);
  // First sweep 30s after boot (give DB connections time to warm)
  setTimeout(() => runBanterSweep(io), 30_000);
}
