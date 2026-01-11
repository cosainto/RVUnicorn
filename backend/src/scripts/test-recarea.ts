import axios from 'axios';

const RIDB_API_KEY = '0df4c4d6-1be3-4f76-99b0-0ab0a676a8fa';

async function testRecArea() {
  try {
    // Get the RecArea for ParentRecAreaID 70901
    const response = await axios.get('https://ridb.recreation.gov/api/v1/recareas/70901', {
      headers: {
        'apikey': RIDB_API_KEY,
        'accept': 'application/json'
      }
    });

    console.log('RecArea data:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testRecArea();
