#!/usr/bin/env python3
"""
RVUnicorn Recipe Takeover System
- Adds imageType/hitchMessage/aiImageUrl fields to Recipe
- Adds RecipePhotoSubmission model
- Seeds 50 camping recipes via AI
- Backend routes for photo submission + moderation
- Frontend: Hitch message banner + upload button
- Camp Kitchen badge on approval
"""
import os, json, subprocess

ROOT = os.path.expanduser('~/Downloads/kindletribe-mvp')
BACKEND = os.path.join(ROOT, 'backend/src')
FRONTEND = os.path.join(ROOT, 'frontend/src')

def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)
    print(f'  OK {path.replace(ROOT+"/", "")}')

def patch(path, old, new, label=''):
    with open(path) as f:
        content = f.read()
    if old not in content:
        print(f'  WARN [{label}] not found')
        return False
    with open(path, 'w') as f:
        f.write(content.replace(old, new, 1))
    print(f'  OK [{label}]')
    return True

print('\nRVUnicorn Recipe Takeover Build\n')

# ── 1. Add columns to Recipe table via raw SQL ────────────────
print('1. Adding Recipe takeover fields via raw SQL')
sql = """
ALTER TABLE "Recipe" 
  ADD COLUMN IF NOT EXISTS "imageType" TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS "hitchMessage" TEXT,
  ADD COLUMN IF NOT EXISTS "aiImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "officialImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "officialImageBy" TEXT,
  ADD COLUMN IF NOT EXISTS "equipment" TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "RecipePhotoSubmission" (
  "id" TEXT NOT NULL,
  "recipeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "photoUrl" TEXT NOT NULL,
  "caption" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "moderatorNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecipePhotoSubmission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecipePhotoSubmission_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE,
  CONSTRAINT "RecipePhotoSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "RecipePhotoSubmission_recipeId_idx" ON "RecipePhotoSubmission"("recipeId");
CREATE INDEX IF NOT EXISTS "RecipePhotoSubmission_userId_idx" ON "RecipePhotoSubmission"("userId");
CREATE INDEX IF NOT EXISTS "RecipePhotoSubmission_status_idx" ON "RecipePhotoSubmission"("status");
"""

sql_file = '/tmp/recipe_takeover.sql'
with open(sql_file, 'w') as f:
    f.write(sql)

r = subprocess.run(
    ['npx', 'prisma', 'db', 'execute', '--file', sql_file],
    capture_output=True, text=True,
    cwd=os.path.join(ROOT, 'backend')
)
if 'error' in r.stderr.lower() and 'already exists' not in r.stderr.lower():
    print(f'  WARN: {r.stderr[:200]}')
else:
    print('  OK Schema updated')

# ── 2. Hitch disclaimer messages ──────────────────────────────
HITCH_LINES = [
    "Hitch cooked up this picture with AI… but let's be honest, he didn't actually make the meal. Cook it yourself, upload a photo, and if it looks great we'll replace this image and award you the Camp Kitchen badge! 🏕️",
    "Hitch whipped up this meal shot with AI… but he definitely didn't fire up the grill. Make it at your campsite, share your photo, and if it looks great we'll swap this image and award you the Camp Kitchen badge!",
    "Hitch generated this food pic with AI… but no actual spatula was involved. Cook the recipe for real, upload your version, and if it looks great we'll replace this image and award you the Camp Kitchen badge!",
    "Hitch made this image with AI magic… but he didn't actually cook dinner. Give the recipe a real campsite try, upload your photo, and if it looks great we'll replace this image and award you the Camp Kitchen badge!",
    "Hitch served up this picture with AI… but he never touched the Blackstone. Cook it yourself, send us the real thing, and if it looks great we'll replace this image and award you the Camp Kitchen badge!",
    "Hitch built this preview with AI… but the meal still needs a real campsite chef. Make it, snap it, and if your photo looks great we'll replace this image and award you the Camp Kitchen badge!",
    "Hitch dreamed this one up with AI… but he didn't actually light the smoker. Cook it for real, upload your masterpiece, and if it looks great we'll replace this image and award you the Camp Kitchen badge!",
    "Hitch generated this recipe image with AI… but this plate has never seen a picnic table. Make the meal at camp, upload your photo, and if it looks great we'll replace this image and award you the Camp Kitchen badge!",
    "Hitch mocked up this food photo with AI… but someone still needs to make the real version. Cook it at your site, share your pic, and if it looks great we'll replace this image and award you the Camp Kitchen badge!",
    "Hitch tossed this image together with AI… but not a single burger was flipped. Make the recipe yourself, upload the proof, and if it looks great we'll replace this image and award you the Camp Kitchen badge!",
    "Hitch created this tasty-looking image with AI… but he hasn't actually made the meal. Cook it for real, show us how it turned out, and if it looks great we'll replace this image and award you the Camp Kitchen badge!",
    "Hitch brought this recipe to life with AI… but now it's your turn to make it real. Upload your campsite version, and if it looks great we'll replace this image and award you the Camp Kitchen badge! 🔥",
]

