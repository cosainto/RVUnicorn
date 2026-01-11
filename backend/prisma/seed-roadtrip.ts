import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// State Gas Prices (approximate averages - can be updated via API later)
const stateGasPrices = [
  { stateCode: 'AL', stateName: 'Alabama', regularPrice: 2.89, dieselPrice: 3.49 },
  { stateCode: 'AK', stateName: 'Alaska', regularPrice: 3.89, dieselPrice: 4.29 },
  { stateCode: 'AZ', stateName: 'Arizona', regularPrice: 3.29, dieselPrice: 3.89 },
  { stateCode: 'AR', stateName: 'Arkansas', regularPrice: 2.79, dieselPrice: 3.39 },
  { stateCode: 'CA', stateName: 'California', regularPrice: 4.89, dieselPrice: 5.29 },
  { stateCode: 'CO', stateName: 'Colorado', regularPrice: 3.19, dieselPrice: 3.79 },
  { stateCode: 'CT', stateName: 'Connecticut', regularPrice: 3.49, dieselPrice: 4.09 },
  { stateCode: 'DE', stateName: 'Delaware', regularPrice: 3.19, dieselPrice: 3.79 },
  { stateCode: 'FL', stateName: 'Florida', regularPrice: 3.29, dieselPrice: 3.89 },
  { stateCode: 'GA', stateName: 'Georgia', regularPrice: 2.99, dieselPrice: 3.59 },
  { stateCode: 'HI', stateName: 'Hawaii', regularPrice: 4.69, dieselPrice: 5.19 },
  { stateCode: 'ID', stateName: 'Idaho', regularPrice: 3.39, dieselPrice: 3.99 },
  { stateCode: 'IL', stateName: 'Illinois', regularPrice: 3.59, dieselPrice: 4.09 },
  { stateCode: 'IN', stateName: 'Indiana', regularPrice: 3.29, dieselPrice: 3.89 },
  { stateCode: 'IA', stateName: 'Iowa', regularPrice: 2.99, dieselPrice: 3.59 },
  { stateCode: 'KS', stateName: 'Kansas', regularPrice: 2.89, dieselPrice: 3.49 },
  { stateCode: 'KY', stateName: 'Kentucky', regularPrice: 2.99, dieselPrice: 3.59 },
  { stateCode: 'LA', stateName: 'Louisiana', regularPrice: 2.89, dieselPrice: 3.49 },
  { stateCode: 'ME', stateName: 'Maine', regularPrice: 3.39, dieselPrice: 3.99 },
  { stateCode: 'MD', stateName: 'Maryland', regularPrice: 3.29, dieselPrice: 3.89 },
  { stateCode: 'MA', stateName: 'Massachusetts', regularPrice: 3.49, dieselPrice: 4.09 },
  { stateCode: 'MI', stateName: 'Michigan', regularPrice: 3.39, dieselPrice: 3.99 },
  { stateCode: 'MN', stateName: 'Minnesota', regularPrice: 3.09, dieselPrice: 3.69 },
  { stateCode: 'MS', stateName: 'Mississippi', regularPrice: 2.79, dieselPrice: 3.39 },
  { stateCode: 'MO', stateName: 'Missouri', regularPrice: 2.79, dieselPrice: 3.39 },
  { stateCode: 'MT', stateName: 'Montana', regularPrice: 3.29, dieselPrice: 3.89 },
  { stateCode: 'NE', stateName: 'Nebraska', regularPrice: 2.99, dieselPrice: 3.59 },
  { stateCode: 'NV', stateName: 'Nevada', regularPrice: 3.89, dieselPrice: 4.39 },
  { stateCode: 'NH', stateName: 'New Hampshire', regularPrice: 3.29, dieselPrice: 3.89 },
  { stateCode: 'NJ', stateName: 'New Jersey', regularPrice: 3.29, dieselPrice: 3.89 },
  { stateCode: 'NM', stateName: 'New Mexico', regularPrice: 3.09, dieselPrice: 3.69 },
  { stateCode: 'NY', stateName: 'New York', regularPrice: 3.59, dieselPrice: 4.19 },
  { stateCode: 'NC', stateName: 'North Carolina', regularPrice: 3.09, dieselPrice: 3.69 },
  { stateCode: 'ND', stateName: 'North Dakota', regularPrice: 3.09, dieselPrice: 3.69 },
  { stateCode: 'OH', stateName: 'Ohio', regularPrice: 3.19, dieselPrice: 3.79 },
  { stateCode: 'OK', stateName: 'Oklahoma', regularPrice: 2.79, dieselPrice: 3.39 },
  { stateCode: 'OR', stateName: 'Oregon', regularPrice: 3.79, dieselPrice: 4.29 },
  { stateCode: 'PA', stateName: 'Pennsylvania', regularPrice: 3.49, dieselPrice: 4.09 },
  { stateCode: 'RI', stateName: 'Rhode Island', regularPrice: 3.39, dieselPrice: 3.99 },
  { stateCode: 'SC', stateName: 'South Carolina', regularPrice: 2.89, dieselPrice: 3.49 },
  { stateCode: 'SD', stateName: 'South Dakota', regularPrice: 3.09, dieselPrice: 3.69 },
  { stateCode: 'TN', stateName: 'Tennessee', regularPrice: 2.89, dieselPrice: 3.49 },
  { stateCode: 'TX', stateName: 'Texas', regularPrice: 2.79, dieselPrice: 3.39 },
  { stateCode: 'UT', stateName: 'Utah', regularPrice: 3.39, dieselPrice: 3.99 },
  { stateCode: 'VT', stateName: 'Vermont', regularPrice: 3.39, dieselPrice: 3.99 },
  { stateCode: 'VA', stateName: 'Virginia', regularPrice: 3.09, dieselPrice: 3.69 },
  { stateCode: 'WA', stateName: 'Washington', regularPrice: 4.09, dieselPrice: 4.59 },
  { stateCode: 'WV', stateName: 'West Virginia', regularPrice: 3.09, dieselPrice: 3.69 },
  { stateCode: 'WI', stateName: 'Wisconsin', regularPrice: 3.09, dieselPrice: 3.69 },
  { stateCode: 'WY', stateName: 'Wyoming', regularPrice: 3.19, dieselPrice: 3.79 },
];

