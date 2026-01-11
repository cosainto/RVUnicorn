import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.trip.deleteMany();
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.stateVisit.deleteMany();
  await prisma.campground.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Cleared existing data');

  // Create test users
  console.log('Creating test users...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const will = await prisma.user.create({
    data: {
      email: 'will@kindletribe.com',
      password: hashedPassword,
      username: 'will',
      firstName: 'Will',
      lastName: 'Roberts',
      bio: 'Love camping and cooking outdoors! 🏕️',
    },
  });

  const hannah = await prisma.user.create({
    data: {
      email: 'hannah@kindletribe.com',
      password: hashedPassword,
      username: 'hannah',
      firstName: 'Hannah',
      lastName: 'Smith',
      bio: 'RV enthusiast and recipe creator 🚐',
    },
  });

  const mike = await prisma.user.create({
    data: {
      email: 'mike@kindletribe.com',
      password: hashedPassword,
      username: 'mike',
      firstName: 'Mike',
      lastName: 'Johnson',
      bio: 'Outdoor cooking expert 🍳',
    },
  });

  console.log('✅ Created 3 test users');

  // Create friendships
  console.log('Creating friendships...');
  await prisma.friendship.create({
    data: {
      initiatorId: will.id,
      receiverId: hannah.id,
      status: 'ACCEPTED',
    },
  });

  await prisma.friendship.create({
    data: {
      initiatorId: mike.id,
      receiverId: will.id,
      status: 'ACCEPTED',
    },
  });

  console.log('✅ Created friendships');

  // Create sample recipes
  console.log('Creating sample recipes...');
  await prisma.recipe.create({
    data: {
      userId: will.id,
      title: 'Campfire Chili',
      description: 'A hearty chili perfect for cold camping nights',
      ingredients: ['1 lb ground beef', '1 onion diced', '2 cans beans', '1 can tomatoes', 'Chili powder'],
      instructions: ['Brown the beef', 'Add onions and cook', 'Add beans and tomatoes', 'Simmer for 30 minutes'],
      prepTime: 15,
      cookTime: 45,
      servings: 6,
      difficulty: 'EASY',
      category: 'DINNER',
      privacy: 'PUBLIC',
    },
  });

  await prisma.recipe.create({
    data: {
      userId: hannah.id,
      title: 'Camping Breakfast Burritos',
      description: 'Easy make-ahead breakfast for the whole crew',
      ingredients: ['6 eggs', '1/2 lb sausage', 'Cheese', 'Tortillas', 'Peppers and onions'],
      instructions: ['Cook sausage', 'Scramble eggs', 'Sauté veggies', 'Assemble burritos', 'Wrap in foil'],
      prepTime: 10,
      cookTime: 20,
      servings: 4,
      difficulty: 'EASY',
      category: 'BREAKFAST',
      privacy: 'FRIENDS',
    },
  });

  await prisma.recipe.create({
    data: {
      userId: mike.id,
      title: 'Dutch Oven Cobbler',
      description: 'Amazing dessert cooked over the campfire',
      ingredients: ['2 cans fruit', '1 box cake mix', '1 stick butter'],
      instructions: ['Pour fruit in dutch oven', 'Sprinkle cake mix on top', 'Dot with butter', 'Cover and cook 45 min'],
      prepTime: 5,
      cookTime: 45,
      servings: 8,
      difficulty: 'MEDIUM',
      category: 'DESSERT',
      privacy: 'PUBLIC',
    },
  });

  console.log('✅ Created 3 sample recipes');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\nTest Users:');
  console.log('- will@kindletribe.com / password123');
  console.log('- hannah@kindletribe.com / password123');
  console.log('- mike@kindletribe.com / password123');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
