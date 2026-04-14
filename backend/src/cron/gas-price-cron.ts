import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient() as any;

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

const STATE_OFFSETS: Record<string, number> = {
  CA: 0.85, HI: 0.90, WA: 0.35, OR: 0.30, NV: 0.25, AK: 0.40,
  IL: 0.20, NY: 0.25, CT: 0.20, MA: 0.18, PA: 0.15, NJ: 0.10,
  CO: 0.10, AZ: 0.05, FL: 0.05, MD: 0.08, VA: 0.05, MI: 0.08,
  MN: 0.05, WI: 0.03, OH: 0.00, IN: -0.05, MO: -0.08,
  TX: -0.15, OK: -0.20, KS: -0.18, NE: -0.12, IA: -0.10,
  SD: -0.08, ND: -0.05, MT: -0.05, WY: -0.10, ID: 0.05,
  UT: 0.00, NM: -0.10, AR: -0.18, LA: -0.15, MS: -0.20,
  AL: -0.18, GA: -0.12, SC: -0.15, NC: -0.08, TN: -0.12,
  KY: -0.10, WV: -0.05, DE: 0.05, RI: 0.15, VT: 0.12,
  NH: 0.08, ME: 0.10,
};

export async function updateGasPrices() {
  try {
    console.log('[GasPriceCron] Checking fuel prices...');

    const recent = await prisma.stateGasPrice.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (recent && recent.updatedAt > sevenDaysAgo) {
      console.log('[GasPriceCron] Prices up to date, skipping update');
      return;
    }

    let nationalRegular = 3.45;
    let nationalDiesel = 3.85;
    try {
      const res = await axios.get('https://www.fueleconomy.gov/ws/rest/fuelprices', {
        headers: { Accept: 'application/json' },
        timeout: 5000,
      });
      if (res.data && res.data.regular) nationalRegular = parseFloat(res.data.regular);
      if (res.data && res.data.diesel) nationalDiesel = parseFloat(res.data.diesel);
      console.log('[GasPriceCron] Live prices: Regular $' + nationalRegular.toFixed(2) + ' | Diesel $' + nationalDiesel.toFixed(2));
    } catch (e: any) {
      console.log('[GasPriceCron] fueleconomy.gov unavailable, using defaults');
    }

    let updated = 0;
    for (const [code, name] of Object.entries(STATE_NAMES)) {
      const offset = STATE_OFFSETS[code] ?? 0;
      const regular = Math.round((nationalRegular + offset) * 100) / 100;
      const midgrade = Math.round((regular + 0.20) * 100) / 100;
      const premium = Math.round((regular + 0.45) * 100) / 100;
      const diesel = Math.round((nationalDiesel + offset * 0.8) * 100) / 100;

      await prisma.stateGasPrice.upsert({
        where: { stateCode: code },
        create: { stateCode: code, stateName: name, regularPrice: regular, midgradePrice: midgrade, premiumPrice: premium, dieselPrice: diesel },
        update: { regularPrice: regular, midgradePrice: midgrade, premiumPrice: premium, dieselPrice: diesel },
      });
      updated++;
    }

    console.log('[GasPriceCron] Updated ' + updated + ' states. Regular $' + nationalRegular.toFixed(2) + ' | Diesel $' + nationalDiesel.toFixed(2));
  } catch (e: any) {
    console.error('[GasPriceCron] Failed:', e.message);
  }
}
