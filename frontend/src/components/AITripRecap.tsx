import { useState } from "react";
import { Sparkles, Share2, Copy, Check } from "lucide-react";
import api from "../services/api";

interface AITripRecapProps {
  tripId: string;
  tripTitle: string;
  campgroundName?: string;
  startDate: string;
  endDate: string;
  attendeeCount?: number;
  checkInCount?: number;
  photoCount?: number;
  activities?: string[];
}

export default function AITripRecap({ tripId, tripTitle, campgroundName, startDate, endDate, attendeeCount, checkInCount, photoCount, activities }: AITripRecapProps) {
  const [recap, setRecap] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateRecap = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/hitch/trip-recap", {
        tripId, tripTitle, campgroundName, startDate, endDate,
        attendeeCount, checkInCount, photoCount, activities,
      });
      setRecap(data.recap || "");
      setGenerated(true);
    } catch {
      setRecap("Could not generate recap. Try again!");
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  };

  const copyRecap = () => {
    navigator.clipboard.writeText(recap);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareRecap = () => {
    navigator.share?.({ text: recap, title: tripTitle }) || copyRecap();
  };

  if (!generated) return (
    <button onClick={generateRecap} disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition">
      {loading
        ? <><span className="animate-spin">🦄</span> Generating recap...</>
        : <><Sparkles className="w-4 h-4" /> Generate Trip Recap</>
      }
    </button>
  );

  return (
    <div className="bg-gradient-to-br from-primary-50 to-purple-50 rounded-2xl border border-primary-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🦄</span>
          <p className="font-bold text-primary-800 text-sm">Your Trip Recap</p>
        </div>
        <div className="flex gap-2">
          <button onClick={copyRecap} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 transition font-medium">
            {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </button>
          <button onClick={shareRecap} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 transition font-medium">
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{recap}</p>
      <button onClick={() => { setGenerated(false); setRecap(""); }}
        className="text-xs text-primary-500 hover:text-primary-700 transition">
        Regenerate
      </button>
    </div>
  );
}
