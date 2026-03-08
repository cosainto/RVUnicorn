
const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
const limit = parseInt(process.argv[2] || '100');
const offset = parseInt(process.argv[3] || '0');
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
  take: limit, skip: offset, orderBy: { name: 'asc' }
}).then(async camps => {
  const short = camps.filter(c => {
    if (!c.description) return true;
    const s = c.description.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return s.length < 7;
  });
  console.log(JSON.stringify(short));
  await p.$disconnect();
}).catch(e => { console.error(e.message); process.exit(1); });
