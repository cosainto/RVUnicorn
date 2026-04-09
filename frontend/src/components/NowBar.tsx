import { Calendar, Package, Navigation, Flame, Camera, Star } from 'lucide-react';
import { type TripState } from '../hooks/useTripState';

interface Props {
  tripState: TripState;
  stateLabel: string;
  stateEmoji: string;
  stateColor: string;
  daysUntilTrip: number;
  hoursUntilTrip: number;
  distanceMiles: number | null;
  // Data from the trip
  eventTitle: string;
  campgroundName?: string;
  attendeeCount: number;
  packTotal?: number;
  packDone?: number;
  nextScheduleItem?: string;
  nextScheduleTime?: string;
  photoCount?: number;
  mealCount?: number;
  // Echo-state actions — wired by the parent so this component stays
  // presentational. Both are optional so callers that don't care about
  // the post-trip survey/scrapbook flow can leave them out.
  onOpenScrapbook?: () => void;
  onOpenSurvey?: () => void;
}

export default function NowBar({
  tripState, stateLabel, stateEmoji, stateColor,
  daysUntilTrip, hoursUntilTrip, distanceMiles,
  eventTitle, campgroundName, attendeeCount,
  packTotal = 0, packDone = 0,
  nextScheduleItem, nextScheduleTime,
  photoCount = 0, mealCount = 0,
  onOpenScrapbook, onOpenSurvey,
}: Props) {

  return (
    <div className={`sticky top-0 z-40 bg-gradient-to-r ${stateColor} text-white shadow-lg`}>
      <div className="max-w-3xl mx-auto px-4 py-3">
        {/* State badge + title */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-lg">{stateEmoji}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">{stateLabel}</span>
          </div>
          <span className="text-xs text-white/60 truncate max-w-[50%]">{eventTitle}</span>
        </div>

        {/* State-specific content */}
        {tripState === 'blueprint' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-lg px-3 py-1.5 text-center">
                <p className="text-xl font-bold">{daysUntilTrip}</p>
                <p className="text-[9px] text-white/70">days away</p>
              </div>
              <div>
                <p className="text-sm font-semibold">{campgroundName || 'Planning phase'}</p>
                <p className="text-[10px] text-white/70">{attendeeCount} camper{attendeeCount !== 1 ? 's' : ''} going</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-white/70">
              <Calendar className="w-3 h-3" />
              <span>Route & bookings</span>
            </div>
          </div>
        )}

        {tripState === 'load-out' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-lg px-3 py-1.5 text-center">
                <p className="text-xl font-bold">{hoursUntilTrip < 48 ? `${hoursUntilTrip}h` : `${daysUntilTrip}d`}</p>
                <p className="text-[9px] text-white/70">to go</p>
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {packTotal > 0 ? `${packDone}/${packTotal} packed` : 'Time to prep!'}
                </p>
                <p className="text-[10px] text-white/70">
                  {packTotal - packDone > 0 ? `${packTotal - packDone} items remaining` : 'All packed!'}
                  {mealCount > 0 ? ` · ${mealCount} meals planned` : ''}
                </p>
              </div>
            </div>
            <div className="bg-white/20 rounded-full h-8 w-8 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
        )}

        {tripState === 'in-motion' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-lg px-3 py-1.5 text-center">
                <p className="text-xl font-bold">{distanceMiles ? `${Math.round(distanceMiles)}` : '—'}</p>
                <p className="text-[9px] text-white/70">miles</p>
              </div>
              <div>
                <p className="text-sm font-semibold">Heading to {campgroundName || 'camp'}</p>
                <p className="text-[10px] text-white/70">
                  {distanceMiles && distanceMiles < 50 ? 'Almost there!' : 'Enjoy the drive'}
                </p>
              </div>
            </div>
            <div className="bg-white/20 rounded-full h-8 w-8 flex items-center justify-center">
              <Navigation className="w-4 h-4" />
            </div>
          </div>
        )}

        {tripState === 'on-site' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-lg px-2.5 py-1.5">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {nextScheduleItem ? `Next: ${nextScheduleItem}` : `You're at ${campgroundName || 'camp'}!`}
                </p>
                <p className="text-[10px] text-white/70">
                  {nextScheduleTime ? `${nextScheduleTime}` : `${attendeeCount} camper${attendeeCount !== 1 ? 's' : ''} here`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-white/20 rounded-lg px-2.5 py-1.5 text-[10px] font-bold">
              <span>{attendeeCount}</span>
              <span className="text-white/70">here</span>
            </div>
          </div>
        )}

        {tripState === 'echo' && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-lg px-2.5 py-1.5 flex-shrink-0">
                <Camera className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Trip complete!</p>
                <p className="text-[10px] text-white/70">
                  {photoCount > 0 ? `${photoCount} photos` : 'Share your photos & how it went'}
                  {attendeeCount > 0 ? ` · ${attendeeCount} campers went` : ''}
                </p>
              </div>
            </div>
            {/* Real action buttons — these used to be inert spans, which is
                why the banner links never did anything. Both buttons are
                wired by TripDetailPage. */}
            <div className="flex items-center gap-2">
              {onOpenScrapbook && (
                <button
                  type="button"
                  onClick={onOpenScrapbook}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 transition rounded-lg px-3 py-1.5 text-[11px] font-bold"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scrapbook</span>
                </button>
              )}
              {onOpenSurvey && (
                <button
                  type="button"
                  onClick={onOpenSurvey}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white text-purple-700 hover:bg-white/90 transition rounded-lg px-3 py-1.5 text-[11px] font-bold"
                >
                  <Star className="w-3.5 h-3.5" />
                  <span>How was it?</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
