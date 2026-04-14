import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Hitch Skins ─────────────────────────────────────────────────

const SKIN_PROMPTS: Record<string, string> = {
  TRAIL_GUIDE: `You are Hitch, a calm, knowledgeable trail guide. You speak with quiet confidence. You're safety-conscious, informative, and reassuring. Short sentences. No hype. Think park ranger who's seen everything. Family friendly.`,
  PARTY_STARTER: `You are Hitch, the ultimate campground hype man. You use energy and humor to get campers moving. You love trivia, s'mores, and making people laugh. Emoji encouraged. Think camp counselor who never runs out of energy. Family friendly.`,
  OLD_TIMER: `You are Hitch, a grizzled old camper full of dry humor and campfire wisdom. You've been camping since before GPS existed. Short, wry observations. Occasional tall tale. Never preachy. Think Sam Elliott at a campfire. Family friendly.`,
};

export type HitchSkin = 'TRAIL_GUIDE' | 'PARTY_STARTER' | 'OLD_TIMER';

export type HitchTrigger =
  | 'EVENT_START'
  | 'HYPE_BLAST'
  | 'QUESTION_CLOSED'
  | 'FINAL_QUESTION'
  | 'SESSION_END'
  | 'PLAN_B_ACTIVATED'
  | 'POPUP_EVENT_CREATED'
  | 'EVENT_WRAP_UP';

export interface HitchEventContext {
  eventName: string;
  hereNowCount: number;
  nearbyCount: number;
  questionNumber?: number;
  leaderboardTop3?: string[];
  popUpTitle?: string;
  planBLocation?: string;
}

const TRIGGER_PROMPTS: Record<HitchTrigger, (ctx: HitchEventContext) => string> = {
  EVENT_START: (ctx) =>
    `"${ctx.eventName}" just went LIVE! ${ctx.hereNowCount} campers are here, ${ctx.nearbyCount} nearby. Write 1-2 sentences to kick off the event and welcome everyone.`,
  HYPE_BLAST: (ctx) =>
    `There are ${ctx.nearbyCount} campers nearby who haven't joined "${ctx.eventName}" yet, but ${ctx.hereNowCount} are already here. Write 1-2 sentences to lure the nearby campers in. Make it irresistible.`,
  QUESTION_CLOSED: (ctx) =>
    `Trivia Q${ctx.questionNumber} just closed at "${ctx.eventName}". ${ctx.hereNowCount} campers playing.${ctx.leaderboardTop3?.length ? ` Leaders: ${ctx.leaderboardTop3.join(', ')}.` : ''} Write 1 sentence reacting to the round.`,
  FINAL_QUESTION: (ctx) =>
    `This is the FINAL trivia question at "${ctx.eventName}"! ${ctx.hereNowCount} campers on the edge of their camp chairs.${ctx.leaderboardTop3?.length ? ` Current leader: ${ctx.leaderboardTop3[0]}.` : ''} Write 1-2 dramatic sentences — everything's on the line!`,
  SESSION_END: (ctx) =>
    `The trivia session just ended at "${ctx.eventName}". ${ctx.hereNowCount} campers played.${ctx.leaderboardTop3?.length ? ` Winner: ${ctx.leaderboardTop3[0]}.` : ''} Write 1-2 sentences wrapping up dramatically before the leaderboard drops.`,
  PLAN_B_ACTIVATED: (ctx) =>
    `Weather forced a Plan B at "${ctx.eventName}"! New location: ${ctx.planBLocation || 'TBD'}. ${ctx.hereNowCount} campers need to know. Write 1-2 reassuring but urgent sentences.`,
  POPUP_EVENT_CREATED: (ctx) =>
    `A pop-up event "${ctx.popUpTitle}" was just created at "${ctx.eventName}"! ${ctx.nearbyCount} nearby campers might be interested. Write 1-2 fun sentences announcing it.`,
  EVENT_WRAP_UP: (ctx) =>
    `"${ctx.eventName}" is wrapping up. ${ctx.hereNowCount} campers stuck around to the end. Write 1-2 warm, memorable closing sentences. Make them want to come back next time.`,
};

// ── Main Function ───────────────────────────────────────────────

export async function generateHitchMessage(
  skin: HitchSkin,
  trigger: HitchTrigger,
  context: HitchEventContext,
): Promise<string | null> {
  const systemPrompt = SKIN_PROMPTS[skin] || SKIN_PROMPTS.PARTY_STARTER;
  const userPrompt = TRIGGER_PROMPTS[trigger](context);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : null;
    return text;
  } catch (e: any) {
    console.error('[HitchEvent] Message generation failed:', e);
    return null;
  }
}

// Plan B always uses OLD_TIMER skin regardless of event setting
export async function generatePlanBMessage(context: HitchEventContext): Promise<string | null> {
  return generateHitchMessage('OLD_TIMER', 'PLAN_B_ACTIVATED', context);
}
