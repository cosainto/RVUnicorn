#!/usr/bin/env npx tsx
/**
 * Campground Owner Outreach Email Generator
 *
 * Generates personalized outreach emails for campground owners whose
 * campgrounds are already on RVUnicorn. Exports a CSV ready for
 * email campaigns (Resend, Mailchimp, etc.)
 *
 * Run: npx tsx src/scripts/campground-outreach.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const OUTPUT_CSV = path.join(process.cwd(), 'outreach-emails.csv');
const OUTPUT_JSON = path.join(process.cwd(), 'outreach-emails.json');

async function main() {
  console.log('Generating campground outreach list...');

  // Find campgrounds with business emails that are UNCLAIMED
  const campgrounds = await prisma.campground.findMany({
    where: {
      verificationStatus: 'UNCLAIMED',
      OR: [
        { businessEmail: { not: null } },
        { websiteUrl: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      location: true,
      state: true,
      city: true,
      businessEmail: true,
      businessPhone: true,
      websiteUrl: true,
      customSlug: true,
      googleRating: true,
      googleReviewCount: true,
      amenities: true,
      _count: {
        select: {
          followers: true,
          checkIns: true,
          reviews: true,
          photos: true,
          campgroundEvents: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  console.log(`Found ${campgrounds.length} unclaimed campgrounds`);

  // Filter to those with email addresses
  const withEmail = campgrounds.filter(c => c.businessEmail);
  const withoutEmail = campgrounds.filter(c => !c.businessEmail && c.websiteUrl);

  console.log(`  ${withEmail.length} with business email (ready to send)`);
  console.log(`  ${withoutEmail.length} with website only (need email lookup)`);

  // Generate personalized email data
  const emailRecords = withEmail.map(cg => {
    const slug = cg.customSlug || cg.id;
    const profileUrl = `https://rvunicorn.com/campgrounds/${slug}`;
    const claimUrl = `https://rvunicorn.com/campgrounds/${slug}`; // Claim button is on the page
    const totalEngagement = cg._count.followers + cg._count.checkIns + cg._count.reviews + cg._count.photos;

    // Personalize the pitch based on engagement
    let hook = '';
    if (cg._count.followers > 10) hook = `${cg._count.followers} RVers already follow ${cg.name} on RVUnicorn.`;
    else if (cg._count.checkIns > 5) hook = `${cg._count.checkIns} RVers have checked in at ${cg.name} on RVUnicorn.`;
    else if (cg._count.reviews > 0) hook = `${cg._count.reviews} RVers have reviewed ${cg.name} on RVUnicorn.`;
    else hook = `${cg.name} is already listed on RVUnicorn with ${cg.amenities?.length || 0} amenities.`;

    // Build amenity highlights
    const topAmenities = (cg.amenities || []).slice(0, 5).join(', ');

    return {
      email: cg.businessEmail!,
      campgroundName: cg.name,
      location: `${cg.city || cg.location || ''}, ${cg.state || ''}`.trim(),
      profileUrl,
      claimUrl,
      hook,
      followers: cg._count.followers,
      checkIns: cg._count.checkIns,
      reviews: cg._count.reviews,
      photos: cg._count.photos,
      events: cg._count.campgroundEvents,
      totalEngagement,
      topAmenities,
      googleRating: cg.googleRating,
      websiteUrl: cg.websiteUrl || '',
      subject: `${cg.name} — ${cg._count.followers > 0 ? cg._count.followers + ' RVers are following you' : 'Your campground is on RVUnicorn'}`,
    };
  });

  // Sort by engagement (highest first — these are warmest leads)
  emailRecords.sort((a, b) => b.totalEngagement - a.totalEngagement);

  // Write CSV
  const csvHeader = 'email,campground_name,location,subject,hook,profile_url,claim_url,followers,checkins,reviews,photos,events,google_rating,website\n';
  const csvRows = emailRecords.map(r =>
    `"${r.email}","${r.campgroundName.replace(/"/g, '""')}","${r.location}","${r.subject.replace(/"/g, '""')}","${r.hook.replace(/"/g, '""')}","${r.profileUrl}","${r.claimUrl}",${r.followers},${r.checkIns},${r.reviews},${r.photos},${r.events},${r.googleRating || ''},${r.websiteUrl}`
  ).join('\n');

  fs.writeFileSync(OUTPUT_CSV, csvHeader + csvRows);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(emailRecords, null, 2));

  console.log(`\nOutput:`);
  console.log(`  CSV: ${OUTPUT_CSV} (${emailRecords.length} records)`);
  console.log(`  JSON: ${OUTPUT_JSON}`);
  console.log(`\nTop 10 warmest leads:`);
  emailRecords.slice(0, 10).forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.campgroundName} — ${r.email} (${r.totalEngagement} engagement)`);
  });

  // Generate the email template
  const template = `
═══════════════════════════════════════════════════════
OUTREACH EMAIL TEMPLATE
═══════════════════════════════════════════════════════

SUBJECT: {{subject}}

Hi there,

{{hook}}

RVUnicorn is a growing community of 11,000+ RV travelers who use our
platform to discover campgrounds, plan trips, and connect with fellow
campers. Your campground already has a profile page on RVUnicorn:

🔗 {{profile_url}}

By claiming your free page, you can:

✅ Respond to reviews from real RVers
✅ Post events and seasonal schedules
✅ Create custom badges for your campground
✅ Upload photos and announcements
✅ See who's checked in and engage with visitors
✅ Appear in our smart search (16,000+ campgrounds listed)

It takes 2 minutes and it's completely free. No credit card needed.

Claim your page: {{claim_url}}

We're in early access beta and actively building features campground
owners have asked for — like booking integration, analytics dashboards,
and promoted listings. Early claimers get priority access.

Questions? Reply to this email — I read every one.

Happy trails,
Will Roberts
Founder, RVUnicorn
rvunicorn.com

P.S. ${emailRecords.length > 100 ? `${emailRecords.length} campgrounds` : 'Hundreds of campgrounds'} have already been claimed by their owners. Don't let someone else manage your page.
═══════════════════════════════════════════════════════
`;

  console.log(template);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