// Major Interstates
const interstates = [
  { name: 'I-10', direction: 'East-West', startState: 'CA', endState: 'FL', totalMiles: 2460, description: 'Southern route from Los Angeles to Jacksonville' },
  { name: 'I-20', direction: 'East-West', startState: 'TX', endState: 'SC', totalMiles: 1539, description: 'Southern route from Texas to South Carolina' },
  { name: 'I-40', direction: 'East-West', startState: 'CA', endState: 'NC', totalMiles: 2555, description: 'Central route from Barstow to Wilmington' },
  { name: 'I-70', direction: 'East-West', startState: 'UT', endState: 'MD', totalMiles: 2153, description: 'Central route through Denver and St. Louis' },
  { name: 'I-80', direction: 'East-West', startState: 'CA', endState: 'NJ', totalMiles: 2900, description: 'Northern route from San Francisco to New York' },
  { name: 'I-90', direction: 'East-West', startState: 'WA', endState: 'MA', totalMiles: 3020, description: 'Longest interstate from Seattle to Boston' },
  { name: 'I-95', direction: 'North-South', startState: 'FL', endState: 'ME', totalMiles: 1926, description: 'East coast from Miami to Maine' },
  { name: 'I-5', direction: 'North-South', startState: 'CA', endState: 'WA', totalMiles: 1381, description: 'West coast from San Diego to Seattle' },
  { name: 'I-15', direction: 'North-South', startState: 'CA', endState: 'MT', totalMiles: 1433, description: 'From San Diego through Las Vegas to Montana' },
  { name: 'I-25', direction: 'North-South', startState: 'NM', endState: 'WY', totalMiles: 1062, description: 'Rocky Mountain corridor' },
  { name: 'I-35', direction: 'North-South', startState: 'TX', endState: 'MN', totalMiles: 1568, description: 'Central corridor from Texas to Minnesota' },
  { name: 'I-55', direction: 'North-South', startState: 'LA', endState: 'IL', totalMiles: 964, description: 'New Orleans to Chicago' },
  { name: 'I-65', direction: 'North-South', startState: 'AL', endState: 'IN', totalMiles: 887, description: 'Mobile to Chicago area' },
  { name: 'I-75', direction: 'North-South', startState: 'FL', endState: 'MI', totalMiles: 1786, description: 'Florida to Michigan' },
  { name: 'I-81', direction: 'North-South', startState: 'TN', endState: 'NY', totalMiles: 855, description: 'Appalachian corridor' },
];

