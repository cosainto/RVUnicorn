import { prisma } from '../prisma';
import { sendEmail } from '../services/email-sms.service';

/**
 * Post-checkout photo reminder email.
 *
 * 24 hours after a user checks out of a campground, send them an email
 * encouraging them to upload photos, leave a review, and share their
 * trip memories. Only sends if:
 *   - User has not already uploaded photos for that campground during the stay
 *   - Reminder hasn't already been sent for this check-in (dedupe via notification)
 *   - User has an email address on file
 *
 * Runs hourly. The 24–72h window gives a day of quiet after checkout
 * and 2 days of catch-up for missed cron ticks.
 */
export async function runPostCheckoutPhotoReminderCron() {
  const now = Date.now();
  const windowEnd = new Date(now - 24 * 60 * 60 * 1000);   // checked out at least 24h ago
  const windowStart = new Date(now - 72 * 60 * 60 * 1000);  // checked out at most 72h ago

  let sent = 0;
  let skippedHasPhotos = 0;
  let skippedAlreadySent = 0;
  let skippedNoEmail = 0;

  try {
    // Find check-ins that ended in the window and have a campground
    const checkIns = await prisma.checkIn.findMany({
      where: {
        isActive: false,
        campgroundId: { not: null },
        checkOutDate: { gte: windowStart, lt: windowEnd },
      },
      include: {
        user: { select: { id: true, firstName: true, email: true } },
        campground: { select: { id: true, name: true, slug: true } },
      },
      take: 200, // safety cap
    });

    for (const checkIn of checkIns) {
      if (!checkIn.campground || !checkIn.user) continue;

      try {
        const userId = checkIn.user.id;
        const campgroundId = checkIn.campground.id;

        // Skip if user has no email
        if (!checkIn.user.email) {
          skippedNoEmail++;
          continue;
        }

        // Dedupe: check if we already sent a reminder for this check-in
        const alreadySent = await prisma.notification.findFirst({
          where: {
            userId,
            type: 'POST_CHECKOUT_PHOTO_REMINDER',
            metadata: { path: ['checkInId'], equals: checkIn.id },
          },
          select: { id: true },
        });
        if (alreadySent) {
          skippedAlreadySent++;
          continue;
        }

        // Check if user already uploaded photos for this campground during their stay
        const existingPhotos = await prisma.campgroundPhoto.findFirst({
          where: {
            userId,
            campgroundId,
            createdAt: {
              gte: checkIn.checkInDate,
              lte: checkIn.checkOutDate || new Date(),
            },
          },
          select: { id: true },
        });
        if (existingPhotos) {
          skippedHasPhotos++;
          continue;
        }

        // Build email
        const firstName = checkIn.user.firstName || 'Camper';
        const campgroundName = checkIn.campground.name;
        const campgroundSlug = checkIn.campground.slug || checkIn.campground.id;
        const checkInDate = checkIn.checkInDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const checkOutDate = checkIn.checkOutDate
          ? checkIn.checkOutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : 'recently';
        const campgroundUrl = `https://www.rvunicorn.com/campgrounds/${campgroundSlug}?tab=photos`;
        const reviewUrl = `https://www.rvunicorn.com/campgrounds/${campgroundSlug}?tab=reviews`;

        const emailHtml = baseHtml(
          `<p>Hey ${firstName}!</p>` +
          `<p>Hope you had a great stay at <strong>${campgroundName}</strong> (${checkInDate} – ${checkOutDate})! 🏕️</p>` +
          `<p>Your photos help fellow RVers decide where to camp next. Got any shots from your trip? We'd love to see them!</p>` +
          `<p style="text-align:center"><a href="${campgroundUrl}" class="btn">Upload Photos 📸</a></p>` +
          `<div class="box">` +
          `<p><strong>While you're at it...</strong></p>` +
          `<p>A quick review goes a long way! Rate ${campgroundName} and share what made your stay special (or what could be better).</p>` +
          `<p style="margin-top:12px"><a href="${reviewUrl}" style="color:#d97706;font-weight:700;text-decoration:none">Leave a Review &rarr;</a></p>` +
          `</div>` +
          `<p style="color:#9ca3af;font-size:13px">Your contributions make RVUnicorn better for everyone. Thanks for being part of the herd! 🦄</p>`
        );

        await sendEmail({
          to: checkIn.user.email,
          subject: `📸 Share your photos from ${campgroundName} — RVUnicorn`,
          html: emailHtml,
          text: `Hey ${firstName}! Hope you had a great stay at ${campgroundName} (${checkInDate} – ${checkOutDate}). Got any photos from your trip? Upload them here: ${campgroundUrl} — Your photos help fellow RVers decide where to camp next. You can also leave a review: ${reviewUrl}`,
        });

        // Create notification record for deduplication
        await prisma.notification.create({
          data: {
            userId,
            type: 'POST_CHECKOUT_PHOTO_REMINDER',
            content: `📸 Share your photos from ${campgroundName}!`,
            link: `/campgrounds/${campgroundSlug}?tab=photos`,
            metadata: {
              checkInId: checkIn.id,
              campgroundId,
              campgroundName,
            },
          },
        }).catch(() => {}); // don't fail if notification creation fails

        sent++;
      } catch (e: any) {
        console.error(`[PostCheckoutPhotoReminder] Failed for checkIn ${checkIn.id}:`, e);
      }
    }

    if (sent > 0 || skippedHasPhotos > 0 || skippedAlreadySent > 0) {
      console.log(
        `[PostCheckoutPhotoReminder] sent=${sent} skip-has-photos=${skippedHasPhotos} skip-already-sent=${skippedAlreadySent} skip-no-email=${skippedNoEmail}`,
      );
    }
  } catch (e: any) {
    console.error('[PostCheckoutPhotoReminder] Error:', e);
  }
}

// ─── Base HTML template (same as email-sms.service.ts) ──────────────────────
const baseHtml = (body: string) => [
  '<!DOCTYPE html><html><head><meta charset="utf-8">',
  '<style>',
  'body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}',
  '.w{max-width:600px;margin:0 auto;padding:32px 16px}',
  '.card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}',
  '.hdr{background:linear-gradient(135deg,#1a1f2e,#1e2535);padding:32px;text-align:center}',
  '.hdr h1{color:#f59e0b;font-size:22px;font-weight:800;margin:12px 0 0}',
  '.bd{padding:32px}.bd p{color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px}',
  '.box{background:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;padding:16px 20px;margin:20px 0}',
  '.box p{margin:0;color:#92400e;font-size:14px}',
  '.btn{display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff!important;',
  'text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;margin:8px 0}',
  '.ft{padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center}',
  '.ft p{color:#94a3b8;font-size:12px;margin:4px 0}.ft a{color:#64748b}',
  '</style></head><body><div class="w"><div class="card">',
  '<div class="hdr"><div style="font-size:32px">&#x1F984;</div><h1>RVUnicorn</h1></div>',
  '<div class="bd">', body, '</div>',
  '<div class="ft">',
  '<p>You are receiving this because you have email notifications enabled.</p>',
  '<p><a href="https://www.rvunicorn.com/settings">Manage notification preferences</a></p>',
  '<p style="margin-top:12px;color:#cbd5e1">&copy; RVUnicorn &middot; Your camping community</p>',
  '</div></div></div></body></html>'
].join('');
