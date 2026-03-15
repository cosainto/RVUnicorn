#!/usr/bin/env python3
"""
Wire remaining Phase 4-9 components into pages + cron job
Run from project root: python3 wire_components.py
"""
import os, re

ROOT = os.getcwd()
FRONTEND = os.path.join(ROOT, 'frontend/src')
BACKEND = os.path.join(ROOT, 'backend/src')

def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)
    print(f'  OK {path.replace(ROOT+"/", "")}')

def patch(path, old, new, label=''):
    with open(path, 'r') as f:
        content = f.read()
    if old not in content:
        print(f'  WARN [{label}] not found')
        return False
    with open(path, 'w') as f:
        f.write(content.replace(old, new, 1))
    print(f'  OK [{label}]')
    return True

print('\nWiring Phase 4-9 components into pages\n')

# ── 1. ProfilePage: HitchProfileSummary ──────────────────────
print('1. ProfilePage: HitchProfileSummary')
pp = f'{FRONTEND}/pages/ProfilePage.tsx'
with open(pp) as f:
    pc = f.read()

if 'HitchProfileSummary' not in pc:
    pc = pc.replace(
        "import { useAuth } from '../contexts/AuthContext';",
        "import { useAuth } from '../contexts/AuthContext';\nimport HitchProfileSummary from '../components/HitchProfileSummary';",
        1
    )
    # Find where bio is rendered - inject summary just before or after bio section
    # Look for a pattern that shows the profile bio area
    if "profile?.bio" in pc:
        pc = pc.replace(
            "{profile?.bio && ",
            "{username && <div className=\"mb-4\"><HitchProfileSummary username={username} /></div>}\n              {profile?.bio && ",
            1
        )
        print('  OK injected before bio')
    elif "{profile.bio}" in pc:
        pc = pc.replace(
            "{profile.bio}",
            "{profile.bio}\n              {username && <div className=\"mt-4\"><HitchProfileSummary username={username} /></div>}",
            1
        )
        print('  OK injected after bio')
    else:
        # Find isOwnProfile and inject near there
        pc = pc.replace(
            "  const isOwnProfile = user?.username === username || user?.id === username;",
            "  const isOwnProfile = user?.username === username || user?.id === username;",
            1
        )
        print('  WARN could not find bio - add HitchProfileSummary manually near profile bio section')
    with open(pp, 'w') as f:
        f.write(pc)
else:
    print('  INFO already wired')

# ── 2. TripDetailPage: TripCopilot + AITripRecap ─────────────
print('2. TripDetailPage: TripCopilot + AITripRecap')
tdp = f'{FRONTEND}/pages/TripDetailPage.tsx'
with open(tdp) as f:
    tc = f.read()

if 'TripCopilot' not in tc or tc.count('TripCopilot') < 2:
    # Fix imports - uncomment if commented
    tc = tc.replace(
        "// import TripCopilot from '../components/TripCopilot';\n// import AITripRecap from '../components/AITripRecap';",
        "import TripCopilot from '../components/TripCopilot';\nimport AITripRecap from '../components/AITripRecap';",
        1
    )
    # If not commented, add fresh
    if "import TripCopilot" not in tc:
        tc = tc.replace(
            "import { useAuth } from '../contexts/AuthContext';",
            "import { useAuth } from '../contexts/AuthContext';\nimport TripCopilot from '../components/TripCopilot';\nimport AITripRecap from '../components/AITripRecap';",
            1
        )

    # Find where to inject TripCopilot - after the event title/header area
    # Look for the return JSX and find a good anchor
    if 'event?.campground' in tc and '<TripCopilot' not in tc:
        # Find the campground name display and inject copilot below it
        tc = tc.replace(
            "{event?.campground && (",
            """{event?.campground && event?.startDate && (
            <TripCopilot
              tripId={event.id}
              origin={(event as any).origin || event.campground.state || ''}
              destination={`${event.campground.name}, ${event.campground.state || ''}`}
              campgroundId={event.campground.id}
            />
          )}
          {event?.campground && (""",
            1
        )
        print('  OK TripCopilot injected')
    elif '<TripCopilot' in tc:
        print('  INFO TripCopilot already in JSX')
    else:
        print('  WARN could not find campground injection point')

    # Add AITripRecap - inject after the trip details, before or in the actions area
    # Find where trip dates/summary is shown
    if '<AITripRecap' not in tc and 'event?.endDate' in tc:
        tc = tc.replace(
            "{event?.endDate && new Date(event.endDate) < new Date() && (",
            """{event?.endDate && new Date(event.endDate) < new Date() && (
            <AITripRecap
              tripId={event.id}
              tripTitle={event.title}
              campgroundName={event.campground?.name}
              startDate={event.startDate}
              endDate={event.endDate || event.startDate}
              attendeeCount={(event as any).attendees?.length}
              photoCount={(event as any).photos?.length}
            />
          )}
          {event?.endDate && new Date(event.endDate) < new Date() && (""",
            1
        )
        print('  OK AITripRecap injected after past trip check')
    elif '<AITripRecap' in tc:
        print('  INFO AITripRecap already in JSX')
    else:
        # Just add it near the bottom of the main content
        print('  WARN endDate check not found - add AITripRecap manually')

    with open(tdp, 'w') as f:
        f.write(tc)
else:
    print('  INFO already wired')

# ── 3. App.tsx: HitchOnboarding for new users ────────────────
print('3. App.tsx: HitchOnboarding trigger')
app_path = f'{FRONTEND}/App.tsx'
with open(app_path) as f:
    app = f.read()