// Sample Gas Stations (Major Truck Stops along I-40)
const gasStations = [
  // I-40 California
  { name: 'Pilot Travel Center', brand: 'Pilot', address: '2615 Lenwood Rd', city: 'Barstow', state: 'CA', zipCode: '92311', latitude: 34.8697, longitude: -117.0228, interstate: 'I-40', exitNumber: '1', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: false, hasDumpStation: false },
  { name: "Love's Travel Stop", brand: "Love's", address: '2959 Lenwood Rd', city: 'Barstow', state: 'CA', zipCode: '92311', latitude: 34.8712, longitude: -117.0182, interstate: 'I-40', exitNumber: '1', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: true, hasDumpStation: false },
  
  // I-40 Arizona
  { name: 'Pilot Travel Center', brand: 'Pilot', address: '2700 E Andy Devine Ave', city: 'Kingman', state: 'AZ', zipCode: '86401', latitude: 35.1894, longitude: -114.0214, interstate: 'I-40', exitNumber: '53', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: false, hasDumpStation: false },
  { name: "Love's Travel Stop", brand: "Love's", address: '3191 E Andy Devine Ave', city: 'Kingman', state: 'AZ', zipCode: '86401', latitude: 35.1912, longitude: -114.0089, interstate: 'I-40', exitNumber: '53', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: false, hasStore: true, hasPropane: true, hasDumpStation: false },
  { name: 'TA Travel Center', brand: 'TA', address: '2881 W Historic Rte 66', city: 'Williams', state: 'AZ', zipCode: '86046', latitude: 35.2444, longitude: -112.2036, interstate: 'I-40', exitNumber: '163', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: false, hasDumpStation: true },
  { name: 'Flying J Travel Center', brand: 'Flying J', address: '8500 E Navajo Blvd', city: 'Holbrook', state: 'AZ', zipCode: '86025', latitude: 34.9126, longitude: -110.1152, interstate: 'I-40', exitNumber: '289', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: true, hasDumpStation: true },
  
  // I-40 New Mexico
  { name: 'Pilot Travel Center', brand: 'Pilot', address: '1701 W Historic Hwy 66', city: 'Gallup', state: 'NM', zipCode: '87301', latitude: 35.5186, longitude: -108.7678, interstate: 'I-40', exitNumber: '16', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: false, hasDumpStation: false },
  { name: "Love's Travel Stop", brand: "Love's", address: '2610 W Historic Hwy 66', city: 'Gallup', state: 'NM', zipCode: '87301', latitude: 35.5203, longitude: -108.7821, interstate: 'I-40', exitNumber: '16', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: true, hasDumpStation: false },
  { name: 'Flying J Travel Center', brand: 'Flying J', address: '5620 University Blvd SE', city: 'Albuquerque', state: 'NM', zipCode: '87106', latitude: 35.0442, longitude: -106.5881, interstate: 'I-40', exitNumber: '222', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: true, hasDumpStation: true },
  { name: 'Pilot Travel Center', brand: 'Pilot', address: '109 Dinosaur Trail', city: 'Tucumcari', state: 'NM', zipCode: '88401', latitude: 35.1756, longitude: -103.7089, interstate: 'I-40', exitNumber: '335', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: false, hasDumpStation: false },
  
  // I-40 Texas
  { name: "Love's Travel Stop", brand: "Love's", address: '13001 I-40 E', city: 'Amarillo', state: 'TX', zipCode: '79118', latitude: 35.1814, longitude: -101.7139, interstate: 'I-40', exitNumber: '75', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: true, hasDumpStation: false },
  { name: 'Pilot Travel Center', brand: 'Pilot', address: '9101 I-40 E', city: 'Amarillo', state: 'TX', zipCode: '79118', latitude: 35.1823, longitude: -101.7458, interstate: 'I-40', exitNumber: '74', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: false, hasDumpStation: false },
  { name: 'TA Travel Center', brand: 'TA', address: '1600 E Amarillo Blvd', city: 'Amarillo', state: 'TX', zipCode: '79107', latitude: 35.2193, longitude: -101.8089, interstate: 'I-40', exitNumber: '71', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: false, hasDumpStation: true },
  
  // I-40 Oklahoma
  { name: 'Pilot Travel Center', brand: 'Pilot', address: '2101 S Country Club Rd', city: 'El Reno', state: 'OK', zipCode: '73036', latitude: 35.5034, longitude: -97.9628, interstate: 'I-40', exitNumber: '123', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: false, hasDumpStation: false },
  { name: "Love's Travel Stop", brand: "Love's", address: '7855 S Sooner Rd', city: 'Oklahoma City', state: 'OK', zipCode: '73135', latitude: 35.3842, longitude: -97.3967, interstate: 'I-40', exitNumber: '157', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: true, hasDumpStation: false },
  { name: 'Flying J Travel Center', brand: 'Flying J', address: '5500 Will Rogers Turnpike', city: 'Vinita', state: 'OK', zipCode: '74301', latitude: 36.6534, longitude: -95.1392, interstate: 'I-44', exitNumber: '289', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: true, hasDumpStation: true },
  
  // I-40 Arkansas
  { name: "Love's Travel Stop", brand: "Love's", address: '1520 Club Rd', city: 'Fort Smith', state: 'AR', zipCode: '72903', latitude: 35.3762, longitude: -94.4281, interstate: 'I-40', exitNumber: '7', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: true, hasDumpStation: false },
  { name: 'Pilot Travel Center', brand: 'Pilot', address: '4201 Phoenix Ave', city: 'Fort Smith', state: 'AR', zipCode: '72903', latitude: 35.3781, longitude: -94.4312, interstate: 'I-40', exitNumber: '7', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: false, hasDumpStation: false },
  { name: 'Flying J Travel Center', brand: 'Flying J', address: '4500 E Broadway', city: 'North Little Rock', state: 'AR', zipCode: '72117', latitude: 34.7956, longitude: -92.2123, interstate: 'I-40', exitNumber: '159', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: true, hasDumpStation: true },
  
  // I-40 Tennessee
  { name: 'Pilot Travel Center', brand: 'Pilot', address: '2400 S Highland Ave', city: 'Jackson', state: 'TN', zipCode: '38301', latitude: 35.5789, longitude: -88.8234, interstate: 'I-40', exitNumber: '80', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: false, hasDumpStation: false },
  { name: "Love's Travel Stop", brand: "Love's", address: '5055 Hacks Cross Rd', city: 'Memphis', state: 'TN', zipCode: '38125', latitude: 35.0234, longitude: -89.8567, interstate: 'I-40', exitNumber: '16', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: true, hasDumpStation: false },
  { name: 'TA Travel Center', brand: 'TA', address: '7021 Strawberry Plains Pike', city: 'Knoxville', state: 'TN', zipCode: '37924', latitude: 36.0123, longitude: -83.7891, interstate: 'I-40', exitNumber: '398', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: false, hasDumpStation: true },
  
  // I-40 North Carolina
  { name: 'Pilot Travel Center', brand: 'Pilot', address: '100 Starmount Rd', city: 'Asheville', state: 'NC', zipCode: '28806', latitude: 35.5612, longitude: -82.6234, interstate: 'I-40', exitNumber: '44', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: false, hasDumpStation: false },
  { name: "Love's Travel Stop", brand: "Love's", address: '6700 Statesville Rd', city: 'Charlotte', state: 'NC', zipCode: '28269', latitude: 35.3412, longitude: -80.8234, interstate: 'I-77', exitNumber: '16', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: true, hasDumpStation: false },

  // I-10 Texas
  { name: "Love's Travel Stop", brand: "Love's", address: '8701 Gateway Blvd W', city: 'El Paso', state: 'TX', zipCode: '79925', latitude: 31.7656, longitude: -106.3234, interstate: 'I-10', exitNumber: '28', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: true, hasDumpStation: false },
  { name: 'Pilot Travel Center', brand: 'Pilot', address: '1200 W Interstate 10', city: 'San Antonio', state: 'TX', zipCode: '78201', latitude: 29.4456, longitude: -98.5234, interstate: 'I-10', exitNumber: '566', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: false, hasDumpStation: false },
  { name: 'Flying J Travel Center', brand: 'Flying J', address: '18950 Katy Fwy', city: 'Houston', state: 'TX', zipCode: '77094', latitude: 29.7934, longitude: -95.6678, interstate: 'I-10', exitNumber: '751', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: true, hasDumpStation: true },
  
  // I-95 Florida
  { name: 'Pilot Travel Center', brand: 'Pilot', address: '3180 SR 207', city: 'St Augustine', state: 'FL', zipCode: '32086', latitude: 29.8234, longitude: -81.3012, interstate: 'I-95', exitNumber: '305', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: false, hasDumpStation: false },
  { name: "Love's Travel Stop", brand: "Love's", address: '2225 S Volusia Ave', city: 'Orange City', state: 'FL', zipCode: '32763', latitude: 28.9123, longitude: -81.2878, interstate: 'I-4', exitNumber: '114', hasDiesel: true, hasTruckParking: true, hasRVParking: true, hasRestrooms: true, hasShowers: true, hasRestaurant: true, hasStore: true, hasPropane: true, hasDumpStation: false },
];

