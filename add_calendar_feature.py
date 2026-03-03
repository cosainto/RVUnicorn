#!/usr/bin/env python3
"""
RVUnicorn - Calendar + Reservation Feature Installer
Run from your project root:  python3 add_calendar_feature.py
"""
import os, sys, subprocess, shutil
from pathlib import Path

ROOT     = Path(__file__).parent
BACKEND  = ROOT / "backend"
FRONTEND = ROOT / "frontend" / "src"
SCHEMA   = BACKEND / "prisma" / "schema.prisma"
ROUTES   = BACKEND / "src" / "routes"
PAGES    = FRONTEND / "pages"
COMPS    = FRONTEND / "components"
SCRIPT_DIR = Path(__file__).parent   # same folder as this script

G="[92m"; R="[91m"; B="[94m"; E="[0m"
def ok(m):  print(f"{G}[OK]{E}  {m}")
def err(m): print(f"{R}[ERR]{E} {m}")
def inf(m): print(f"{B}[..]{E}  {m}")

def run(cmd, cwd=None):
    r = subprocess.run(cmd, shell=True, cwd=str(cwd or ROOT), capture_output=True, text=True)
    if r.returncode != 0:
        err(f"Command failed: {cmd}")
        print(r.stderr[:300])
        return False
    return True

def backup(path):
    bak = Path(str(path)+".bak")
    if not bak.exists(): shutil.copy(path, bak)

# ================================================================
# 1. SCHEMA PATCH — add fields to EventAttendee
# ================================================================
def patch_schema():
    inf("Patching Prisma schema...")
    src = SCHEMA.read_text()
    if "confirmationNumber" in src:
        inf("Schema already patched - skipping"); return
    backup(SCHEMA)
    old = "  updatedAt DateTime @updatedAt\n  event     Event    @relation(fields: [eventId]"
    new = "  updatedAt          DateTime @updatedAt\n  confirmationNumber String?\n  siteNumber         String?\n  notes              String?\n  event     Event    @relation(fields: [eventId]"
    if old in src:
        src = src.replace(old, new)
        ok("Added confirmationNumber / siteNumber / notes to EventAttendee")
    else:
        err("Could not auto-patch EventAttendee - add these 3 lines manually after updatedAt:")
        print("    confirmationNumber String?")
        print("    siteNumber         String?")
        print("    notes              String?")
    SCHEMA.write_text(src)

