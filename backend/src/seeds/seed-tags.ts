import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultTags = [
  { name: 'Question', slug: 'question', color: '#3B82F6' },
  { name: 'Tips & Tricks', slug: 'tips-tricks', color: '#10B981' },
  { name: 'Review', slug: 'review', color: '#8B5CF6' },
  { name: 'Gear', slug: 'gear', color: '#F59E0B' },
  { name: 'Wildlife', slug: 'wildlife', color: '#06B6D4' },
  { name: 'Weather', slug: 'weather', color: '#6366F1' },
  { name: 'Hiking', slug: 'hiking', color: '#84CC16' },
  { name: 'Fishing', slug: 'fishing', color: '#0EA5E9' },
  { name: 'Kids & Family', slug: 'kids-family', color: '#EC4899' },
  { name: 'Pets', slug: 'pets', color: '#F97316' },
  { name: 'RV & Camping', slug: 'rv-camping', color: '#14B8A6' },
  { name: 'Food & Recipes', slug: 'food-recipes', color: '#EF4444' },
  { name: 'Safety', slug: 'safety', color: '#DC2626' },
  { name: 'Photography', slug: 'photography', color: '#7C3AED' },
  { name: 'First Timer', slug: 'first-timer', color: '#22C55E' },
];

async function main() {
  console.log('🏷️  Seeding thread tags...');

  for (const tag of defaultTags) {
    try {
      await prisma.threadTag.upsert({
        where: { slug: tag.slug },
        update: { name: tag.name, color: tag.color },
        create: tag
      });
      console.log(`  ✅ ${tag.name}`);
    } catch (error) {
      console.log(`  ⚠️  ${tag.name} - already exists or error`);
    }
  }

  console.log('\n✨ Tags seeded successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