// Sample Rest Stops along I-40
const restStops = [
  // Arizona
  { name: 'Meteor Crater Rest Area', state: 'AZ', latitude: 35.0289, longitude: -111.0234, interstate: 'I-40', direction: 'Both', mileMarker: 233, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: false, hasRVParking: true, hasDumpStation: false, hasWater: false, is24Hours: true },
  { name: 'Kingman Rest Area', state: 'AZ', latitude: 35.2234, longitude: -114.0678, interstate: 'I-40', direction: 'Eastbound', mileMarker: 48, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: false, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true },
  
  // New Mexico
  { name: 'Continental Divide Rest Area', state: 'NM', latitude: 35.4234, longitude: -108.3456, interstate: 'I-40', direction: 'Both', mileMarker: 47, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: false, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true, notes: 'At the Continental Divide - 7,245 ft elevation' },
  { name: 'Clines Corners Rest Area', state: 'NM', latitude: 35.0123, longitude: -105.5234, interstate: 'I-40', direction: 'Both', mileMarker: 218, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: true, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true },
  
  // Texas
  { name: 'Adrian Rest Area', state: 'TX', latitude: 35.2734, longitude: -102.6678, interstate: 'I-40', direction: 'Both', mileMarker: 22, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: false, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true, notes: 'Near the midpoint of Route 66' },
  { name: 'Conway Rest Area', state: 'TX', latitude: 35.0789, longitude: -101.3456, interstate: 'I-40', direction: 'Eastbound', mileMarker: 96, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: false, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true },
  
  // Oklahoma
  { name: 'Texola Rest Area', state: 'OK', latitude: 35.2134, longitude: -99.9678, interstate: 'I-40', direction: 'Westbound', mileMarker: 1, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: false, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true },
  { name: 'Sayre Rest Area', state: 'OK', latitude: 35.2789, longitude: -99.6234, interstate: 'I-40', direction: 'Both', mileMarker: 20, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: false, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true },
  { name: 'Oklahoma City Rest Area', state: 'OK', latitude: 35.4012, longitude: -97.5234, interstate: 'I-40', direction: 'Both', mileMarker: 149, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: true, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true },
  
  // Arkansas
  { name: 'Ozark Rest Area', state: 'AR', latitude: 35.4567, longitude: -93.8234, interstate: 'I-40', direction: 'Both', mileMarker: 35, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: false, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true },
  { name: 'Russellville Rest Area', state: 'AR', latitude: 35.2678, longitude: -93.1234, interstate: 'I-40', direction: 'Eastbound', mileMarker: 84, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: false, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true },
  
  // Tennessee
  { name: 'Memphis Rest Area', state: 'TN', latitude: 35.0456, longitude: -89.9123, interstate: 'I-40', direction: 'Eastbound', mileMarker: 12, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: true, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true },
  { name: 'Jackson Rest Area', state: 'TN', latitude: 35.6234, longitude: -88.8012, interstate: 'I-40', direction: 'Both', mileMarker: 82, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: false, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true },
  { name: 'Cookeville Rest Area', state: 'TN', latitude: 36.1345, longitude: -85.5012, interstate: 'I-40', direction: 'Both', mileMarker: 290, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: true, hasRVParking: true, hasDumpStation: true, hasWater: true, is24Hours: true },
  
  // North Carolina
  { name: 'Asheville Rest Area', state: 'NC', latitude: 35.5912, longitude: -82.5534, interstate: 'I-40', direction: 'Both', mileMarker: 55, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: true, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true },
  { name: 'Hickory Rest Area', state: 'NC', latitude: 35.7234, longitude: -81.3456, interstate: 'I-40', direction: 'Eastbound', mileMarker: 123, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: false, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true },
  
  // I-10 Rest Areas
  { name: 'Palm Springs Rest Area', state: 'CA', latitude: 33.8234, longitude: -116.5234, interstate: 'I-10', direction: 'Both', mileMarker: 117, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: false, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true },
  { name: 'Quartzsite Rest Area', state: 'AZ', latitude: 33.6612, longitude: -114.2234, interstate: 'I-10', direction: 'Both', mileMarker: 17, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: false, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true },
  { name: 'Texas Canyon Rest Area', state: 'AZ', latitude: 32.0234, longitude: -110.1234, interstate: 'I-10', direction: 'Both', mileMarker: 318, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: false, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true, notes: 'Scenic rock formations' },
  
  // I-95 Rest Areas
  { name: 'St. Johns Welcome Center', state: 'FL', latitude: 30.1234, longitude: -81.5234, interstate: 'I-95', direction: 'Both', mileMarker: 373, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: true, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true },
  { name: 'Savannah Rest Area', state: 'GA', latitude: 32.0123, longitude: -81.0234, interstate: 'I-95', direction: 'Both', mileMarker: 109, hasRestrooms: true, hasPicnicArea: true, hasPetArea: true, hasVending: true, hasWifi: false, hasRVParking: true, hasDumpStation: false, hasWater: true, is24Hours: true },
];