# ================================================================
# 2. BACKEND ROUTE FILE
# ================================================================
ROUTE_TS = """import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/calendar?month=1-12&year=YYYY
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const month  = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year   = parseInt(req.query.year  as string) || new Date().getFullYear();
    const start  = new Date(year, month - 1, 1);
    const end    = new Date(year, month,     1);

    const events = await prisma.event.findMany({
      where: {
        OR: [{ organizerId: userId }, { attendees: { some: { userId } } }],
        startDate: { lt: end }, endDate: { gte: start },
      },
      include: {
        campground: { select: { id: true, name: true, location: true } },
        organizer:  { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        attendees: { include: { user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } } } },
      },
    });

    const trips = await prisma.trip.findMany({
      where: { userId, startDate: { lt: end }, endDate: { gte: start } },
      include: { stays: { include: { campground: { select: { id: true, name: true, location: true } } } } },
    });

    const items = [
      ...events.map(e => ({
        id: e.id, type: 'EVENT', title: e.title,
        startDate: e.startDate, endDate: e.endDate,
        campground: e.campground, location: (e as any).location,
        isOrganizer: e.organizerId === userId,
        myAttendee: e.attendees.find(a => a.userId === userId) || null,
        attendees: e.attendees, color: '#f59e0b',
      })),
      ...trips.flatMap(t => (t.stays as any[]).map((s: any) => ({
        id: s.id, tripId: t.id, type: 'STAY', title: t.name,
        startDate: s.startDate ?? t.startDate, endDate: s.endDate ?? t.endDate,
        campground: s.campground, isOrganizer: true,
        myAttendee: { confirmationNumber: s.confirmationNumber, siteNumber: s.siteNumber, userId },
        attendees: [], color: '#34d399',
      }))),
    ];
    res.json({ items });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to fetch calendar' }); }
});

// PATCH /api/calendar/events/:eventId/reservation
router.patch('/events/:eventId/reservation', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { eventId } = req.params;
    const { confirmationNumber, siteNumber, notes, targetUserId } = req.body;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Not found' });
    const affectedId = (event.organizerId === userId && targetUserId) ? targetUserId : userId;
    const updated = await prisma.eventAttendee.update({
      where: { eventId_userId: { eventId, userId: affectedId } },
      data: {
        ...(confirmationNumber !== undefined && { confirmationNumber }),
        ...(siteNumber         !== undefined && { siteNumber }),
        ...(notes              !== undefined && { notes }),
      },
    });
    res.json({ attendee: updated });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

// PATCH /api/calendar/stays/:stayId/reservation
router.patch('/stays/:stayId/reservation', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { stayId } = req.params;
    const { confirmationNumber, siteNumber } = req.body;
    const stay = await (prisma as any).stay.findFirst({ where: { id: stayId, trip: { userId } } });
    if (!stay) return res.status(403).json({ error: 'Not authorised' });
    const updated = await (prisma as any).stay.update({
      where: { id: stayId },
      data: {
        ...(confirmationNumber !== undefined && { confirmationNumber }),
        ...(siteNumber !== undefined && { siteNumber }),
      },
    });
    res.json({ stay: updated });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

// POST /api/calendar/events/:eventId/attendees  (tag a friend)
router.post('/events/:eventId/attendees', authenticateToken, async (req: Request, res: Response) => {
  try {
    const inviterId = (req as any).user.id;
    const { eventId } = req.params;
    const { userId } = req.body;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Not found' });
    const isAttendee = await prisma.eventAttendee.findUnique({ where: { eventId_userId: { eventId, userId: inviterId } } });
    if (event.organizerId !== inviterId && !isAttendee) return res.status(403).json({ error: 'Not authorised' });
    const attendee = await prisma.eventAttendee.upsert({
      where:  { eventId_userId: { eventId, userId } },
      create: { eventId, userId, status: 'INVITED' },
      update: {},
      include: { user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } } },
    });
    await prisma.notification.create({
      data: { userId, type: 'EVENT_INVITE', content: `You were added to "${event.title}"`, link: `/trips/${eventId}`, category: 'SOCIAL' },
    });
    res.json({ attendee });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

export default router;
"""

def write_route():
    path = ROUTES / "calendar.routes.ts"
    path.write_text(ROUTE_TS)
    ok("calendar.routes.ts written")

def register_route():
    idx = ROUTES / "index.ts"
    if not idx.exists(): err("routes/index.ts not found"); return
    src = idx.read_text()
    if "calendar.routes" in src: inf("Route already registered"); return
    backup(idx)
    if "from './trip.routes'" in src:
        src = src.replace("from './trip.routes';",
                          "from './trip.routes';\nimport calendarRoutes from './calendar.routes';")
    else:
        lines = src.split("\n")
        last_import = max((i for i,l in enumerate(lines) if l.strip().startswith("import ")), default=0)
        lines.insert(last_import+1, "import calendarRoutes from './calendar.routes';")
        src = "\n".join(lines)
    if "router.use('/trips', tripRoutes)" in src:
        src = src.replace("router.use('/trips', tripRoutes);",
                          "router.use('/trips', tripRoutes);\nrouter.use('/calendar', calendarRoutes);")
    elif "export default router" in src:
        src = src.replace("export default router",
                          "router.use('/calendar', calendarRoutes);\nexport default router")
    idx.write_text(src)
    ok("Registered /calendar in routes/index.ts")

# ================================================================
# 3. FRONTEND WIDGET — read from sibling file TripCalendarWidget.tsx
#    (the installer writes it inline below)
# ================================================================
WIDGET_TSX = open(SCRIPT_DIR / "TripCalendarWidget.tsx").read()

def write_widget():
    dest = COMPS / "TripCalendarWidget.tsx"
    dest.write_text(WIDGET_TSX)
    ok(f"TripCalendarWidget.tsx written to {dest}")

