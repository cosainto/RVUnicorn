# Feed Enhancement Notes

## What was changed

### Frontend (`frontend/src/pages/FeedPage.tsx`)
- Complete rewrite with Reddit-style layout
- Vote arrows (up/down) on every thread card
- Sort options: Hot / New / Top / Rising (replaces old 5-tab system)
- "My Feed" toggle filter that works with any sort
- Active trip banner when you're camping somewhere
- Right sidebar: Community stats, Trending hashtags, Browse by topic
- Improved thread cards with feed reason badges, tags with icons, content preview
- Better new thread composer with campground autocomplete
- Infinite scroll / load more pagination

### Backend (`backend/src/routes/threads.routes.ts`)
- Added `POST /threads/:id/vote` for thread-level upvote/downvote
- Added `getThreadScore()` and `enrichThreadsWithScores()` helpers
- Threads now return `score` and `userVote` fields
- Added `GET /threads/active-trip` for current campground detection

### Database (`backend/prisma/schema.prisma`)
- Added `ThreadVote` model with UP/DOWN vote types
- Added relations to Thread and User models

## Next Steps

1. Run Prisma migration:
   ```bash
   cd backend && npx prisma db push
   ```

2. Restart backend:
   ```bash
   cd backend && npm run dev
   ```

3. If `/api/trips/active` returns 404, you may need to add a route in your
   trips or stateVisit routes that returns the user's current active trip
   with campground info. The FeedPage handles this gracefully (no banner shown).

4. Test the feed:
   - Vote on threads (up/down arrows)
   - Toggle "My Feed" filter
   - Switch between Hot/New/Top/Rising sorts
   - Create a new thread with campground + tags
   - Check sidebar for trending hashtags

5. Push to production:
   ```bash
   git add -A && git commit -m "Enhanced Reddit-style feed with voting, sorting, sidebar" && git push origin main
   ```
