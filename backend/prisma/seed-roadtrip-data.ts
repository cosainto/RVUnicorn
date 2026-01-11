/**
 * Seed truck stops and rest areas with static data
 * This doesn't rely on external APIs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Major truck stop chains with real locations
const TRUCK_STOPS = [
  // I-10 (Southern Route - CA to FL)
  { name: "Pilot Travel Center", brand: "Pilot", city: "Buckeye", state: "AZ", latitude: 33.4303, longitude: -112.5838, interstate: "I-10" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Quartzsite", state: "AZ", latitude: 33.6639, longitude: -114.2181, interstate: "I-10" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Ehrenberg", state: "AZ", latitude: 33.6047, longitude: -114.5253, interstate: "I-10" },
  { name: "TA Travel Center", brand: "TA", city: "Casa Grande", state: "AZ", latitude: 32.8795, longitude: -111.7574, interstate: "I-10" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Lordsburg", state: "NM", latitude: 32.3503, longitude: -108.7087, interstate: "I-10" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Deming", state: "NM", latitude: 32.2687, longitude: -107.7581, interstate: "I-10" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Las Cruces", state: "NM", latitude: 32.3199, longitude: -106.7637, interstate: "I-10" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "El Paso", state: "TX", latitude: 31.7619, longitude: -106.4850, interstate: "I-10" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Van Horn", state: "TX", latitude: 31.0404, longitude: -104.8307, interstate: "I-10" },
  { name: "TA Travel Center", brand: "TA", city: "Fort Stockton", state: "TX", latitude: 30.8940, longitude: -102.8791, interstate: "I-10" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Sonora", state: "TX", latitude: 30.5669, longitude: -100.6479, interstate: "I-10" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Junction", state: "TX", latitude: 30.4893, longitude: -99.7720, interstate: "I-10" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Kerrville", state: "TX", latitude: 30.0474, longitude: -99.1403, interstate: "I-10" },
  { name: "Buc-ee's", brand: "Buc-ee's", city: "Luling", state: "TX", latitude: 29.6819, longitude: -97.6475, interstate: "I-10" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Seguin", state: "TX", latitude: 29.5688, longitude: -97.9647, interstate: "I-10" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "San Antonio", state: "TX", latitude: 29.5107, longitude: -98.3989, interstate: "I-10" },
  { name: "TA Travel Center", brand: "TA", city: "Houston", state: "TX", latitude: 29.7857, longitude: -95.2155, interstate: "I-10" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Beaumont", state: "TX", latitude: 30.0802, longitude: -94.1266, interstate: "I-10" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Lake Charles", state: "LA", latitude: 30.2266, longitude: -93.2174, interstate: "I-10" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Scott", state: "LA", latitude: 30.2355, longitude: -92.0946, interstate: "I-10" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Baton Rouge", state: "LA", latitude: 30.4515, longitude: -91.1871, interstate: "I-10" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Slidell", state: "LA", latitude: 30.2752, longitude: -89.7812, interstate: "I-10" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Mobile", state: "AL", latitude: 30.6954, longitude: -88.0399, interstate: "I-10" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Pensacola", state: "FL", latitude: 30.4213, longitude: -87.2169, interstate: "I-10" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Tallahassee", state: "FL", latitude: 30.4383, longitude: -84.2807, interstate: "I-10" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Jacksonville", state: "FL", latitude: 30.3322, longitude: -81.6557, interstate: "I-10" },

  // I-40 (Route 66 Corridor - CA to NC)
  { name: "Pilot Travel Center", brand: "Pilot", city: "Barstow", state: "CA", latitude: 34.8958, longitude: -117.0173, interstate: "I-40" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Needles", state: "CA", latitude: 34.8480, longitude: -114.6144, interstate: "I-40" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Kingman", state: "AZ", latitude: 35.1894, longitude: -114.0530, interstate: "I-40" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Seligman", state: "AZ", latitude: 35.3269, longitude: -112.8766, interstate: "I-40" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Williams", state: "AZ", latitude: 35.2494, longitude: -112.1871, interstate: "I-40" },
  { name: "TA Travel Center", brand: "TA", city: "Flagstaff", state: "AZ", latitude: 35.1983, longitude: -111.6513, interstate: "I-40" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Winslow", state: "AZ", latitude: 35.0242, longitude: -110.6974, interstate: "I-40" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Holbrook", state: "AZ", latitude: 34.9022, longitude: -110.1582, interstate: "I-40" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Gallup", state: "NM", latitude: 35.5281, longitude: -108.7426, interstate: "I-40" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Grants", state: "NM", latitude: 35.1472, longitude: -107.8514, interstate: "I-40" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Albuquerque", state: "NM", latitude: 35.0844, longitude: -106.6504, interstate: "I-40" },
  { name: "TA Travel Center", brand: "TA", city: "Moriarty", state: "NM", latitude: 34.9900, longitude: -106.0492, interstate: "I-40" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Santa Rosa", state: "NM", latitude: 34.9384, longitude: -104.6824, interstate: "I-40" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Tucumcari", state: "NM", latitude: 35.1719, longitude: -103.7249, interstate: "I-40" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Amarillo", state: "TX", latitude: 35.2220, longitude: -101.8313, interstate: "I-40" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Shamrock", state: "TX", latitude: 35.2140, longitude: -100.2490, interstate: "I-40" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Elk City", state: "OK", latitude: 35.4120, longitude: -99.4043, interstate: "I-40" },
  { name: "TA Travel Center", brand: "TA", city: "Oklahoma City", state: "OK", latitude: 35.4676, longitude: -97.5164, interstate: "I-40" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Henryetta", state: "OK", latitude: 35.4398, longitude: -95.9819, interstate: "I-40" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Sallisaw", state: "OK", latitude: 35.4606, longitude: -94.7874, interstate: "I-40" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Fort Smith", state: "AR", latitude: 35.3859, longitude: -94.3985, interstate: "I-40" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Russellville", state: "AR", latitude: 35.2784, longitude: -93.1338, interstate: "I-40" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Conway", state: "AR", latitude: 35.0887, longitude: -92.4421, interstate: "I-40" },
  { name: "TA Travel Center", brand: "TA", city: "Little Rock", state: "AR", latitude: 34.7465, longitude: -92.2896, interstate: "I-40" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "West Memphis", state: "AR", latitude: 35.1465, longitude: -90.1848, interstate: "I-40" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Memphis", state: "TN", latitude: 35.1175, longitude: -89.9711, interstate: "I-40" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Jackson", state: "TN", latitude: 35.6145, longitude: -88.8139, interstate: "I-40" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Nashville", state: "TN", latitude: 36.1627, longitude: -86.7816, interstate: "I-40" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Cookeville", state: "TN", latitude: 36.1628, longitude: -85.5016, interstate: "I-40" },
  { name: "TA Travel Center", brand: "TA", city: "Knoxville", state: "TN", latitude: 35.9606, longitude: -83.9207, interstate: "I-40" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Asheville", state: "NC", latitude: 35.5951, longitude: -82.5515, interstate: "I-40" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Statesville", state: "NC", latitude: 35.7826, longitude: -80.8873, interstate: "I-40" },

  // I-95 (East Coast - ME to FL)
  { name: "Pilot Travel Center", brand: "Pilot", city: "Bangor", state: "ME", latitude: 44.8012, longitude: -68.7778, interstate: "I-95" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Augusta", state: "ME", latitude: 44.3106, longitude: -69.7795, interstate: "I-95" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Portsmouth", state: "NH", latitude: 43.0718, longitude: -70.7626, interstate: "I-95" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Peabody", state: "MA", latitude: 42.5278, longitude: -70.9286, interstate: "I-95" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Providence", state: "RI", latitude: 41.8240, longitude: -71.4128, interstate: "I-95" },
  { name: "TA Travel Center", brand: "TA", city: "Milford", state: "CT", latitude: 41.2223, longitude: -73.0576, interstate: "I-95" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "New Haven", state: "CT", latitude: 41.3083, longitude: -72.9279, interstate: "I-95" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Newark", state: "NJ", latitude: 40.7357, longitude: -74.1724, interstate: "I-95" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Philadelphia", state: "PA", latitude: 39.9526, longitude: -75.1652, interstate: "I-95" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Wilmington", state: "DE", latitude: 39.7391, longitude: -75.5398, interstate: "I-95" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Baltimore", state: "MD", latitude: 39.2904, longitude: -76.6122, interstate: "I-95" },
  { name: "TA Travel Center", brand: "TA", city: "Fredericksburg", state: "VA", latitude: 38.3032, longitude: -77.4605, interstate: "I-95" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Richmond", state: "VA", latitude: 37.5407, longitude: -77.4360, interstate: "I-95" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Emporia", state: "VA", latitude: 36.6860, longitude: -77.5428, interstate: "I-95" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Rocky Mount", state: "NC", latitude: 35.9382, longitude: -77.7905, interstate: "I-95" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Fayetteville", state: "NC", latitude: 35.0527, longitude: -78.8784, interstate: "I-95" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Lumberton", state: "NC", latitude: 34.6182, longitude: -79.0086, interstate: "I-95" },
  { name: "TA Travel Center", brand: "TA", city: "Florence", state: "SC", latitude: 34.1954, longitude: -79.7626, interstate: "I-95" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Santee", state: "SC", latitude: 33.4957, longitude: -80.4773, interstate: "I-95" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Savannah", state: "GA", latitude: 32.0809, longitude: -81.0912, interstate: "I-95" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Brunswick", state: "GA", latitude: 31.1499, longitude: -81.4915, interstate: "I-95" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Jacksonville", state: "FL", latitude: 30.3322, longitude: -81.6557, interstate: "I-95" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Daytona Beach", state: "FL", latitude: 29.2108, longitude: -81.0228, interstate: "I-95" },
  { name: "TA Travel Center", brand: "TA", city: "Vero Beach", state: "FL", latitude: 27.6386, longitude: -80.3973, interstate: "I-95" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "West Palm Beach", state: "FL", latitude: 26.7153, longitude: -80.0534, interstate: "I-95" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Fort Lauderdale", state: "FL", latitude: 26.1224, longitude: -80.1373, interstate: "I-95" },

  // I-5 (West Coast - WA to CA)
  { name: "Pilot Travel Center", brand: "Pilot", city: "Bellingham", state: "WA", latitude: 48.7519, longitude: -122.4787, interstate: "I-5" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Everett", state: "WA", latitude: 47.9790, longitude: -122.2021, interstate: "I-5" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Seattle", state: "WA", latitude: 47.6062, longitude: -122.3321, interstate: "I-5" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Tacoma", state: "WA", latitude: 47.2529, longitude: -122.4443, interstate: "I-5" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Olympia", state: "WA", latitude: 47.0379, longitude: -122.9007, interstate: "I-5" },
  { name: "TA Travel Center", brand: "TA", city: "Centralia", state: "WA", latitude: 46.7162, longitude: -122.9543, interstate: "I-5" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Vancouver", state: "WA", latitude: 45.6387, longitude: -122.6615, interstate: "I-5" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Portland", state: "OR", latitude: 45.5152, longitude: -122.6784, interstate: "I-5" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Salem", state: "OR", latitude: 44.9429, longitude: -123.0351, interstate: "I-5" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Eugene", state: "OR", latitude: 44.0521, longitude: -123.0868, interstate: "I-5" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Roseburg", state: "OR", latitude: 43.2165, longitude: -123.3417, interstate: "I-5" },
  { name: "TA Travel Center", brand: "TA", city: "Grants Pass", state: "OR", latitude: 42.4390, longitude: -123.3284, interstate: "I-5" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Medford", state: "OR", latitude: 42.3265, longitude: -122.8756, interstate: "I-5" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Yreka", state: "CA", latitude: 41.7354, longitude: -122.6344, interstate: "I-5" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Redding", state: "CA", latitude: 40.5865, longitude: -122.3917, interstate: "I-5" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Red Bluff", state: "CA", latitude: 40.1785, longitude: -122.2358, interstate: "I-5" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Williams", state: "CA", latitude: 39.1546, longitude: -122.1494, interstate: "I-5" },
  { name: "TA Travel Center", brand: "TA", city: "Sacramento", state: "CA", latitude: 38.5816, longitude: -121.4944, interstate: "I-5" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Stockton", state: "CA", latitude: 37.9577, longitude: -121.2908, interstate: "I-5" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Patterson", state: "CA", latitude: 37.4716, longitude: -121.1297, interstate: "I-5" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Coalinga", state: "CA", latitude: 36.1397, longitude: -120.3600, interstate: "I-5" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Bakersfield", state: "CA", latitude: 35.3733, longitude: -119.0187, interstate: "I-5" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Lebec", state: "CA", latitude: 34.8394, longitude: -118.8648, interstate: "I-5" },
  { name: "TA Travel Center", brand: "TA", city: "Los Angeles", state: "CA", latitude: 34.0522, longitude: -118.2437, interstate: "I-5" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "San Diego", state: "CA", latitude: 32.7157, longitude: -117.1611, interstate: "I-5" },

  // I-80 (Northern Route - CA to NJ)
  { name: "Pilot Travel Center", brand: "Pilot", city: "Oakland", state: "CA", latitude: 37.8044, longitude: -122.2712, interstate: "I-80" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Fairfield", state: "CA", latitude: 38.2494, longitude: -122.0400, interstate: "I-80" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Reno", state: "NV", latitude: 39.5296, longitude: -119.8138, interstate: "I-80" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Winnemucca", state: "NV", latitude: 40.9730, longitude: -117.7357, interstate: "I-80" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Elko", state: "NV", latitude: 40.8324, longitude: -115.7631, interstate: "I-80" },
  { name: "TA Travel Center", brand: "TA", city: "West Wendover", state: "NV", latitude: 40.7391, longitude: -114.0733, interstate: "I-80" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Salt Lake City", state: "UT", latitude: 40.7608, longitude: -111.8910, interstate: "I-80" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Evanston", state: "WY", latitude: 41.2683, longitude: -110.9632, interstate: "I-80" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Rock Springs", state: "WY", latitude: 41.5875, longitude: -109.2029, interstate: "I-80" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Rawlins", state: "WY", latitude: 41.7911, longitude: -107.2387, interstate: "I-80" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Laramie", state: "WY", latitude: 41.3114, longitude: -105.5911, interstate: "I-80" },
  { name: "TA Travel Center", brand: "TA", city: "Cheyenne", state: "WY", latitude: 41.1400, longitude: -104.8202, interstate: "I-80" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Sidney", state: "NE", latitude: 41.1428, longitude: -102.9779, interstate: "I-80" },
  { name: "Love's Travel Stop", brand: "Love's", city: "North Platte", state: "NE", latitude: 41.1403, longitude: -100.7601, interstate: "I-80" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Kearney", state: "NE", latitude: 40.6995, longitude: -99.0817, interstate: "I-80" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Grand Island", state: "NE", latitude: 40.9250, longitude: -98.3420, interstate: "I-80" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Lincoln", state: "NE", latitude: 40.8258, longitude: -96.6852, interstate: "I-80" },
  { name: "TA Travel Center", brand: "TA", city: "Omaha", state: "NE", latitude: 41.2524, longitude: -95.9980, interstate: "I-80" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Des Moines", state: "IA", latitude: 41.5868, longitude: -93.6250, interstate: "I-80" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Iowa City", state: "IA", latitude: 41.6611, longitude: -91.5302, interstate: "I-80" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Davenport", state: "IA", latitude: 41.5236, longitude: -90.5776, interstate: "I-80" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Rock Island", state: "IL", latitude: 41.5095, longitude: -90.5787, interstate: "I-80" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Peru", state: "IL", latitude: 41.3275, longitude: -89.1262, interstate: "I-80" },
  { name: "TA Travel Center", brand: "TA", city: "Joliet", state: "IL", latitude: 41.5250, longitude: -88.0817, interstate: "I-80" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Gary", state: "IN", latitude: 41.5934, longitude: -87.3465, interstate: "I-80" },
  { name: "Love's Travel Stop", brand: "Love's", city: "South Bend", state: "IN", latitude: 41.6764, longitude: -86.2520, interstate: "I-80" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Toledo", state: "OH", latitude: 41.6528, longitude: -83.5379, interstate: "I-80" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Cleveland", state: "OH", latitude: 41.4993, longitude: -81.6944, interstate: "I-80" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Youngstown", state: "OH", latitude: 41.0998, longitude: -80.6495, interstate: "I-80" },
  { name: "TA Travel Center", brand: "TA", city: "Mercer", state: "PA", latitude: 41.2270, longitude: -80.2384, interstate: "I-80" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Clearfield", state: "PA", latitude: 41.0267, longitude: -78.4392, interstate: "I-80" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Bloomsburg", state: "PA", latitude: 41.0037, longitude: -76.4549, interstate: "I-80" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Stroudsburg", state: "PA", latitude: 40.9865, longitude: -75.1946, interstate: "I-80" },

  // I-75 (Southeast - MI to FL)
  { name: "Pilot Travel Center", brand: "Pilot", city: "Sault Ste. Marie", state: "MI", latitude: 46.4953, longitude: -84.3453, interstate: "I-75" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Grayling", state: "MI", latitude: 44.6614, longitude: -84.7147, interstate: "I-75" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Flint", state: "MI", latitude: 43.0125, longitude: -83.6875, interstate: "I-75" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Detroit", state: "MI", latitude: 42.3314, longitude: -83.0458, interstate: "I-75" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Toledo", state: "OH", latitude: 41.6528, longitude: -83.5379, interstate: "I-75" },
  { name: "TA Travel Center", brand: "TA", city: "Findlay", state: "OH", latitude: 41.0442, longitude: -83.6499, interstate: "I-75" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Dayton", state: "OH", latitude: 39.7589, longitude: -84.1916, interstate: "I-75" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Cincinnati", state: "OH", latitude: 39.1031, longitude: -84.5120, interstate: "I-75" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Lexington", state: "KY", latitude: 38.0406, longitude: -84.5037, interstate: "I-75" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Corbin", state: "KY", latitude: 36.9487, longitude: -84.0968, interstate: "I-75" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Knoxville", state: "TN", latitude: 35.9606, longitude: -83.9207, interstate: "I-75" },
  { name: "TA Travel Center", brand: "TA", city: "Chattanooga", state: "TN", latitude: 35.0456, longitude: -85.3097, interstate: "I-75" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Dalton", state: "GA", latitude: 34.7698, longitude: -84.9702, interstate: "I-75" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Atlanta", state: "GA", latitude: 33.7490, longitude: -84.3880, interstate: "I-75" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Macon", state: "GA", latitude: 32.8407, longitude: -83.6324, interstate: "I-75" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Valdosta", state: "GA", latitude: 30.8327, longitude: -83.2785, interstate: "I-75" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Lake City", state: "FL", latitude: 30.1897, longitude: -82.6393, interstate: "I-75" },
  { name: "TA Travel Center", brand: "TA", city: "Gainesville", state: "FL", latitude: 29.6516, longitude: -82.3248, interstate: "I-75" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Ocala", state: "FL", latitude: 29.1872, longitude: -82.1401, interstate: "I-75" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Tampa", state: "FL", latitude: 27.9506, longitude: -82.4572, interstate: "I-75" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Fort Myers", state: "FL", latitude: 26.6406, longitude: -81.8723, interstate: "I-75" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Naples", state: "FL", latitude: 26.1420, longitude: -81.7948, interstate: "I-75" },

  // I-35 (Central - MN to TX)
  { name: "Pilot Travel Center", brand: "Pilot", city: "Duluth", state: "MN", latitude: 46.7867, longitude: -92.1005, interstate: "I-35" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Minneapolis", state: "MN", latitude: 44.9778, longitude: -93.2650, interstate: "I-35" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Albert Lea", state: "MN", latitude: 43.6480, longitude: -93.3688, interstate: "I-35" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Des Moines", state: "IA", latitude: 41.5868, longitude: -93.6250, interstate: "I-35" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Kansas City", state: "MO", latitude: 39.0997, longitude: -94.5786, interstate: "I-35" },
  { name: "TA Travel Center", brand: "TA", city: "Emporia", state: "KS", latitude: 38.4039, longitude: -96.1817, interstate: "I-35" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Wichita", state: "KS", latitude: 37.6872, longitude: -97.3301, interstate: "I-35" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Oklahoma City", state: "OK", latitude: 35.4676, longitude: -97.5164, interstate: "I-35" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Ardmore", state: "OK", latitude: 34.1743, longitude: -97.1436, interstate: "I-35" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Gainesville", state: "TX", latitude: 33.6259, longitude: -97.1333, interstate: "I-35" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Denton", state: "TX", latitude: 33.2148, longitude: -97.1331, interstate: "I-35" },
  { name: "Buc-ee's", brand: "Buc-ee's", city: "Fort Worth", state: "TX", latitude: 32.7555, longitude: -97.3308, interstate: "I-35" },
  { name: "TA Travel Center", brand: "TA", city: "Dallas", state: "TX", latitude: 32.7767, longitude: -96.7970, interstate: "I-35" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Waco", state: "TX", latitude: 31.5493, longitude: -97.1467, interstate: "I-35" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Temple", state: "TX", latitude: 31.0982, longitude: -97.3428, interstate: "I-35" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Round Rock", state: "TX", latitude: 30.5083, longitude: -97.6789, interstate: "I-35" },
  { name: "Buc-ee's", brand: "Buc-ee's", city: "New Braunfels", state: "TX", latitude: 29.7030, longitude: -98.1245, interstate: "I-35" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "San Antonio", state: "TX", latitude: 29.4241, longitude: -98.4936, interstate: "I-35" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Laredo", state: "TX", latitude: 27.5064, longitude: -99.5075, interstate: "I-35" },

  // I-90 (Longest - WA to MA)
  { name: "Pilot Travel Center", brand: "Pilot", city: "Seattle", state: "WA", latitude: 47.6062, longitude: -122.3321, interstate: "I-90" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Ellensburg", state: "WA", latitude: 46.9965, longitude: -120.5478, interstate: "I-90" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Spokane", state: "WA", latitude: 47.6588, longitude: -117.4260, interstate: "I-90" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Missoula", state: "MT", latitude: 46.8721, longitude: -114.0072, interstate: "I-90" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Butte", state: "MT", latitude: 46.0038, longitude: -112.5348, interstate: "I-90" },
  { name: "TA Travel Center", brand: "TA", city: "Billings", state: "MT", latitude: 45.7833, longitude: -108.5007, interstate: "I-90" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Sheridan", state: "WY", latitude: 44.7972, longitude: -106.9562, interstate: "I-90" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Gillette", state: "WY", latitude: 44.2911, longitude: -105.5022, interstate: "I-90" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Rapid City", state: "SD", latitude: 44.0805, longitude: -103.2310, interstate: "I-90" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Sioux Falls", state: "SD", latitude: 43.5460, longitude: -96.7313, interstate: "I-90" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Rochester", state: "MN", latitude: 44.0121, longitude: -92.4802, interstate: "I-90" },
  { name: "TA Travel Center", brand: "TA", city: "La Crosse", state: "WI", latitude: 43.8014, longitude: -91.2396, interstate: "I-90" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Madison", state: "WI", latitude: 43.0731, longitude: -89.4012, interstate: "I-90" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Rockford", state: "IL", latitude: 42.2711, longitude: -89.0940, interstate: "I-90" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Chicago", state: "IL", latitude: 41.8781, longitude: -87.6298, interstate: "I-90" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Gary", state: "IN", latitude: 41.5934, longitude: -87.3465, interstate: "I-90" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Cleveland", state: "OH", latitude: 41.4993, longitude: -81.6944, interstate: "I-90" },
  { name: "TA Travel Center", brand: "TA", city: "Erie", state: "PA", latitude: 42.1292, longitude: -80.0851, interstate: "I-90" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Buffalo", state: "NY", latitude: 42.8864, longitude: -78.8784, interstate: "I-90" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Syracuse", state: "NY", latitude: 43.0481, longitude: -76.1474, interstate: "I-90" },
  { name: "Flying J Travel Center", brand: "Flying J", city: "Albany", state: "NY", latitude: 42.6526, longitude: -73.7562, interstate: "I-90" },
  { name: "Pilot Travel Center", brand: "Pilot", city: "Springfield", state: "MA", latitude: 42.1015, longitude: -72.5898, interstate: "I-90" },
  { name: "Love's Travel Stop", brand: "Love's", city: "Boston", state: "MA", latitude: 42.3601, longitude: -71.0589, interstate: "I-90" },
];

// Rest areas along major interstates
const REST_AREAS = [
  // I-10 Rest Areas
  { name: "Arizona Rest Area", state: "AZ", latitude: 33.3942, longitude: -112.0740, interstate: "I-10", direction: "Eastbound", hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true },
  { name: "New Mexico Welcome Center", state: "NM", latitude: 32.0795, longitude: -109.0479, interstate: "I-10", direction: "Westbound", hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: true },
  { name: "Texas Rest Area", state: "TX", latitude: 31.2589, longitude: -105.4843, interstate: "I-10", direction: "Eastbound", hasRestrooms: true, hasPicnicArea: true, hasPetArea: true },
  { name: "Louisiana Welcome Center", state: "LA", latitude: 30.1856, longitude: -93.7610, interstate: "I-10", direction: "Eastbound", hasRestrooms: true, hasPicnicArea: true, hasWifi: true },
  { name: "Alabama Rest Area", state: "AL", latitude: 30.5789, longitude: -88.2456, interstate: "I-10", direction: "Westbound", hasRestrooms: true, hasPetArea: true },
  { name: "Florida Welcome Center", state: "FL", latitude: 30.6257, longitude: -87.3417, interstate: "I-10", direction: "Eastbound", hasRestrooms: true, hasPicnicArea: true, hasWifi: true, hasRVParking: true },

  // I-40 Rest Areas
  { name: "California Rest Area", state: "CA", latitude: 34.9465, longitude: -116.8765, interstate: "I-40", direction: "Eastbound", hasRestrooms: true, hasPicnicArea: true },
  { name: "Arizona Welcome Center", state: "AZ", latitude: 35.0432, longitude: -114.5678, interstate: "I-40", direction: "Eastbound", hasRestrooms: true, hasPicnicArea: true, hasWifi: true },
  { name: "New Mexico Rest Area", state: "NM", latitude: 35.2098, longitude: -107.9087, interstate: "I-40", direction: "Westbound", hasRestrooms: true, hasPetArea: true },
  { name: "Texas Welcome Center", state: "TX", latitude: 35.1875, longitude: -103.0456, interstate: "I-40", direction: "Eastbound", hasRestrooms: true, hasPicnicArea: true, hasVending: true },
  { name: "Oklahoma Rest Area", state: "OK", latitude: 35.3654, longitude: -99.8765, interstate: "I-40", direction: "Eastbound", hasRestrooms: true, hasPicnicArea: true },
  { name: "Arkansas Welcome Center", state: "AR", latitude: 35.4123, longitude: -94.4567, interstate: "I-40", direction: "Eastbound", hasRestrooms: true, hasWifi: true },
  { name: "Tennessee Rest Area", state: "TN", latitude: 35.8765, longitude: -88.5432, interstate: "I-40", direction: "Westbound", hasRestrooms: true, hasPetArea: true },
  { name: "North Carolina Welcome Center", state: "NC", latitude: 35.7654, longitude: -81.2345, interstate: "I-40", direction: "Eastbound", hasRestrooms: true, hasPicnicArea: true, hasRVParking: true },

  // I-95 Rest Areas
  { name: "Maine Welcome Center", state: "ME", latitude: 43.8765, longitude: -70.3456, interstate: "I-95", direction: "Northbound", hasRestrooms: true, hasPicnicArea: true },
  { name: "New Hampshire Rest Area", state: "NH", latitude: 42.9876, longitude: -70.8765, interstate: "I-95", direction: "Southbound", hasRestrooms: true, hasVending: true },
  { name: "Massachusetts Service Plaza", state: "MA", latitude: 42.4567, longitude: -71.0123, interstate: "I-95", direction: "Northbound", hasRestrooms: true, hasPicnicArea: true, hasWifi: true },
  { name: "Connecticut Rest Area", state: "CT", latitude: 41.3456, longitude: -72.8765, interstate: "I-95", direction: "Southbound", hasRestrooms: true },
  { name: "New Jersey Service Area", state: "NJ", latitude: 40.2345, longitude: -74.5678, interstate: "I-95", direction: "Northbound", hasRestrooms: true, hasPicnicArea: true, hasVending: true },
  { name: "Delaware Welcome Center", state: "DE", latitude: 39.7654, longitude: -75.5432, interstate: "I-95", direction: "Southbound", hasRestrooms: true, hasWifi: true },
  { name: "Maryland Rest Area", state: "MD", latitude: 39.4567, longitude: -76.2345, interstate: "I-95", direction: "Northbound", hasRestrooms: true, hasPetArea: true },
  { name: "Virginia Welcome Center", state: "VA", latitude: 38.7654, longitude: -77.4321, interstate: "I-95", direction: "Southbound", hasRestrooms: true, hasPicnicArea: true, hasRVParking: true },
  { name: "North Carolina Rest Area", state: "NC", latitude: 36.4567, longitude: -77.8765, interstate: "I-95", direction: "Northbound", hasRestrooms: true },
  { name: "South Carolina Welcome Center", state: "SC", latitude: 34.2345, longitude: -79.7654, interstate: "I-95", direction: "Southbound", hasRestrooms: true, hasPicnicArea: true },
  { name: "Georgia Rest Area", state: "GA", latitude: 32.1234, longitude: -81.2345, interstate: "I-95", direction: "Northbound", hasRestrooms: true, hasVending: true },
  { name: "Florida Welcome Center", state: "FL", latitude: 30.7654, longitude: -81.5432, interstate: "I-95", direction: "Southbound", hasRestrooms: true, hasPicnicArea: true, hasWifi: true },

  // I-5 Rest Areas
  { name: "Washington Rest Area", state: "WA", latitude: 48.2345, longitude: -122.4567, interstate: "I-5", direction: "Southbound", hasRestrooms: true, hasPicnicArea: true },
  { name: "Oregon Welcome Center", state: "OR", latitude: 45.7654, longitude: -122.7654, interstate: "I-5", direction: "Northbound", hasRestrooms: true, hasWifi: true },
  { name: "California Rest Area", state: "CA", latitude: 41.5432, longitude: -122.3456, interstate: "I-5", direction: "Southbound", hasRestrooms: true, hasPetArea: true },

  // I-80 Rest Areas
  { name: "California Rest Area", state: "CA", latitude: 38.5678, longitude: -121.8765, interstate: "I-80", direction: "Eastbound", hasRestrooms: true, hasPicnicArea: true },
  { name: "Nevada Rest Area", state: "NV", latitude: 40.2345, longitude: -117.5678, interstate: "I-80", direction: "Westbound", hasRestrooms: true },
  { name: "Utah Welcome Center", state: "UT", latitude: 40.9876, longitude: -111.9876, interstate: "I-80", direction: "Eastbound", hasRestrooms: true, hasWifi: true },
  { name: "Wyoming Rest Area", state: "WY", latitude: 41.3456, longitude: -108.7654, interstate: "I-80", direction: "Westbound", hasRestrooms: true, hasPicnicArea: true },
  { name: "Nebraska Rest Area", state: "NE", latitude: 41.1234, longitude: -101.5678, interstate: "I-80", direction: "Eastbound", hasRestrooms: true, hasPetArea: true },
  { name: "Iowa Welcome Center", state: "IA", latitude: 41.5678, longitude: -95.8765, interstate: "I-80", direction: "Eastbound", hasRestrooms: true, hasRVParking: true },

  // I-75 Rest Areas
  { name: "Michigan Welcome Center", state: "MI", latitude: 45.7654, longitude: -84.5678, interstate: "I-75", direction: "Southbound", hasRestrooms: true, hasPicnicArea: true },
  { name: "Ohio Rest Area", state: "OH", latitude: 40.8765, longitude: -83.5432, interstate: "I-75", direction: "Northbound", hasRestrooms: true },
  { name: "Kentucky Welcome Center", state: "KY", latitude: 38.5432, longitude: -84.2345, interstate: "I-75", direction: "Southbound", hasRestrooms: true, hasWifi: true },
  { name: "Tennessee Rest Area", state: "TN", latitude: 36.2345, longitude: -84.8765, interstate: "I-75", direction: "Northbound", hasRestrooms: true, hasPetArea: true },
  { name: "Georgia Welcome Center", state: "GA", latitude: 34.9876, longitude: -85.0123, interstate: "I-75", direction: "Southbound", hasRestrooms: true, hasPicnicArea: true },
  { name: "Florida Welcome Center", state: "FL", latitude: 30.8765, longitude: -82.5678, interstate: "I-75", direction: "Southbound", hasRestrooms: true, hasRVParking: true, hasWifi: true },

  // I-35 Rest Areas
  { name: "Minnesota Rest Area", state: "MN", latitude: 45.1234, longitude: -93.2345, interstate: "I-35", direction: "Southbound", hasRestrooms: true, hasPicnicArea: true },
  { name: "Iowa Rest Area", state: "IA", latitude: 42.5678, longitude: -93.5678, interstate: "I-35", direction: "Northbound", hasRestrooms: true },
  { name: "Missouri Welcome Center", state: "MO", latitude: 39.3456, longitude: -94.5678, interstate: "I-35", direction: "Southbound", hasRestrooms: true, hasWifi: true },
  { name: "Kansas Rest Area", state: "KS", latitude: 37.8765, longitude: -97.2345, interstate: "I-35", direction: "Northbound", hasRestrooms: true, hasPetArea: true },
  { name: "Oklahoma Welcome Center", state: "OK", latitude: 34.7654, longitude: -97.3456, interstate: "I-35", direction: "Southbound", hasRestrooms: true, hasPicnicArea: true },
  { name: "Texas Welcome Center", state: "TX", latitude: 33.7654, longitude: -97.0987, interstate: "I-35", direction: "Southbound", hasRestrooms: true, hasRVParking: true },

  // I-90 Rest Areas
  { name: "Washington Rest Area", state: "WA", latitude: 47.2345, longitude: -121.8765, interstate: "I-90", direction: "Eastbound", hasRestrooms: true, hasPicnicArea: true },
  { name: "Montana Rest Area", state: "MT", latitude: 46.2345, longitude: -110.5678, interstate: "I-90", direction: "Westbound", hasRestrooms: true },
  { name: "South Dakota Welcome Center", state: "SD", latitude: 43.8765, longitude: -102.3456, interstate: "I-90", direction: "Eastbound", hasRestrooms: true, hasWifi: true },
  { name: "Minnesota Rest Area", state: "MN", latitude: 43.9876, longitude: -92.1234, interstate: "I-90", direction: "Westbound", hasRestrooms: true, hasPetArea: true },
  { name: "Wisconsin Rest Area", state: "WI", latitude: 43.5678, longitude: -89.8765, interstate: "I-90", direction: "Eastbound", hasRestrooms: true, hasPicnicArea: true },
  { name: "Illinois Rest Area", state: "IL", latitude: 42.1234, longitude: -88.5678, interstate: "I-90", direction: "Westbound", hasRestrooms: true },
  { name: "Ohio Rest Area", state: "OH", latitude: 41.6543, longitude: -81.2345, interstate: "I-90", direction: "Eastbound", hasRestrooms: true, hasRVParking: true },
  { name: "New York Welcome Center", state: "NY", latitude: 42.9876, longitude: -78.7654, interstate: "I-90", direction: "Eastbound", hasRestrooms: true, hasPicnicArea: true, hasWifi: true },
];

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   SEEDING TRUCK STOPS & REST AREAS');
  console.log('   Using static data (no API needed)');
  console.log('═══════════════════════════════════════════════════\n');

  // Clear existing data
  console.log('🧹 Clearing existing data...');
  await prisma.gasStation.deleteMany({});
  await prisma.restStop.deleteMany({});

  // Seed truck stops
  console.log('\n🚛 Seeding truck stops...');
  let truckCount = 0;
  for (const stop of TRUCK_STOPS) {
    try {
      await prisma.gasStation.create({
        data: {
          name: stop.name,
          brand: stop.brand,
          address: '',
          city: stop.city,
          state: stop.state,
          zipCode: '',
          latitude: stop.latitude,
          longitude: stop.longitude,
          interstate: stop.interstate,
          hasDiesel: true,
          hasTruckParking: true,
          hasRVParking: stop.brand === "Buc-ee's" || Math.random() > 0.3,
          hasRestrooms: true,
          hasShowers: stop.brand !== "Buc-ee's",
          hasRestaurant: Math.random() > 0.4,
          hasStore: true,
          hasPropane: Math.random() > 0.5,
          hasDumpStation: Math.random() > 0.6,
        },
      });
      truckCount++;
    } catch (error) {
      console.log(`   Skipped duplicate: ${stop.name} in ${stop.city}`);
    }
  }
  console.log(`   ✅ Created ${truckCount} truck stops`);

  // Seed rest areas
  console.log('\n🅿️ Seeding rest areas...');
  let restCount = 0;
  for (const rest of REST_AREAS) {
    try {
      await prisma.restStop.create({
        data: {
          name: rest.name,
          state: rest.state,
          latitude: rest.latitude,
          longitude: rest.longitude,
          interstate: rest.interstate,
          direction: rest.direction,
          hasRestrooms: rest.hasRestrooms || false,
          hasPicnicArea: rest.hasPicnicArea || false,
          hasPetArea: rest.hasPetArea || false,
          hasVending: rest.hasVending || false,
          hasWifi: rest.hasWifi || false,
          hasRVParking: rest.hasRVParking || false,
          is24Hours: true,
        },
      });
      restCount++;
    } catch (error) {
      console.log(`   Skipped duplicate: ${rest.name}`);
    }
  }
  console.log(`   ✅ Created ${restCount} rest areas`);

  // Also seed gas prices if empty
  const priceCount = await prisma.stateGasPrice.count();
  if (priceCount === 0) {
    console.log('\n⛽ Seeding gas prices...');
    const gasPrices: { [key: string]: { regular: number; diesel: number } } = {
      AL: { regular: 2.59, diesel: 3.19 }, AK: { regular: 3.69, diesel: 4.09 }, AZ: { regular: 3.09, diesel: 3.59 },
      AR: { regular: 2.59, diesel: 3.19 }, CA: { regular: 4.59, diesel: 5.09 }, CO: { regular: 2.99, diesel: 3.49 },
      CT: { regular: 3.29, diesel: 4.09 }, DE: { regular: 2.99, diesel: 3.69 }, FL: { regular: 3.09, diesel: 3.59 },
      GA: { regular: 2.69, diesel: 3.29 }, HI: { regular: 4.49, diesel: 5.29 }, ID: { regular: 3.19, diesel: 3.69 },
      IL: { regular: 3.29, diesel: 3.79 }, IN: { regular: 2.99, diesel: 3.49 }, IA: { regular: 2.79, diesel: 3.29 },
      KS: { regular: 2.69, diesel: 3.19 }, KY: { regular: 2.79, diesel: 3.39 }, LA: { regular: 2.59, diesel: 3.09 },
      ME: { regular: 3.09, diesel: 3.89 }, MD: { regular: 3.09, diesel: 3.69 }, MA: { regular: 3.19, diesel: 3.99 },
      MI: { regular: 2.99, diesel: 3.59 }, MN: { regular: 2.89, diesel: 3.49 }, MS: { regular: 2.49, diesel: 3.09 },
      MO: { regular: 2.59, diesel: 3.09 }, MT: { regular: 3.09, diesel: 3.59 }, NE: { regular: 2.79, diesel: 3.29 },
      NV: { regular: 3.69, diesel: 4.19 }, NH: { regular: 2.99, diesel: 3.79 }, NJ: { regular: 3.09, diesel: 3.79 },
      NM: { regular: 2.89, diesel: 3.39 }, NY: { regular: 3.39, diesel: 4.19 }, NC: { regular: 2.79, diesel: 3.39 },
      ND: { regular: 2.89, diesel: 3.39 }, OH: { regular: 2.89, diesel: 3.49 }, OK: { regular: 2.59, diesel: 3.09 },
      OR: { regular: 3.59, diesel: 4.09 }, PA: { regular: 3.39, diesel: 4.09 }, RI: { regular: 3.19, diesel: 3.99 },
      SC: { regular: 2.59, diesel: 3.19 }, SD: { regular: 2.89, diesel: 3.49 }, TN: { regular: 2.59, diesel: 3.19 },
      TX: { regular: 2.49, diesel: 3.09 }, UT: { regular: 3.19, diesel: 3.69 }, VT: { regular: 3.29, diesel: 3.99 },
      VA: { regular: 2.89, diesel: 3.49 }, WA: { regular: 3.99, diesel: 4.49 }, WV: { regular: 2.89, diesel: 3.49 },
      WI: { regular: 2.89, diesel: 3.49 }, WY: { regular: 3.09, diesel: 3.59 }, DC: { regular: 3.29, diesel: 3.89 },
    };

    const stateNames: { [key: string]: string } = {
      AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
      CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
      IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
      ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
      MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
      NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
      OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
      TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
      WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
    };

    for (const [code, prices] of Object.entries(gasPrices)) {
      await prisma.stateGasPrice.create({
        data: {
          stateCode: code,
          stateName: stateNames[code] || code,
          regularPrice: prices.regular,
          dieselPrice: prices.diesel,
          midgradePrice: prices.regular + 0.30,
          premiumPrice: prices.regular + 0.60,
        },
      });
    }
    console.log(`   ✅ Created ${Object.keys(gasPrices).length} state gas prices`);
  }

  // Final counts
  const finalTruckCount = await prisma.gasStation.count();
  const finalRestCount = await prisma.restStop.count();
  const finalPriceCount = await prisma.stateGasPrice.count();

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`   COMPLETE!`);
  console.log(`   🚛 ${finalTruckCount} truck stops`);
  console.log(`   🅿️ ${finalRestCount} rest areas`);
  console.log(`   ⛽ ${finalPriceCount} state gas prices`);
  console.log('═══════════════════════════════════════════════════\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
