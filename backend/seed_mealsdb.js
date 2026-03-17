const Anthropic = require('@anthropic-ai/sdk');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const https = require('https');
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HITCH_LINES = [
  "Hitch made this with AI but never cooked it. Make it at camp and earn the Camp Kitchen badge!",
  "Hitch built this preview with AI but the meal needs a real campsite chef. Cook it and earn the Camp Kitchen badge!",
  "Hitch generated this image with AI. Cook it for real at your campsite and earn the Camp Kitchen badge!",
  "Hitch dreamed this one up with AI. Make it at camp, snap a photo, and earn the Camp Kitchen badge!",
  "Hitch served up this picture with AI but never touched the Blackstone. Cook it yourself and earn the badge!",
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

async function rewriteForCamping(meal) {
  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Rewrite this recipe for RV/camping cooking. Adapt cooking methods for campfire, Dutch oven, cast iron skillet, or Blackstone griddle where possible. Keep the same ingredients but make it camping-friendly.

Recipe: ${meal.strMeal}
Original instructions: ${(meal.strInstructions||'').substring(0, 500)}

Return ONLY a JSON object (no markdown):
{
  "description": "2 sentence camping-adapted description",
  "campingTip": "1 sentence tip for making this at camp",
  "difficulty": "EASY or MEDIUM or HARD",
  "equipment": ["list", "of", "camping", "equipment"]
}`
    }]
  });
  const text = resp.content[0].type === 'text' ? resp.content[0].text : '{}';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

function parseIngredients(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (ing && ing.trim()) {
      ingredients.push(`${measure ? measure.trim() + ' ' : ''}${ing.trim()}`);
    }
  }
  return ingredients;
}

function parseInstructions(meal) {
  const raw = meal.strInstructions || '';
  return raw.split(/\r\n|\n|\r/)
    .map(s => s.trim())
    .filter(s => s.length > 10)
    .slice(0, 10);
}

function categoryMap(cat) {
  const map = {
    'Breakfast': 'BREAKFAST', 'Dessert': 'DESSERT', 'Side': 'SNACK',
    'Starter': 'SNACK', 'Vegan': 'DINNER', 'Vegetarian': 'DINNER',
    'Seafood': 'DINNER', 'Lamb': 'DINNER', 'Beef': 'DINNER',
    'Chicken': 'DINNER', 'Pork': 'DINNER', 'Pasta': 'DINNER',
    'Miscellaneous': 'DINNER', 'Goat': 'DINNER'
  };
  return map[cat] || 'DINNER';
}

async function main() {
  const sys = await prisma.user.findFirst({ where: { email: 'system@rvunicorn.com' } });
  if (!sys) { console.error('No system user'); process.exit(1); }

  // Get all meal categories
  const catData = await fetch('https://www.themealdb.com/api/json/v1/1/categories.php');
  const categories = catData.categories.map(c => c.strCategory);
  console.log('Categories:', categories.join(', '));

  let total = 0;
  let failed = 0;

  for (const cat of categories) {
    console.log('\nFetching', cat, 'meals...');
    const listData = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(cat)}`);
    const meals = listData.meals || [];
    console.log('  Found', meals.length, 'meals');

    for (const m of meals) {
      try {
        // Get full meal details
        const detailData = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${m.idMeal}`);
        const meal = detailData.meals?.[0];
        if (!meal) continue;

        // AI rewrite for camping
        let camping = { description: meal.strMeal + ' adapted for campsite cooking.', campingTip: 'Great for Dutch oven or cast iron skillet.', difficulty: 'MEDIUM', equipment: [] };
        try {
          camping = await rewriteForCamping(meal);
        } catch(e) {
          console.error('  AI rewrite failed for', meal.strMeal);
        }

        const ingredients = parseIngredients(meal);
        const instructions = parseInstructions(meal);
        const category = categoryMap(meal.strCategory);
        const hitch = HITCH_LINES[Math.floor(Math.random() * HITCH_LINES.length)];
        const id = require('crypto').randomUUID();

        await prisma.$executeRawUnsafe(
          'INSERT INTO "Recipe" (id,title,description,category,cuisine,difficulty,"prepTime","cookTime",servings,ingredients,instructions,"dietaryPreferences",privacy,"userId","imageType","hitchMessage","imageUrl","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,\'PUBLIC\',$13,\'ai\',$14,$15,NOW(),NOW())',
          id,
          meal.strMeal,
          camping.description || null,
          category,
          meal.strArea || 'International',
          camping.difficulty || 'MEDIUM',
          15, 30, 4,
          ingredients,
          instructions,
          [],
          sys.id,
          hitch,
          meal.strMealThumb || null
        );

        total++;
        console.log('  OK', meal.strMeal);

        // Small delay to be respectful to the API
        await new Promise(r => setTimeout(r, 500));
      } catch(e) {
        failed++;
        console.error('  FAIL:', m.strMeal, '-', e.message?.substring(0,60));
      }
    }
  }

  console.log('\nDone! Seeded', total, 'recipes,', failed, 'failed.');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