# ── 3. Backend: recipe takeover routes ───────────────────────
print('2. Adding recipe takeover routes')

takeover_routes = '''
import random

const HITCH_LINES = ''' + json.dumps(HITCH_LINES, indent=2) + ''';

// POST /api/recipes/:id/submit-photo
router.post('/:id/submit-photo', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { photoUrl, caption } = req.body;
    const userId = req.user?.id;

    if (!photoUrl) return res.status(400).json({ error: 'Photo URL required' });

    const submission = await (prisma as any).$queryRaw`
      INSERT INTO "RecipePhotoSubmission" ("id", "recipeId", "userId", "photoUrl", "caption", "status", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, ${id}, ${userId}, ${photoUrl}, ${caption || null}, 'PENDING', NOW(), NOW())
      RETURNING *
    `;

    res.json({ success: true, submission: Array.isArray(submission) ? submission[0] : submission });
  } catch (e: any) {
    console.error('Submit photo error:', e?.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/recipes/admin/pending-photos (admin only)
router.get('/admin/pending-photos', authenticateToken, async (req: any, res) => {
  try {
    const submissions = await (prisma as any).$queryRaw`
      SELECT rps.*, r.title as "recipeTitle", u.username, u."firstName", u."lastName"
      FROM "RecipePhotoSubmission" rps
      JOIN "Recipe" r ON rps."recipeId" = r.id
      JOIN "User" u ON rps."userId" = u.id
      WHERE rps.status = 'PENDING'
      ORDER BY rps."createdAt" DESC
      LIMIT 50
    `;
    res.json({ submissions });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/recipes/:id/moderate-photo/:submissionId
router.post('/:id/moderate-photo/:submissionId', authenticateToken, async (req: any, res) => {
  try {
    const { id, submissionId } = req.params;
    const { approved, note } = req.body;
    const userId = req.user?.id;

    // Update submission status
    await (prisma as any).$executeRaw`
      UPDATE "RecipePhotoSubmission"
      SET status = ${approved ? 'APPROVED' : 'REJECTED'}, "moderatorNote" = ${note || null}, "updatedAt" = NOW()
      WHERE id = ${submissionId}
    `;

    if (approved) {
      // Get submission photo URL
      const subs = await (prisma as any).$queryRaw`
        SELECT "photoUrl", "userId" FROM "RecipePhotoSubmission" WHERE id = ${submissionId}
      `;
      const sub = Array.isArray(subs) ? subs[0] : subs;

      if (sub) {
        // Update recipe with official image
        await (prisma as any).$executeRaw`
          UPDATE "Recipe"
          SET "officialImageUrl" = ${sub.photoUrl}, "imageType" = 'user', "officialImageBy" = ${sub.userId}, "updatedAt" = NOW()
          WHERE id = ${id}
        `;

        // Award Camp Kitchen badge
        const campKitchenBadge = await prisma.badge.findFirst({ where: { name: { contains: 'Camp Kitchen', mode: 'insensitive' } } }).catch(() => null);
        if (campKitchenBadge) {
          await prisma.userBadge.upsert({
            where: { userId_badgeId: { userId: sub.userId, badgeId: campKitchenBadge.id } },
            create: { userId: sub.userId, badgeId: campKitchenBadge.id },
            update: {},
          }).catch(() => {});
        }

        // Create Basecamp notification
        const recipe = await prisma.recipe.findUnique({ where: { id }, select: { title: true } });
        const uploader = await prisma.user.findUnique({ where: { id: sub.userId }, select: { firstName: true, username: true } });
        if (recipe && uploader) {
          await prisma.notification.create({
            data: {
              userId: sub.userId,
              type: 'BADGE',
              title: '🏕️ Camp Kitchen Badge!',
              content: `Your photo for "${recipe.title}" was approved and is now the official recipe image! You've earned the Camp Kitchen badge!`,
              link: `/recipes/${id}`,
              category: 'ACHIEVEMENT',
            }
          }).catch(() => {});
        }
      }
    }

    res.json({ success: true, approved });
  } catch (e: any) {
    console.error('Moderate photo error:', e?.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/recipes/:id/photo-submissions
router.get('/:id/photo-submissions', optionalAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const submissions = await (prisma as any).$queryRaw`
      SELECT rps.*, u.username, u."firstName", u."profilePicture"
      FROM "RecipePhotoSubmission" rps
      JOIN "User" u ON rps."userId" = u.id
      WHERE rps."recipeId" = ${id} AND rps.status != 'REJECTED'
      ORDER BY rps."createdAt" DESC
    `;
    res.json({ submissions });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});
'''