async function seedRoadtripData() {
  console.log('🚗 Seeding roadtrip data...');

  // Seed gas prices
  console.log('⛽ Seeding state gas prices...');
  for (const price of stateGasPrices) {
    await prisma.stateGasPrice.upsert({
      where: { stateCode: price.stateCode },
      update: { regularPrice: price.regularPrice, dieselPrice: price.dieselPrice },
      create: price,
    });
  }
  console.log(`   ✅ ${stateGasPrices.length} state gas prices seeded`);

  // Seed interstates
  console.log('🛣️ Seeding interstates...');
  for (const interstate of interstates) {
    await prisma.interstate.upsert({
      where: { name: interstate.name },
      update: interstate,
      create: interstate,
    });
  }
  console.log(`   ✅ ${interstates.length} interstates seeded`);

  // Seed gas stations
  console.log('⛽ Seeding gas stations...');
  for (const station of gasStations) {
    await prisma.gasStation.create({
      data: station,
    });
  }
  console.log(`   ✅ ${gasStations.length} gas stations seeded`);

  // Seed rest stops
  console.log('🅿️ Seeding rest stops...');
  for (const stop of restStops) {
    await prisma.restStop.create({
      data: stop,
    });
  }
  console.log(`   ✅ ${restStops.length} rest stops seeded`);

  console.log('🎉 Roadtrip data seeding complete!');
}

// Export for use in main seed file
export { seedRoadtripData };

// Run directly if called as script
if (require.main === module) {
  seedRoadtripData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
