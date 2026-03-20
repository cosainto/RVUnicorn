interface Props {
  content: string;
  metadata: {
    winnerName: string;
    winnerUsername: string;
    campgroundName: string;
    campgroundCity?: string;
    campgroundState?: string;
    campgroundImage?: string;
    totalPoints: number;
    correctAnswers: number;
    character: string;
    imageUrl?: string;
  };
}

const CHARACTER_EMOJIS: Record<string, string> = {
  hitch: '🦄', walter: '🎭', rose: '🌹', diesel: '🚛', scout: '🌲', luna: '🌙', pebble: '🪨',
};

export default function CampfireWinnerCard({ content, metadata }: Props) {
  const lines = content.split('\n').filter(Boolean);
  const proclamation = lines.slice(3).join(' ').trim();
  const charEmoji = CHARACTER_EMOJIS[metadata.character] || '🏆';

  return (
    <div className="rounded-2xl overflow-hidden border border-amber-300"
      style={{ background: 'linear-gradient(135deg, #1a0f00, #2d1a00, #1a0f00)' }}>

      {/* Campground image header */}
      {metadata.campgroundImage && (
        <div className="relative h-32 overflow-hidden">
          <img src={metadata.campgroundImage} className="w-full h-full object-cover opacity-60" alt="" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a0f00] to-transparent" />
          <div className="absolute bottom-2 left-3 text-xs text-amber-300 font-medium">
            📍 {metadata.campgroundName}{metadata.campgroundCity ? ` · ${metadata.campgroundCity}, ${metadata.campgroundState}` : ''}
          </div>
        </div>
      )}

      {/* Winner section */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🏆</span>
          <div>
            <div className="text-amber-400 font-bold text-sm uppercase tracking-wide">Campfire Trivia Champion</div>
            <div className="text-amber-600 text-xs">Weekly Winner</div>
          </div>
          <div className="ml-auto text-2xl">{charEmoji}</div>
        </div>

        {/* Winner name */}
        <div className="text-center py-3">
          <div className="text-white text-2xl font-bold mb-1">{metadata.winnerName}</div>
          <div className="text-amber-400 text-sm">@{metadata.winnerUsername}</div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 my-3">
          <div className="bg-amber-900/30 border border-amber-800/40 rounded-xl p-3 text-center">
            <div className="text-amber-300 text-xl font-bold">{metadata.totalPoints}</div>
            <div className="text-amber-600 text-xs">Total Points</div>
          </div>
          <div className="bg-amber-900/30 border border-amber-800/40 rounded-xl p-3 text-center">
            <div className="text-amber-300 text-xl font-bold">{metadata.correctAnswers}</div>
            <div className="text-amber-600 text-xs">Correct Answers</div>
          </div>
        </div>

        {/* Character proclamation */}
        {proclamation && (
          <div className="bg-amber-900/20 border border-amber-800/30 rounded-xl px-4 py-3 mt-2">
            <p className="text-amber-200 text-xs leading-relaxed italic">{proclamation}</p>
          </div>
        )}

        {/* Badge */}
        <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-amber-900/40">
          {metadata.imageUrl && <img src={metadata.imageUrl} className="w-8 h-8 rounded-full object-cover" alt="Champion badge" />}
          <span className="text-amber-400 text-xs font-medium">Campfire Champion Badge Earned!</span>
        </div>
      </div>
    </div>
  );
}
