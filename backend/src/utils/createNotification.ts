import { PrismaClient } from '@prisma/client';
import { pushNotification } from '../routes/notification.routes';
import { sendWebPush } from './webPush';

const prisma = new PrismaClient();

interface NotifyOptions {
  userId: string;
  type: string;
  content: string;
  link?: string;
  category?: 'MESSAGE' | 'FRIEND' | 'CAMPGROUND' | 'SYSTEM';
  actorId?: string;
  actorName?: string;
  actorAvatar?: string;
  metadata?: any;
}

export async function createNotification(opts: NotifyOptions) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        content: opts.content,
        link: opts.link,
        category: opts.category || 'SYSTEM',
        actorId: opts.actorId,
        actorName: opts.actorName,
        actorAvatar: opts.actorAvatar,
        metadata: opts.metadata || {},
      },
    });
    pushNotification(opts.userId, notification);
    // Also send web push for users not currently on the page
    sendWebPush(opts.userId, {
      title: 'RVUnicorn 🦄',
      body: opts.content,
      url: opts.link || '/basecamp',
    }).catch(() => {});
    return notification;
  } catch (e) {
    console.error('Failed to create notification:', e);
    return null;
  }
}

export const notifyMessage = (userId: string, senderName: string, senderId: string, preview: string, senderAvatar?: string) =>
  createNotification({ userId, type: 'NEW_MESSAGE', category: 'MESSAGE', content: 'sent you a message', link: '/messages', actorId: senderId, actorName: senderName, actorAvatar: senderAvatar, metadata: { preview: preview.substring(0, 100) } });

export const notifyFriendRequest = (userId: string, senderName: string, senderId: string, senderAvatar?: string) =>
  createNotification({ userId, type: 'FRIEND_REQUEST', category: 'FRIEND', content: 'sent you a friend request', link: '/friends', actorId: senderId, actorName: senderName, actorAvatar: senderAvatar });

export const notifyFriendAccepted = (userId: string, friendName: string, friendId: string, friendAvatar?: string) =>
  createNotification({ userId, type: 'FRIEND_ACCEPTED', category: 'FRIEND', content: 'accepted your friend request', link: `/profile/${friendName}`, actorId: friendId, actorName: friendName, actorAvatar: friendAvatar });

export const notifyCampgroundUpdate = (userId: string, campName: string, campId: string, updateType: string) =>
  createNotification({ userId, type: 'CAMPGROUND_UPDATE', category: 'CAMPGROUND', content: `${campName} posted a new ${updateType}`, link: `/campgrounds/${campId}`, metadata: { campgroundId: campId } });

export const notifyCheckIn = (userId: string, userName: string, userAvatar: string, campName: string, campId: string) =>
  createNotification({ userId, type: 'FRIEND_CHECKIN', category: 'FRIEND', content: `checked in at ${campName}`, link: `/campgrounds/${campId}`, actorName: userName, actorAvatar: userAvatar });
