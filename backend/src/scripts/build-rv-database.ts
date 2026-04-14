/**
 * RVUnicorn — RV Database Builder
 * ================================
 * Sources: RVUSA.com scraping + NHTSA API + curated data
 * Creates: RVMake, RVModel, RVSpec lookup tables
 * 
 * Run: npx tsx src/scripts/build-rv-database.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

// ═══════════════════════════════════════════════════════════════
// CURATED RV DATA — Top manufacturers with types and specs
// ═══════════════════════════════════════════════════════════════

interface RVMakeData {
  name: string;
  logo?: string;
  website?: string;
  types: string[];
}

interface RVModelData {
  make: string;
  name: string;
  type: string;
  year?: number;
  lengthFt?: number;
  heightFt?: number;
  weightLbs?: number;
  sleeps?: number;
  slideouts?: number;
  mpg?: number;
  tankGallons?: number;
  features?: string[];
  stockImage?: string;
  msrp?: string;
}

const RV_TYPES = [
  'Class A',
  'Class B',
  'Class B+',
  'Class C',
  'Travel Trailer',
  'Fifth Wheel',
  'Toy Hauler',
  'Pop-Up Camper',
  'Truck Camper',
  'Teardrop Trailer',
  'Airstream',
  'Van Conversion',
  'Skoolie',
  'Overlander',
  'Park Model',
  'Hybrid Trailer',
];

// Major RV manufacturers with their product lines
const RV_MAKES: RVMakeData[] = [
  { name: 'Airstream', website: 'https://www.airstream.com', types: ['Travel Trailer', 'Class B'] },
  { name: 'Winnebago', website: 'https://www.winnebago.com', types: ['Class A', 'Class B', 'Class B+', 'Class C', 'Travel Trailer', 'Fifth Wheel', 'Toy Hauler'] },
  { name: 'Thor Motor Coach', website: 'https://www.thormotorcoach.com', types: ['Class A', 'Class B', 'Class B+', 'Class C'] },
  { name: 'Tiffin Motorhomes', website: 'https://www.tiffinmotorhomes.com', types: ['Class A', 'Class C'] },
  { name: 'Newmar', website: 'https://www.newmarcorp.com', types: ['Class A'] },
  { name: 'Jayco', website: 'https://www.jayco.com', types: ['Class A', 'Class C', 'Travel Trailer', 'Fifth Wheel', 'Toy Hauler', 'Pop-Up Camper'] },
  { name: 'Forest River', website: 'https://www.forestriverinc.com', types: ['Class A', 'Class B', 'Class C', 'Travel Trailer', 'Fifth Wheel', 'Toy Hauler', 'Pop-Up Camper', 'Park Model'] },
  { name: 'Coachmen', website: 'https://www.coachmenrv.com', types: ['Class A', 'Class B', 'Class C', 'Travel Trailer', 'Fifth Wheel'] },
  { name: 'Keystone', website: 'https://www.keystonerv.com', types: ['Travel Trailer', 'Fifth Wheel', 'Toy Hauler'] },
  { name: 'Grand Design', website: 'https://www.granddesignrv.com', types: ['Travel Trailer', 'Fifth Wheel', 'Toy Hauler'] },
  { name: 'Heartland', website: 'https://www.heartlandrvs.com', types: ['Travel Trailer', 'Fifth Wheel', 'Toy Hauler'] },
  { name: 'Entegra Coach', website: 'https://www.entegracoach.com', types: ['Class A', 'Class B', 'Class C'] },
  { name: 'Fleetwood', website: 'https://www.fleetwoodrv.com', types: ['Class A'] },
  { name: 'Holiday Rambler', website: 'https://www.holidayrambler.com', types: ['Class A'] },
  { name: 'Dutchmen', website: 'https://www.dutchmen.com', types: ['Travel Trailer', 'Fifth Wheel', 'Toy Hauler'] },
  { name: 'CrossRoads', website: 'https://www.crossroadsrv.com', types: ['Travel Trailer', 'Fifth Wheel', 'Toy Hauler'] },
  { name: 'KZ RV', website: 'https://www.kz-rv.com', types: ['Travel Trailer', 'Fifth Wheel', 'Toy Hauler'] },
  { name: 'Lance Campers', website: 'https://www.lancecamper.com', types: ['Truck Camper', 'Travel Trailer'] },
  { name: 'NuCamp', website: 'https://www.nucamprv.com', types: ['Teardrop Trailer', 'Travel Trailer', 'Truck Camper'] },
  { name: 'Pleasure-Way', website: 'https://www.pleasureway.com', types: ['Class B'] },
  { name: 'Storyteller Overland', website: 'https://www.storytelleroverland.com', types: ['Class B', 'Van Conversion'] },
  { name: 'Leisure Travel Vans', website: 'https://www.leisurevans.com', types: ['Class B', 'Class B+'] },
  { name: 'Northwood', website: 'https://www.northwoodmfg.com', types: ['Travel Trailer', 'Fifth Wheel', 'Truck Camper'] },
  { name: 'Palomino', website: 'https://www.palominorv.com', types: ['Travel Trailer', 'Truck Camper', 'Pop-Up Camper'] },
  { name: 'Venture RV', website: 'https://www.venture-rv.com', types: ['Travel Trailer'] },
  { name: 'East to West', website: 'https://www.easttowestrv.com', types: ['Travel Trailer', 'Fifth Wheel'] },
  { name: 'Alliance RV', website: 'https://www.alliancerv.com', types: ['Fifth Wheel', 'Travel Trailer'] },
  { name: 'Brinkley RV', website: 'https://www.brinkleyrv.com', types: ['Fifth Wheel', 'Travel Trailer', 'Toy Hauler'] },
  { name: 'Cruiser RV', website: 'https://www.cruiserrv.com', types: ['Travel Trailer', 'Fifth Wheel'] },
  { name: 'Outdoors RV', website: 'https://www.outdoorsrvmfg.com', types: ['Travel Trailer', 'Fifth Wheel'] },
  { name: 'Ember RV', website: 'https://www.emberrv.com', types: ['Travel Trailer'] },
  { name: 'inTech RV', website: 'https://www.intechrv.com', types: ['Travel Trailer', 'Toy Hauler'] },
  { name: 'Braxton Creek', website: 'https://www.braxtoncreekrv.com', types: ['Travel Trailer'] },
  { name: 'Taxa Outdoors', website: 'https://www.taxaoutdoors.com', types: ['Travel Trailer', 'Pop-Up Camper'] },
  { name: 'Scamp', website: 'https://www.scamptrailers.com', types: ['Travel Trailer'] },
  { name: 'Casita', website: 'https://www.casitatraveltrailers.com', types: ['Travel Trailer'] },
  { name: 'Oliver Travel Trailers', website: 'https://www.olivertraveltrailers.com', types: ['Travel Trailer'] },
  { name: 'Escape Trailer', website: 'https://www.escapetrailer.com', types: ['Travel Trailer', 'Fifth Wheel'] },
  { name: 'Happier Camper', website: 'https://www.happiercamper.com', types: ['Travel Trailer'] },
  { name: 'EarthRoamer', website: 'https://www.earthroamer.com', types: ['Overlander'] },
  { name: 'Roadtrek', website: 'https://www.roadtrek.com', types: ['Class B'] },
  { name: 'American Coach', website: 'https://www.americancoach.com', types: ['Class A'] },
  { name: 'Monaco', types: ['Class A'] },
  { name: 'Country Coach', types: ['Class A'] },
  { name: 'Prevost', website: 'https://www.prevostcar.com', types: ['Class A'] },
  { name: 'REV Recreation Group', types: ['Class A', 'Class C'] },
  { name: 'Nexus RV', website: 'https://www.nexusrv.com', types: ['Class B+', 'Class C'] },
  { name: 'Regency RV', types: ['Class B'] },
  { name: 'Chinook RV', types: ['Class B+'] },
  { name: 'Dynamax', types: ['Class C'] },
];

// Curated popular models with specs
const POPULAR_MODELS: RVModelData[] = [
  // Airstream
  { make: 'Airstream', name: 'Basecamp 16', type: 'Travel Trailer', lengthFt: 16, weightLbs: 3500, sleeps: 2, slideouts: 0, features: ['Solar ready', 'Off-grid capable', 'Lightweight'] },
  { make: 'Airstream', name: 'Basecamp 20', type: 'Travel Trailer', lengthFt: 20, weightLbs: 4500, sleeps: 4, slideouts: 0, features: ['Solar ready', 'Off-grid capable', 'Rear hatch'] },
  { make: 'Airstream', name: 'Bambi 16RB', type: 'Travel Trailer', lengthFt: 16, weightLbs: 3500, sleeps: 2, slideouts: 0, features: ['Compact', 'Iconic design'] },
  { make: 'Airstream', name: 'Caravel 16RB', type: 'Travel Trailer', lengthFt: 16, weightLbs: 3800, sleeps: 2, slideouts: 0, features: ['Premium finishes'] },
  { make: 'Airstream', name: 'Flying Cloud 25FB', type: 'Travel Trailer', lengthFt: 25, weightLbs: 5900, sleeps: 6, slideouts: 0, features: ['Queen bed', 'Full bath', 'Panoramic windows'] },
  { make: 'Airstream', name: 'International 25FB', type: 'Travel Trailer', lengthFt: 25, weightLbs: 6200, sleeps: 4, slideouts: 0, features: ['Premium interior', 'Smart controls'] },
  { make: 'Airstream', name: 'Classic 30', type: 'Travel Trailer', lengthFt: 30, weightLbs: 7800, sleeps: 4, slideouts: 0, features: ['King bed option', 'Dual A/C', 'Smart controls'] },
  { make: 'Airstream', name: 'Interstate 19', type: 'Class B', lengthFt: 19, weightLbs: 9200, sleeps: 2, slideouts: 0, mpg: 18, features: ['Mercedes Sprinter chassis', 'Pop-top option'] },
  { make: 'Airstream', name: 'Interstate 24GL', type: 'Class B', lengthFt: 24, weightLbs: 10500, sleeps: 2, slideouts: 0, mpg: 16, features: ['Mercedes Sprinter', 'Grand touring'] },

  // Winnebago
  { make: 'Winnebago', name: 'Solis 59P', type: 'Class B', lengthFt: 19, weightLbs: 8700, sleeps: 2, slideouts: 0, mpg: 18, features: ['Pop-top', 'Ram ProMaster', 'Flexible space'] },
  { make: 'Winnebago', name: 'Revel 44E', type: 'Class B', lengthFt: 19, weightLbs: 9500, sleeps: 2, slideouts: 0, mpg: 16, features: ['4x4 Mercedes Sprinter', 'Off-grid', 'Hydronic heat'] },
  { make: 'Winnebago', name: 'Travato 59K', type: 'Class B', lengthFt: 21, weightLbs: 9100, sleeps: 2, slideouts: 0, mpg: 18, features: ['Ram ProMaster', 'Murphy bed', 'Pure3 energy'] },
  { make: 'Winnebago', name: 'View 24D', type: 'Class C', lengthFt: 25, weightLbs: 12500, sleeps: 4, slideouts: 1, mpg: 14, features: ['Mercedes Sprinter', 'Full slide'] },
  { make: 'Winnebago', name: 'Minnie Winnie 22R', type: 'Class C', lengthFt: 24, weightLbs: 11000, sleeps: 6, slideouts: 0, mpg: 12, features: ['Ford E-450', 'Over-cab bed'] },
  { make: 'Winnebago', name: 'Voyage 2831RB', type: 'Travel Trailer', lengthFt: 32, weightLbs: 7500, sleeps: 6, slideouts: 1, features: ['Rear bath', 'King bed'] },
  { make: 'Winnebago', name: 'Micro Minnie 1700FBS', type: 'Travel Trailer', lengthFt: 21, weightLbs: 3800, sleeps: 4, slideouts: 0, features: ['Lightweight', 'Front bed'] },
  { make: 'Winnebago', name: 'Forza 34T', type: 'Class A', lengthFt: 36, weightLbs: 28000, sleeps: 4, slideouts: 3, mpg: 8, features: ['Freightliner chassis', 'Diesel pusher'] },
  { make: 'Winnebago', name: 'Journey 36M', type: 'Class A', lengthFt: 38, weightLbs: 30000, sleeps: 4, slideouts: 4, mpg: 7, features: ['Freightliner', 'Premium diesel pusher'] },

  // Thor Motor Coach
  { make: 'Thor Motor Coach', name: 'Rize 18G', type: 'Class B', lengthFt: 19, weightLbs: 8800, sleeps: 2, slideouts: 0, mpg: 18, features: ['Ram ProMaster', 'Pop-top'] },
  { make: 'Thor Motor Coach', name: 'Sanctuary 19L', type: 'Class B', lengthFt: 19, weightLbs: 9300, sleeps: 2, slideouts: 0, mpg: 16, features: ['AWD Sprinter', 'Off-grid'] },
  { make: 'Thor Motor Coach', name: 'Gemini 23TW', type: 'Class B+', lengthFt: 24, weightLbs: 11500, sleeps: 6, slideouts: 0, mpg: 14, features: ['Ford Transit', 'Twin beds'] },
  { make: 'Thor Motor Coach', name: 'Four Winds 28A', type: 'Class C', lengthFt: 30, weightLbs: 14000, sleeps: 8, slideouts: 1, mpg: 10, features: ['Ford E-450', 'Bunk beds'] },
  { make: 'Thor Motor Coach', name: 'Ace 30.3', type: 'Class A', lengthFt: 31, weightLbs: 18000, sleeps: 6, slideouts: 1, mpg: 8, features: ['Ford F-53', 'Drop-down bunk'] },
  { make: 'Thor Motor Coach', name: 'Tuscany 40RT', type: 'Class A', lengthFt: 41, weightLbs: 35000, sleeps: 4, slideouts: 4, mpg: 7, features: ['Freightliner', 'Luxury diesel'] },

  // Jayco
  { make: 'Jayco', name: 'Jay Feather 22RB', type: 'Travel Trailer', lengthFt: 25, weightLbs: 5100, sleeps: 4, slideouts: 1, features: ['Rear bath', 'Slide out dinette'] },
  { make: 'Jayco', name: 'Jay Flight 28BHS', type: 'Travel Trailer', lengthFt: 32, weightLbs: 6800, sleeps: 10, slideouts: 1, features: ['Bunk house', 'Outdoor kitchen'] },
  { make: 'Jayco', name: 'Eagle HT 28.5RSTS', type: 'Fifth Wheel', lengthFt: 34, weightLbs: 9500, sleeps: 4, slideouts: 3, features: ['Luxury fifth wheel', 'Fireplace'] },
  { make: 'Jayco', name: 'Seismic 4113', type: 'Toy Hauler', lengthFt: 44, weightLbs: 15000, sleeps: 8, slideouts: 2, features: ['13ft garage', 'Fuel station'] },
  { make: 'Jayco', name: 'Melbourne 24L', type: 'Class C', lengthFt: 25, weightLbs: 12000, sleeps: 4, slideouts: 1, mpg: 14, features: ['Mercedes Sprinter'] },

  // Grand Design
  { make: 'Grand Design', name: 'Imagine 2910BH', type: 'Travel Trailer', lengthFt: 34, weightLbs: 7200, sleeps: 10, slideouts: 1, features: ['Bunk house', 'Outdoor kitchen'] },
  { make: 'Grand Design', name: 'Transcend Xplor 200MK', type: 'Travel Trailer', lengthFt: 24, weightLbs: 4800, sleeps: 4, slideouts: 1, features: ['Murphy bed', 'Lightweight'] },
  { make: 'Grand Design', name: 'Reflection 150 260RD', type: 'Fifth Wheel', lengthFt: 30, weightLbs: 9800, sleeps: 4, slideouts: 2, features: ['Rear den', 'Residential fridge'] },
  { make: 'Grand Design', name: 'Solitude 390RK', type: 'Fifth Wheel', lengthFt: 43, weightLbs: 14500, sleeps: 4, slideouts: 4, features: ['Rear kitchen', 'Luxury', 'Washer/dryer ready'] },
  { make: 'Grand Design', name: 'Momentum 395MS', type: 'Toy Hauler', lengthFt: 43, weightLbs: 16000, sleeps: 8, slideouts: 3, features: ['Master suite', 'Fuel station'] },

  // Keystone
  { make: 'Keystone', name: 'Passport 219BH', type: 'Travel Trailer', lengthFt: 26, weightLbs: 5200, sleeps: 8, slideouts: 1, features: ['Bunk house', 'Outside kitchen'] },
  { make: 'Keystone', name: 'Cougar 25RES', type: 'Fifth Wheel', lengthFt: 29, weightLbs: 8500, sleeps: 4, slideouts: 2, features: ['iN-Command system', 'King bed'] },
  { make: 'Keystone', name: 'Montana 3855BR', type: 'Fifth Wheel', lengthFt: 41, weightLbs: 13500, sleeps: 6, slideouts: 4, features: ['Bunk room', 'Washer/dryer', 'Fireplace'] },
  { make: 'Keystone', name: 'Raptor 423', type: 'Toy Hauler', lengthFt: 44, weightLbs: 16500, sleeps: 8, slideouts: 3, features: ['13ft garage', 'Party deck'] },

  // Forest River
  { make: 'Forest River', name: 'Rockwood Mini Lite 2509S', type: 'Travel Trailer', lengthFt: 29, weightLbs: 5500, sleeps: 6, slideouts: 1, features: ['Murphy bed', 'Lightweight'] },
  { make: 'Forest River', name: 'Cherokee 274WK', type: 'Travel Trailer', lengthFt: 33, weightLbs: 7000, sleeps: 8, slideouts: 1, features: ['Bunk house', 'Outdoor kitchen'] },
  { make: 'Forest River', name: 'Cardinal Luxury 370FLX', type: 'Fifth Wheel', lengthFt: 41, weightLbs: 13500, sleeps: 4, slideouts: 4, features: ['Front living', 'Luxury'] },
  { make: 'Forest River', name: 'Georgetown 36B7', type: 'Class A', lengthFt: 38, weightLbs: 22000, sleeps: 8, slideouts: 2, mpg: 8, features: ['Ford F-53', 'Bunk beds'] },
  { make: 'Forest River', name: 'Sunseeker 2860DS', type: 'Class C', lengthFt: 30, weightLbs: 14000, sleeps: 6, slideouts: 1, mpg: 10, features: ['Ford E-450', 'Full wall slide'] },

  // Heartland
  { make: 'Heartland', name: 'North Trail 22FBS', type: 'Travel Trailer', lengthFt: 27, weightLbs: 5400, sleeps: 4, slideouts: 1, features: ['Front bedroom', 'Aluminum frame'] },
  { make: 'Heartland', name: 'Bighorn 3375SS', type: 'Fifth Wheel', lengthFt: 38, weightLbs: 13000, sleeps: 4, slideouts: 3, features: ['King bed', 'Residential fridge'] },
  { make: 'Heartland', name: 'Torque 371', type: 'Toy Hauler', lengthFt: 41, weightLbs: 15500, sleeps: 8, slideouts: 2, features: ['13ft garage', 'Fuel station'] },

  // Coachmen
  { make: 'Coachmen', name: 'Catalina Legacy 293QBCK', type: 'Travel Trailer', lengthFt: 35, weightLbs: 7200, sleeps: 10, slideouts: 1, features: ['Bunk house', 'Outdoor kitchen'] },
  { make: 'Coachmen', name: 'Beyond 22D', type: 'Class B', lengthFt: 22, weightLbs: 9500, sleeps: 2, slideouts: 0, mpg: 16, features: ['Ford Transit AWD', 'Li-ion batteries'] },
  { make: 'Coachmen', name: 'Leprechaun 260DS', type: 'Class C', lengthFt: 28, weightLbs: 13500, sleeps: 6, slideouts: 1, mpg: 10, features: ['Ford E-450', 'Full-wall slide'] },

  // Tiffin
  { make: 'Tiffin Motorhomes', name: 'Phaeton 37BH', type: 'Class A', lengthFt: 38, weightLbs: 32000, sleeps: 6, slideouts: 3, mpg: 7, features: ['Freightliner', 'Bunk beds', 'Bath & half'] },
  { make: 'Tiffin Motorhomes', name: 'Allegro Bus 40IP', type: 'Class A', lengthFt: 41, weightLbs: 36000, sleeps: 4, slideouts: 4, mpg: 6, features: ['Powerglide chassis', 'Tag axle'] },
  { make: 'Tiffin Motorhomes', name: 'Open Road 32LA', type: 'Class A', lengthFt: 34, weightLbs: 20000, sleeps: 4, slideouts: 2, mpg: 8, features: ['Ford F-53', 'Full-body paint'] },
  { make: 'Tiffin Motorhomes', name: 'Wayfarer 25QW', type: 'Class C', lengthFt: 25, weightLbs: 12000, sleeps: 4, slideouts: 1, mpg: 14, features: ['Mercedes Sprinter'] },

  // Newmar
  { make: 'Newmar', name: 'Bay Star 3014', type: 'Class A', lengthFt: 32, weightLbs: 22000, sleeps: 4, slideouts: 2, mpg: 8, features: ['Ford F-53', 'Entry-luxury'] },
  { make: 'Newmar', name: 'Dutch Star 4369', type: 'Class A', lengthFt: 44, weightLbs: 38000, sleeps: 4, slideouts: 4, mpg: 6, features: ['Freightliner', 'Luxury diesel'] },
  { make: 'Newmar', name: 'King Aire 4596', type: 'Class A', lengthFt: 45, weightLbs: 42000, sleeps: 4, slideouts: 4, mpg: 6, features: ['Spartan chassis', 'Ultra-luxury'] },

  // Smaller / Specialty
  { make: 'NuCamp', name: 'TAB 320S', type: 'Teardrop Trailer', lengthFt: 13, weightLbs: 1750, sleeps: 2, slideouts: 0, features: ['Teardrop', 'Stargazer window', 'Off-road option'] },
  { make: 'NuCamp', name: 'TAB 400', type: 'Teardrop Trailer', lengthFt: 18, weightLbs: 2900, sleeps: 2, slideouts: 0, features: ['Wet bath', 'AC', 'Boondocking ready'] },
  { make: 'NuCamp', name: 'Cirrus 820', type: 'Truck Camper', lengthFt: 18, weightLbs: 2700, sleeps: 4, slideouts: 0, features: ['Short bed truck', 'Wet bath'] },

  { make: 'Lance Campers', name: '1172', type: 'Truck Camper', lengthFt: 21, weightLbs: 3800, sleeps: 4, slideouts: 1, features: ['Long bed', 'Slide out', 'Dual entry'] },
  { make: 'Lance Campers', name: '2075', type: 'Travel Trailer', lengthFt: 24, weightLbs: 5200, sleeps: 5, slideouts: 1, features: ['Aerodynamic', 'Solar ready'] },

  { make: 'Pleasure-Way', name: 'Ontour 2.0', type: 'Class B', lengthFt: 19, weightLbs: 7500, sleeps: 2, slideouts: 0, mpg: 20, features: ['Ford Transit', 'Compact', 'Lithium'] },
  { make: 'Pleasure-Way', name: 'Plateau TS', type: 'Class B', lengthFt: 22, weightLbs: 9500, sleeps: 2, slideouts: 0, mpg: 16, features: ['Mercedes Sprinter', 'Twin slide-out bed'] },

  { make: 'Storyteller Overland', name: 'MODE LT', type: 'Class B', lengthFt: 19, weightLbs: 9800, sleeps: 2, slideouts: 0, mpg: 16, features: ['4x4 Sprinter', 'GrooveLounge', 'Off-grid'] },
  { make: 'Storyteller Overland', name: 'Beast MODE', type: 'Class B', lengthFt: 19, weightLbs: 10200, sleeps: 2, slideouts: 0, mpg: 15, features: ['4x4 Sprinter', 'Adventure package'] },

  { make: 'EarthRoamer', name: 'LTi', type: 'Overlander', lengthFt: 27, weightLbs: 22000, sleeps: 4, slideouts: 0, mpg: 12, features: ['Ford F-550 4x4', 'Carbon fiber body', 'Off-grid luxury'] },

  { make: 'Happier Camper', name: 'HC1', type: 'Travel Trailer', lengthFt: 13, weightLbs: 1100, sleeps: 2, slideouts: 0, features: ['Modular interior', 'Ultra-light', 'Retro design'] },

  { make: 'Casita', name: 'Spirit Deluxe', type: 'Travel Trailer', lengthFt: 17, weightLbs: 2700, sleeps: 4, slideouts: 0, features: ['Fiberglass', 'Lightweight', 'No-leak roof'] },
  { make: 'Casita', name: 'Independence Deluxe', type: 'Travel Trailer', lengthFt: 17, weightLbs: 2700, sleeps: 3, slideouts: 0, features: ['Fiberglass', 'Rear bath'] },

  { make: 'Scamp', name: '13 Standard', type: 'Travel Trailer', lengthFt: 13, weightLbs: 1500, sleeps: 2, slideouts: 0, features: ['Fiberglass', 'Ultra-light', 'Classic'] },
  { make: 'Scamp', name: '19 Deluxe', type: 'Travel Trailer', lengthFt: 19, weightLbs: 2700, sleeps: 4, slideouts: 0, features: ['Fiberglass', 'Full bath'] },

  { make: 'Oliver Travel Trailers', name: 'Legacy Elite II', type: 'Travel Trailer', lengthFt: 23, weightLbs: 5500, sleeps: 2, slideouts: 0, features: ['Double-hull fiberglass', 'Four-season', 'Premium build'] },

  { make: 'Taxa Outdoors', name: 'Mantis', type: 'Travel Trailer', lengthFt: 18, weightLbs: 3200, sleeps: 4, slideouts: 0, features: ['NASA-inspired', 'Off-road', 'Pop-up roof'] },
  { make: 'Taxa Outdoors', name: 'Cricket', type: 'Pop-Up Camper', lengthFt: 15, weightLbs: 1700, sleeps: 2, slideouts: 0, features: ['Micro-camper', 'Pop-up', 'Lightweight'] },

  // Brinkley (newer brand, popular)
  { make: 'Brinkley RV', name: 'Model Z 3100', type: 'Fifth Wheel', lengthFt: 35, weightLbs: 12000, sleeps: 4, slideouts: 3, features: ['Mid-bunk', 'Luxury', 'Off-door-side kitchen'] },
  { make: 'Brinkley RV', name: 'Model G 3500', type: 'Toy Hauler', lengthFt: 40, weightLbs: 14500, sleeps: 8, slideouts: 2, features: ['12ft garage', 'Happi-Jac beds'] },

  // Alliance
  { make: 'Alliance RV', name: 'Valor 36V11', type: 'Fifth Wheel', lengthFt: 39, weightLbs: 13000, sleeps: 6, slideouts: 3, features: ['Bunk room', 'Fireplace', 'King bed'] },
  { make: 'Alliance RV', name: 'Avenue 32RLS', type: 'Fifth Wheel', lengthFt: 36, weightLbs: 11500, sleeps: 4, slideouts: 3, features: ['Rear living', 'Residential feel'] },
];

// ═══════════════════════════════════════════════════════════════
// NHTSA Vehicle API — supplemental data
// ═══════════════════════════════════════════════════════════════
async function fetchNHTSAMakes(): Promise<string[]> {
  try {
    console.log('🔍 Fetching RV makes from NHTSA...');
    const url = 'https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/Multipurpose%20Passenger%20Vehicle%20(MPV)?format=json';
    const res = await fetch(url);
    const data: any = await res.json();
    const makes = (data.Results || [])
      .map((r: any) => r.MakeName)
      .filter((n: string) => n && n.length > 1);
    console.log(`  Found ${makes.length} makes from NHTSA`);
    return makes;
  } catch (e: any) {
    console.log('  ⚠️ NHTSA fetch failed, using curated data only');
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// DATABASE POPULATION
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  🚐 RVUnicorn RV Database Builder');
  console.log('═'.repeat(60));

  // Step 1: Insert RV Types
  console.log('\n📦 Step 1: Creating RV types...');
  for (const type of RV_TYPES) {
    await prisma.rVType.upsert({
      where: { name: type },
      update: {},
      create: { name: type, description: '' },
    });
  }
  console.log(`  ✅ ${RV_TYPES.length} RV types`);

  // Step 2: Insert Makes
  console.log('\n📦 Step 2: Creating RV makes...');
  let makeCount = 0;
  for (const make of RV_MAKES) {
    await prisma.rVMake.upsert({
      where: { name: make.name },
      update: { website: make.website },
      create: {
        name: make.name,
        website: make.website,
        logo: make.logo,
        types: make.types,
      },
    });
    makeCount++;
  }

  // Supplement from NHTSA
  const nhtsaMakes = await fetchNHTSAMakes();
  for (const name of nhtsaMakes) {
    const exists = RV_MAKES.find(m => m.name.toLowerCase() === name.toLowerCase());
    if (!exists) {
      try {
        await prisma.rVMake.upsert({
          where: { name },
          update: {},
          create: { name, types: [] },
        });
        makeCount++;
      } catch {}
    }
  }
  console.log(`  ✅ ${makeCount} RV makes`);

  // Step 3: Insert Models
  console.log('\n📦 Step 3: Creating RV models with specs...');
  let modelCount = 0;
  for (const model of POPULAR_MODELS) {
    const make = await prisma.rVMake.findUnique({ where: { name: model.make } });
    if (!make) continue;

    await prisma.rVModel.upsert({
      where: {
        makeId_name: { makeId: make.id, name: model.name },
      },
      update: {
        type: model.type,
        lengthFt: model.lengthFt,
        heightFt: model.heightFt,
        weightLbs: model.weightLbs,
        sleeps: model.sleeps,
        slideouts: model.slideouts,
        mpg: model.mpg,
        tankGallons: model.tankGallons,
        features: model.features || [],
        stockImage: model.stockImage,
        msrp: model.msrp,
      },
      create: {
        makeId: make.id,
        name: model.name,
        type: model.type,
        lengthFt: model.lengthFt,
        heightFt: model.heightFt,
        weightLbs: model.weightLbs,
        sleeps: model.sleeps,
        slideouts: model.slideouts,
        mpg: model.mpg,
        tankGallons: model.tankGallons,
        features: model.features || [],
        stockImage: model.stockImage,
        msrp: model.msrp,
      },
    });
    modelCount++;
  }
  console.log(`  ✅ ${modelCount} RV models with specs`);

  // Summary
  const totalMakes = await prisma.rVMake.count();
  const totalModels = await prisma.rVModel.count();
  const totalTypes = await prisma.rVType.count();

  console.log('\n' + '═'.repeat(60));
  console.log('  ✅ RV DATABASE BUILT!');
  console.log('═'.repeat(60));
  console.log(`  Types:  ${totalTypes}`);
  console.log(`  Makes:  ${totalMakes}`);
  console.log(`  Models: ${totalModels}`);
  console.log('');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  prisma.$disconnect();
  process.exit(1);
});
