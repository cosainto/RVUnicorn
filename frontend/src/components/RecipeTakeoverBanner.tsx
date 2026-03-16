import { useState } from "react";
import { Camera, X, Upload, ChefHat } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

interface Props {
  recipeId: string;
  recipeTitle: string;
  imageType: "ai" | "user";
  hitchMessage?: string;
  officialImageUrl?: string;
  onPhotoSubmitted?: () => void;
}

export default function RecipeTakeoverBanner({ recipeId, recipeTitle, imageType, hitchMessage, officialImageUrl, onPhotoSubmitted }: Props) {
  const { user } = useAuth();
  const [showUpload, setShowUpload] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (imageType === "user" && officialImageUrl) return (
    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
      <ChefHat className="w-4 h-4 shrink-0" />
      <span>This is a real campsite photo from the RVUnicorn community! 🏕️</span>
    </div>
  );

  if (submitted) return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-center gap-2">
      <span>📸 Photo submitted for review! If approved, you'll earn the Camp Kitchen badge 🏕️</span>
    </div>
  );

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl overflow-hidden">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <span className="text-lg shrink-0">🦄</span>
            <p className="text-xs text-amber-800 leading-relaxed">{hitchMessage || "Hitch made this with AI — cook it yourself and upload the real thing to earn the Camp Kitchen badge!"}</p>
          </div>
          <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {user && !showUpload && (
          <button onClick={() => setShowUpload(true)}
            className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg transition w-full justify-center">
            <Camera className="w-3.5 h-3.5" />
            📸 Upload Your Campsite Version
          </button>
        )}

        {showUpload && (
          <div className="mt-3 space-y-2">
            <input type="url" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)}
              placeholder="Paste your photo URL (Cloudinary, imgur, etc.)"
              className="w-full text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-orange-400" />
            <input type="text" value={caption} onChange={e => setCaption(e.target.value)}
              placeholder="Caption (optional)"
              className="w-full text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-orange-400" />
            <div className="flex gap-2">
              <button onClick={async () => {
                if (!photoUrl.trim()) return;
                setSubmitting(true);
                try {
                  await api.post(`/recipes/${recipeId}/submit-photo`, { photoUrl, caption });
                  setSubmitted(true);
                  setShowUpload(false);
                  if (onPhotoSubmitted) onPhotoSubmitted();
                } catch { alert("Failed to submit"); }
                finally { setSubmitting(false); }
              }} disabled={!photoUrl.trim() || submitting}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 disabled:opacity-40 transition">
                <Upload className="w-3 h-3" />
                {submitting ? "Submitting..." : "Submit for Review"}
              </button>
              <button onClick={() => setShowUpload(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
