import axios from 'axios';

const RIDB_API_KEY = '0df4c4d6-1be3-4f76-99b0-0ab0a676a8fa';

async function testAPI() {
  try {
    const response = await axios.get('https://ridb.recreation.gov/api/v1/facilities', {
      headers: {
        'apikey': RIDB_API_KEY,
        'accept': 'application/json'
      },
      params: {
        offset: 0,
        limit: 3,
        activity: 'CAMPING'
      }
    });

    const facilities = response.data.RECDATA || [];
    
    console.log('Sample facility data structure:');
    console.log(JSON.stringify(facilities[0], null, 2));
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testAPI();
