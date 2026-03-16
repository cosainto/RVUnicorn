const Anthropic = require('@anthropic-ai/sdk');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const HITCH_LINES = [
  "Hitch cooked up this picture with AI but he did not actually make the meal. Cook it yourself, upload a photo, and earn the Camp Kitchen badge!",
  "Hitch whipped up this meal shot with AI but he never fired up the grill. Make it at your campsite and earn the Camp Kitchen badge!",
  "Hitch generated this food pic with AI but no actual spatula was involved. Cook it for real and earn the Camp Kitchen badge!",
  "Hitch made this image with AI magic but he did not cook dinner. Give it a real campsite try and earn the Camp Kitchen badge!",
  "Hitch served up this picture with AI but he never touched the Blackstone. Cook it yourself and earn the Camp Kitchen badge!",
];
const TYPES = [
  { category: 'BREAKFAST', cuisine: 'American', count: 8, context: 'campfire breakfast, Dutch oven, cast iron skillet' },
  { category: 'LUNCH', cuisine: 'American', count: 8, context: 'easy campsite lunch, wraps, foil packets' },
  { category: 'DINNER', cuisine: 'American', count: 12, context: 'campfire dinner, Dutch oven, one pot, Blackstone' },
  { category: 'DINNER', cuisine: 'Mexican', count: 5, context: 'campsite tacos, burritos, Dutch oven' },
  { category: 'SNACK', cuisine: 'American', count: 6, context: 'camping snacks, trail mix, energy bites' },
  { category: 'DESSERT', cuisine: 'American', count: 6, context: 'campfire desserts, Dutch oven cobbler, foil packets' },
];
async function main() {
  const sys = await prisma.user.findFirst({ where: { email: 'system@rvunicorn.com' } });
  if (!sys) { console.error('No system user'); process.exit(1); }
  let total = 0;
  for (const t of TYPES) {
    console.log('Generating ' + t.count + ' ' + t.category + '...');
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 4000,
      messages: [{ role: 'user', content: 'Generate ' + t.count + ' camping recipes for ' + t.category + '. Context: ' + t.context + '. Return ONLY a JSON array with fields: title, description, category(' + t.category + '), cuisine(' + t.cuisine + '), difficulty(EASY/MEDIUM/HARD), prepTime(number), cookTime(number), servings(number), ingredients(array), instructions(array), dietaryPreferences(array). No markdown.' }]
    });
    const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
    let recipes;
    try { recipes = JSON.parse(text.replace(/```json|```/g, '').trim()); }
    catch(e) { console.error('Parse error:', e.message); continue; }
    for (const r of recipes) {
      try {
        const id = require('crypto').randomUUID();
        const hitch = HITCH_LINES[Math.floor(Math.random() * HITCH_LINES.length)];
        await prisma.$executeRawUnsafe(
          'INSERT INTO "Recipe" (id,title,description,category,cuisine,difficulty,"prepTime","cookTime",servings,ingredients,instructions,"dietaryPreferences",privacy,"userId","imageType","hitchMessage","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,\'PUBLIC\',$13,\'ai\',$14,NOW(),NOW())',
          id, r.title, r.description||null, r.category, r.cuisine, r.difficulty||'EASY',
          r.prepTime||10, r.cookTime||20, r.servings||4,
          r.ingredients||[], r.instructions||[], r.dietaryPreferences||[],
          sys.id, hitch
        );
        total++;
        console.log('  OK ' + r.title);
      } catch(e) { console.error('  FAIL ' + r.title + ': ' + e.message); }
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('Done! Seeded ' + total + ' recipes.');
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
