import cron from 'node-cron';
import {
  sendProfileNudges,
  sendConnectionNudges,
  sendThirtyDayCheckins,
  sendPreTrip7Day,
  sendPostTripRecap,
  sendOwnerWeeklyDigests,
  sendOwnerPotentialEnergy,
  sendCreatorWeeklyDigests,
  sendWeeklyCommunityDigest,
} from '../services/emailTriggers';

export function registerEmailCampaignCrons() {
  // Daily 7am CT — pre-trip briefings + trip completions
  cron.schedule('0 7 * * *', async () => {
    console.log('[EmailCampaigns] Running daily trip emails...');
    try {
      await sendPreTrip7Day();
      await sendPostTripRecap();
    } catch (err) {
      console.error('[EmailCampaigns] Daily trip emails failed:', err);
    }
  }, { timezone: 'America/Chicago' });

  // Daily 10am CT — onboarding nudges
  cron.schedule('0 10 * * *', async () => {
    console.log('[EmailCampaigns] Running onboarding nudges...');
    try {
      await sendProfileNudges();
      await sendConnectionNudges();
      await sendThirtyDayCheckins();
    } catch (err) {
      console.error('[EmailCampaigns] Onboarding nudges failed:', err);
    }
  }, { timezone: 'America/Chicago' });

  // Monday 8am CT — weekly digests for owners + creators
  cron.schedule('0 8 * * 1', async () => {
    console.log('[EmailCampaigns] Running Monday weekly digests...');
    try {
      await sendOwnerWeeklyDigests();
      await sendOwnerPotentialEnergy();
      await sendCreatorWeeklyDigests();
    } catch (err) {
      console.error('[EmailCampaigns] Monday digests failed:', err);
    }
  }, { timezone: 'America/Chicago' });

  // Tuesday 9am CT — community digest
  cron.schedule('0 9 * * 2', async () => {
    console.log('[EmailCampaigns] Running community digest...');
    try {
      await sendWeeklyCommunityDigest();
    } catch (err) {
      console.error('[EmailCampaigns] Community digest failed:', err);
    }
  }, { timezone: 'America/Chicago' });

  console.log('[EmailCampaigns] All email campaign crons registered');
}