recipe_routes_path = f'{BACKEND}/routes/recipe.routes.ts'
with open(recipe_routes_path) as f:
    rc = f.read()

if 'submit-photo' not in rc:
    rc = rc.replace('export default router;', takeover_routes + '\nexport default router;')
    with open(recipe_routes_path, 'w') as f:
        f.write(rc)
    print('  OK Takeover routes added')
else:
    print('  INFO already exists')

# ── 4. Seed 50 camping recipes script ────────────────────────
print('3. Creating recipe seed script')

seed_script = '''#!/usr/bin/env node
/**
 * Seed 50 camping recipes using Claude AI
 * Run: node seed_recipes.js
 */
const Anthropic = require('@anthropic-ai/sdk');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HITCH_LINES = ''' + json.dumps(HITCH_LINES) + ''';

const RECIPE_TYPES = [
  { category: 'BREAKFAST', cuisine: 'American', count: 10, context: 'campfire breakfast, Dutch oven, cast iron skillet, RV kitchen' },
  { category: 'LUNCH', cuisine: 'American', count: 8, context: 'easy campsite lunch, sandwiches, wraps, foil packets' },
  { category: 'DINNER', cuisine: 'American', count: 15, context: 'campfire dinner, Dutch oven, one pot, foil packet, Blackstone griddle' },
  { category: 'DINNER', cuisine: 'Mexican', count: 5, context: 'campsite Mexican food, tacos, burritos, Dutch oven' },
  { category: 'SNACK', cuisine: 'American', count: 6, context: 'camping snacks, trail mix, energy bites, campfire popcorn' },
  { category: 'DESSERT', cuisine: 'American', count: 6, context: 'campfire desserts, Dutch oven cobbler, s\'mores, foil packet desserts' },
];

async function seedRecipes() {
  // Get system user
  const systemUser = await prisma.user.findFirst({ where: { email: 'system@rvunicorn.com' } });
  if (!systemUser) {
    console.error('System user not found. Create system@rvunicorn.com first.');
    process.exit(1);
  }

  let total = 0;

  for (const type of RECIPE_TYPES) {
    console.log(`Generating ${type.count} ${type.category} recipes...`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Generate ${type.count} unique camping/RV recipes for ${type.category.toLowerCase()} meals.
Context: ${type.context}
Cuisine style: ${type.cuisine}

Return ONLY a JSON array with this exact structure (no markdown, no extra text):
[
  {
    "title": "Recipe Name",
    "description": "2 sentence description",
    "category": "${type.category}",
    "cuisine": "${type.cuisine}",
    "difficulty": "EASY|MEDIUM|HARD",
    "prepTime": 10,
    "cookTime": 20,
    "servings": 4,
    "equipment": ["Dutch oven", "campfire"],
    "ingredients": ["2 cups flour", "1 tsp salt"],
    "instructions": ["Step 1: Do this", "Step 2: Do that"],
    "dietaryPreferences": []
  }
]

Make them practical for camping - simple ingredients, campfire/Dutch oven/Blackstone cooking methods, fun names.`
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = text.replace(/```json|```/g, '').trim();

    let recipes;
    try {
      recipes = JSON.parse(clean);
    } catch (e) {
      console.error('Parse error for', type.category, ':', e.message);
      continue;
    }

    for (const recipe of recipes) {
      try {
        await prisma.recipe.create({
          data: {
            title: recipe.title,
            description: recipe.description,
            category: recipe.category,
            cuisine: recipe.cuisine,
            difficulty: recipe.difficulty || 'EASY',
            prepTime: recipe.prepTime || 10,
            cookTime: recipe.cookTime || 20,
            servings: recipe.servings || 4,
            ingredients: recipe.ingredients || [],
            instructions: recipe.instructions || [],
            dietaryPreferences: recipe.dietaryPreferences || [],
            privacy: 'PUBLIC',
            userId: systemUser.id,
            imageType: 'ai',
            hitchMessage: HITCH_LINES[Math.floor(Math.random() * HITCH_LINES.length)],
          }
        });
        total++;
        console.log(`  ✓ ${recipe.title}`);
      } catch (e) {
        console.error(`  ✗ ${recipe.title}:`, e.message);
      }
    }

    // Small delay between AI calls
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\\nDone! Seeded ${total} recipes.`);
  await prisma.$disconnect();
}

seedRecipes().catch(e => { console.error(e); process.exit(1); });
'''

