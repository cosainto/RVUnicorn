import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import MentionInput, { RenderMentions } from './MentionInput';
import { RenderHashtags } from './HashtagDisplay';
import ReactionPicker from './ReactionPicker';
import CommentThread from './CommentThread';
import { GifButton } from './GifPicker';
import { Link } from 'react-router-dom';
import { X, ThumbsUp, ThumbsDown,
  Heart,
  MessageSquare,
  Share2,
  Copy,
  Trash2,
  Flag,
  MapPin,
  Calendar,
  Star,
  Users,
  ChefHat,
  Camera,   
  User,
  MoreHorizontal,
  Tent,
  Send,
  Utensils,
  Backpack,
  FileText,
  Video,
  Play,
  Image,
  Megaphone,
} from 'lucide-react';
import api from '../services/api';
import StargazingCard from './StargazingCard';
import CampfireWinnerCard from './CampfireWinnerCard';


interface FeedItem {
  id: string;
  type: string;
  isPackingActivity?: boolean;
  isFriendRequest?: boolean;
  isCampingBuddy?: boolean;
  userHasLiked?: boolean;
  likeCount?: number;
  sourceLikeCount?: number;
  sourceLoveCount?: number;
  sourceDislikeCount?: number;
  packItemId?: string;
  canRespond?: boolean;
  actor: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  content?: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaId?: string;
  mediaLikeCount?: number;
  mediaCommentCount?: number;
  userHasLikedMedia?: boolean;
  mediaComments?: any[];
  title?: string;
  targetName?: string;
  targetLink?: string;
  targetUser?: {
    id: string;
    username: string;
    firstName: string;
    lastName?: string;
    profilePicture?: string;
  } | null;
  createdAt: string;
  _count?: {
    likes: number;
    comments: number;
  };
  canDelete?: boolean;
  isLiked?: boolean;
  isBasecampActivity?: boolean;
  reaction?: string | null;
  campground?: {
    id: string;
    name: string;
    location: string;
    state?: string;
  };
  comments?: {
    id: string;
    content: string;
    imageUrl?: string;
    createdAt: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      username: string;
      profilePicture?: string;
    };
  }[];
  activityType?: string;
  activityIcon?: string;
  activityLabel?: string;
  sourceLikeCount?: number;
  sourceLikers?: { id: string; firstName: string; lastName: string; username: string }[];
  userHasLiked?: boolean;
  replyContent?: string;
  metadata?: any;
}

interface SocialFeedProps {
  username: string;
  includePacking?: boolean;
  isOwnProfile: boolean;
}

