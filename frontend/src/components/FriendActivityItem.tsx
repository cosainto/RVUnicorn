import React from 'react';
import ActivityMuteMenu from './ActivityMuteMenu';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface Actor {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
}

interface SecondaryUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profileLink: string;
}

interface FeedItem {
  id: string;
  type: string;
  actor: Actor;
  content?: string;
  title?: string;
  targetName?: string;
  targetLink?: string;
  targetUser?: { id: string; firstName: string; lastName: string; username: string };
  secondaryUser?: SecondaryUser;
  createdAt: string;
  activityType: string;
  activityIcon: string;
  activityLabel: string;
  activityColor?: string;
  campground?: { id: string; name: string; location?: string; state?: string };
  imageUrl?: string;
  isFriendActivity?: boolean;
  hasMutualFriendInteraction?: boolean;
  isPackingActivity?: boolean;
  isFriendRequest?: boolean;
  isCampingBuddy?: boolean;
  canRespond?: boolean;
  isRead?: boolean;
  metadata?: any;
}

interface FriendActivityItemProps {
  item: FeedItem;
  currentUserId: string;
  onAcceptFriendRequest?: (friendshipId: string) => void;
  onDeclineFriendRequest?: (friendshipId: string) => void;
  onAcceptPackItem?: (packItemId: string) => void;
  onDeclinePackItem?: (packItemId: string) => void;
  onVolunteerPackItem?: (packItemId: string) => void;
}

