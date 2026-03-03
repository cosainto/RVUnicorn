import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth.routes';
import postRoutes from './routes/post.routes';
import friendRoutes from './routes/friend.routes';
import recipeRoutes from './routes/recipe.routes';
import gearRoutes from './routes/gear.routes';
import mapRoutes from './routes/map.routes';
import rvRoutes from './routes/rv.routes';
import tripRoutes from './routes/trip.routes';
import campgroundRoutes from './routes/campground.routes';
import campsiteRoutes from './routes/campsite.routes';
import maintenanceRoutes from './routes/maintenance.routes';
import borrowRoutes from './routes/borrow.routes';
import stickerRoutes from './routes/sticker.routes';
import jobRoutes from './routes/job.routes';
import communityRoutes from './routes/community.routes';
import checkinRoutes from './routes/checkin.routes';
import eventAccessRoutes from './event-access.routes';
import onboardingRoutes from './onboarding.routes';
import tripCommentsRoutes from './trip-comments.routes';
import mediaAlbumsRoutes from './media-albums.routes';
import campgroundMessagingRoutes from "./campground-messaging.routes";
import calendarRoutes from './calendar.routes';

dotenv.config();

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check route
app.get('/', (req, res) => {
  res.json({ message: 'KindleTribe API is running!' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/gear', gearRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/rv', rvRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/events', tripRoutes);
app.use('/api/events', tripCommentsRoutes);
app.use('/api/events', eventAccessRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/campgrounds', campgroundRoutes);
app.use('/api/campsite', campsiteRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/borrow', borrowRoutes);
app.use('/api/stickers', stickerRoutes);
app.use("/api/campground-messaging", campgroundMessagingRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/media-albums', mediaAlbumsRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
