import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/onboarding/status - Check onboarding status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        onboardingCompleted: true,
        onboardingStep: true,
        homeCity: true,
        homeState: true,
        rvType: true,
        travelPartyType: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate what's missing
    const missingFields = [];
    if (!user.homeCity || !user.homeState) missingFields.push('hometown');
    if (!user.rvType) missingFields.push('rv');
    if (!user.travelPartyType) missingFields.push('travelParty');

    res.json({
      completed: user.onboardingCompleted,
      step: user.onboardingStep,
      missingFields,
      hasHometown: !!(user.homeCity && user.homeState),
      hasRV: !!user.rvType,
      hasTravelParty: !!user.travelPartyType,
    });
  } catch (error) {
    console.error('Get onboarding status error:', error);
    res.status(500).json({ error: 'Failed to get onboarding status' });
  }
});

// Helper function to geocode address
async function geocodeAddress(city: string, state: string, zipCode?: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const query = zipCode 
      ? `${city}, ${state} ${zipCode}, USA`
      : `${city}, ${state}, USA`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'RVUnicorn/1.0' }
    });
    const data = await response.json();
    
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// PUT /api/onboarding/hometown - Save hometown info
router.put('/hometown', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { homeAddress, homeCity, homeState, homeZipCode, homeCountry } = req.body;

    // Geocode the address to get coordinates
    let homeLatitude = null;
    let homeLongitude = null;
    
    if (homeCity && homeState) {
      const coords = await geocodeAddress(homeCity, homeState, homeZipCode);
      if (coords) {
        homeLatitude = coords.lat;
        homeLongitude = coords.lon;
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        homeAddress,
        homeCity,
        homeState,
        homeZipCode,
        homeCountry: homeCountry || 'USA',
        homeLatitude,
        homeLongitude,
        onboardingStep: { increment: 1 }
      },
      select: {
        id: true,
        homeCity: true,
        homeState: true,
        homeZipCode: true,
        homeLatitude: true,
        homeLongitude: true,
        onboardingStep: true,
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Save hometown error:', error);
    res.status(500).json({ error: 'Failed to save hometown' });
  }
});

// PUT /api/onboarding/rv - Save RV info
router.put('/rv', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { rvType, rvYear, rvMake, rvModel, rvLength, rvSleeps, hasRV, campingStyles } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        campingStyles: campingStyles || [],
        rvType: hasRV ? rvType : null,
        rvYear: hasRV ? rvYear : null,
        rvMake: hasRV ? rvMake : null,
        rvModel: hasRV ? rvModel : null,
        rvLength: hasRV ? rvLength : null,
        rvSleeps: hasRV ? rvSleeps : null,
        onboardingStep: { increment: 1 }
      },
      select: {
        id: true,
        rvType: true,
        rvMake: true,
        rvModel: true,
        onboardingStep: true,
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Save RV info error:', error);
    res.status(500).json({ error: 'Failed to save RV info' });
  }
});

// PUT /api/onboarding/travel-party - Save travel party info
router.put('/travel-party', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { travelPartyType, travelPartySize, hasPets, petTypes } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        travelPartyType,
        travelPartySize,
        hasPets: hasPets || false,
        petTypes: petTypes || [],
        onboardingStep: { increment: 1 }
      },
      select: {
        id: true,
        travelPartyType: true,
        travelPartySize: true,
        hasPets: true,
        petTypes: true,
        onboardingStep: true,
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Save travel party error:', error);
    res.status(500).json({ error: 'Failed to save travel party info' });
  }
});

// PUT /api/onboarding/social-links - Save social links
router.put('/social-links', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { website, facebookUrl, instagramUrl, twitterUrl, youtubeUrl, tiktokUrl } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        website: website || null,
        facebookUrl: facebookUrl || null,
        instagramUrl: instagramUrl || null,
        twitterUrl: twitterUrl || null,
        youtubeUrl: youtubeUrl || null,
        tiktokUrl: tiktokUrl || null,
        onboardingStep: { increment: 1 }
      },
      select: {
        id: true,
        website: true,
        facebookUrl: true,
        instagramUrl: true,
        twitterUrl: true,
        youtubeUrl: true,
        tiktokUrl: true,
        onboardingStep: true,
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Save social links error:', error);
    res.status(500).json({ error: 'Failed to save social links' });
  }
});

// PUT /api/onboarding/complete - Mark onboarding as complete
router.put('/complete', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        onboardingCompleted: true
      },
      select: {
        id: true,
        onboardingCompleted: true,
        homeCity: true,
        homeState: true,
        rvType: true,
        travelPartyType: true,
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// PUT /api/onboarding/skip - Skip onboarding
router.put('/skip', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        onboardingCompleted: true
      }
    });

    res.json({ message: 'Onboarding skipped' });
  } catch (error) {
    console.error('Skip onboarding error:', error);
    res.status(500).json({ error: 'Failed to skip onboarding' });
  }
});

// GET /api/onboarding/home-location - Get user's home location for trip planning
router.get('/home-location', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        homeAddress: true,
        homeCity: true,
        homeState: true,
        homeZipCode: true,
        homeCountry: true,
        homeLatitude: true,
        homeLongitude: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build a formatted address string
    let formattedAddress = '';
    if (user.homeAddress) {
      formattedAddress = user.homeAddress;
    } else if (user.homeCity && user.homeState) {
      formattedAddress = `${user.homeCity}, ${user.homeState}`;
      if (user.homeZipCode) formattedAddress += ` ${user.homeZipCode}`;
    }

    res.json({
      ...user,
      formattedAddress,
      hasHomeLocation: !!(user.homeCity && user.homeState)
    });
  } catch (error) {
    console.error('Get home location error:', error);
    res.status(500).json({ error: 'Failed to get home location' });
  }
});

export default router;
