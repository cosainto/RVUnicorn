async function test() {
  const facilityId = '232447';
  const url = `https://www.recreation.gov/api/camps/campgrounds/${facilityId}`;
  
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RVUnicorn/1.0' }
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Keys:', Object.keys(data));
    if (data.campground) {
      console.log('Campground name:', data.campground.facility_name);
      console.log('Activities:', data.campground.activities ? data.campground.activities.slice(0, 3) : 'None');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}
test();
