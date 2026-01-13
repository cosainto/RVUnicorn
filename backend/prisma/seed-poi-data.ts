/**
 * Import POI Factory data for Rest Areas and Truck Stops
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDirection(dir: string): string {
  const d = dir.toUpperCase();
  if (d.includes('EB') || d.includes('EAST')) return 'Eastbound';
  if (d.includes('WB') || d.includes('WEST')) return 'Westbound';
  if (d.includes('NB') || d.includes('NORTH')) return 'Northbound';
  if (d.includes('SB') || d.includes('SOUTH')) return 'Southbound';
  return 'Both';
}

function parseRestArea(line: string) {
  const parts = parseCSVLine(line);
  if (parts.length < 3) return null;
  const longitude = parseFloat(parts[0]);
  const latitude = parseFloat(parts[1]);
  if (isNaN(longitude) || isNaN(latitude)) return null;
  
  const locationInfo = parts[2] || '';
  const locationParts = locationInfo.split(',');
  const state = locationParts[0]?.trim() || '';
  const highway = locationParts[1]?.trim() || '';
  const direction = locationParts[2]?.trim() || '';
  let name = locationParts.slice(3).join(',').trim();
  
  let mileMarker: number | null = null;
  const mmMatch = name.match(/MM(\d+\.?\d*)/i);
  if (mmMatch) mileMarker = parseFloat(mmMatch[1]);
  
  const amenities = parts[3] || '';
  if (state.length !== 2) return null;
  
  return {
    name: name || state + ' Rest Area',
    state,
    latitude,
    longitude,
    interstate: highway,
    direction: parseDirection(direction),
    mileMarker,
    hasRestrooms: amenities.includes('RR') && !amenities.includes('NO RR'),
    hasPicnicArea: amenities.includes('PT'),
    hasPetArea: amenities.toLowerCase().includes('pet'),
    hasVending: amenities.includes('VM'),
    hasWifi: amenities.toLowerCase().includes('wifi'),
    hasRVParking: amenities.includes('RV'),
    hasDumpStation: amenities.toLowerCase().includes('dump'),
    hasWater: false,
    is24Hours: true,
    notes: amenities
  };
}

function parseLoves(line: string) {
  const parts = parseCSVLine(line);
  if (parts.length < 3) return null;
  const longitude = parseFloat(parts[0]);
  const latitude = parseFloat(parts[1]);
  if (isNaN(longitude) || isNaN(latitude)) return null;
  
  const nameInfo = parts[2] || '';
  const details = parts[3] || '';
  const nameMatch = nameInfo.match(/Love's TS-([^,]+),(\w{2})/);
  const city = nameMatch ? nameMatch[1].trim() : '';
  const state = nameMatch ? nameMatch[2].trim() : '';
  if (!state || state.length !== 2) return null;
  
  let address = '', phone = '', interstate = '', exitNumber = '';
  const detailParts = details.split('|');
  for (const part of detailParts) {
    const exitMatch = part.match(/I-(\d+)[^\d]*Exit\s*(\d+)/i);
    if (exitMatch) { interstate = 'I-' + exitMatch[1]; exitNumber = 'Exit ' + exitMatch[2]; }
    if (part.match(/\d+.*(?:St|Ave|Rd|Hwy|Dr|Blvd)/i)) address = part.trim();
    if (part.match(/\d{3}-\d{3}-\d{4}/)) phone = part.trim();
  }
  
  return {
    name: "Love's Travel Stop - " + city,
    brand: "Love's",
    address: address || city + ', ' + state,
    city, state, zipCode: '', latitude, longitude, interstate, exitNumber,
    hasDiesel: true, hasTruckParking: true,
    hasRVParking: details.toLowerCase().includes('rv'),
    hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true,
    hasPropane: details.toLowerCase().includes('propane'),
    hasDumpStation: details.toLowerCase().includes('dump'),
    phone, website: 'https://www.loves.com'
  };
}

function parsePilotFlyingJ(line: string) {
  const parts = parseCSVLine(line);
  if (parts.length < 3) return null;
  const longitude = parseFloat(parts[0]);
  const latitude = parseFloat(parts[1]);
  if (isNaN(longitude) || isNaN(latitude)) return null;
  
  const nameInfo = parts[2] || '';
  const contactInfo = parts[3] || '';
  
  let brand = 'Pilot';
  if (nameInfo.toLowerCase().includes('flying j')) brand = 'Flying J';
  else if (nameInfo.toLowerCase().includes('ez trip')) brand = 'EZ Trip';
  
  const cityMatch = nameInfo.match(/[A-Z]{2}:([^-]+)/);
  const city = cityMatch ? cityMatch[1].trim() : '';
  
  let state = '';
  const stateMatch = contactInfo.match(/^([A-Z]{2})\s/);
  if (stateMatch) state = stateMatch[1];
  else {
    const stateMatch2 = nameInfo.match(/-([A-Z]{2}):/);
    if (stateMatch2) state = stateMatch2[1];
  }
  
  const phoneMatch = contactInfo.match(/(\d{3}-\d{3}-\d{4})/);
  const phone = phoneMatch ? phoneMatch[1] : '';
  
  let interstate = '', exitNumber = '';
  const intMatch = nameInfo.match(/(I-\d+)\s*Exit\s*(\d+)/i);
  if (intMatch) { interstate = intMatch[1]; exitNumber = 'Exit ' + intMatch[2]; }
  
  const addrMatch = nameInfo.match(/,\s*(\d+[^;]+)/);
  const address = addrMatch ? addrMatch[1].trim() : '';
  
  if (!state || state.length !== 2) return null;
  
  return {
    name: brand + ' - ' + (city || 'Location'),
    brand, address: address || city + ', ' + state,
    city: city || '', state, zipCode: '', latitude, longitude, interstate, exitNumber,
    hasDiesel: true, hasTruckParking: true, hasRVParking: true,
    hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true,
    hasPropane: false, hasDumpStation: false,
    phone, website: 'https://pilotflyingj.com'
  };
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   IMPORTING POI FACTORY DATA');
  console.log('═══════════════════════════════════════════════════\n');

  const dataDir = path.join(__dirname, 'data');
  
  console.log('🧹 Clearing existing data...');
  await prisma.restStop.deleteMany({});
  await prisma.gasStation.deleteMany({});
  
  // Rest Areas
  console.log('\n🅿️ Importing Rest Areas...');
  const restFile = path.join(dataDir, 'RestAreasCombined_USA.csv');
  if (fs.existsSync(restFile)) {
    const lines = fs.readFileSync(restFile, 'utf-8').split('\n').filter(l => l.trim());
    let count = 0, errors = 0;
    for (const line of lines) {
      try {
        const data = parseRestArea(line);
        if (data) { await prisma.restStop.create({ data }); count++; }
      } catch (e) { errors++; }
    }
    console.log('   ✅ Created ' + count + ' rest areas (' + errors + ' skipped)');
  }
  
  // Love's
  console.log('\n🚛 Importing Love\'s...');
  const lovesFile = path.join(dataDir, 'loves.csv');
  if (fs.existsSync(lovesFile)) {
    const lines = fs.readFileSync(lovesFile, 'utf-8').split('\n').filter(l => l.trim());
    let count = 0, errors = 0;
    for (const line of lines) {
      try {
        const data = parseLoves(line);
        if (data) { await prisma.gasStation.create({ data }); count++; }
      } catch (e) { errors++; }
    }
    console.log('   ✅ Created ' + count + ' Love\'s locations (' + errors + ' skipped)');
  }
  
  // Pilot/Flying J
  console.log('\n⛽ Importing Pilot/Flying J...');
  const pilotFile = path.join(dataDir, 'pilot-flying-j.csv');
  if (fs.existsSync(pilotFile)) {
    const lines = fs.readFileSync(pilotFile, 'utf-8').split('\n').filter(l => l.trim());
    let count = 0, errors = 0;
    for (const line of lines) {
      try {
        const data = parsePilotFlyingJ(line);
        if (data) { await prisma.gasStation.create({ data }); count++; }
      } catch (e) { errors++; }
    }
    console.log('   ✅ Created ' + count + ' Pilot/Flying J locations (' + errors + ' skipped)');
  }
  
  const totalRest = await prisma.restStop.count();
  const totalGas = await prisma.gasStation.count();
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log('   COMPLETE! 🅿️ ' + totalRest + ' Rest Areas | ⛽ ' + totalGas + ' Truck Stops');
  console.log('═══════════════════════════════════════════════════\n');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
