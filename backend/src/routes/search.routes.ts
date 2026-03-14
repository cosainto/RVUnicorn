import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const authenticateToken = (req: Request, res: Response, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET, (err: any, decoded: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    (req as any).userId = decoded.userId;
    next();
  });
};

async function parseSearchQuery(query: string) {
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 500,
      system: `Parse search queries for an RV/camping platform. Return ONLY valid JSON:
{"type":["campgrounds","users","recipes","events"],"campgroundFilters":{"state":null,"hasFullHookups":null,"hasElectricHookup":null,"hasWifi":null,"hasPool":null,"hasShowers":null,"isPetFriendly":null,"isWaterfront":null,"isBigRigFriendly":null,"hasPullThrough":null,"maxPricePerNight":null,"minRating":null},"userFilters":{"rvType":null,"location":null},"recipeFilters":{"category":null},"eventFilters":{"location":null},"keywords":["word1"],"aiSummary":"brief description"}`,
      messages: [{ role: 'user', content: `Parse: "${query}"` }],
    });
    const text = resp.content[0].type === 'text' ? resp.content[0].text : '{}';
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return { type: ['campgrounds','users','recipes','events'], campgroundFilters: {}, userFilters: {}, recipeFilters: {}, eventFilters: {}, keywords: query.split(' '), aiSummary: query };
  }
}

router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim();
    const page = parseInt(req.query.page as string) || 1;
    const limit = 10;
    if (!query) return res.json({ results: {}, parsed: null });

    const parsed = await parseSearchQuery(query);
    const kw = parsed.keywords?.length > 0 ? parsed.keywords : query.split(' ').filter((w: string) => w.length > 2);
    const kwSearch = kw.join(' ');
    const results: any = {};

    if (parsed.type?.includes('campgrounds')) {
      const w: any = {};
      const cf = parsed.campgroundFilters || {};
      if (cf.state) w.state = { contains: cf.state, mode: 'insensitive' };
      if (cf.hasFullHookups) w.hasFullHookups = true;
      if (cf.hasElectricHookup) w.hasElectricHookup = true;
      if (cf.hasWifi) w.hasWifi = true;
      if (cf.hasPool) w.hasPool = true;
      if (cf.hasShowers) w.hasShowers = true;
      if (cf.isPetFriendly) w.isPetFriendly = true;
      if (cf.isWaterfront) w.isWaterfront = true;
      if (cf.isBigRigFriendly) w.isBigRigFriendly = true;
      if (cf.hasPullThrough) w.hasPullThrough = true;
      if (cf.maxPricePerNight) w.pricePerNight = { lte: cf.maxPricePerNight };
      if (cf.minRating) w.googleRating = { gte: cf.minRating };
      if (kwSearch && !cf.state) w.OR = [{ name:{contains:kwSearch,mode:'insensitive'} },{ location:{contains:kwSearch,mode:'insensitive'} },{ state:{contains:kwSearch,mode:'insensitive'} }];
      const items = await prisma.campground.findMany({ where:w, take:limit, skip:(page-1)*limit, orderBy:[{googleRating:'desc'}], select:{id:true,name:true,location:true,state:true,description:true,imageUrl:true,googleRating:true,pricePerNight:true,hasFullHookups:true,hasWifi:true,isPetFriendly:true,isWaterfront:true,isBigRigFriendly:true,hasPullThrough:true,maxRvLength:true,maxAmpService:true,hasElectricHookup:true,hasWaterHookup:true,hasSewerHookup:true,hasPool:true,hasShowers:true} });
      const total = await prisma.campground.count({ where: w });
      results.campgrounds = { items, total };
    }

    if (parsed.type?.includes('users')) {
      const w: any = { OR:[{firstName:{contains:kwSearch,mode:'insensitive'}},{lastName:{contains:kwSearch,mode:'insensitive'}},{username:{contains:kwSearch,mode:'insensitive'}}] };
      const items = await prisma.user.findMany({ where:w, take:limit, skip:(page-1)*limit, select:{id:true,firstName:true,lastName:true,username:true,profilePicture:true,bio:true,rvMake:true,rvModel:true,rvType:true,isCreator:true,creatorVerified:true} });
      const total = await prisma.user.count({ where: w });
      results.users = { items, total };
    }

    if (parsed.type?.includes('recipes')) {
      const w: any = { isPublic:true, OR:[{title:{contains:kwSearch,mode:'insensitive'}},{description:{contains:kwSearch,mode:'insensitive'}},{category:{contains:kwSearch,mode:'insensitive'}}] };
      const items = await prisma.recipe.findMany({ where:w, take:limit, skip:(page-1)*limit, orderBy:{createdAt:'desc'}, select:{id:true,title:true,description:true,imageUrl:true,category:true,difficulty:true,prepTime:true,cookTime:true,user:{select:{id:true,firstName:true,lastName:true,username:true}}} }).catch(()=>[]);
      const total = await prisma.recipe.count({ where:w }).catch(()=>0);
      results.recipes = { items:items||[], total };
    }

    if (parsed.type?.includes('events')) {
      const w: any = { OR:[{title:{contains:kwSearch,mode:'insensitive'}},{description:{contains:kwSearch,mode:'insensitive'}},{location:{contains:kwSearch,mode:'insensitive'}}] };
      const items = await prisma.event.findMany({ where:w, take:limit, skip:(page-1)*limit, orderBy:{startDate:'desc'}, select:{id:true,title:true,description:true,location:true,startDate:true,coverImage:true,host:{select:{id:true,firstName:true,lastName:true,username:true}},_count:{select:{attendees:true}}} }).catch(()=>[]);
      const total = await prisma.event.count({ where:w }).catch(()=>0);
      results.events = { items:items||[], total };
    }

    res.json({ results, parsed: { aiSummary: parsed.aiSummary, type: parsed.type } });
  } catch (error) { console.error('Search error:', error); res.status(500).json({ error: 'Search failed' }); }
});

router.get('/quick', authenticateToken, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q || q.length < 2) return res.json({ results: [] });
    const [camps, users] = await Promise.all([
      prisma.campground.findMany({ where:{OR:[{name:{contains:q,mode:'insensitive'}},{location:{contains:q,mode:'insensitive'}}]}, select:{id:true,name:true,location:true,state:true,imageUrl:true}, take:5 }),
      prisma.user.findMany({ where:{OR:[{firstName:{contains:q,mode:'insensitive'}},{lastName:{contains:q,mode:'insensitive'}},{username:{contains:q,mode:'insensitive'}}]}, select:{id:true,firstName:true,lastName:true,username:true,profilePicture:true}, take:5 }),
    ]);
    res.json({ results: [
      ...camps.map(c => ({type:'campground',id:c.id,title:c.name,subtitle:`${c.location}${c.state?`, ${c.state}`:''}`,image:c.imageUrl,link:`/campgrounds/${c.id}`})),
      ...users.map(u => ({type:'user',id:u.id,title:`${u.firstName} ${u.lastName}`,subtitle:`@${u.username}`,image:u.profilePicture,link:`/profile/${u.username}`})),
    ]});
  } catch { res.json({ results: [] }); }
});

export default router;
