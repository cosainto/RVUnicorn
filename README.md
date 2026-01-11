# KindleTribe MVP

An invite-only camping social network platform.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- Git

### Installation

1. **Clone and setup**
```bash
cd kindletribe-mvp
npm run setup
```

2. **Configure environment variables**
```bash
# Copy example env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` with your database credentials:
```
DATABASE_URL="postgresql://user:password@localhost:5432/kindletribe"
JWT_SECRET="your-super-secret-jwt-key-change-this"
PORT=3001
```

3. **Initialize database**
```bash
cd backend
npm run db:migrate
npm run db:seed
```

4. **Start the application**

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

5. **Access the app**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Default Test Users

After seeding, you can login with:
- **Super Admin**: admin@kindletribe.com / password123
- **User 1**: user1@kindletribe.com / password123
- **User 2**: user2@kindletribe.com / password123

## 📁 Project Structure

```
kindletribe-mvp/
├── backend/          # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── types/
│   ├── prisma/
│   └── package.json
├── frontend/         # React + TypeScript + Tailwind
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── types/
│   └── package.json
└── README.md
```

## 🎯 MVP Features

- ✅ User authentication (JWT)
- ✅ Invite-only system
- ✅ User profiles with RV info
- ✅ Campground pages
- ✅ Stay verification
- ✅ Friend connections
- ✅ Basic feed/forum posts
- ✅ Travel map (state tracking)
- ✅ Search campgrounds

## 🔧 Development Scripts

### Backend
```bash
npm run dev          # Start dev server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database with test data
npm run db:studio    # Open Prisma Studio (DB GUI)
```

### Frontend
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## 🗄️ Database Schema

Key tables:
- users (profiles, RV info)
- invites (invite codes)
- campgrounds (locations, amenities)
- stays (verified visits)
- friendships (connections)
- posts (forum content)
- comments (post responses)

## 🚢 Deployment

### Backend
1. Set up PostgreSQL database
2. Set environment variables
3. Run migrations: `npm run db:migrate`
4. Build: `npm run build`
5. Start: `npm run start`

### Frontend
1. Build: `npm run build`
2. Serve the `dist` folder with any static host (Vercel, Netlify, etc.)

## 📝 Next Steps

Phase 2 features to add:
- Real-time chat (Socket.io already configured)
- Marketplace
- Events system
- Advanced moderation
- Image uploads (S3)
- Email notifications
- Mobile responsive improvements

## 🐛 Troubleshooting

**Database connection issues:**
- Verify PostgreSQL is running
- Check DATABASE_URL in backend/.env
- Ensure database exists: `createdb kindletribe`

**Port conflicts:**
- Change PORT in backend/.env
- Change port in frontend/vite.config.ts

**Module not found errors:**
- Run `npm install` in both backend and frontend directories

## 📄 License

MIT License - Free to use and modify
