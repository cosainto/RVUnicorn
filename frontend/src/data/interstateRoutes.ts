// Major Interstate Highway coordinates (simplified paths)
// These are approximate centerline coordinates for major interstates

export interface InterstateRoute {
  id: string;
  name: string;
  direction: 'East-West' | 'North-South';
  color: string;
  coordinates: [number, number][]; // [longitude, latitude]
}

export const interstateRoutes: InterstateRoute[] = [
  // I-10: Southern Route (CA to FL)
  {
    id: 'I-10',
    name: 'I-10',
    direction: 'East-West',
    color: '#dc2626', // red
    coordinates: [
      [-117.16, 32.72], // San Diego area
      [-116.54, 32.79], // El Centro
      [-114.62, 32.72], // Yuma area
      [-112.07, 33.45], // Phoenix
      [-110.97, 32.22], // Tucson
      [-109.00, 32.00], // AZ/NM border
      [-106.75, 32.34], // Las Cruces
      [-106.49, 31.76], // El Paso
      [-104.83, 31.04], // Van Horn
      [-102.88, 30.89], // Fort Stockton
      [-100.46, 30.45], // Sonora
      [-98.49, 29.42], // San Antonio
      [-97.74, 30.27], // Austin area
      [-95.36, 29.76], // Houston
      [-94.10, 30.09], // Beaumont
      [-93.22, 30.23], // Lake Charles
      [-92.02, 30.22], // Lafayette
      [-91.19, 30.45], // Baton Rouge
      [-90.07, 29.95], // New Orleans
      [-89.09, 30.37], // Mississippi Gulf Coast
      [-88.04, 30.69], // Mobile
      [-87.22, 30.48], // Pensacola
      [-86.14, 30.44], // Panama City area
      [-84.28, 30.44], // Tallahassee
      [-82.64, 30.19], // Lake City
      [-81.66, 30.33], // Jacksonville
    ],
  },
  
  // I-40: Central Route (CA to NC)
  {
    id: 'I-40',
    name: 'I-40',
    direction: 'East-West',
    color: '#2563eb', // blue
    coordinates: [
      [-117.02, 34.90], // Barstow
      [-116.17, 34.87], // Ludlow
      [-114.61, 34.85], // Needles
      [-114.05, 35.19], // Kingman
      [-112.19, 35.25], // Williams
      [-111.65, 35.20], // Flagstaff
      [-110.87, 35.05], // Winslow
      [-110.15, 34.91], // Holbrook
      [-109.04, 35.52], // AZ/NM border
      [-108.74, 35.53], // Gallup
      [-107.86, 35.15], // Grants
      [-106.65, 35.08], // Albuquerque
      [-105.97, 35.05], // Santa Rosa area
      [-103.72, 35.17], // Tucumcari
      [-102.10, 35.20], // TX/NM border area
      [-101.83, 35.20], // Amarillo
      [-100.53, 35.22], // Shamrock
      [-99.90, 35.21], // OK/TX border
      [-98.58, 35.47], // Weatherford
      [-97.52, 35.47], // Oklahoma City
      [-96.01, 35.47], // Shawnee
      [-95.36, 35.47], // Henryetta
      [-94.80, 35.39], // Sallisaw
      [-94.40, 35.39], // AR/OK border
      [-93.75, 35.29], // Fort Smith area
      [-92.44, 35.08], // Conway
      [-92.27, 34.75], // Little Rock area
      [-91.14, 35.00], // Forrest City
      [-90.05, 35.15], // Memphis
      [-88.82, 35.61], // Jackson TN
      [-87.07, 36.08], // Nashville area
      [-86.78, 36.16], // Lebanon
      [-85.51, 36.13], // Cookeville
      [-84.52, 35.97], // Crossville
      [-83.92, 35.96], // Knoxville
      [-83.45, 35.80], // Sevierville area
      [-82.55, 35.60], // Asheville
      [-81.54, 35.74], // Marion
      [-81.20, 35.73], // Hickory
      [-80.24, 36.10], // Winston-Salem
      [-79.79, 36.07], // Greensboro
      [-79.43, 36.00], // Burlington
      [-78.90, 35.99], // Durham
      [-78.64, 35.78], // Raleigh
      [-77.93, 35.22], // Goldsboro area
      [-77.86, 34.24], // Wilmington
    ],
  },
  
  // I-95: East Coast (FL to ME)
  {
    id: 'I-95',
    name: 'I-95',
    direction: 'North-South',
    color: '#16a34a', // green
    coordinates: [
      [-80.19, 25.77], // Miami
      [-80.13, 26.12], // Fort Lauderdale
      [-80.06, 26.71], // West Palm Beach
      [-80.33, 27.64], // Vero Beach area
      [-80.61, 28.07], // Melbourne
      [-80.87, 28.54], // Titusville
      [-81.06, 29.21], // Daytona Beach
      [-81.39, 29.90], // St. Augustine
      [-81.66, 30.33], // Jacksonville
      [-81.49, 31.13], // Brunswick GA
      [-81.10, 32.08], // Savannah
      [-80.95, 32.47], // Hilton Head area
      [-80.02, 32.90], // Charleston SC
      [-79.94, 33.69], // Florence
      [-79.03, 34.23], // Lumberton NC
      [-78.64, 35.05], // Fayetteville
      [-78.31, 35.59], // Selma
      [-77.93, 35.94], // Rocky Mount
      [-77.41, 36.87], // Emporia VA
      [-77.46, 37.24], // Petersburg
      [-77.44, 37.54], // Richmond
      [-77.46, 38.30], // Fredericksburg
      [-77.19, 38.85], // Washington DC area
      [-76.61, 39.29], // Baltimore
      [-75.56, 39.75], // Wilmington DE
      [-75.13, 39.95], // Philadelphia area
      [-74.76, 40.22], // Trenton
      [-74.17, 40.70], // Newark
      [-73.88, 40.85], // NYC area
      [-73.19, 41.17], // Bridgeport CT
      [-72.92, 41.31], // New Haven
      [-72.08, 41.35], // New London
      [-71.42, 41.82], // Providence
      [-71.06, 42.36], // Boston
      [-70.87, 42.88], // Portsmouth NH
      [-70.32, 43.66], // Portland ME
      [-69.78, 44.31], // Augusta area
      [-68.77, 44.80], // Bangor
      [-67.84, 46.12], // Houlton
    ],
  },
  
  // I-80: Northern Route (CA to NJ)
  {
    id: 'I-80',
    name: 'I-80',
    direction: 'East-West',
    color: '#9333ea', // purple
    coordinates: [
      [-122.39, 37.79], // San Francisco
      [-121.94, 37.70], // Oakland
      [-121.29, 37.95], // Livermore
      [-120.85, 37.81], // Tracy
      [-119.80, 38.58], // Sacramento area
      [-120.00, 39.28], // Auburn
      [-120.17, 39.32], // Colfax
      [-120.24, 39.33], // Donner Pass area
      [-119.81, 39.52], // Reno
      [-118.78, 40.84], // Winnemucca
      [-117.73, 40.97], // Battle Mountain
      [-116.99, 40.84], // Elko
      [-115.74, 40.74], // Wells
      [-114.04, 40.73], // Wendover
      [-112.01, 40.76], // Salt Lake City
      [-111.02, 40.98], // Evanston WY
      [-110.41, 41.14], // Fort Bridger
      [-108.76, 41.31], // Rock Springs
      [-107.22, 41.14], // Rawlins
      [-105.59, 41.14], // Laramie
      [-104.82, 41.14], // Cheyenne
      [-103.00, 41.14], // Sidney NE
      [-101.69, 41.13], // North Platte
      [-100.76, 40.92], // Lexington
      [-99.38, 40.70], // Kearney
      [-98.36, 40.82], // Grand Island
      [-96.71, 40.81], // Lincoln
      [-95.93, 41.26], // Omaha
      [-95.86, 41.59], // Council Bluffs
      [-93.62, 41.59], // Des Moines
      [-91.67, 41.52], // Iowa City
      [-90.57, 41.51], // Davenport
      [-89.59, 41.65], // LaSalle IL
      [-88.00, 41.52], // Joliet
      [-87.63, 41.88], // Chicago
      [-87.02, 41.71], // Gary IN
      [-85.67, 41.70], // Elkhart
      [-84.43, 41.65], // Toledo OH area
      [-83.01, 41.47], // Sandusky
      [-81.69, 41.50], // Cleveland
      [-80.85, 41.27], // Youngstown area
      [-80.34, 41.10], // Sharon PA
      [-79.95, 41.00], // Clarion
      [-78.00, 40.97], // Clearfield
      [-77.00, 40.97], // State College area
      [-76.00, 41.00], // Bloomsburg
      [-75.47, 41.00], // Stroudsburg
      [-75.00, 40.90], // Delaware Water Gap
      [-74.18, 40.88], // Hackettstown NJ
      [-74.07, 40.79], // Teaneck area
    ],
  },
  
  // I-90: Longest Interstate (WA to MA)
  {
    id: 'I-90',
    name: 'I-90',
    direction: 'East-West',
    color: '#ea580c', // orange
    coordinates: [
      [-122.33, 47.61], // Seattle
      [-121.89, 47.49], // Snoqualmie Pass
      [-120.51, 47.42], // Ellensburg
      [-119.28, 47.11], // Moses Lake
      [-117.93, 47.63], // Spokane
      [-116.93, 47.68], // Coeur d'Alene ID
      [-115.53, 47.50], // St. Regis MT
      [-114.01, 46.87], // Missoula
      [-112.99, 46.59], // Butte
      [-111.04, 45.68], // Bozeman
      [-110.56, 45.59], // Livingston
      [-109.06, 45.46], // Billings
      [-107.88, 45.80], // Hardin
      [-106.28, 45.26], // Sheridan WY area
      [-105.50, 44.80], // Buffalo WY
      [-104.37, 44.29], // Gillette
      [-103.23, 44.08], // Sundance
      [-102.00, 44.05], // Spearfish SD
      [-100.35, 44.37], // Pierre
      [-98.50, 44.31], // Mitchell
      [-96.73, 43.55], // Sioux Falls
      [-96.17, 43.65], // Worthington MN
      [-94.16, 44.02], // Albert Lea
      [-93.26, 44.98], // Minneapolis
      [-92.10, 44.94], // River Falls WI
      [-91.50, 44.81], // Eau Claire
      [-90.88, 43.81], // Tomah
      [-89.40, 43.07], // Madison
      [-89.02, 42.88], // Janesville
      [-88.25, 42.27], // Rockford IL
      [-87.63, 41.88], // Chicago
      [-87.02, 41.71], // Gary IN
      [-86.25, 41.68], // South Bend
      [-85.00, 41.65], // Angola
      [-84.00, 41.65], // Toledo OH
      [-83.45, 42.33], // Detroit area
      [-82.45, 43.00], // Port Huron
      [-79.87, 42.88], // Buffalo NY
      [-78.88, 42.88], // Batavia
      [-77.61, 43.15], // Rochester
      [-76.15, 43.05], // Syracuse
      [-75.23, 43.10], // Utica
      [-74.17, 42.81], // Albany area
      [-73.69, 42.73], // Rensselaer
      [-73.18, 42.45], // Pittsfield MA
      [-72.58, 42.10], // Springfield
      [-71.80, 42.26], // Worcester
      [-71.06, 42.36], // Boston
    ],
  },
  
  // I-5: West Coast (CA to WA)
  {
    id: 'I-5',
    name: 'I-5',
    direction: 'North-South',
    color: '#0891b2', // cyan
    coordinates: [
      [-117.16, 32.72], // San Diego
      [-117.88, 33.68], // Oceanside
      [-117.91, 33.77], // San Clemente
      [-117.94, 33.92], // Irvine
      [-118.19, 33.99], // Santa Ana
      [-118.24, 34.05], // Los Angeles
      [-118.46, 34.18], // San Fernando
      [-118.76, 34.42], // Santa Clarita
      [-118.95, 34.87], // Castaic area
      [-119.07, 35.27], // Gorman
      [-119.06, 35.38], // Tejon Pass
      [-119.02, 35.73], // Bakersfield area
      [-119.78, 36.33], // Tulare
      [-119.79, 36.74], // Fresno
      [-120.48, 37.36], // Merced
      [-121.00, 37.67], // Modesto
      [-121.29, 37.95], // Stockton
      [-121.49, 38.58], // Sacramento
      [-122.02, 39.14], // Woodland
      [-122.21, 39.76], // Williams
      [-122.19, 40.19], // Red Bluff
      [-122.39, 40.59], // Redding
      [-122.39, 41.31], // Dunsmuir
      [-122.32, 41.73], // Weed
      [-122.63, 42.19], // Ashland OR
      [-122.87, 42.32], // Medford
      [-123.02, 42.44], // Grants Pass
      [-123.36, 43.22], // Roseburg
      [-123.09, 43.98], // Eugene
      [-122.76, 44.94], // Salem
      [-122.68, 45.52], // Portland
      [-122.67, 45.88], // Vancouver WA
      [-122.90, 46.14], // Kelso
      [-122.90, 46.73], // Centralia
      [-122.90, 47.04], // Olympia
      [-122.43, 47.25], // Tacoma
      [-122.33, 47.61], // Seattle
      [-122.20, 48.00], // Everett
      [-122.34, 48.42], // Mt Vernon
      [-122.47, 48.77], // Bellingham
      [-122.76, 49.00], // Border
    ],
  },
  
  // I-75: Southeast Corridor (FL to MI)
  {
    id: 'I-75',
    name: 'I-75',
    direction: 'North-South',
    color: '#f59e0b', // amber
    coordinates: [
      [-80.39, 25.10], // Miami Gardens
      [-80.34, 26.15], // Fort Lauderdale
      [-80.14, 26.64], // Boca Raton
      [-81.57, 26.64], // Naples area
      [-81.88, 26.93], // Fort Myers
      [-82.01, 27.34], // Port Charlotte
      [-82.46, 27.95], // Sarasota
      [-82.46, 27.95], // St Petersburg area
      [-82.46, 28.06], // Tampa
      [-82.32, 28.54], // Brooksville
      [-82.34, 29.05], // Ocala
      [-82.34, 29.65], // Gainesville
      [-82.68, 30.27], // Lake City
      [-83.65, 30.85], // Valdosta GA
      [-83.63, 31.58], // Tifton
      [-83.80, 32.07], // Cordele
      [-83.64, 32.46], // Perry
      [-83.63, 32.84], // Macon
      [-84.39, 33.75], // Atlanta
      [-84.87, 34.48], // Cartersville
      [-84.97, 34.87], // Dalton
      [-85.26, 35.04], // Chattanooga TN
      [-84.26, 35.95], // Knoxville area
      [-84.27, 36.57], // Jellico
      [-84.29, 37.06], // Corbin KY
      [-84.50, 37.48], // London
      [-84.47, 37.98], // Berea
      [-84.51, 38.05], // Richmond
      [-84.50, 38.40], // Lexington
      [-84.51, 39.10], // Cincinnati OH
      [-84.26, 39.76], // Dayton
      [-84.18, 40.10], // Troy
      [-84.02, 40.75], // Lima
      [-83.65, 41.05], // Findlay
      [-83.55, 41.65], // Toledo
      [-83.69, 42.33], // Detroit
      [-83.04, 42.97], // Flint
      [-84.19, 43.42], // Saginaw
      [-84.68, 43.60], // Bay City
      [-84.72, 44.33], // Grayling
      [-84.72, 44.73], // Gaylord
      [-84.81, 45.78], // Indian River
      [-84.73, 46.49], // St Ignace
      [-87.38, 46.54], // Marquette area
      [-88.00, 46.50], // Baraga
    ],
  },
  
  // I-35: Central Corridor (TX to MN)
  {
    id: 'I-35',
    name: 'I-35',
    direction: 'North-South',
    color: '#7c3aed', // violet
    coordinates: [
      [-98.49, 27.51], // Laredo TX
      [-98.49, 29.42], // San Antonio
      [-97.74, 30.27], // Austin
      [-97.13, 31.08], // Temple
      [-97.13, 31.55], // Waco
      [-97.13, 32.76], // Fort Worth area
      [-96.80, 32.78], // Dallas
      [-96.80, 33.20], // McKinney
      [-96.70, 33.84], // Sherman
      [-96.60, 34.18], // Gainesville
      [-97.13, 34.61], // Ardmore OK
      [-97.44, 35.47], // Oklahoma City
      [-97.39, 35.93], // Guthrie
      [-97.06, 36.31], // Ponca City area
      [-96.99, 37.69], // Wichita KS
      [-97.33, 38.36], // Newton
      [-95.68, 39.05], // Topeka
      [-94.63, 39.10], // Kansas City
      [-94.48, 39.77], // St Joseph MO
      [-93.62, 41.59], // Des Moines IA
      [-93.37, 42.50], // Ames
      [-93.62, 43.15], // Clear Lake
      [-93.23, 43.65], // Albert Lea MN
      [-93.47, 44.02], // Owatonna
      [-93.26, 44.98], // Minneapolis
      [-93.09, 45.56], // Forest Lake
      [-92.82, 46.78], // Duluth
    ],
  },
];

// Export a function to get GeoJSON format
export function getInterstateGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: interstateRoutes.map(route => ({
      type: 'Feature',
      properties: {
        id: route.id,
        name: route.name,
        direction: route.direction,
        color: route.color,
      },
      geometry: {
        type: 'LineString',
        coordinates: route.coordinates,
      },
    })),
  };
}

export default interstateRoutes;