const FriendActivityItem: React.FC<FriendActivityItemProps> = ({
  item,
  currentUserId,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onAcceptPackItem,
  onDeclinePackItem,
  onVolunteerPackItem,
}) => {
  const timeAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });

  const renderActivityMessage = () => {
    const actorName = (
      <Link
        to={'/profile/' + item.actor?.username}
        className="font-semibold text-navy-700 hover:underline"
      >
        {item.actor?.firstName} {item.actor?.lastName}
      </Link>
    );

    // Mutual friend interactions (Friend A commented on Friend B)
    if (item.hasMutualFriendInteraction && item.secondaryUser) {
      return (
        <span className="text-gray-700">
          {actorName}
          <span className="mx-1">{item.activityLabel}</span>
          <Link
            to={item.secondaryUser.profileLink}
            className="font-semibold text-navy-700 hover:underline"
          >
            {item.secondaryUser.firstName} {item.secondaryUser.lastName}
          </Link>
          <span>'s wall</span>
        </span>
      );
    }

    // Recipe likes - "User likes a recipe"
    if (item.type === 'RECIPE_LIKED') {
      return (
        <span className="text-gray-700">
          {actorName}
          <span className="mx-1">❤️ likes</span>
          {item.targetLink ? (
            <Link to={item.targetLink} className="font-medium text-orange-600 hover:underline">
              {item.targetName || 'a recipe'}
            </Link>
          ) : (
            <span className="font-medium">{item.targetName || 'a recipe'}</span>
          )}
        </span>
      );
    }

    // Recipe comments - "User commented on this recipe"
    if (item.type === 'RECIPE_COMMENTED') {
      return (
        <span className="text-gray-700">
          {actorName}
          <span className="mx-1">💬 commented on</span>
          {item.targetLink ? (
            <Link to={item.targetLink} className="font-medium text-orange-600 hover:underline">
              {item.targetName || 'this recipe'}
            </Link>
          ) : (
            <span className="font-medium">{item.targetName || 'this recipe'}</span>
          )}
        </span>
      );
    }

    // Event comments - "User commented on this event"
    if (item.type === 'EVENT_COMMENTED') {
      return (
        <span className="text-gray-700">
          {actorName}
          <span className="mx-1">💬 commented on</span>
          {item.targetLink ? (
            <Link to={item.targetLink} className="font-medium text-blue-600 hover:underline">
              {item.targetName || 'this event'}
            </Link>
          ) : (
            <span className="font-medium">{item.targetName || 'this event'}</span>
          )}
        </span>
      );
    }

    // Standard activity with target link
    if (item.targetLink && item.targetName) {
      return (
        <span className="text-gray-700">
          {actorName}
          <span className={'mx-1 ' + (item.activityColor || '')}>{item.activityLabel}</span>
          <Link to={item.targetLink} className="font-medium text-blue-600 hover:underline">
            {item.targetName}
          </Link>
        </span>
      );
    }

    return (
      <span className="text-gray-700">
        {actorName}
        <span className={'mx-1 ' + (item.activityColor || '')}>{item.activityLabel}</span>
        {item.targetName && <span className="font-medium">{item.targetName}</span>}
      </span>
    );
  };

  const renderPackingContent = () => {
    if (item.isFriendRequest) {
      return (
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div className="text-2xl">👋</div>
          <div className="flex-1">
            <p className="text-gray-700">
              <Link
                to={'/profile/' + item.actor?.username}
                className="font-semibold text-navy-700 hover:underline"
              >
                {item.actor?.firstName} {item.actor?.lastName}
              </Link>
              <span> wants to be your camping buddy!</span>
            </p>
          </div>
          {item.canRespond && (
            <div className="flex gap-2">
              <button
                onClick={() => onAcceptFriendRequest?.(item.metadata?.friendshipId)}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                Accept
              </button>
              <button
                onClick={() => onDeclineFriendRequest?.(item.metadata?.friendshipId)}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
              >
                Decline
              </button>
            </div>
          )}
        </div>
      );
    }

    if (item.isCampingBuddy) {
      return (
        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
          <div className="text-2xl">🏕️</div>
          <div className="flex-1">
            <p className="text-gray-700">
              <span>You and </span>
              <Link
                to={'/profile/' + item.actor?.username}
                className="font-semibold text-navy-700 hover:underline"
              >
                {item.actor?.firstName} {item.actor?.lastName}
              </Link>
              <span> are now camping buddies!</span>
            </p>
          </div>
        </div>
      );
    }

    if (item.isPackingActivity) {
      return (
        <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
          <div className="text-2xl">{item.activityIcon}</div>
          <div className="flex-1">
            <p className="text-gray-700">{item.content}</p>
            {item.targetLink && (
              <Link to={item.targetLink} className="text-sm text-blue-600 hover:underline">
                View event →
              </Link>
            )}
          </div>
          {item.canRespond && item.type === 'PACK_ITEM_ASSIGNMENT_REQUEST' && (
            <div className="flex gap-2">
              <button
                onClick={() => onAcceptPackItem?.(item.metadata?.packItemId)}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                I'll bring it
              </button>
              <button
                onClick={() => onDeclinePackItem?.(item.metadata?.packItemId)}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
              >
                Can't bring it
              </button>
            </div>
          )}
          {item.canRespond && item.type === 'PACK_ITEM_NEEDS_VOLUNTEER' && (
            <button
              onClick={() => onVolunteerPackItem?.(item.metadata?.packItemId)}
              className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700"
            >
              I'll volunteer!
            </button>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className={'p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ' + (!item.isRead ? 'bg-blue-50/30' : '')}>
      {(item.isPackingActivity || item.isFriendRequest || item.isCampingBuddy) ? (
        renderPackingContent()
      ) : (
        <div className="flex gap-3">
          <Link to={'/profile/' + item.actor?.username} className="flex-shrink-0">
            {item.actor?.profilePicture ? (
              <img
                src={item.actor.profilePicture}
                alt={item.actor.firstName + "'s avatar"}
                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                {item.actor?.firstName?.[0]}{item.actor?.lastName?.[0]}
              </div>
            )}
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">{item.activityIcon}</span>
              <div className="flex-1">
                {renderActivityMessage()}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-400">{timeAgo}</div>
                  <ActivityMuteMenu
                    activityId={item.id}
                    actorId={item.actor?.id}
                    actorName={item.actor?.firstName}
                    eventId={item.type.includes("EVENT") ? item.targetLink?.split("/").pop() : undefined}
                    eventTitle={item.type.includes("EVENT") ? item.targetName : undefined}
                  />
                </div>
              </div>
            </div>

            {item.content && !item.isPackingActivity && (
              <p className="mt-2 text-gray-600 text-sm line-clamp-2">{item.content}</p>
            )}

            {item.imageUrl && (
              <div className="mt-2">
                {item.targetLink ? (
                  <Link to={item.targetLink}>
                    <img
                      src={item.imageUrl}
                      alt="Activity preview"
                      className="w-full max-w-xs h-32 object-cover rounded-lg border border-gray-200 hover:opacity-90"
                    />
                  </Link>
                ) : (
                  <img
                    src={item.imageUrl}
                    alt="Activity preview"
                    className="w-full max-w-xs h-32 object-cover rounded-lg border border-gray-200"
                  />
                )}
              </div>
            )}

            {item.campground && (
              <Link
                to={'/campgrounds/' + item.campground.id}
                className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                <span className="text-sm">🏕️</span>
                <span className="text-sm font-medium text-gray-700">{item.campground.name}</span>
                {item.campground.state && (
                  <span className="text-xs text-gray-500">{item.campground.state}</span>
                )}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FriendActivityItem;
