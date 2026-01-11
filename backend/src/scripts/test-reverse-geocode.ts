import axios from 'axios';

async function reverseGeocode(lat: number, lon: number) {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat,
        lon,
        format: 'json'
      },
      headers: {
        'User-Agent': 'KindleTribe/1.0'
      }
    });

    const address = response.data.address;
    console.log('Full address data:', JSON.stringify(address, null, 2));
    console.log('\nState:', address.state);
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

// Test with Temple Mountain coordinates
reverseGeocode(38.65677222, -110.661225);
