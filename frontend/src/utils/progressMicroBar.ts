const STATE_MILESTONES = [5, 10, 15, 20, 25, 30, 35, 40, 50];
const NIGHT_MILESTONES = [10, 25, 50, 100, 200, 365, 500, 1000];
const CAMPGROUND_MILESTONES = [5, 10, 25, 50, 100, 200];
const BADGE_MILESTONES = [3, 5, 10, 15, 20, 30];

function findNextMilestone(current: number, milestones: number[]): number | null {
  for (const m of milestones) {
    if (current < m) return m;
  }
  return null;
}

export function getMostMotivatingProgress(stats: {
  statesVisited?: number;
  nightsCamped?: number;
  campgroundsVisited?: number;
  badgesEarned?: number;
}): { label: string; current: number; target: number; percent: number; remaining: string } | null {
  const candidates: { label: string; current: number; target: number; percent: number; icon: string }[] = [];

  const states = stats.statesVisited || 0;
  const stateTarget = findNextMilestone(states, STATE_MILESTONES);
  if (stateTarget && states > 0) candidates.push({ label: `${states}/${stateTarget} States`, current: states, target: stateTarget, percent: states / stateTarget, icon: '\u{1F5FA}' });

  const nights = stats.nightsCamped || 0;
  const nightTarget = findNextMilestone(nights, NIGHT_MILESTONES);
  if (nightTarget && nights > 0) candidates.push({ label: `${nights}/${nightTarget} Nights`, current: nights, target: nightTarget, percent: nights / nightTarget, icon: '\u{1F3D5}' });

  const cgs = stats.campgroundsVisited || 0;
  const cgTarget = findNextMilestone(cgs, CAMPGROUND_MILESTONES);
  if (cgTarget && cgs > 0) candidates.push({ label: `${cgs}/${cgTarget} Campgrounds`, current: cgs, target: cgTarget, percent: cgs / cgTarget, icon: '\u{1F4CD}' });

  const badges = stats.badgesEarned || 0;
  const badgeTarget = findNextMilestone(badges, BADGE_MILESTONES);
  if (badgeTarget && badges > 0) candidates.push({ label: `${badges}/${badgeTarget} Badges`, current: badges, target: badgeTarget, percent: badges / badgeTarget, icon: '\u{1F3C6}' });

  if (candidates.length === 0) return null;

  // Pick highest percentage (closest to milestone)
  candidates.sort((a, b) => b.percent - a.percent);
  const best = candidates[0];
  const remaining = best.target - best.current;

  return {
    label: `${best.icon} ${best.label}`,
    current: best.current,
    target: best.target,
    percent: Math.round(best.percent * 100),
    remaining: `${remaining} more to next milestone`,
  };
}
