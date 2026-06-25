import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const specs = [
  // Coachmen
  { make: 'Coachmen', model: 'Pursuit 31BH', year: 2022, fuelType: 'GAS', tankCapacityGallons: 80, avgMpgLow: 7.5, avgMpgHigh: 10, avgMpgEstimate: 8.5, source: 'manufacturer' },
  { make: 'Coachmen', model: 'Mirada 35OS', year: 2023, fuelType: 'GAS', tankCapacityGallons: 80, avgMpgLow: 7, avgMpgHigh: 9, avgMpgEstimate: 8, source: 'manufacturer' },
  // Thor Motor Coach
  { make: 'Thor Motor Coach', model: 'Hurricane 35M', year: 2023, fuelType: 'GAS', tankCapacityGallons: 80, avgMpgLow: 6.5, avgMpgHigh: 9, avgMpgEstimate: 7.5, source: 'manufacturer' },
  { make: 'Thor Motor Coach', model: 'Ace 30.3', year: 2023, fuelType: 'GAS', tankCapacityGallons: 55, avgMpgLow: 8, avgMpgHigh: 11, avgMpgEstimate: 9.5, source: 'manufacturer' },
  { make: 'Thor Motor Coach', model: 'Challenger 37FH', year: 2023, fuelType: 'GAS', tankCapacityGallons: 80, avgMpgLow: 6, avgMpgHigh: 8.5, avgMpgEstimate: 7, source: 'manufacturer' },
  { make: 'Thor Motor Coach', model: 'Palazzo 37.5', year: 2023, fuelType: 'DIESEL', tankCapacityGallons: 100, avgMpgLow: 8, avgMpgHigh: 11, avgMpgEstimate: 9.5, source: 'manufacturer' },
  // Winnebago
  { make: 'Winnebago', model: 'Vista 35U', year: 2023, fuelType: 'GAS', tankCapacityGallons: 80, avgMpgLow: 6.5, avgMpgHigh: 9, avgMpgEstimate: 7.5, source: 'manufacturer' },
  { make: 'Winnebago', model: 'Forza 38W', year: 2023, fuelType: 'DIESEL', tankCapacityGallons: 100, avgMpgLow: 9, avgMpgHigh: 12, avgMpgEstimate: 10, source: 'manufacturer' },
  { make: 'Winnebago', model: 'Intent 31P', year: 2023, fuelType: 'GAS', tankCapacityGallons: 55, avgMpgLow: 8, avgMpgHigh: 11, avgMpgEstimate: 9, source: 'manufacturer' },
  // Tiffin
  { make: 'Tiffin', model: 'Allegro Open Road 36UA', year: 2023, fuelType: 'GAS', tankCapacityGallons: 80, avgMpgLow: 6, avgMpgHigh: 8.5, avgMpgEstimate: 7, source: 'manufacturer' },
  { make: 'Tiffin', model: 'Phaeton 40IH', year: 2023, fuelType: 'DIESEL', tankCapacityGallons: 100, avgMpgLow: 8, avgMpgHigh: 11, avgMpgEstimate: 9, source: 'manufacturer' },
  { make: 'Tiffin', model: 'Allegro Bus 45OPP', year: 2023, fuelType: 'DIESEL', tankCapacityGallons: 150, avgMpgLow: 7, avgMpgHigh: 10, avgMpgEstimate: 8, source: 'manufacturer' },
  // Newmar
  { make: 'Newmar', model: 'Bay Star 3226', year: 2023, fuelType: 'GAS', tankCapacityGallons: 80, avgMpgLow: 6.5, avgMpgHigh: 9, avgMpgEstimate: 7.5, source: 'manufacturer' },
  { make: 'Newmar', model: 'Dutch Star 4369', year: 2023, fuelType: 'DIESEL', tankCapacityGallons: 150, avgMpgLow: 7, avgMpgHigh: 10, avgMpgEstimate: 8.5, source: 'manufacturer' },
  // Fleetwood
  { make: 'Fleetwood', model: 'Bounder 36F', year: 2023, fuelType: 'GAS', tankCapacityGallons: 80, avgMpgLow: 6, avgMpgHigh: 8.5, avgMpgEstimate: 7, source: 'manufacturer' },
  { make: 'Fleetwood', model: 'Discovery LXE 44B', year: 2023, fuelType: 'DIESEL', tankCapacityGallons: 100, avgMpgLow: 8, avgMpgHigh: 11, avgMpgEstimate: 9, source: 'manufacturer' },
  // Forest River
  { make: 'Forest River', model: 'Georgetown 36B5', year: 2023, fuelType: 'GAS', tankCapacityGallons: 80, avgMpgLow: 6, avgMpgHigh: 9, avgMpgEstimate: 7.5, source: 'manufacturer' },
  { make: 'Forest River', model: 'Berkshire XLT 45CA', year: 2023, fuelType: 'DIESEL', tankCapacityGallons: 100, avgMpgLow: 7.5, avgMpgHigh: 10, avgMpgEstimate: 8.5, source: 'manufacturer' },
  // Holiday Rambler
  { make: 'Holiday Rambler', model: 'Vacationer 36F', year: 2023, fuelType: 'GAS', tankCapacityGallons: 80, avgMpgLow: 6, avgMpgHigh: 8.5, avgMpgEstimate: 7, source: 'manufacturer' },
  { make: 'Holiday Rambler', model: 'Navigator 38N', year: 2023, fuelType: 'DIESEL', tankCapacityGallons: 100, avgMpgLow: 8, avgMpgHigh: 11, avgMpgEstimate: 9, source: 'manufacturer' },
  // Entegra Coach
  { make: 'Entegra Coach', model: 'Vision XL 36A', year: 2023, fuelType: 'GAS', tankCapacityGallons: 80, avgMpgLow: 6, avgMpgHigh: 9, avgMpgEstimate: 7.5, source: 'manufacturer' },
];

async function main() {
  console.log(`Seeding ${specs.length} manufacturer specs...`);
  let created = 0;
  for (const s of specs) {
    try {
      await prisma.rigManufacturerSpecs.upsert({
        where: { make_model_year: { make: s.make, model: s.model, year: s.year } },
        create: s,
        update: s,
      });
      created++;
    } catch (err: any) {
      console.error(`Failed: ${s.make} ${s.model} ${s.year}:`, err.message);
    }
  }
  console.log(`Done: ${created}/${specs.length} specs seeded.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
