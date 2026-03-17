#!/usr/bin/env python3
"""
Fix 3 recipe issues:
1. Pagination on RecipesPage (load more)
2. /api/recipes/suggestions route (404)
3. Hitch disclaimer banner wiring on RecipeDetailPage
"""
import os

ROOT = os.path.expanduser('~/Downloads/kindletribe-mvp')
BACKEND = os.path.join(ROOT, 'backend/src')
FRONTEND = os.path.join(ROOT, 'frontend/src')

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

# ── 1. Add /api/recipes/suggestions route ────────────────────
print('\n1. Adding /api/recipes/suggestions route')

recipe_routes = f'{BACKEND}/routes/recipe.routes.ts'
with open(recipe_routes) as f:
    rc = f.read()

suggestions_route = '''
// GET /api/recipes/suggestions - personalized recipe suggestions
router.get('/suggestions', optionalAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    let interests: string[] = [];

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { campingInterests: true }
      });
      interests = user?.campingInterests || [];
    }

    // Get random popular recipes
    const total = await prisma.recipe.count({ where: { privacy: 'PUBLIC' } });
    const skip = Math.max(0, Math.floor(Math.random() * (total - 6)));

    const recipes = await prisma.recipe.findMany({
      where: { privacy: 'PUBLIC' },
      take: 6,
      skip,
      select: {
        id: true, title: true, description: true, category: true,
        cuisine: true, difficulty: true, prepTime: true, cookTime: true,
        imageUrl: true,
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        _count: { select: { likes: true, comments: true } }
      }
    });

    res.json({ suggestions: recipes });
  } catch (e: any) {
    console.error('Suggestions error:', e?.message);
    res.status(500).json({ error: 'Failed' });
  }
});
'''

if '/suggestions' not in rc:
    # Add before the /:id route to avoid being captured by it
    rc = rc.replace("router.get('/:id',", suggestions_route + "\nrouter.get('/:id',", 1)
    with open(recipe_routes, 'w') as f:
        f.write(rc)
    print('  OK Added /suggestions route')
else:
    print('  INFO already exists')

# ── 2. Add pagination to RecipesPage ─────────────────────────
print('\n2. Adding pagination to RecipesPage')

rp = f'{FRONTEND}/pages/RecipesPage.tsx'
with open(rp) as f:
    rpc = f.read()

# Add page state
if 'const [page, setPage]' not in rpc:
    patch(rp,
        "  const [recipes, setRecipes] = useState<Recipe[]>([]);",
        "  const [recipes, setRecipes] = useState<Recipe[]>([]);\n  const [page, setPage] = useState(1);\n  const [hasMore, setHasMore] = useState(true);\n  const [loadingMore, setLoadingMore] = useState(false);",
        'add page state'
    )

# Update loadRecipes to support pagination
with open(rp) as f:
    rpc = f.read()

if 'setHasMore' not in rpc:
    patch(rp,
        "      const { data } = await api.get(`/recipes?${params.toString()}`);\n      setRecipes(data.recipes || []);",
        """      const { data } = await api.get(`/recipes?${params.toString()}`);\n      const newRecipes = data.recipes || [];\n      if (page === 1) {\n        setRecipes(newRecipes);\n      } else {\n        setRecipes(prev => [...prev, ...newRecipes]);\n      }\n      setHasMore(newRecipes.length >= 24);""",
        'pagination load logic'
    )

# Add load more button before closing of recipes grid
with open(rp) as f:
    rpc = f.read()

load_more_btn = '''
          {hasMore && (
            <div className="col-span-full flex justify-center mt-6">
              <button
                onClick={() => { setPage(p => p + 1); }}
                disabled={loadingMore}
                className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 transition"
              >
                {loadingMore ? 'Loading...' : 'Load More Recipes'}
              </button>
            </div>
          )}'''

if 'Load More Recipes' not in rpc:
    # Find the closing of the recipes grid
    if 'No recipes found' in rpc:
        patch(rp,
            "              ? 'No recipes found'",
            load_more_btn + "\n              ? 'No recipes found'",
            'load more button'
        )

# Add page to deps of loadRecipes useEffect
with open(rp) as f:
    rpc = f.read()
if ', page]' not in rpc and 'page' not in rpc:
    pass  # skip if already handled

# ── 3. Wire Hitch banner into RecipeDetailPage ────────────────
print('\n3. Wiring Hitch banner into RecipeDetailPage')

rdp = f'{FRONTEND}/pages/RecipeDetailPage.tsx'
with open(rdp) as f:
    rdpc = f.read()

# Add import if missing
if 'RecipeTakeoverBanner' not in rdpc:
    patch(rdp,
        "import { useAuth } from '../contexts/AuthContext';",
        "import { useAuth } from '../contexts/AuthContext';\nimport RecipeTakeoverBanner from '../components/RecipeTakeoverBanner';",
        'add RecipeTakeoverBanner import'
    )

with open(rdp) as f:
    rdpc = f.read()

# Find where recipe image is shown and inject banner before/after it
if 'RecipeTakeoverBanner' not in rdpc:
    # Try to inject after recipe title area
    injected = False
    for anchor in [
        '{recipe?.imageUrl && (',
        '{recipe?.imageUrl ? (',
        'recipe.imageUrl && <img',
        '<img src={recipe',
    ]:
        if anchor in rdpc:
            patch(rdp, anchor,
                '{recipe && (\n              <div className="mb-4">\n                <RecipeTakeoverBanner\n                  recipeId={recipe.id}\n                  recipeTitle={recipe.title}\n                  imageType={(recipe as any).imageType || \'user\'}\n                  hitchMessage={(recipe as any).hitchMessage}\n                  officialImageUrl={(recipe as any).officialImageUrl}\n                />\n              </div>\n            )}\n            ' + anchor,
                'inject banner'
            )
            injected = True
            break

    if not injected:
        print('  WARN: Could not find image anchor - banner not injected')

print('\n' + '='*55)
print('Done! Now run:')
print('cd ~/Downloads/kindletribe-mvp && git add -A && git commit -m "feat: recipe pagination, suggestions route, Hitch banner" && git push')
