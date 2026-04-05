# Event System V2 Spec — Advanced Features

## RIG-AWARE CHECKLIST
- On RSVP, query user's RV profile (class, rig size, has_oven, has_grill, etc.)
- Hitch suggests checklist items based on rig capabilities
- "Claiming a slot" system — one person claims lasagna, another claims drinks
- Prevents duplicate contributions automatically

## GEO-FENCE HERE_NOW
- Official events get a geo-fence radius (default 0.5 miles, organizer adjustable)
- When user GPS enters radius during event window → silent push from Hitch:
  "Welcome to [Event]! Tap to check in and see who's here"
- Auto-sets RSVP status to HERE_NOW
- Uses existing geolocation infrastructure from Driving Mode + check-in system

## LEGACY EVENT → TRIP MEMORY
- 24 hours after event end time, Micro-Basecamp transitions automatically
- Remove: live chat, who's bringing what list, RSVP buttons
- Add: shared photo gallery (pull from tagged photos at that campground/date range)
- Add: attendee follow suggestions ("You camped with Sarah — follow her trips?")
- Add: "See you next time" section showing if any attendees have future trips nearby
- Memory persists on user profiles and campground page permanently

## OFFLINE CACHING
- "Save for Offline" auto-triggers when user RSVPs as GOING
- Locally caches: event schedule, packing list, campground map, sub-events, organizer contact
- Cache updates sync when connection restored
- Offline banner shows when rendering from cache: "Offline — last synced 2h ago"

## CAPACITY + WAITLIST
- Organizer sets maxAttendees (optional)
- When full: RSVP button becomes "Join Waitlist"
- Hitch manages queue messaging: "You're #3 on the waitlist — I'll holler if a spot opens!"
- Auto-notify next in line when someone drops

## WEATHER CONTINGENCY
- Outdoor events auto-monitored by existing weather system
- If rain/severe weather forecast within event window → alert organizer
- Hitch prompts: "Rain's coming Saturday — want to add a Plan B location?"
- Organizer can add contingency plan visible to all RSVPed attendees
- Push notification to attendees if Plan B activates