if 'HitchOnboarding' not in app:
    app = app.replace(
        "import GuideUnlockToast from './components/GuideUnlockToast';",
        "import GuideUnlockToast from './components/GuideUnlockToast';\nimport HitchOnboarding from './components/HitchOnboarding';",
        1
    )
    # Add state after useAuth
    app = app.replace(
        "function AppContent() {\n  const { user } = useAuth();\n",
        """function AppContent() {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user && !(user as any).rvType) {
      const done = localStorage.getItem('hitch_onboarding_done');
      if (!done) setShowOnboarding(true);
    }
  }, [user]);

""",
        1
    )
    # Make sure useState and useEffect are imported
    if "useState" not in app.split("import")[1]:
        app = app.replace(
            "import React",
            "import React, { useState, useEffect }",
            1
        )
    app = app.replace(
        "<GuideUnlockToast />",
        """<GuideUnlockToast />
      {showOnboarding && (
        <HitchOnboarding onComplete={() => {
          localStorage.setItem('hitch_onboarding_done', '1');
          setShowOnboarding(false);
        }} />
      )}""",
        1
    )
    with open(app_path, 'w') as f:
        f.write(app)
    print('  OK HitchOnboarding wired')
else:
    print('  INFO already wired')

# ── 4. Verify CampgroundDetailPage has leaderboard + selector ─
print('4. Verify CampgroundDetailPage wiring')
cdp = f'{FRONTEND}/pages/CampgroundDetailPage.tsx'
with open(cdp) as f:
    cdp_content = f.read()

checks = [
    ('CampgroundReportLeaderboard', 'Leaderboard'),
    ('PredictiveSiteSelector', 'PredictiveSiteSelector'),
    ('CampgroundSecrets', 'Secrets'),
    ('RigStressScore', 'RigStressScore'),
    ('AskTheCampfire', 'Campfire'),
    ('RoastMode', 'Roast'),
    ('SmartReviewForm', 'SmartReviewForm'),
]
for component, label in checks:
    status = 'OK' if component in cdp_content else 'MISSING'
    print(f'  {status} {label}')

# ── 5. Weekly Digest Cron Job ─────────────────────────────────
print('5. Weekly Digest: cron route + Railway cron setup')

# Add a cron trigger route that Railway can call
hitch_guides_path = f'{BACKEND}/routes/hitch-guides.routes.ts'
with open(hitch_guides_path) as f:
    gc = f.read()

if 'send-weekly-digests' not in gc:
    cron_route = '''
// POST /api/hitch/send-weekly-digests
// Called by Railway cron job every Monday at 8am
// Railway Cron setup: Add a cron job in Railway dashboard
//   Schedule: 0 8 * * 1  (every Monday 8am UTC)
//   Command: curl -X POST https://your-backend-url/api/hitch/send-weekly-digests -H "X-Cron-Secret: $CRON_SECRET"
router.post('/send-weekly-digests', async (req: any, res) => {
  try {
    // Verify cron secret to prevent unauthorized calls
    const cronSecret = req.headers['x-cron-secret'];
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all users with emails who have been active in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = await prisma.user.findMany({
      where: {
        email: { not: '' },
        updatedAt: { gte: thirtyDaysAgo },
      },
      select: { id: true, email: true, firstName: true },
      take: 500, // process in batches
    });

    let sent = 0;
    let failed = 0;

    // Process in small batches to avoid rate limits
    for (const user of activeUsers) {
      try {
        // Call the individual digest endpoint
        const res2 = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3001'}/api/hitch/weekly-digest/${user.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res2.ok) sent++;
        else failed++;
        // Small delay between sends
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch {
        failed++;
      }
    }

    console.log(`Weekly digest: ${sent} sent, ${failed} failed, ${activeUsers.length} total`);
    res.json({ sent, failed, total: activeUsers.length });
  } catch (e: any) {
    console.error('Weekly digest cron error:', e?.message);
    res.status(500).json({ error: 'Failed' });
  }
});
'''
    gc = gc.replace('export default router;', cron_route + '\nexport default router;')
    with open(hitch_guides_path, 'w') as f:
        f.write(gc)
    print('  OK send-weekly-digests cron route added')
else:
    print('  INFO already exists')

# ── 6. Add CRON_SECRET to env example ────────────────────────
env_example = f'{ROOT}/backend/.env.example'
if os.path.exists(env_example):
    with open(env_example) as f:
        env_content = f.read()
    if 'CRON_SECRET' not in env_content:
        with open(env_example, 'a') as f:
            f.write('\nCRON_SECRET=your-secret-cron-key\nBACKEND_URL=https://your-backend-url.railway.app\n')
        print('  OK CRON_SECRET added to .env.example')

print('\n' + '='*55)
print('Wiring complete!\n')
print('Railway Cron Setup (do this in Railway dashboard):')
print('  1. Go to your backend service > Settings > Cron Jobs')
print('  2. Add new cron job:')
print('     Schedule: 0 8 * * 1')
print('     Command: curl -X POST $RAILWAY_PUBLIC_DOMAIN/api/hitch/send-weekly-digests \\')
print('              -H "X-Cron-Secret: $CRON_SECRET"')
print('  3. Add CRON_SECRET env var to your Railway backend service')
print()
print('Run:\ngit add -A && git commit -m "feat: wire all Phase 4-9 components + weekly digest cron" && git push')