export default function SocialFeed({ username, isOwnProfile = false, includePacking = false }: SocialFeedProps) {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMoreActions, setShowMoreActions] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [commentImages, setCommentImages] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [shareModalItem, setShareModalItem] = useState<FeedItem | null>(null);
  const [handlePrompt, setHandlePrompt] = useState<{ platform: string; field: string } | null>(null);
  const [handleInput, setHandleInput] = useState('');
  const { user: authUser, refreshUser } = useAuth();
  
  // New post form state
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submittingPost, setSubmittingPost] = useState(false);

  useEffect(() => {
    loadFeed();
  }, [username, page]);

  const loadFeed = async () => {
    try {
      setLoading(true);
      
      const { data: activityData } = await api.get(`/profile/${username}/activity-feed?page=${page}&limit=20`);
      
      let allItems: FeedItem[] = activityData.feedItems || [];
      
      if (isOwnProfile) {
        try {
          const { data: campgroundData } = await api.get('/campground-posts/my-feed?limit=20');
          
          const campgroundItems: FeedItem[] = (campgroundData.posts || []).map((post: any) => ({
            id: `campground-${post.id}`,
            originalId: post.id,
            type: 'CAMPGROUND_POST',
            actor: post.author,
            content: post.content,
            imageUrl: post.imageUrl,
            title: post.title,
            targetName: post.campground.name,
            targetLink: `/campgrounds/${post.campground.id}`,
            createdAt: post.createdAt,
            _count: post._count,
            isLiked: post.isLiked,
            campground: post.campground,
            comments: post.comments || [],
          }));
          
          allItems = [...allItems, ...campgroundItems].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          // Fetch packing activities only if includePacking is true
          if (includePacking) {
            try {
              const { data: packingData } = await api.get('/basecamp/feed?page=1&limit=20');
              const packingItems: FeedItem[] = (packingData.feedItems || [])
                .filter((item: any) => item.isPackingActivity || item.isBasecampActivity || item.isFriendRequest || item.isCampingBuddy || item.activityType?.startsWith('PACK_') || item.type?.startsWith('PACK_') || item.type === 'FRIEND_REQUEST' || item.activityType === 'FRIEND_REQUEST' || item.type === 'NEW_CAMPING_BUDDY' || item.activityType === 'NEW_CAMPING_BUDDY' || item.type === 'THREAD_REPLY' || item.type === 'THREAD_CREATED' || item.type === 'THREAD_COMMENT' || item.type === 'THREAD_MENTION' || item.type === 'MEAL_ASSIGNMENT_REQUEST' || item.type === 'MEAL_ASSIGNMENT_RESPONSE' || item.type === 'RECIPE_COMMENT_THREAD' || item.type === 'RECIPE_MENTION' || item.type === 'RECIPE_COMMENTED' || item.isRecipeComment || item.type === 'PHOTO_UPLOADED' || item.isFriendActivity || item.type === 'BADGE_EARNED' || item.activityType === 'BADGE_EARNED' || item.type === 'STARGAZING' || item.activityType === 'STARGAZING' || item.type === 'CAMPFIRE_WINNER' || item.activityType === 'CAMPFIRE_WINNER')
                .map((item: any) => ({
                  id: item.id,
                  type: item.type || item.activityType,
                  actor: item.actor,
                  content: item.content || item.activityLabel,
                  title: item.title || item.targetName,
                  targetName: item.targetName,
                  targetLink: item.targetLink,
                  createdAt: item.createdAt,
                  activityType: item.activityType || item.type,
                  activityIcon: item.activityIcon,
                  activityLabel: item.activityLabel || item.content,
                  isPackingActivity: item.isPackingActivity,
                  isFriendRequest: item.isFriendRequest || item.type === 'FRIEND_REQUEST',
                  packItemId: item.packItemId,
                  friendshipId: item.friendshipId,
                  metadata: item.metadata,
                  canRespond: item.canRespond,
                  isBasecampActivity: item.isBasecampActivity,
                  reaction: item.reaction,
                  userHasLiked: item.userHasLiked,
                  replyContent: item.replyContent,
                  imageUrl: item.imageUrl,
                  videoUrl: item.videoUrl,
                  isFriendActivity: item.isFriendActivity,
                  mediaId: item.mediaId,
                  mediaLikeCount: item.mediaLikeCount,
                  mediaCommentCount: item.mediaCommentCount,
                  userHasLikedMedia: item.userHasLikedMedia,
                }));
              
              if (packingItems.length > 0) {
                allItems = [...allItems, ...packingItems].sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
              }
            } catch (e) {
              console.log('Could not load packing activities:', e);
            }
          }
        } catch (error) {
          console.error('Load campground feed error:', error);
        }
      }
      
      // Deduplicate by id
      const seenIds = new Set<string>();
      const uniqueItems = allItems.filter(item => {
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      });

      if (page === 1) {
        setFeedItems(uniqueItems);
      } else {
        setFeedItems((prev) => {
          const existingIds = new Set(prev.map(p => p.id));
          const newItems = uniqueItems.filter(item => !existingIds.has(item.id));
          return [...prev, ...newItems];
        });
      }
      
      setHasMore(activityData.hasMore || false);
    } catch (error) {
      console.error('Load feed error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !newPostImage) return;
    
    try {
      setSubmittingPost(true);
      const { data } = await api.post(`/profile/${username}/wall-post`, {
        content: newPostContent.trim(),
        imageUrl: newPostImage || undefined
      });
      
      // Add new post to the top of the feed
      const newItem: FeedItem = {
        id: data.id,
        type: 'POST',
        actor: data.user,
        content: data.content,
        imageUrl: data.imageUrl,
        createdAt: data.createdAt,
        _count: { likes: 0, comments: 0 },
        canDelete: true,
      };
      
      setFeedItems([newItem, ...feedItems]);
      setNewPostContent('');
      setNewPostImage(null);
    } catch (error) {
      console.error('Create post error:', error);
      alert('Failed to create post');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be less than 10MB");
      return;
    }
    
    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("image", file);
      
      const { data } = await api.post("/upload/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      const imageUrl = data.url || data.imageUrl;
      setNewPostImage(imageUrl);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload image");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getActivityIcon = (item: FeedItem) => {
    if (item.type === 'STARGAZING' || item.activityType === 'STARGAZING' || item.type === 'CAMPFIRE_WINNER' || item.activityType === 'CAMPFIRE_WINNER') {
      let meta: any = {};
      try { meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : (item.metadata || {}); } catch {}
      return (
        <div key={item.id} className="mb-4">
          <StargazingCard
            content={item.content || ''}
            metadata={{
              imageUrl: meta.imageUrl || 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773960904/rvunicorn/stargazing.png',
              walterImage: meta.walterImage || 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773969595/rvunicorn/walter-stargazing.png',
              campgroundName: meta.campgroundName || '',
              moonPhase: meta.moonPhase || '🌟',
              date: meta.date || new Date().toISOString().split('T')[0],
            }}
          />
        </div>
      );
    }

    if (item.activityIcon) {
      return <span className="text-lg">{item.activityIcon}</span>;
    }
    
    switch (item.type) {
      case 'POST':
        return <MessageSquare className="w-4 h-4" />;
      case 'THREAD':
      case 'THREAD_CREATED':
      case 'THREAD_COMMENT':
        return <MessageSquare className="w-4 h-4 text-indigo-500" />;
      case 'EVENT':
        return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'FAVORITE':
        return <Star className="w-4 h-4 text-yellow-500" />;
      case 'CAMPSITE_UPDATE':
      case 'CHECKIN':
        return <MapPin className="w-4 h-4 text-green-500" />;
      case 'FRIEND':
        return <Users className="w-4 h-4 text-purple-500" />;
      case 'RECIPE':
      case 'MEAL':
        return <Utensils className="w-4 h-4 text-orange-500" />;
      case 'PHOTO':
        return <Camera className="w-4 h-4 text-pink-500" />;
      case 'GEAR':
        return <Backpack className="w-4 h-4 text-amber-500" />;
      case 'CAMPGROUND_POST':
        return <Tent className="w-4 h-4 text-green-600" />;
      case 'CAMPGROUND_ANNOUNCEMENT':
      case 'CREATOR_VIDEO_UPLOAD':
      case 'SHARED_CREATOR_VIDEO':
        return <Share2 className="w-4 h-4 text-purple-500" />;
        return <Video className="w-4 h-4 text-purple-500" />;
        return <Megaphone className="w-4 h-4 text-red-500" />;
      case 'REVIEW':
        return <Star className="w-4 h-4 text-yellow-500" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getActivityText = (item: FeedItem) => {
    // Show "You" if the actor is the profile owner viewing their own feed
    const isActorProfileOwner = isOwnProfile && item.actor.username === username;
    const actorName = isActorProfileOwner ? 'You' : `${item.actor.firstName} ${item.actor.lastName}`;
    
    // Friend requests - show linked name
    if (item.isFriendRequest || item.activityType === 'FRIEND_REQUEST') {
      return (
        <span>
          <Link to={`/profile/${item.actor.username}`} className="font-semibold text-primary-600 hover:underline">
            {actorName}
          </Link>
          {' wants to be your camping buddy! 🏕️'}
        </span>
      );
    }

    // New camping buddy - show both names as links
    if (item.activityType === 'NEW_CAMPING_BUDDY' || item.isCampingBuddy) {
      return (
        <span>
          {'You and '}
          <Link to={`/profile/${item.actor.username}`} className="font-semibold text-primary-600 hover:underline">
            {item.actor.firstName} {item.actor.lastName}
          </Link>
          {' are now camping buddies! 🏕️'}
        </span>
      );
    }

    // Packing activities have complete messages - don't add actor or target
    if (item.isPackingActivity && item.activityLabel) {
      return (
        <span>
          {item.activityLabel}
          {item.targetLink && (
            <>
              {' for '}
              <Link to={item.targetLink} className="font-semibold text-primary-600 hover:underline">
                {item.targetName}
              </Link>
            </>
          )}
        </span>
      );
    }
    
    // Special handling for recipe comments
    if (item.type === 'RECIPE_COMMENTED' || item.activityType === 'RECIPE_COMMENTED') {
      const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata || '{}') : (item.metadata || {});
      const mentions = meta.mentions || [];
      return (
        <span>
          <Link to={`/profile/${item.actor.username}`} className="font-semibold hover:underline">
            {actorName}
          </Link>
          {' '}commented on{' '}
          {item.targetLink ? (
            <Link to={item.targetLink} className="font-semibold text-primary-600 hover:underline">
              {item.targetName}
            </Link>
          ) : (
            <span className="font-semibold">{item.targetName}</span>
          )}
          {mentions.length > 0 && (
            <span>
              {' '}with{' '}
              {mentions.map((m: string, i: number) => (
                <span key={m}>
                  <Link to={`/profile/${m}`} className="text-primary-600 hover:underline">@{m}</Link>
                  {i < mentions.length - 1 ? ', ' : ''}
                </span>
              ))}
            </span>
          )}
          {item.content && (
            <span className="block mt-1 text-gray-600 italic">"<RenderMentions content={item.content} />"</span>
          )}
        </span>
      );
    }

    // Special handling for recipe shares - show full content with message
    if (item.activityType === 'RECIPE_SHARED' || item.activityType === 'RECIPE_SHARE_TAG') {
      return (
        <span>
          <Link to={`/profile/${item.actor.username}`} className="font-semibold hover:underline">
            {actorName}
          </Link>
          {' '}{item.content}{' '}
          {item.targetLink && (
            <Link to={item.targetLink} className="font-semibold text-primary-600 hover:underline">
              {item.targetName}
            </Link>
          )}
        </span>
      );
    }

    if (item.activityLabel && item.activityLabel !== 'did something' && item.type !== 'CAMPGROUND_ANNOUNCEMENT') {
        return (
        <span>
          <Link to={`/profile/${item.actor.username}`} className="font-semibold hover:underline">
            {actorName}
          </Link>
          {' '}{item.activityLabel}{' '}
          {item.targetLink ? (
            <Link to={item.targetLink} className="font-semibold text-primary-600 hover:underline">
              {item.targetName}
            </Link>
          ) : item.targetName ? (
            <span className="font-semibold">{item.targetName}</span>
          ) : null}
        </span>
      );
    }
    
    switch (item.type) {
      case 'POST':
        return `${actorName} posted`;
      case 'THREAD':
        return `${actorName} started a discussion`;
      case 'THREAD_CREATED':
        return (
          <span>
            <Link to={`/profile/${item.actor?.username}`} className="font-semibold hover:underline">
              {actorName}
            </Link>
            {' started a thread. Share your thoughts! '}
            <Link to={`/threads/${item.threadId || item.entityId}`} className="font-semibold text-primary-600 hover:underline">
              {item.title || item.entityName || 'View Thread'}
            </Link>
          </span>
        );
      case 'THREAD_COMMENT':
        return (
          <span>
            <Link to={`/profile/${item.actor?.username}`} className="font-semibold hover:underline">
              {actorName}
            </Link>
            {" is talking in "}
            <Link to={`/threads/${item.threadId || item.entityId}`} className="font-semibold text-primary-600 hover:underline">
              {item.title || item.entityName || 'a thread'}
            </Link>
          </span>
        );
      case 'EVENT':
        return `${actorName} is attending ${item.targetName}`;
      case 'FAVORITE':
        return `${actorName} favorited ${item.targetName}`;
      case 'FRIEND': {
        // Viewer-aware rendering for FRIEND_ADDED:
        //  - viewer is the actor or the target → "You became friends with [other]"
        //  - viewer is anyone else → "[actor] and [target] became friends"
        // Both names are clickable links to their profiles.
        const actor = item.actor;
        const target = item.targetUser;
        const actorLink = actor?.username ? `/profile/${actor.username}` : null;
        const targetLink = target?.username ? `/profile/${target.username}` : item.targetLink || null;
        const isViewerActor = !!authUser && actor?.id === authUser.id;
        const isViewerTarget = !!authUser && target?.id === authUser.id;

        if (isViewerActor && target) {
          // Viewer is the actor — show the OTHER person
          return (
            <span>
              You became friends with{' '}
              {targetLink ? (
                <Link to={targetLink} className="font-semibold hover:underline">
                  {target.firstName} {target.lastName || ''}
                </Link>
              ) : (
                <span className="font-semibold">{target.firstName} {target.lastName || ''}</span>
              )}
            </span>
          );
        }

        if (isViewerTarget && actor) {
          // Viewer is the target — show the actor as the "other" person
          return (
            <span>
              You became friends with{' '}
              {actorLink ? (
                <Link to={actorLink} className="font-semibold hover:underline">
                  {actor.firstName} {actor.lastName || ''}
                </Link>
              ) : (
                <span className="font-semibold">{actor.firstName} {actor.lastName || ''}</span>
              )}
            </span>
          );
        }

        // Viewer is neither — third-person mutual phrasing with both names linkable
        if (actor && target) {
          return (
            <span>
              {actorLink ? (
                <Link to={actorLink} className="font-semibold hover:underline">
                  {actor.firstName} {actor.lastName || ''}
                </Link>
              ) : (
                <span className="font-semibold">{actor.firstName} {actor.lastName || ''}</span>
              )}
              {' and '}
              {targetLink ? (
                <Link to={targetLink} className="font-semibold hover:underline">
                  {target.firstName} {target.lastName || ''}
                </Link>
              ) : (
                <span className="font-semibold">{target.firstName} {target.lastName || ''}</span>
              )}
              {' became friends'}
            </span>
          );
        }

        // Fallback for old activity rows that don't have targetUser populated
        return `${actorName} became friends with ${item.targetName}`;
      }
      case 'CAMPSITE_UPDATE':
      case 'CHECKIN':
        return `${actorName} checked in at ${item.targetName}`;
      case 'RECIPE':
        return `${actorName} shared a recipe`;
      case 'MEAL':
        return `${actorName} planned a meal`;
      case 'PHOTO':
        return `${actorName} added a photo`;
      case 'GEAR':
        return `${actorName} added gear`;
      case 'PACKING_FOR_TRIP':
        return `${actorName} is packing for a camping trip! 🎒`;
       case 'CAMPGROUND_POST':
        return null;
      case 'CAMPGROUND_ANNOUNCEMENT':
        return (
          <span>
            <span className="font-semibold">{item.targetName || item.title}</span>
            {' '} posted an announcement
          </span>
        );
      case 'CREATOR_VIDEO_UPLOAD':
        return (
          <span>
            <Link to={`/profile/${item.actor.username}`} className="font-semibold hover:underline">
              {actorName}
            </Link>
            {' uploaded a new video: '}
            <Link to={item.targetLink || `/creators/${item.actor.username}/content/${item.id}`} className="font-semibold text-purple-600 hover:underline">
              {item.targetName || 'Untitled'}
            </Link>
            {' - Go check it out! 🎬'}
          </span>
        );
      case 'SHARED_CREATOR_VIDEO':
        const shareMeta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
        return (
          <span>
            <Link to={`/profile/${item.actor.username}`} className="font-semibold hover:underline">
              {actorName}
            </Link>
            {' shared a video: '}
            <Link to={item.targetLink || `#`} className="font-semibold text-purple-600 hover:underline">
              {item.targetName || 'Untitled'}
            </Link>
            {' by '}{shareMeta?.originalCreatorName || 'a creator'}{' 🔄'}
          </span>
        );
      default:
        return (
          <span>
            <Link to={`/profile/${item.actor?.username}`} className="font-semibold hover:underline">
              {actorName}
            </Link>
            {item.content ? (
              <> {item.content}</>
            ) : item.activityLabel && item.activityLabel !== 'did something' ? (
              <> {item.activityLabel}</>
            ) : (
              <> posted an update</>
            )}
            {item.targetLink && item.targetName && (
              <> — <Link to={item.targetLink} className="font-semibold text-primary-600 hover:underline">{item.targetName}</Link></>
            )}
          </span>
        );
    }
  };

  const handlePackingResponse = async (item: FeedItem, willBring: boolean) => {
    if (!item.packItemId) return;
    try {
      await api.put(`/trip-packing/${item.packItemId}/respond`, { accept: willBring });
      // Remove the item from feed or update it
      setFeedItems(items => items.filter(i => i.id !== item.id));
      alert(willBring ? "Great! You've confirmed you'll bring this item." : "No problem. Others will be notified.");
    } catch (error) {
      console.error('Packing response error:', error);
      alert('Failed to respond. Please try again.');
    }
  };

  const handleFriendResponse = async (item: FeedItem, accept: boolean) => {
    const meta = item as any;
    const friendshipId = meta.friendshipId || meta.metadata?.friendshipId || meta.packItemId;
    console.log('Friend response - item:', item, 'friendshipId:', friendshipId);
    if (!friendshipId) {
      console.error('No friendshipId found', item);
      alert('Error: Could not find friendship ID');
      return;
    }
    try {
      if (accept) {
        await api.put(`/friends/accept/${friendshipId}`);
        alert("You're now camping buddies! 🏕️");
      } else {
        await api.delete(`/friends/${friendshipId}`);
        alert("Friend request declined.");
      }
      // Remove the item from feed
      setFeedItems(items => items.filter(i => i.id !== item.id));
    } catch (error) {
      console.error('Friend response error:', error);
      alert('Failed to respond. Please try again.');
    }
  };

  const handleLike = async (item: FeedItem) => {
    try {
      if (item.type === 'CAMPGROUND_POST') {
        const originalId = item.id.replace('campground-', '');
        const { data } = await api.put(`/campground-posts/${originalId}/like`);
        setFeedItems((items) =>
          items.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  isLiked: data.liked,
                  _count: {
                    ...i._count,
                    likes: data.liked ? (i._count?.likes || 0) + 1 : (i._count?.likes || 1) - 1,
                    comments: i._count?.comments || 0,
                  },
                }
              : i
          )
        );
      } else if (item.mediaId && (item.type === 'PHOTO_UPLOADED' || item.activityType === 'PHOTO_UPLOADED' || item.type === 'PHOTO')) {
        // Like the actual media item
        const isCurrentlyLiked = item.userHasLikedMedia;
        if (isCurrentlyLiked) {
          await api.delete(`/media-albums/media/${item.mediaId}/reactions/LIKE`);
        } else {
          await api.post(`/media-albums/media/${item.mediaId}/reactions`, { type: 'LIKE' });
        }
        setFeedItems((items) =>
          items.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  userHasLikedMedia: !isCurrentlyLiked,
                  mediaLikeCount: isCurrentlyLiked 
                    ? Math.max((i.mediaLikeCount || 1) - 1, 0) 
                    : (i.mediaLikeCount || 0) + 1,
                }
              : i
          )
        );
      } else {
        // Handle both regular posts and activity items
        const postId = item.id.startsWith('activity-') ? item.id.replace('activity-', '') : item.id;
        const { data } = await api.post(`/activity/${postId}/like`);
        setFeedItems((items) =>
          items.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  isLiked: data.liked !== undefined ? data.liked : !i.isLiked,
                  _count: {
                    ...i._count,
                    likes: data.liked ? (i._count?.likes || 0) + 1 : Math.max((i._count?.likes || 1) - 1, 0),
                    comments: i._count?.comments || 0,
                  },
                }
              : i
          )
        );
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleBasecampReaction = async (itemId: string, reaction: string | null) => {
    try {
      // Extract the real ID (remove basecamp- prefix)
      const realId = itemId.replace(/^basecamp-/, '');
      const { data } = await api.post(`/basecamp/activity/${realId}/react`, { reaction });
      setFeedItems(items => items.map(item => 
        item.id === itemId ? { ...item, reaction: data.reaction } : item
      ));
    } catch (error) {
      console.error('Reaction error:', error);
    }
  };

  const handleBasecampDismiss = async (itemId: string) => {
    try {
      const realId = itemId.replace(/^basecamp-/, '');
      await api.delete(`/basecamp/activity/${realId}`);
      setFeedItems(items => items.filter(item => item.id !== itemId));
    } catch (error) {
      console.error('Dismiss error:', error);
    }
  };

  const platformToField: Record<string, string> = {
    Facebook: 'facebookUrl',
    'X / Twitter': 'twitterUrl',
    Reddit: 'redditUrl',
    WhatsApp: '',
    Threads: '',
    Email: '',
  };

  const handleShare = async (item: FeedItem) => {
    setShareModalItem(item);
  };

  const handleSocialClick = (platformName: string) => {
    const field = platformToField[platformName];
    if (field && authUser && !(authUser as any)[field]) {
      setHandlePrompt({ platform: platformName, field });
    }
    setShareModalItem(null);
  };

  const saveHandle = async () => {
    if (!handlePrompt || !handleInput.trim()) {
      setHandlePrompt(null);
      setHandleInput('');
      return;
    }
    try {
      await api.put('/profile/social-links', { [handlePrompt.field]: handleInput.trim() });
      if (refreshUser) await refreshUser();
    } catch (e) {
      console.error('Failed to save handle:', e);
    }
    setHandlePrompt(null);
    setHandleInput('');
  };


  const handleVideoLike = async (item: FeedItem) => {
    try {
      const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
      const contentId = meta?.contentId || item.targetLink?.split('/').pop();
      if (!contentId) return;
      const { data } = await api.post(`/creators/content/${contentId}/like`);
      setFeedItems(items => items.map(i => 
        i.id === item.id ? { ...i, isLiked: data.isLiked, likeCount: data.isLiked ? (i.likeCount || 0) + 1 : (i.likeCount || 0) - 1 } : i
      ));
    } catch (error) {
      console.error('Video like error:', error);
    }
  };

  const handleVideoShare = async (item: FeedItem) => {
    try {
      const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
      const contentId = meta?.contentId || item.targetLink?.split('/').pop();
      if (!contentId) return;
      await api.post(`/creators/content/${contentId}/share`);
      alert('Video shared to your feed and your friends can now see it!');
    } catch (error) {
      console.error('Video share error:', error);
      alert('Failed to share video');
    }
  };
  const handleDelete = async (item: FeedItem) => {
    if (confirm('Are you sure you want to delete this?')) {
      try {
        const realId = item.id.replace(/^(basecamp-|activity-|post-|photo-|album-)/, '');
        if (item.isBasecampActivity || item.id.startsWith('basecamp-') || item.id.startsWith('activity-')) {
          await api.delete(`/basecamp/activity/${realId}`);
        } else if (item.type === 'PHOTO_UPLOADED' || item.activityType === 'PHOTO_UPLOADED') {
          await api.delete(`/basecamp/activity/${realId}`);
          if (item.mediaId) { try { await api.delete(`/media-albums/media/${item.mediaId}`); } catch {} }
        } else if (item.type === 'ALBUM_CREATED' || item.activityType === 'ALBUM_CREATED') {
          await api.delete(`/basecamp/activity/${realId}`);
        } else {
          await api.delete(`/posts/${realId}`);
        }
        setFeedItems((items) => items.filter((i) => i.id !== item.id));
        alert('Deleted successfully');
      } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete');
      }
    }
  };

  const handleReport = async (itemId: string) => {
    if (confirm('Report this content as inappropriate?')) {
      try {
        await api.post(`/posts/${itemId}/report`, {
          reason: 'inappropriate',
        });
        alert('Content reported. Our moderators will review it shortly.');
      } catch (error) {
        console.error('Report error:', error);
        alert('Failed to report content');
      }
    }
  };

  const toggleComments = async (itemId: string, mediaId?: string) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
      // Fetch media comments if this is a media item
      if (mediaId) {
        try {
          const { data } = await api.get(`/media-albums/media/${mediaId}/comments`);
          setFeedItems(items => items.map(item => 
            item.id === itemId ? { ...item, mediaComments: data } : item
          ));
        } catch (e) {
          console.error('Failed to fetch media comments:', e);
        }
      }
    }
    setExpandedComments(newExpanded);
  };

  const handleAddComment = async (item: FeedItem) => {
    const content = newComments[item.id]?.trim();
    const imageUrl = commentImages[item.id];
    if (!content && !imageUrl) return;

    try {
      setSubmittingComment(item.id);
      
      if (item.type === 'CAMPGROUND_POST') {
        const originalId = item.id.replace('campground-', '');
        const { data } = await api.post(`/campground-posts/${originalId}/comments`, { content, imageUrl });
        
        setFeedItems((items) =>
          items.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  comments: [...(i.comments || []), data],
                  _count: {
                    ...i._count,
                    likes: i._count?.likes || 0,
                    comments: (i._count?.comments || 0) + 1,
                  },
                }
              : i
          )
        );
      } else if (item.mediaId && (item.type === 'PHOTO_UPLOADED' || item.activityType === 'PHOTO_UPLOADED' || item.type === 'PHOTO')) {
        // Handle media comments
        const { data } = await api.post(`/media-albums/media/${item.mediaId}/comments`, { content });
        
        setFeedItems((items) =>
          items.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  mediaComments: [...(i.mediaComments || []), data],
                  mediaCommentCount: (i.mediaCommentCount || 0) + 1,
                }
              : i
          )
        );
      } else {
        // Handle regular posts and activity items
        const postId = item.id.startsWith('activity-') ? item.id.replace('activity-', '') : item.id;
        const { data } = await api.post(`/posts/${postId}/comments`, { content, imageUrl });
        
        setFeedItems((items) =>
          items.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  comments: [...(i.comments || []), data],
                  _count: {
                    ...i._count,
                    likes: i._count?.likes || 0,
                    comments: (i._count?.comments || 0) + 1,
                  },
                }
              : i
          )
        );
      }
      
      setNewComments({ ...newComments, [item.id]: '' });
      setCommentImages({ ...commentImages, [item.id]: '' });
      setExpandedComments(new Set([...expandedComments, item.id]));
    } catch (error) {
      console.error('Add comment error:', error);
    } finally {
      setSubmittingComment(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const loadMore = () => {
    setPage(page + 1);
  };

  const renderCampgroundPost = (item: FeedItem) => (
    <div
      key={item.id}
      className="border-2 border-green-200 bg-green-50 rounded-lg p-4 hover:shadow-md transition"
    >
      <Link
        to={item.targetLink || '#'}
        className="flex items-center gap-3 mb-3 hover:bg-green-100 -mx-2 px-2 py-1 rounded-lg transition"
      >
        <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white">
          <Tent className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900">{item.campground?.name}</p>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {item.campground?.location}
          </p>
        </div>
        <span className="text-xs text-gray-400">{formatDate(item.createdAt)}</span>
      </Link>

      {item.title && (
        <h4 className="font-semibold text-gray-900 mb-2">{item.title}</h4>
      )}
      {item.content && (
        <p className="text-gray-700 mb-3"><RenderMentions content={item.content} /></p>
      )}

      {/* Show video or image for posts and photo uploads */}
      {item.videoUrl ? (
        <video 
          src={item.videoUrl} 
          controls
          poster={item.imageUrl}
          className="mt-3 rounded-lg max-h-80 w-full object-contain border border-gray-200"
        />
      ) : (item.imageUrl || (item.activityType === 'PHOTO_UPLOADED' && item.imageUrl)) && (
        <img
          src={item.imageUrl.startsWith('http') ? item.imageUrl : (item.imageUrl.startsWith('/images/') ? item.imageUrl : `${item.imageUrl}`)}
          alt="Post"
          className="w-1/4 rounded-lg mb-3 max-h-24 object-cover"
        />
      )}

      <div className="flex items-center gap-4 pt-3 border-t border-green-200">
        <button
          onClick={() => handleLike(item)}
          className={`flex items-center gap-1 text-sm transition ${
            item.isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
          }`}
        >
          <Heart className={`w-5 h-5 ${(item.mediaId ? item.userHasLikedMedia : item.isLiked) ? 'fill-current' : ''}`} />
          <span>{item.mediaId ? (item.mediaLikeCount || 0) : (item._count?.likes || 0)}</span>
        </button>
        <button
          onClick={() => toggleComments(item.id, item.mediaId)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition"
        >
          <MessageSquare className="w-5 h-5" />
          <span>{item.mediaId ? (item.mediaCommentCount || 0) : (item._count?.comments || 0)}</span>
        </button>
      </div>

      {expandedComments.has(item.id) && (
        <div className="mt-4 pt-4 border-t border-green-200">
          {/* Show media comments for media items, regular comments otherwise */}
          {((item.mediaId && item.mediaComments && item.mediaComments.length > 0) || (item.comments && item.comments.length > 0)) && (
            <div className="space-y-3 mb-4">
              {(item.mediaId ? item.mediaComments : item.comments)?.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <Link to={`/profile/${comment.user.username}`}>
                    {comment.user.profilePicture ? (
                      <img
                        src={`${comment.user.profilePicture}`}
                        alt={comment.user.firstName}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold">
                        {comment.user.firstName[0]}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 bg-white rounded-lg px-3 py-2">
                    <Link
                      to={`/profile/${comment.user.username}`}
                      className="font-medium text-sm text-gray-900 hover:underline"
                    >
                      {comment.user.firstName} {comment.user.lastName}
                    </Link>
                    <p className="text-sm text-gray-700"><RenderMentions content={comment.content} /></p>
                    {comment.imageUrl && (
                      <img 
                        src={comment.imageUrl} 
                        alt="" 
                        className="mt-2 rounded-lg max-h-48 object-cover" 
                      />
                    )}
                    <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

<div className="space-y-2">
            {commentImages[item.id] && (
              <div className="relative inline-block">
                <img src={commentImages[item.id]} alt="GIF" className="h-24 rounded-lg" />
                <button
                  type="button"
                  onClick={() => setCommentImages({ ...commentImages, [item.id]: '' })}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex gap-2 items-center">
              <MentionInput
                value={newComments[item.id] || ''}
                onChange={(value) => setNewComments({ ...newComments, [item.id]: value })}
                placeholder="Write a comment... @ to mention, # for tags"
                rows={1}
                className="flex-1 rounded-full px-4 py-2 text-sm"
              />
              <GifButton onSelect={(gifUrl) => setCommentImages({ ...commentImages, [item.id]: gifUrl })} />
              <button
                onClick={() => handleAddComment(item)}
                disabled={submittingComment === item.id || (!newComments[item.id]?.trim() && !commentImages[item.id])}
                className="p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderActivityItem = (item: FeedItem) => {
    let bgColor = 'bg-white';
    let borderColor = 'border-gray-200';
    
    if (item.type === 'THREAD') {
      bgColor = 'bg-indigo-50';
      borderColor = 'border-indigo-200';
    } else if (item.type === 'EVENT') {
      bgColor = 'bg-blue-50';
      borderColor = 'border-blue-200';
    } else if (item.type === 'RECIPE' || item.type === 'MEAL') {
      bgColor = 'bg-orange-50';
      borderColor = 'border-orange-200';
    } else if (item.type === 'CHECKIN' || item.type === 'REVIEW') {
      bgColor = 'bg-green-50';
      borderColor = 'border-green-200';
    } else if (item.type === 'CAMPGROUND_ANNOUNCEMENT') {
      bgColor = 'bg-amber-50';
      borderColor = 'border-amber-300';
    } else if (item.type === 'CREATOR_VIDEO_UPLOAD') {
    } else if (item.type === 'SHARED_CREATOR_VIDEO') {
      bgColor = 'bg-purple-50';
      borderColor = 'border-purple-200';
      bgColor = 'bg-purple-50';
      borderColor = 'border-purple-200';
    }

    // CAMPFIRE_WINNER renders as full card
    if (item.type === 'CAMPFIRE_WINNER' || item.activityType === 'CAMPFIRE_WINNER') {
      let meta: any = {};
      try { meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : (item.metadata || {}); } catch {}
      return (
        <CampfireWinnerCard
          key={item.id}
          content={item.content || ''}
          metadata={meta}
        />
      );
    }

    // STARGAZING renders as full card
    if (item.type === 'STARGAZING' || item.activityType === 'STARGAZING' || item.type === 'CAMPFIRE_WINNER' || item.activityType === 'CAMPFIRE_WINNER') {
      let meta: any = {};
      try { meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : (item.metadata || {}); } catch {}
      return (
        <StargazingCard
          key={item.id}
          content={item.content || ''}
          metadata={{
            imageUrl: meta.imageUrl || 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773960904/rvunicorn/stargazing.png',
            walterImage: meta.walterImage || 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773969595/rvunicorn/walter-stargazing.png',
            campgroundName: meta.campgroundName || '',
            moonPhase: meta.moonPhase || '🌟',
            date: meta.date || new Date().toISOString().split('T')[0],
          }}
        />
      );
    }

    return (
      <div
        key={item.id}
        className={`border ${borderColor} rounded-lg p-4 hover:shadow-md transition ${bgColor}`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Link to={`/profile/${item.actor.username}`} className="flex-shrink-0">
              {item.actor.profilePicture ? (
                <img
                  src={`${item.actor.profilePicture}`}
                  alt={item.actor.firstName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center border-2 border-gray-200">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-primary-600 flex-shrink-0">
                  {getActivityIcon(item)}
                </span>
                <p className="text-sm text-gray-700">
                  {typeof getActivityText(item) === 'string' ? getActivityText(item) : getActivityText(item)}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formatDate(item.createdAt)}
              </p>
            </div>
          </div>

          {(item.canDelete || !isOwnProfile) && (
            <div className="relative">
              <button
                onClick={() => setShowMoreActions(showMoreActions === item.id ? null : item.id)}
                className="p-1 hover:bg-gray-100 rounded-full transition"
              >
                <MoreHorizontal className="w-5 h-5 text-gray-500" />
              </button>

              {showMoreActions === item.id && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                  <button
                    onClick={() => {
                      handleDelete(item);
                      setShowMoreActions(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                  <button
                    onClick={() => {
                      handleReport(item.id);
                      setShowMoreActions(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                  >
                    <Flag className="w-4 h-4" />
                    Report Abuse
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rich CHECK_IN card */}
        {(item.type === 'CHECKIN' || item.activityType === 'CHECK_IN') && item.campground && (
          <div className="mb-3 flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.12)' }}>
            {item.campground.imageUrl ? (
              <img src={item.campground.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(201,168,76,0.1)' }}>
                <MapPin className="w-6 h-6" style={{ color: '#C9A84C' }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span style={{ color: '#C9A84C', fontSize: '14px' }}>{'\u{1F3D5}'}</span>
                <Link to={`/campgrounds/${item.campground.id}`} className="font-semibold text-sm hover:underline" style={{ color: 'inherit' }}>
                  {item.campground.name}
                </Link>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}>checked in</span>
              </div>
              {(item.campground.location || item.campground.state) && (
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.campground.location}{item.campground.state && `, ${item.campground.state}`}</p>
              )}
              {item.content && <p className="text-[12px] mt-2 italic leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.content}</p>}
              {item.targetLink && item.targetLink.includes('/trips/') && (
                <Link to={item.targetLink} className="text-[11px] font-medium mt-1.5 inline-block" style={{ color: '#E8622A' }}>View Trip →</Link>
              )}
            </div>
          </div>
        )}

        {item.content && (!item.activityLabel || item.type === 'CAMPGROUND_ANNOUNCEMENT') && !(item.type === 'CHECKIN' || item.activityType === 'CHECK_IN') && (
          <div className="mb-3">
            <p className="text-gray-900 whitespace-pre-wrap"><RenderMentions content={item.content} /></p>
          </div>
        )}

        {/* Show video or image */}
        {item.videoUrl ? (
          <div className="mb-3">
            <video 
              src={item.videoUrl} 
              controls
              poster={item.imageUrl}
              className="rounded-lg max-h-80 max-w-full object-contain border border-gray-200"
            />
          </div>
        ) : item.imageUrl && (
          <div className="mb-3">
            <img
              src={item.imageUrl.startsWith("http") ? item.imageUrl : (item.imageUrl.startsWith("/images/") ? item.imageUrl : `${item.imageUrl}`)}
              alt="Post"
              className="rounded-lg max-h-64 max-w-sm object-cover"
            />
          </div>
        )}


        {/* Video thumbnail for creator uploads */}
        {(item.type === 'CREATOR_VIDEO_UPLOAD' || item.type === 'SHARED_CREATOR_VIDEO') && item.metadata && (() => {
          try {
            const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
            if (meta.thumbnailUrl) {
              return (
                <Link to={item.targetLink || `#`} className="block mb-3">
                  <div className="relative rounded-lg overflow-hidden max-w-md hover:opacity-90 transition">
                    <img
                      src={meta.thumbnailUrl}
                      alt={meta.title || 'Video'}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
                        <Play className="w-8 h-8 text-purple-600 fill-purple-600 ml-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            }
            return null;
          } catch (e) {
            return null;
          }

        })()}
        {/* Like and Share buttons for video uploads */}
        {(item.type === 'CREATOR_VIDEO_UPLOAD' || item.type === 'SHARED_CREATOR_VIDEO') && (
          <div className="flex items-center gap-6 pt-3 mb-3">
            <button
              onClick={() => handleVideoLike(item)}
              className={`flex items-center gap-2 text-sm transition ${item.isLiked ? 'text-red-500' : 'text-gray-600 hover:text-red-600'}`}
            >
              <Heart className={`w-5 h-5 ${item.isLiked ? 'fill-current' : ''}`} />
              <span>{item.likeCount || 0}</span>
            </button>
            <button
              onClick={() => handleVideoShare(item)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-purple-600 transition"
            >
              <Share2 className="w-5 h-5" />
              <span>Share to Feed</span>
            </button>
          </div>
        )}
        {item.targetLink && item.targetName && !item.activityLabel && item.activityType !== 'NEW_CAMPING_BUDDY' && !item.isCampingBuddy && (
          <Link
            to={item.targetLink}
            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mb-3"
          >
            View {item.targetName} →
          </Link>
        )}

        {item.campground && item.type !== 'CAMPGROUND_POST' && (
          <Link
            to={`/campgrounds/${item.campground.id}`}
            className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 mb-3"
          >
            <MapPin className="w-4 h-4" />
            {item.campground.name}
            {item.campground.location && ` • ${item.campground.location}`}
          </Link>
        )}

        {/* Friend Request Buttons */}
        {item.activityType === 'FRIEND_REQUEST' && item.canRespond && (
          <div className="flex items-center gap-3 pt-3 border-t border-gray-100 mb-3">
            <button
              onClick={() => handleFriendResponse(item, true)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium"
            >
              ✓ Accept
            </button>
            <button
              onClick={() => handleFriendResponse(item, false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm font-medium"
            >
              ✗ Decline
            </button>
          </div>
        )}

        {/* Packing Response Buttons */}
        {item.isPackingActivity && item.canRespond && item.activityType !== 'FRIEND_REQUEST' && (
          <div className="flex items-center gap-3 pt-3 border-t border-gray-100 mb-3">
            <span className="text-sm text-gray-600">Can you bring this?</span>
            <button
              onClick={() => handlePackingResponse(item, true)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium"
            >
              ✓ Yes, I'll bring it
            </button>
            <button
              onClick={() => handlePackingResponse(item, false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm font-medium"
            >
              ✗ No, I can't
            </button>
            {item.targetLink && (
              <a href={item.targetLink} className="text-sm text-blue-600 hover:underline ml-auto">
                View Event →
              </a>
            )}
          </div>
        )}

        {/* Reply content for thread replies */}
        {item.isBasecampActivity && (item.replyContent || item.metadata?.replyContent || item.metadata?.commentPreview) && (
          <div className="bg-gray-50 rounded-lg p-3 mb-3 border-l-4 border-primary-300">
            <p className="text-sm text-gray-700 italic">"{item.replyContent || item.metadata?.replyContent || item.metadata?.commentPreview}"</p>
          </div>
        )}

        {/* Reaction buttons for basecamp activities (thread replies, etc.) */}
        {item.isBasecampActivity && (
          <div className="pt-3 border-t border-gray-100">
            {/* Source like count display */}
            {(item.sourceLikeCount !== undefined && item.sourceLikeCount > 0) && (
              <div className="flex items-center gap-1 mb-2 text-sm text-gray-600">
                <ThumbsUp className="w-3 h-3" />
                <span>
                  {item.sourceLikers && item.sourceLikers.length > 0 ? (
                    <>
                      {item.sourceLikers.slice(0, 2).map((liker, idx) => (
                        <span key={liker.id}>
                          <Link to={`/profile/${liker.username}`} className="font-medium hover:underline">
                            {liker.firstName}
                          </Link>
                          {idx < Math.min(item.sourceLikers!.length, 2) - 1 && ', '}
                        </span>
                      ))}
                      {item.sourceLikeCount > 2 && (
                        <span> and {item.sourceLikeCount - 2} other{item.sourceLikeCount - 2 > 1 ? 's' : ''}</span>
                      )}
                      {' liked this'}
                    </>
                  ) : (
                    <span>{item.sourceLikeCount} like{item.sourceLikeCount > 1 ? 's' : ''}</span>
                  )}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBasecampReaction(item.id, item.reaction === 'like' ? null : 'like')}
                className={"p-2 rounded-full transition flex items-center gap-1 " + (item.reaction === 'like' || item.userHasLiked ? 'text-blue-500 bg-blue-50' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100')}
                title="Like"
              >
                <ThumbsUp className="w-4 h-4" />
                {(item.sourceLikeCount || 0) > 0 && <span className="text-xs">{item.sourceLikeCount}</span>}
              </button>
              <button
                onClick={() => handleBasecampReaction(item.id, item.reaction === 'love' ? null : 'love')}
                className={"p-2 rounded-full transition flex items-center gap-1 " + (item.reaction === 'love' ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-500 hover:bg-gray-100')}
                title="Love"
              >
                <Heart className="w-4 h-4" />
                {(item.sourceLoveCount || 0) > 0 && <span className="text-xs">{item.sourceLoveCount}</span>}
              </button>
              <button
                onClick={() => handleBasecampReaction(item.id, item.reaction === 'dislike' ? null : 'dislike')}
                className={"p-2 rounded-full transition flex items-center gap-1 " + (item.reaction === 'dislike' ? 'text-orange-500 bg-orange-50' : 'text-gray-400 hover:text-orange-500 hover:bg-gray-100')}
                title="Dislike"
              >
                <ThumbsDown className="w-4 h-4" />
                {(item.sourceDislikeCount || 0) > 0 && <span className="text-xs">{item.sourceDislikeCount}</span>}
              </button>
              <button
                onClick={() => handleBasecampDismiss(item.id)}
                className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
              {item.targetLink && (
                <Link to={item.targetLink} className="ml-auto text-sm text-primary-600 hover:underline">
                  View Thread →
                </Link>
              )}
            </div>
          </div>
        )}

        {!item.isPackingActivity && !item.isBasecampActivity && item.type !== 'FRIEND_REQUEST' && item.activityType !== 'FRIEND_REQUEST' && (
          <div className="flex items-center gap-6 pt-3 border-t border-gray-100">
            <button
              onClick={() => handleLike(item)}
              className={`flex items-center gap-2 text-sm transition ${
                (item.mediaId ? item.userHasLikedMedia : item.isLiked) ? 'text-red-500' : 'text-gray-600 hover:text-red-600'
              }`}
            >
              <Heart className={`w-4 h-4 ${(item.mediaId ? item.userHasLikedMedia : item.isLiked) ? 'fill-current' : ''}`} />
              <span>{item.mediaId ? (item.mediaLikeCount || 0) : (item._count?.likes || 0)}</span>
            </button>

            {(item.type === 'POST' || item.mediaId) && (
              <button
                onClick={() => toggleComments(item.id, item.mediaId)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600 transition"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{item.mediaId ? (item.mediaCommentCount || 0) : (item._count?.comments || 0)}</span>
              </button>
            )}

            <button onClick={() => handleShare(item)} className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition">
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
          </div>
        )}

        {/* Expanded Comments Section - for POST and media types */}
        {(item.type === 'POST' || item.mediaId) && expandedComments.has(item.id) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            {((item.mediaId && item.mediaComments && item.mediaComments.length > 0) || (item.comments && item.comments.length > 0)) && (
              <div className="space-y-3 mb-4">
                {(item.mediaId ? item.mediaComments : item.comments)?.map((comment: any) => (
                  <div key={comment.id} className="flex gap-2">
                    <Link to={`/profile/${comment.user.username}`}>
                      {comment.user.profilePicture ? (
                        <img
                          src={comment.user.profilePicture}
                          alt={comment.user.firstName}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold">
                          {comment.user.firstName[0]}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                      <Link
                        to={`/profile/${comment.user.username}`}
                        className="font-medium text-sm text-gray-900 hover:underline"
                      >
                        {comment.user.firstName} {comment.user.lastName}
                      </Link>
                      <p className="text-sm text-gray-700"><RenderMentions content={comment.content} /></p>
                      {comment.imageUrl && (
                        <img 
                          src={comment.imageUrl} 
                          alt="" 
                          className="mt-2 rounded-lg max-h-48 object-cover" 
                        />
                      )}
                      <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {commentImages[item.id] && (
                <div className="relative inline-block">
                  <img src={commentImages[item.id]} alt="GIF" className="h-24 rounded-lg" />
                  <button
                    type="button"
                    onClick={() => setCommentImages({ ...commentImages, [item.id]: '' })}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-2 items-center">
                <MentionInput
                  value={newComments[item.id] || ''}
                  onChange={(value) => setNewComments({ ...newComments, [item.id]: value })}
                  placeholder="Write a comment... @ to mention, # for tags"
                  rows={1}
                  className="flex-1 rounded-full px-4 py-2 text-sm"
                />
                <GifButton onSelect={(gifUrl) => setCommentImages({ ...commentImages, [item.id]: gifUrl })} />
                <button
                  onClick={() => handleAddComment(item)}
                  disabled={submittingComment === item.id || (!newComments[item.id]?.trim() && !commentImages[item.id])}
                  className="p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-primary-600" />
          Activity Wall
        </h2>
      </div>

      {/* Inline Post Form - show on own profile or friend's wall */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex gap-3">
          {(authUser as any)?.profilePicture ? (
            <img src={(authUser as any).profilePicture} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="flex-1">
            <MentionInput
              value={newPostContent}
              onChange={setNewPostContent}
              placeholder={isOwnProfile ? "What's on your mind? Share an update..." : "Write something on their wall..."}
              rows={3}
            />
            {newPostImage && (
              <div className="relative mt-2">
                <img
                  src={newPostImage}
                  alt="Upload preview"
                  className="max-h-48 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => setNewPostImage(null)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition"
                  title="Add photo"
                >
                  {uploadingImage ? (
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Image className="w-5 h-5" />
                  )}
                </button>
                <GifButton onSelect={(gifUrl) => setNewPostImage(gifUrl)} />
              </div>
              <button
                onClick={handleCreatePost}
                disabled={(!newPostContent.trim() && !newPostImage) || submittingPost}
                className="btn btn-primary btn-sm flex items-center gap-2"
              >
                {submittingPost ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Post
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && page === 1 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-600 mt-4 text-sm">Loading activity...</p>
        </div>
      ) : feedItems.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <MessageSquare className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-lg font-medium">No activity yet</p>
          <p className="text-sm text-gray-500 mt-2">
            {isOwnProfile
              ? "Start sharing your camping adventures! Create posts, join discussions, or share recipes."
              : "This user hasn't posted anything yet."}
          </p>
          {isOwnProfile && (
            <div className="flex gap-3 justify-center mt-4">
              <Link to="/feed" className="btn btn-secondary">
                Join Discussions
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {(() => {
            const SYSTEM_TYPES = new Set(['STARGAZING', 'WALLET_CHAOS', 'WALLET_APOLOGY']);
            const grouped: Array<{ type: 'item'; item: any } | { type: 'group'; key: string; items: any[] }> = [];
            let i = 0;
            while (i < feedItems.length) {
              const item = feedItems[i];
              if (SYSTEM_TYPES.has(item.type) || SYSTEM_TYPES.has(item.activityType)) {
                const group: any[] = [item];
                let j = i + 1;
                while (j < feedItems.length && (SYSTEM_TYPES.has(feedItems[j].type) || SYSTEM_TYPES.has(feedItems[j].activityType))) {
                  group.push(feedItems[j]);
                  j++;
                }
                if (group.length === 1) {
                  grouped.push({ type: 'item', item });
                } else {
                  grouped.push({ type: 'group', key: `grp-${item.id}`, items: group });
                }
                i = j;
              } else {
                grouped.push({ type: 'item', item });
                i++;
              }
            }

            return grouped.map(entry => {
              if (entry.type === 'group') {
                const { key, items } = entry;
                const isExpanded = expandedGroups.has(key);
                const hasStargazing = items.some((i: any) => i.type === 'STARGAZING' || i.activityType === 'STARGAZING');
                const emoji = hasStargazing ? '🔭' : '🪨';
                const label = hasStargazing
                  ? `Walter posted ${items.length} sky report${items.length > 1 ? 's' : ''} this week`
                  : `${items.length} character update${items.length > 1 ? 's' : ''}`;

                return (
                  <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
                    <button
                      onClick={() => setExpandedGroups(prev => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key); else next.add(key);
                        return next;
                      })}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition text-left"
                    >
                      <span className="text-lg">{emoji}</span>
                      <p className="flex-1 text-sm text-gray-600 font-medium">{label}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">{isExpanded ? 'Collapse ▲' : 'Tap to read ▼'}</span>
                    </button>
                    {isExpanded && (
                      <div className="divide-y divide-gray-100 border-t border-gray-100">
                        {items.map((item: any) => (
                          <div key={item.id} className="px-4 py-3">
                            {item.type === 'CAMPGROUND_POST' ? renderCampgroundPost(item) : renderActivityItem(item)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              const { item } = entry;
              return item.type === 'CAMPGROUND_POST'
                ? renderCampgroundPost(item)
                : renderActivityItem(item);
            });
          })()}

          {hasMore && (
            <div className="text-center pt-4">
              <button onClick={loadMore} className="btn btn-secondary" disabled={loading}>
                {loading ? 'Loading...' : 'Load More Activity'}
              </button>
            </div>
          )}
        </div>
      )}

      {shareModalItem && (() => {
        const sUrl = 'https://www.rvunicorn.com/post/' + shareModalItem.id;
        const sText = shareModalItem.content?.substring(0, 100) || 'Check out this post on RVUnicorn!';
        const eu = encodeURIComponent(sUrl);
        const et = encodeURIComponent(sText);
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9999 }} onClick={() => setShareModalItem(null)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Share</h3>
                <button onClick={() => setShareModalItem(null)} className="p-1 hover:bg-gray-100 rounded-full transition"><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 mb-4">
                <p className="text-sm text-gray-800 line-clamp-2">{sText}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <a href={'https://www.facebook.com/sharer/sharer.php?u=' + eu} target="_blank" rel="noopener noreferrer" onClick={() => handleSocialClick('Facebook')} style={{ backgroundColor: '#1877F2' }} className="text-white rounded-xl py-3 flex flex-col items-center gap-1.5 hover:opacity-90">
                  <span className="text-lg">&#x1F4D8;</span><span style={{ fontSize: '10px' }} className="font-medium">Facebook</span>
                </a>
                <a href={'https://twitter.com/intent/tweet?text=' + et + '&url=' + eu} target="_blank" rel="noopener noreferrer" onClick={() => handleSocialClick('X / Twitter')} style={{ backgroundColor: '#000' }} className="text-white rounded-xl py-3 flex flex-col items-center gap-1.5 hover:opacity-90">
                  <span className="text-lg">X</span><span style={{ fontSize: '10px' }} className="font-medium">X / Twitter</span>
                </a>
                <a href={'https://www.reddit.com/submit?url=' + eu} target="_blank" rel="noopener noreferrer" onClick={() => handleSocialClick('Reddit')} style={{ backgroundColor: '#FF4500' }} className="text-white rounded-xl py-3 flex flex-col items-center gap-1.5 hover:opacity-90">
                  <span className="text-lg">&#x1F916;</span><span style={{ fontSize: '10px' }} className="font-medium">Reddit</span>
                </a>
                <a href={'https://wa.me/?text=' + et + '%20' + eu} target="_blank" rel="noopener noreferrer" onClick={() => { setShareModalItem(null); }} style={{ backgroundColor: '#25D366' }} className="text-white rounded-xl py-3 flex flex-col items-center gap-1.5 hover:opacity-90">
                  <span className="text-lg">&#x1F4AC;</span><span style={{ fontSize: '10px' }} className="font-medium">WhatsApp</span>
                </a>
                <a href={'https://www.threads.net/intent/post?text=' + et + '%20' + eu} target="_blank" rel="noopener noreferrer" onClick={() => setShareModalItem(null)} style={{ backgroundColor: '#000' }} className="text-white rounded-xl py-3 flex flex-col items-center gap-1.5 hover:opacity-90">
                  <span className="text-lg">&#x1F9F5;</span><span style={{ fontSize: '10px' }} className="font-medium">Threads</span>
                </a>
                <a href={'mailto:?subject=Check%20this%20out&body=' + et + '%0A%0A' + eu} onClick={() => setShareModalItem(null)} style={{ backgroundColor: '#666' }} className="text-white rounded-xl py-3 flex flex-col items-center gap-1.5 hover:opacity-90">
                  <span className="text-lg">&#x2709;&#xFE0F;</span><span style={{ fontSize: '10px' }} className="font-medium">Email</span>
                </a>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(sUrl); setShareModalItem(null); }} className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-sm text-gray-700">
                <Copy className="w-4 h-4" /> Copy Link
              </button>
            </div>
          </div>
        );
      })()}

      {handlePrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 10000 }} onClick={() => { setHandlePrompt(null); setHandleInput(''); }}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Save your {handlePrompt.platform} handle?</h3>
            <p className="text-sm text-gray-600 mb-4">Add your {handlePrompt.platform} username to your RVUnicorn profile so friends can find you!</p>
            <input
              type="text"
              value={handleInput}
              onChange={e => setHandleInput(e.target.value)}
              placeholder={handlePrompt.platform === 'Facebook' ? 'facebook.com/yourpage' : handlePrompt.platform === 'X / Twitter' ? '@yourhandle' : 'your username'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { setHandlePrompt(null); setHandleInput(''); }} className="flex-1 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Skip</button>
              <button onClick={saveHandle} className="flex-1 py-2 text-sm bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:opacity-90 transition font-medium">Save</button>
            </div>
          </div>
        </div>
      )}

    </div>



  );
}
