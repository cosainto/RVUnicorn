import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GOOGLE_API_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';

interface ApiResponse {
  status: string;
  results?: {
    name: string;
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
    photos?: { photo_reference: string }[];
  }[];
}

async function main() {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent('Hidden Ridge Hopkins Michigan campground')}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json() as ApiResponse;
  
  console.log('Status:', data.status);
  if (data.results) {
    data.results.slice(0, 5).forEach((r, i) => {
      console.log(i + 1 + '.', r.name, '-', r.formatted_address);
    });
  }
}

main().catch(console.error).finally(() => process.exit());
