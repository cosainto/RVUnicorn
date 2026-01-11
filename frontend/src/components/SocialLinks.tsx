import { useState, useEffect } from 'react';
import { Facebook, Instagram, Youtube, Link, Edit2, Twitter, Save } from 'lucide-react';
import api from '../services/api';

interface SocialLinksProps {
  profile?: {
    id: string;
    username: string;
    facebookUrl?: string;
    instagramUrl?: string;
    tiktokUrl?: string;
    redditUrl?: string;
    youtubeUrl?: string;
    twitterUrl?: string;
    blueskyUrl?: string;
  } | null;
  isOwnProfile: boolean;
  onUpdate?: () => void;
}

const PLATFORMS = [
  { key: 'facebookUrl', label: 'Facebook', icon: Facebook, baseUrl: 'https://facebook.com/', placeholder: 'username' },
  { key: 'instagramUrl', label: 'Instagram', icon: Instagram, baseUrl: 'https://instagram.com/', placeholder: 'username' },
  { key: 'youtubeUrl', label: 'YouTube', icon: Youtube, baseUrl: 'https://youtube.com/@', placeholder: 'channel' },
  { key: 'tiktokUrl', label: 'TikTok', icon: Link, baseUrl: 'https://tiktok.com/@', placeholder: 'username' },
  { key: 'redditUrl', label: 'Reddit', icon: Link, baseUrl: 'https://reddit.com/u/', placeholder: 'username' },
  { key: 'twitterUrl', label: 'Twitter/X', icon: Twitter, baseUrl: 'https://x.com/', placeholder: 'username' },
  { key: 'blueskyUrl', label: 'Bluesky', icon: Link, baseUrl: 'https://bsky.app/profile/', placeholder: 'handle.bsky.social' },
];

// Clean up the handle - remove @ symbol, URLs, and whitespace
const cleanHandle = (value: string): string => {
  if (!value) return '';
  
  let handle = value.trim();
  
  // Remove @ prefix if present
  handle = handle.replace(/^@/, '');
  
  // If it's a full URL, extract just the handle
  // Match common patterns like https://instagram.com/username or instagram.com/username
  const urlPatterns = [
    /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(.+)/i,
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(.+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/@?(.+)/i,
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@?(.+)/i,
    /(?:https?:\/\/)?(?:www\.)?reddit\.com\/u\/(.+)/i,
    /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/(.+)/i,
    /(?:https?:\/\/)?bsky\.app\/profile\/(.+)/i,
  ];
  
  for (const pattern of urlPatterns) {
    const match = handle.match(pattern);
    if (match) {
      handle = match[1];
      break;
    }
  }
  
  // Remove trailing slashes
  handle = handle.replace(/\/+$/, '');
  
  return handle;
};

// Build the full URL for a platform
const buildUrl = (handle: string, baseUrl: string): string => {
  if (!handle) return '';
  
  // If it's already a full URL, return as-is
  if (handle.startsWith('http://') || handle.startsWith('https://')) {
    return handle;
  }
  
  // Clean the handle and build URL
  const cleanedHandle = cleanHandle(handle);
  return `${baseUrl}${cleanedHandle}`;
};

export default function SocialLinks({ profile, isOwnProfile, onUpdate }: SocialLinksProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    facebookUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
    redditUrl: '',
    youtubeUrl: '',
    twitterUrl: '',
    blueskyUrl: '',
  });

  // Update form data when profile changes
  useEffect(() => {
    if (profile) {
      setFormData({
        facebookUrl: profile.facebookUrl || '',
        instagramUrl: profile.instagramUrl || '',
        tiktokUrl: profile.tiktokUrl || '',
        redditUrl: profile.redditUrl || '',
        youtubeUrl: profile.youtubeUrl || '',
        twitterUrl: profile.twitterUrl || '',
        blueskyUrl: profile.blueskyUrl || '',
      });
    }
  }, [profile]);

  if (!profile) {
    return null;
  }

  const activePlatforms = PLATFORMS.filter((platform) => {
    const value = profile[platform.key as keyof typeof profile];
    return value && String(value).trim() !== '';
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Clean up handles before saving
      const cleanedData: Record<string, string> = {};
      PLATFORMS.forEach(platform => {
        const value = formData[platform.key as keyof typeof formData];
        cleanedData[platform.key] = cleanHandle(value);
      });
      
      await api.put(`/profile/${profile.username}`, cleanedData);
      setIsEditing(false);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Update social links error:', error);
      alert('Failed to update social links');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    // Clean the handle as user types (remove @ prefix, extract from URLs)
    const cleanedValue = cleanHandle(value);
    setFormData({ ...formData, [key]: cleanedValue });
  };

  if (!isEditing && activePlatforms.length === 0 && !isOwnProfile) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">Social Links</h2>
        {isOwnProfile && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="p-2 hover:bg-gray-100 rounded-full transition"
            title="Edit social links"
          >
            <Edit2 className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {!isEditing ? (
        activePlatforms.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {activePlatforms.map((platform) => {
              const Icon = platform.icon;
              const handle = profile[platform.key as keyof typeof profile] as string;
              const fullUrl = buildUrl(handle, platform.baseUrl);
              
              return (
                <a
                  key={platform.key}
                  href={fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                  title={`Visit ${platform.label}`}
                >
                  <Icon className="w-5 h-5 text-gray-700" />
                  <span className="text-sm font-medium text-gray-700">{platform.label}</span>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600">
            <Link className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-sm">No social links added yet</p>
            {isOwnProfile && (
              <button
                onClick={() => setIsEditing(true)}
                className="btn btn-primary btn-sm mt-3"
              >
                Add Social Links
              </button>
            )}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {PLATFORMS.map((platform) => {
            const Icon = platform.icon;
            // Extract display prefix from baseUrl (remove https://)
            const displayPrefix = platform.baseUrl.replace('https://', '');
            
            return (
              <div key={platform.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {platform.label}
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 text-sm text-gray-500 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md whitespace-nowrap">
                    {displayPrefix}
                  </span>
                  <input
                    type="text"
                    value={formData[platform.key as keyof typeof formData]}
                    onChange={(e) => handleInputChange(platform.key, e.target.value)}
                    placeholder={platform.placeholder}
                    className="input rounded-l-none flex-1 min-w-0"
                  />
                </div>
              </div>
            );
          })}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Links'}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setFormData({
                  facebookUrl: profile.facebookUrl || '',
                  instagramUrl: profile.instagramUrl || '',
                  tiktokUrl: profile.tiktokUrl || '',
                  redditUrl: profile.redditUrl || '',
                  youtubeUrl: profile.youtubeUrl || '',
                  twitterUrl: profile.twitterUrl || '',
                  blueskyUrl: profile.blueskyUrl || '',
                });
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