# ================================================================
# 4. BASECAMP — inject compact calendar widget into sidebar
# ================================================================
def patch_basecamp():
    path = PAGES / "BasecampPage.tsx"
    if not path.exists(): err("BasecampPage.tsx not found"); return
    src = path.read_text()
    if "TripCalendarWidget" in src: inf("Calendar already in BasecampPage"); return
    backup(path)
    src = src.replace(
        "import api from '../services/api';",
        "import api from '../services/api';\nimport TripCalendarWidget from '../components/TripCalendarWidget';"
    )
    injection = "\n            {/* ── Trip Calendar ── */}\n            <TripCalendarWidget compact={true} />\n"
    injected = False
    for marker in ["<Top8Friends", "<PackingList", 'className="space-y-4"', 'className="space-y-6"']:
        if marker in src:
            src = src.replace(marker, injection + "            " + marker, 1)
            ok(f"Injected TripCalendarWidget before {marker}")
            injected = True
            break
    if not injected:
        err("Could not auto-inject into BasecampPage sidebar. Add manually:")
        print('    <TripCalendarWidget compact={true} />')
    path.write_text(src)

# ================================================================
# 5. PROFILE PAGE — add Calendar tab
# ================================================================
def patch_profile():
    target = None
    for name in ["ProfilePage.tsx", "UserProfilePage.tsx", "profile.tsx", "[username].tsx"]:
        p = PAGES / name
        if p.exists(): target = p; break
    if not target: inf("Profile page not found by common names - skipping"); return
    src = target.read_text()
    if "TripCalendarWidget" in src: inf("Calendar already in ProfilePage"); return
    backup(target)
    src = src.replace(
        "import api from '../services/api';",
        "import api from '../services/api';\nimport TripCalendarWidget from '../components/TripCalendarWidget';"
    )
    # Add tab button after Photos button
    for marker in [">Photos</button>", ">Photos </button>", "tab === \'photos\'", 'tab === "photos"']:
        if marker in src:
            cal_btn = "\n              <button onClick={()=>setActiveTab('calendar')} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${activeTab==='calendar'?'bg-amber-500 text-black':'text-gray-400 hover:text-white'}`}>Calendar</button>"
            src = src.replace(marker, marker + cal_btn, 1)
            ok("Added Calendar tab button to ProfilePage")
            break
    # Add tab content panel
    for marker in ["{activeTab === \'photos\'", "{activeTab === \"photos\"", "activeTab === 'photos' &&", 'activeTab === "photos" &&']:
        if marker in src:
            panel = "{activeTab === 'calendar' && <div className=\"py-4\"><TripCalendarWidget compact={false} userId={profileUser?.id || profile?.id} /></div>}\n"
            src = src.replace(marker, panel + marker, 1)
            ok("Added Calendar tab panel to ProfilePage")
            break
    target.write_text(src)

# ================================================================
# 6. PRISMA MIGRATE
# ================================================================
def migrate():
    inf("Running Prisma migration...")
    success = run("npx prisma migrate dev --name add_reservation_fields --skip-seed", cwd=BACKEND)
    if success:
        ok("Migration complete!")
    else:
        inf("Auto-migration failed. Run manually:")
        print("    cd ~/Downloads/kindletribe-mvp/backend")
        print("    npx prisma migrate dev --name add_reservation_fields")

# ================================================================
# MAIN
# ================================================================
def main():
    print("\n\033[95m" + "="*55)
    print(" RVUnicorn - Calendar + Reservation Installer")
    print("="*55 + "\033[0m")

    steps = [
        ("1. Patch Prisma schema",     patch_schema),
        ("2. Write backend route",     write_route),
        ("3. Register route",          register_route),
        ("4. Write frontend widget",   write_widget),
        ("5. Inject into BasecampPage",patch_basecamp),
        ("6. Patch ProfilePage",       patch_profile),
        ("7. Run Prisma migration",    migrate),
    ]
    for label, fn in steps:
        print(f"\n\033[94m── {label}\033[0m")
        try: fn()
        except Exception as e: err(f"Error: {e}")

    print("\n\033[92m" + "="*55)
    print(" Done! Commit and deploy:")
    print("="*55 + "\033[0m")
    print("  git add -A")
    print('  git commit -m "feat: trip calendar with per-attendee reservations"')
    print("  git push")
    print()

if __name__ == "__main__":
    main()
