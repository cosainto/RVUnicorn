
const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
const limit = parseInt(process.argv[2] || '500');
p.campground.findMany({
  select: {
    id:true,name:true,state:true,city:true,location:true,description:true,
    latitude:true,longitude:true,siteType:true,activities:true,pricePerNight:true,
    maxRvLength:true,maxAmpService:true,isPetFriendly:true,isWaterfront:true,
    isBigRigFriendly:true,hasPullThrough:true,hasFullHookups:true,
    hasElectricHookup:true,hasWaterHookup:true,hasSewerHookup:true,hasWifi:true,
    hasShowers:true,hasRestrooms:true,hasLaundry:true,hasPool:true,
    hasDumpStation:true,hasPropane:true,hasStore:true,hasCableTV:true,
    hasBackIn:true,seasonStart:true,seasonEnd:true,googleRating:true,
    googleReviewCount:true,websiteUrl:true,
  },
  take: 16159,
  orderBy: { name: 'asc' }
}).then(async camps => {
  const short = camps.filter(c => {
    if (!c.description) return true;
    if (c.description.includes('Hitch')) return false;
    const s = c.description.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return s.length < 7;
  }).slice(0, limit);
  console.log(JSON.stringify(short));
  await p.$disconnect();
}).catch(e => { console.error(e.message); process.exit(1); });
