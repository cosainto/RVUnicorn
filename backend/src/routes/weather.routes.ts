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
    
    const pointsData: any = await pointsRes.json();
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
    
    const forecastData: any = await forecastRes.json();
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
  } catch (error: any) {
    console.error('Weather fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
});


// GET /api/weather/activities
const activitiesCache: WeatherCache = {};
router.get('/activities', async (req, res) => {
  try {
    const { lat, lon, campgroundName = 'your campground' } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
    const cacheKey = `activities-${lat},${lon}-${new Date().toDateString()}`;
    if (activitiesCache[cacheKey] && Date.now() - activitiesCache[cacheKey].timestamp < CACHE_DURATION) {
      return res.json(activitiesCache[cacheKey].data);
    }
    let weatherSummary = 'pleasant camping weather';
    try {
      const pr = await fetch(`https://api.weather.gov/points/${lat},${lon}`, { headers: { 'User-Agent': 'RVUnicorn (contact@rvunicorn.com)' } });
      if (pr.ok) {
        const pd: any = await pr.json();
        const fu = pd.properties?.forecast;
        if (fu) {
          const fr = await fetch(fu, { headers: { 'User-Agent': 'RVUnicorn (contact@rvunicorn.com)' } });
          if (fr.ok) {
            const fd: any = await fr.json();
            const p0 = fd.properties?.periods?.[0];
            if (p0) weatherSummary = `${p0.name}: ${p0.temperature}F, ${p0.shortForecast}, winds ${p0.windSpeed}`;
          }
        }
      }
    } catch (e: any) {}
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic.default();
    const now = new Date();
    const tod = now.getHours() < 10 ? 'morning' : now.getHours() < 14 ? 'midday' : now.getHours() < 18 ? 'afternoon' : 'evening';
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `You are a camping activity advisor at ${campgroundName}. Weather: ${weatherSummary}. Time: ${tod}. Suggest exactly 4 activities. Respond ONLY with JSON array: [{"emoji":"🎣","title":"Go Fishing","reason":"brief reason under 12 words","duration":"2-3 hours"}]` }],
    });
    let activities = [];
    try { activities = JSON.parse(response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'); } catch (e: any) {
      activities = [{ emoji: '🚶', title: 'Take a Walk', reason: 'Great time to explore', duration: '30-60 min' }, { emoji: '🔥', title: 'Campfire Time', reason: 'Perfect for gathering around the fire', duration: '1-2 hours' }, { emoji: '📸', title: 'Photography', reason: 'Capture the scenery', duration: '1 hour' }, { emoji: '⭐', title: 'Stargazing', reason: 'Clear skies tonight', duration: 'After dark' }];
    }
    const result = { activities, weatherSummary, generatedAt: new Date().toISOString() };
    activitiesCache[cacheKey] = { data: result, timestamp: Date.now() };
    res.json(result);
  } catch (error: any) { console.error('Activities error:', error); res.status(500).json({ error: 'Failed' }); }
});
export default router;
