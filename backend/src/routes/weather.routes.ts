import { Router } from 'express';

const router = Router();

interface WeatherCache {
  [key: string]: {
    data: any;
    timestamp: number;
  };
}

const cache: WeatherCache = {};
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Get weather for coordinates
router.get('/forecast', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon required' });
    }
    
    const cacheKey = `${lat},${lon}`;
    
    // Check cache
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_DURATION) {
      return res.json(cache[cacheKey].data);
    }
    
    // Step 1: Get grid point from coordinates
    const pointsUrl = `https://api.weather.gov/points/${lat},${lon}`;
    const pointsRes = await fetch(pointsUrl, {
      headers: { 'User-Agent': 'RVUnicorn (contact@rvunicorn.com)' }
    });
    
    if (!pointsRes.ok) {
      // Location might be outside US
      return res.status(404).json({ error: 'Weather not available for this location' });
    }
    
    const pointsData = await pointsRes.json();
    const forecastUrl = pointsData.properties?.forecast;
    const forecastHourlyUrl = pointsData.properties?.forecastHourly;
    
    if (!forecastUrl) {
      return res.status(404).json({ error: 'Forecast not available' });
    }
    
    // Step 2: Get forecast
    const forecastRes = await fetch(forecastUrl, {
      headers: { 'User-Agent': 'RVUnicorn (contact@rvunicorn.com)' }
    });
    
    if (!forecastRes.ok) {
      return res.status(500).json({ error: 'Failed to fetch forecast' });
    }
    
    const forecastData = await forecastRes.json();
    const periods = forecastData.properties?.periods || [];
    
    // Format response
    const result = {
      location: {
        city: pointsData.properties?.relativeLocation?.properties?.city,
        state: pointsData.properties?.relativeLocation?.properties?.state,
      },
      current: periods[0] ? {
        name: periods[0].name,
        temperature: periods[0].temperature,
        temperatureUnit: periods[0].temperatureUnit,
        windSpeed: periods[0].windSpeed,
        windDirection: periods[0].windDirection,
        shortForecast: periods[0].shortForecast,
        detailedForecast: periods[0].detailedForecast,
        icon: periods[0].icon,
        isDaytime: periods[0].isDaytime,
      } : null,
      forecast: periods.slice(0, 10).map((p: any) => ({
        name: p.name,
        temperature: p.temperature,
        temperatureUnit: p.temperatureUnit,
        windSpeed: p.windSpeed,
        shortForecast: p.shortForecast,
        icon: p.icon,
        isDaytime: p.isDaytime,
      })),
      updatedAt: new Date().toISOString(),
    };
    
    // Cache result
    cache[cacheKey] = { data: result, timestamp: Date.now() };
    
    res.json(result);
  } catch (error) {
    console.error('Weather fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
});

export default router;