write(f'{ROOT}/backend/seed_recipes.js', seed_script)

# ── 5. Frontend: RecipeTakeoverBanner component ───────────────
print('4. Creating RecipeTakeoverBanner component')

write(f'{FRONTEND}/components/RecipeTakeoverBanner.tsx', '''import { useState } from "react";
import { Camera, X, Upload, ChefHat } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

interface Props {
  recipeId: string;
  recipeTitle: string;
  imageType: "ai" | "user";
  hitchMessage?: string;
  officialImageUrl?: string;
  onPhotoSubmitted?: () => void;
}

export default function RecipeTakeoverBanner({ recipeId, recipeTitle, imageType, hitchMessage, officialImageUrl, onPhotoSubmitted }: Props) {
  const { user } = useAuth();
  const [showUpload, setShowUpload] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (imageType === "user" && officialImageUrl) return (
    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
      <ChefHat className="w-4 h-4 shrink-0" />
      <span>This is a real campsite photo from the RVUnicorn community! 🏕️</span>
    </div>
  );

  if (submitted) return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-center gap-2">
      <span>📸 Photo submitted for review! If approved, you\'ll earn the Camp Kitchen badge 🏕️</span>
    </div>
  );

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl overflow-hidden">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <span className="text-lg shrink-0">🦄</span>
            <p className="text-xs text-amber-800 leading-relaxed">{hitchMessage || "Hitch made this with AI — cook it yourself and upload the real thing to earn the Camp Kitchen badge!"}</p>
          </div>
          <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {user && !showUpload && (
          <button onClick={() => setShowUpload(true)}
            className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg transition w-full justify-center">
            <Camera className="w-3.5 h-3.5" />
            📸 Upload Your Campsite Version
          </button>
        )}

        {showUpload && (
          <div className="mt-3 space-y-2">
            <input type="url" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)}
              placeholder="Paste your photo URL (Cloudinary, imgur, etc.)"
              className="w-full text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-orange-400" />
            <input type="text" value={caption} onChange={e => setCaption(e.target.value)}
              placeholder="Caption (optional)"
              className="w-full text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-orange-400" />
            <div className="flex gap-2">
              <button onClick={async () => {
                if (!photoUrl.trim()) return;
                setSubmitting(true);
                try {
                  await api.post(`/recipes/${recipeId}/submit-photo`, { photoUrl, caption });
                  setSubmitted(true);
                  setShowUpload(false);
                  if (onPhotoSubmitted) onPhotoSubmitted();
                } catch { alert("Failed to submit"); }
                finally { setSubmitting(false); }
              }} disabled={!photoUrl.trim() || submitting}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 disabled:opacity-40 transition">
                <Upload className="w-3 h-3" />
                {submitting ? "Submitting..." : "Submit for Review"}
              </button>
              <button onClick={() => setShowUpload(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
''')

# ── 6. Wire into RecipeDetailPage ────────────────────────────
print('5. Wiring into RecipeDetailPage')
rdp = f'{FRONTEND}/pages/RecipeDetailPage.tsx'
with open(rdp) as f:
    rdp_content = f.read()

if 'RecipeTakeoverBanner' not in rdp_content:
    rdp_content = rdp_content.replace(
        "import { useAuth } from '../contexts/AuthContext';",
        "import { useAuth } from '../contexts/AuthContext';\nimport RecipeTakeoverBanner from '../components/RecipeTakeoverBanner';",
        1
    )
    # Inject after the recipe image
    if "recipe?.imageUrl" in rdp_content:
        rdp_content = rdp_content.replace(
            "{recipe?.imageUrl && (",
            """{recipe && (
            <div className="mb-4">
              <RecipeTakeoverBanner
                recipeId={recipe.id}
                recipeTitle={recipe.title}
                imageType={(recipe as any).imageType || 'user'}
                hitchMessage={(recipe as any).hitchMessage}
                officialImageUrl={(recipe as any).officialImageUrl}
              />
            </div>
          )}
          {recipe?.imageUrl && (""",
            1
        )
        print('  OK Wired into RecipeDetailPage')
    with open(rdp, 'w') as f:
        f.write(rdp_content)
else:
    print('  INFO already wired')

print('\n' + '='*55)
print('Recipe Takeover Build Complete!\n')
print('Next steps:')
print('1. Run the seed script to generate 50 recipes:')
print('   cd ~/Downloads/kindletribe-mvp/backend && node seed_recipes.js')
print()
print('2. Push the code:')
print('   git add -A && git commit -m "feat: Recipe Takeover system + 50 camping recipes" && git push')
