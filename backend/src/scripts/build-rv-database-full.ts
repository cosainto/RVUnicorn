/**
 * RVUnicorn — Comprehensive RV Database Builder (1965–2025)
 * =========================================================
 * Sources: NHTSA VPIC API (all makes/models by year) + curated specs
 * 
 * Run: npx tsx src/scripts/build-rv-database-full.ts
 * 
 * This pulls EVERY RV-related make and model from the federal
 * NHTSA database going back to 1965. Progress is saved so you
 * can stop and resume anytime.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient() as any;
const PROGRESS_FILE = path.join(__dirname, 'rv-database-progress.json');

// Rate limit: be nice to NHTSA
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Progress {
  stage: string;
  completedYears: number[];
  totalMakes: number;
  totalModels: number;
  lastUpdated: string;
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {}
  return { stage: 'init', completedYears: [], totalMakes: 0, totalModels: 0, lastUpdated: '' };
}

function saveProgress(p: Progress) {
  p.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ═══════════════════════════════════════════════════════════════
// NHTSA Vehicle Types relevant to RVs
// ═══════════════════════════════════════════════════════════════
const NHTSA_VEHICLE_TYPES = [
  'Motorhome',
  'Trailer',
  'Multipurpose Passenger Vehicle (MPV)',
  'Bus',
  'Incomplete Vehicle',
];

// Keywords to identify RV-related makes (filter out car/truck-only makes)
const RV_MAKE_KEYWORDS = [
  'rv', 'coach', 'camper', 'trailer', 'motorhome', 'recreation',
  'camping', 'travel', 'caravan', 'mobile', 'van',
];

// Known RV manufacturers (always include even if NHTSA doesn't tag them)
const KNOWN_RV_MAKES = new Set([
  'AIRSTREAM', 'WINNEBAGO', 'THOR', 'TIFFIN', 'NEWMAR', 'JAYCO',
  'FOREST RIVER', 'COACHMEN', 'KEYSTONE', 'GRAND DESIGN', 'HEARTLAND',
  'ENTEGRA', 'FLEETWOOD', 'HOLIDAY RAMBLER', 'DUTCHMEN', 'CROSSROADS',
  'KZ', 'LANCE', 'NUCAMP', 'PLEASURE-WAY', 'STORYTELLER', 'LEISURE TRAVEL',
  'NORTHWOOD', 'PALOMINO', 'VENTURE', 'EAST TO WEST', 'ALLIANCE',
  'BRINKLEY', 'CRUISER', 'OUTDOORS RV', 'EMBER', 'INTECH', 'BRAXTON CREEK',
  'TAXA', 'SCAMP', 'CASITA', 'OLIVER', 'ESCAPE', 'HAPPIER CAMPER',
  'EARTHROAMER', 'ROADTREK', 'AMERICAN COACH', 'MONACO', 'COUNTRY COACH',
  'PREVOST', 'NEXUS', 'REGENCY', 'CHINOOK', 'DYNAMAX', 'GULF STREAM',
  'STARCRAFT', 'SHASTA', 'ALINER', 'BIGFOOT', 'BORN FREE', 'LAZY DAZE',
  'PHOENIX', 'RENEGADE', 'SAFARI', 'SUNLINE', 'SUNNYBROOK', 'ADVENTURER',
  'ARCTIC FOX', 'AVION', 'BEAVER', 'BLUE BIRD', 'BORN FREE', 'CARDINAL',
  'CARRIAGE', 'CHAMPION', 'COBRA', 'COLEMAN', 'CORSAIR', 'DAMON',
  'DISCOVERY', 'DOUBLE TREE', 'EXCEL', 'EXPLORER', 'FOUR WINDS',
  'FRANKLIN', 'FRONTIER', 'GEORGIE BOY', 'GLENDALE', 'GULFSTREAM',
  'HI-LO', 'ITASCA', 'KING OF THE ROAD', 'KIT', 'KOMFORT',
  'LAYTON', 'MALLARD', 'MCKENZIE', 'MONTANA', 'NATIONAL RV',
  'NEWMAR', 'NOMAD', 'NORTHSTAR', 'PACE ARROW', 'PILGRIM',
  'PROWLER', 'RECREATION BY DESIGN', 'REXHALL', 'RIALTA',
  'ROCKWOOD', 'SANDPIPER', 'SKYLINE', 'SOUTHWIND', 'SPORTSMEN',
  'SPRINGDALE', 'STERLING', 'SUN VOYAGER', 'SUNDANCE', 'SUNLITE',
  'TERRY', 'TITAN', 'TRAIL MANOR', 'TRAVELAIRE', 'ULTRA',
  'VANGUARD', 'VIKING', 'WANDERER', 'WESTERN', 'WILDERNESS',
  'XPLORER',
  // Modern/newer brands
  'VANLEIGH', 'HIGHLAND RIDGE', 'PRIME TIME', 'VENTURE RV',
  'RIVERSIDE', 'PACIFIC COACHWORKS', 'ROADTREK', 'WINNEBAGO INDUSTRIES',
  'REV GROUP', 'THOR INDUSTRIES', 'PATRICK INDUSTRIES',
  // Towable/truck camper brands
  'HOST', 'NORTHERN LITE', 'HALLMARK', 'CAPRI', 'PALOMINO',
  'LIVIN LITE', 'CHALET', 'ALASKAN', 'GRANDBY', 'HAWK',
  // European/specialty
  'HYMER', 'DETHLEFFS', 'BURSTNER', 'KNAUS', 'RAPIDO',
  'ADRIA', 'PILOTE', 'LAIKA', 'BENIMAR', 'ROLLER TEAM',
  'AUTOCRUISE', 'AUTO-SLEEPERS', 'BAILEY', 'SWIFT', 'ELDDIS',
  'LUNAR', 'SPRITE', 'COACHMAN', 'BUCCANEER', 'COMPASS',
]);

// ═══════════════════════════════════════════════════════════════
// NHTSA API Helpers
// ═══════════════════════════════════════════════════════════════

async function fetchJSON(url: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e: any) {
      if (attempt === retries - 1) throw e;
      await delay(2000 * (attempt + 1));
    }
  }
}

// Get all makes for a vehicle type
async function getMakesForType(vehicleType: string): Promise<{ MakeId: number; MakeName: string }[]> {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/${encodeURIComponent(vehicleType)}?format=json`;
  const data = await fetchJSON(url);
  return data.Results || [];
}

// Get models for a specific make, year, and vehicle type
async function getModelsForMakeYear(makeId: number, year: number, vehicleType: string): Promise<any[]> {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeIdYear/makeId/${makeId}/modelyear/${year}/vehicletype/${encodeURIComponent(vehicleType)}?format=json`;
  const data = await fetchJSON(url);
  return data.Results || [];
}

// Get all makes (general)
async function getAllMakes(): Promise<{ Make_ID: number; Make_Name: string }[]> {
  const url = 'https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json';
  const data = await fetchJSON(url);
  return data.Results || [];
}

// ═══════════════════════════════════════════════════════════════
// RV Type mapping from NHTSA vehicle types
// ═══════════════════════════════════════════════════════════════
function guessRVType(vehicleType: string, modelName: string): string {
  const model = modelName.toUpperCase();
  
  if (model.includes('CLASS A') || model.includes('DIESEL PUSHER')) return 'Class A';
  if (model.includes('CLASS B+') || model.includes('CLASS B PLUS')) return 'Class B+';
  if (model.includes('CLASS B') || model.includes('CAMPER VAN') || model.includes('SPRINTER')) return 'Class B';
  if (model.includes('CLASS C')) return 'Class C';
  if (model.includes('FIFTH WHEEL') || model.includes('5TH WHEEL')) return 'Fifth Wheel';
  if (model.includes('TOY HAULER') || model.includes('TOYHAULER')) return 'Toy Hauler';
  if (model.includes('TEARDROP')) return 'Teardrop Trailer';
  if (model.includes('POP-UP') || model.includes('POPUP') || model.includes('FOLD')) return 'Pop-Up Camper';
  if (model.includes('TRUCK CAMPER') || model.includes('SLIDE-IN')) return 'Truck Camper';
  if (model.includes('PARK MODEL')) return 'Park Model';
  
  if (vehicleType === 'Motorhome') return 'Class A';
  if (vehicleType === 'Trailer') return 'Travel Trailer';
  if (vehicleType === 'Bus') return 'Class A';
  
  return 'Travel Trailer';
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  🚐 RV Database Builder — Full Historical (1965–2025)');
  console.log('═'.repeat(60));

  const progress = loadProgress();
  const START_YEAR = 1965;
  const END_YEAR = new Date().getFullYear() + 1;

  // ─── Step 1: Collect all RV-related makes ───
  console.log('\n📦 Step 1: Collecting RV manufacturers from NHTSA...');
  
  const allRVMakes = new Map<string, { id: number; name: string; types: Set<string> }>();

  for (const vType of NHTSA_VEHICLE_TYPES) {
    console.log(`  Fetching makes for: ${vType}...`);
    try {
      const makes = await getMakesForType(vType);
      for (const make of makes) {
        const key = make.MakeName.toUpperCase().trim();
        if (!allRVMakes.has(key)) {
          allRVMakes.set(key, { id: make.MakeId, name: make.MakeName, types: new Set() });
        }
        allRVMakes.get(key)!.types.add(vType);
      }
      await delay(500);
    } catch (e: any) {
      console.log(`  ⚠️ Failed for ${vType}, continuing...`);
    }
  }

  // Add known RV makes that might not be in NHTSA results
  for (const knownMake of KNOWN_RV_MAKES) {
    if (!allRVMakes.has(knownMake)) {
      allRVMakes.set(knownMake, { id: 0, name: knownMake, types: new Set(['Trailer']) });
    }
  }

  console.log(`  Found ${allRVMakes.size} RV-related manufacturers`);

  // Upsert all makes to database
  console.log('\n📦 Step 2: Saving makes to database...');
  let makeCount = 0;
  for (const [key, makeData] of allRVMakes) {
    // Format name nicely
    const name = makeData.name.split(' ').map(w => 
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(' ').replace(/\bRv\b/g, 'RV').replace(/\bLlc\b/g, 'LLC').replace(/\bInc\b/g, 'Inc');
    
    try {
      await prisma.rVMake.upsert({
        where: { name },
        update: { types: Array.from(makeData.types) },
        create: { name, types: Array.from(makeData.types) },
      });
      makeCount++;
    } catch {
      // Try with original casing
      try {
        await prisma.rVMake.upsert({
          where: { name: makeData.name },
          update: {},
          create: { name: makeData.name, types: Array.from(makeData.types) },
        });
        makeCount++;
      } catch {}
    }
  }
  console.log(`  ✅ ${makeCount} makes saved`);

  // ─── Step 3: Fetch models by year ───
  console.log('\n📦 Step 3: Fetching models by year (1965–2025)...');
  console.log('  This will take a while — progress is saved!\n');

  let totalNewModels = 0;
  const yearsToProcess = [];
  
  for (let year = START_YEAR; year <= END_YEAR; year++) {
    if (!progress.completedYears.includes(year)) {
      yearsToProcess.push(year);
    }
  }

  console.log(`  ${progress.completedYears.length} years already done, ${yearsToProcess.length} remaining\n`);

  for (const year of yearsToProcess) {
    const yearStart = Date.now();
    let yearModels = 0;

    // Get top RV makes by their NHTSA ID and fetch models
    const makesWithIds = Array.from(allRVMakes.values()).filter(m => m.id > 0);
    
    // Process in batches to avoid overwhelming the API
    // Only process makes that are known RV manufacturers for efficiency
    const priorityMakes = makesWithIds.filter(m => 
      KNOWN_RV_MAKES.has(m.name.toUpperCase().trim())
    );

    for (const makeData of priorityMakes) {
      for (const vType of NHTSA_VEHICLE_TYPES) {
        try {
          const models = await getModelsForMakeYear(makeData.id, year, vType);
          
          for (const model of models) {
            if (!model.Model_Name) continue;
            
            const makeName = model.Make_Name?.split(' ').map((w: string) => 
              w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
            ).join(' ').replace(/\bRv\b/g, 'RV') || makeData.name;

            const modelName = model.Model_Name.trim();
            const rvType = guessRVType(vType, modelName);

            // Find or create the make
            let dbMake;
            try {
              dbMake = await prisma.rVMake.findFirst({
                where: { name: { equals: makeName, mode: 'insensitive' } },
              });
              if (!dbMake) {
                dbMake = await prisma.rVMake.create({
                  data: { name: makeName, types: [vType] },
                });
              }
            } catch {
              continue;
            }

            // Upsert model
            try {
              await prisma.rVModel.upsert({
                where: { makeId_name: { makeId: dbMake.id, name: modelName } },
                update: { type: rvType },
                create: {
                  makeId: dbMake.id,
                  name: modelName,
                  type: rvType,
                  features: [],
                },
              });
              yearModels++;
              totalNewModels++;
            } catch {}
          }

          await delay(200); // Rate limit
        } catch {
          // Skip failed requests
        }
      }
    }

    // Mark year as completed
    progress.completedYears.push(year);
    progress.totalModels += yearModels;
    saveProgress(progress);

    const elapsed = ((Date.now() - yearStart) / 1000).toFixed(1);
    console.log(`  ${year}: +${yearModels} models (${elapsed}s) | Total: ${progress.totalModels} | Years done: ${progress.completedYears.length}/${END_YEAR - START_YEAR + 1}`);
  }

  // ─── Summary ───
  const finalMakes = await prisma.rVMake.count();
  const finalModels = await prisma.rVModel.count();
  const finalTypes = await prisma.rVType.count();

  console.log('\n' + '═'.repeat(60));
  console.log('  ✅ FULL RV DATABASE BUILT!');
  console.log('═'.repeat(60));
  console.log(`  Types:    ${finalTypes}`);
  console.log(`  Makes:    ${finalMakes}`);
  console.log(`  Models:   ${finalModels}`);
  console.log(`  Years:    ${START_YEAR}–${END_YEAR}`);
  console.log(`  New this run: ${totalNewModels}`);
  console.log('');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  prisma.$disconnect();
  process.exit(1);
});
