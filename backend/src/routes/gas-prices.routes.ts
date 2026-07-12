import { Router, Request, Response } from 'express';

const router = Router();
import { prisma } from '../lib/prisma';

// AAA Gas Prices URL (we'll scrape or use cached data)
// Note: In production, you'd want to use an official API or scrape responsibly

interface GasPriceData {
  stateCode: string;
  stateName: string;
  regularPrice: number;
  midgradePrice: number | null;
  premiumPrice: number | null;
  dieselPrice: number;
}

// Fetch real-time gas prices (with caching)
router.get('/update', async (req: Request, res: Response) => {
  try {
    // Check if we've updated recently (within last hour)
    const recentUpdate = await prisma.stateGasPrice.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    if (recentUpdate && recentUpdate.updatedAt > oneHourAgo) {
      return res.json({ 
        message: 'Gas prices already up to date',
        lastUpdated: recentUpdate.updatedAt,
        fromCache: true 
      });
    }

    // Fetch fresh data from API/scraper
    const freshPrices = await fetchGasPricesFromSource();
    
    if (freshPrices && freshPrices.length > 0) {
      // Update database
      for (const price of freshPrices) {
        await prisma.stateGasPrice.upsert({
          where: { stateCode: price.stateCode },
          update: {
            regularPrice: price.regularPrice,
            midgradePrice: price.midgradePrice,
            premiumPrice: price.premiumPrice,
            dieselPrice: price.dieselPrice,
          },
          create: price,
        });
      }

      res.json({
        message: 'Gas prices updated successfully',
        updatedCount: freshPrices.length,
        fromCache: false,
      });
    } else {
      res.json({
        message: 'Unable to fetch fresh prices, using cached data',
        fromCache: true,
      });
    }
  } catch (error: any) {
    console.error('Update gas prices error:', error);
    res.status(500).json({ error: 'Failed to update gas prices' });
  }
});

// Get current gas prices with optional comparison to national average
router.get('/current', async (req: Request, res: Response) => {
  try {
    const prices = await prisma.stateGasPrice.findMany({
      orderBy: { stateCode: 'asc' },
    });

    // Calculate national averages
    const regularPrices = prices.map((p: any) => p.regularPrice);
    const dieselPrices = prices.map((p: any) => p.dieselPrice);
    
    const nationalAverage = {
      regular: regularPrices.reduce((a: any, b: any) => a + b, 0) / regularPrices.length,
      diesel: dieselPrices.reduce((a: any, b: any) => a + b, 0) / dieselPrices.length,
    };

    // Find cheapest and most expensive states
    const sortedByRegular = [...prices].sort((a, b) => a.regularPrice - b.regularPrice);
    const sortedByDiesel = [...prices].sort((a, b) => a.dieselPrice - b.dieselPrice);

    res.json({
      prices,
      nationalAverage,
      cheapest: {
        regular: sortedByRegular[0],
        diesel: sortedByDiesel[0],
      },
      mostExpensive: {
        regular: sortedByRegular[sortedByRegular.length - 1],
        diesel: sortedByDiesel[sortedByDiesel.length - 1],
      },
      lastUpdated: prices[0]?.updatedAt || null,
    });
  } catch (error: any) {
    console.error('Get current gas prices error:', error);
    res.status(500).json({ error: 'Failed to fetch gas prices' });
  }
});

// Helper function to fetch gas prices
// In production, this would call an actual API or scraper
async function fetchGasPricesFromSource(): Promise<GasPriceData[]> {
  // For now, we'll simulate price fluctuations based on the base prices
  // In production, you'd use:
  // 1. GasBuddy API (requires partnership)
  // 2. AAA's TripTik API
  // 3. EIA (Energy Information Administration) API - https://www.eia.gov/opendata/
  // 4. Web scraping (be careful with ToS)

  try {
    // Get current prices from database
    const currentPrices = await prisma.stateGasPrice.findMany();
    
    if (currentPrices.length === 0) {
      return [];
    }

    // Simulate small price fluctuations (±5 cents)
    // In production, replace this with actual API call
    const updatedPrices: GasPriceData[] = currentPrices.map((price: any) => {
      const regularFluctuation = (Math.random() - 0.5) * 0.10; // ±5 cents
      const dieselFluctuation = (Math.random() - 0.5) * 0.10;
      
      return {
        stateCode: price.stateCode,
        stateName: price.stateName,
        regularPrice: Math.round((price.regularPrice + regularFluctuation) * 100) / 100,
        midgradePrice: price.midgradePrice ? Math.round((price.midgradePrice + regularFluctuation) * 100) / 100 : null,
        premiumPrice: price.premiumPrice ? Math.round((price.premiumPrice + regularFluctuation) * 100) / 100 : null,
        dieselPrice: Math.round((price.dieselPrice + dieselFluctuation) * 100) / 100,
      };
    });

    return updatedPrices;
  } catch (error: any) {
    console.error('Fetch gas prices error:', error);
    return [];
  }
}

// Alternative: Use EIA API for official government data
// This is a real, free API!
async function fetchFromEIA(): Promise<void> {
  // EIA API endpoint for gasoline prices
  // You need to register for a free API key at: https://www.eia.gov/opendata/register.php
  const EIA_API_KEY = process.env.EIA_API_KEY;
  
  if (!EIA_API_KEY) {
    console.log('EIA_API_KEY not set, skipping EIA fetch');
    return;
  }

  try {
    // Example: Fetch weekly retail gasoline prices by state
    const url = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${EIA_API_KEY}&frequency=weekly&data[0]=value&facets[product][]=EPMR&facets[duession][]=PG1&sort[0][column]=period&sort[0][direction]=desc&length=50`;
    
    const response = await fetch(url);
    const data: any = await response.json();
    
    console.log('EIA Data:', data);
    // Process and store the data...
  } catch (error: any) {
    console.error('EIA API error:', error);
  }
}

export default router;
