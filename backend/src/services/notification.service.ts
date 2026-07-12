import { sendEmail, notificationEmail, friendRequestEmail, mentionEmail } from './email-sms.service';
import { canSendEmail, queueForDigest, EMAIL_PRIORITY } from './emailThrottle';

import { prisma } from '../lib/prisma';

interface NotificationData {
  userId: string;
  type: string;
  title: string;
  content: string;
  link?: string;
  eventId?: string;
  eventTitle?: string;
  eventDate?: Date;
  campgroundName?: string;
  actorId?: string;
  actorName?: string;
}

export const notificationService = {
  async create(data: NotificationData) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          content: data.content,
          link: data.link,
          eventId: data.eventId,
          eventTitle: data.eventTitle,
          eventDate: data.eventDate,
          campgroundName: data.campgroundName,
          actorId: data.actorId,
          actorName: data.actorName,
        },
      });

      // Send email notification if user has it enabled — throttled
      try {
        const user = await prisma.user.findUnique({
          where: { id: data.userId },
          select: { email: true, firstName: true, emailOnNotification: true }
        });
        if (user && user.emailOnNotification) {
          const throttle = await canSendEmail(data.userId, data.type);

          if (throttle.canSend) {
            const typeEmojiMap: Record<string, string> = {
              EVENT_INVITE: '\u{1F4C5}', EVENT_UPDATE: '\u{1F4DD}', RSVP_CHANGE: '\u2705',
              COMMENT_ADDED: '\u{1F4AC}', NOTE_ADDED: '\u{1F4CC}', CHECKLIST_ASSIGNED: '\u2705',
              CHECKLIST_COMPLETED: '\u{1F389}', CAMPGROUND_ADDED: '\u{1F3D5}\uFE0F',
              FRIEND_REQUEST: '\u{1F91D}', MENTION: '\u{1F4E3}', LIKE: '\u2764\uFE0F',
            };
            const emailContent = notificationEmail({
              recipientName: user.firstName || 'there',
              title: data.title,
              content: data.content,
              link: data.link,
              emoji: typeEmojiMap[data.type] || '\u{1F514}',
            });
            await sendEmail({ to: user.email, ...emailContent });

            // Log the email send
            await prisma.emailLog.create({
              data: {
                userId: data.userId,
                type: data.type,
                priority: throttle.priority,
                subject: emailContent.subject,
              },
            });
          } else if (throttle.queueForDigest && throttle.digestType) {
            await queueForDigest(data.userId, throttle.digestType, data.type, {
              title: data.title,
              content: data.content,
              link: data.link,
              actorName: data.actorName,
            });
          }
        }
      } catch (emailErr) {
        console.error('Email notification error (non-fatal):', emailErr);
      }

      return notification;
    } catch (error: any) {
      console.error('Create notification error:', error);
    }
  },

  // Event Invite
  async notifyEventInvite(params: {
    userId: string;
    eventId: string;
    eventTitle: string;
    eventDate: Date;
    campgroundName?: string;
    invitedBy: { id: string; name: string };
  }) {
    return this.create({
      userId: params.userId,
      type: 'EVENT_INVITE',
      title: 'Event Invitation',
      content: `${params.invitedBy.name} invited you to "${params.eventTitle}"`,
      link: `/events/${params.eventId}`,
      eventId: params.eventId,
      eventTitle: params.eventTitle,
      eventDate: params.eventDate,
      campgroundName: params.campgroundName,
      actorId: params.invitedBy.id,
      actorName: params.invitedBy.name,
    });
  },

  // Event Update
  async notifyEventUpdate(params: {
    userIds: string[];
    eventId: string;
    eventTitle: string;
    eventDate: Date;
    campgroundName?: string;
    updatedBy: { id: string; name: string };
    updateType: string; // 'date', 'location', 'details'
  }) {
    const promises = params.userIds.map(userId =>
      this.create({
        userId,
        type: 'EVENT_UPDATE',
        title: 'Event Updated',
        content: `${params.updatedBy.name} updated "${params.eventTitle}" (${params.updateType} changed)`,
        link: `/events/${params.eventId}`,
        eventId: params.eventId,
        eventTitle: params.eventTitle,
        eventDate: params.eventDate,
        campgroundName: params.campgroundName,
        actorId: params.updatedBy.id,
        actorName: params.updatedBy.name,
      })
    );
    return Promise.all(promises);
  },

  // Note Added
  async notifyNoteAdded(params: {
    userIds: string[];
    eventId: string;
    eventTitle: string;
    eventDate: Date;
    campgroundName?: string;
    notePreview: string;
    addedBy: { id: string; name: string };
  }) {
    const promises = params.userIds.map(userId =>
      this.create({
        userId,
        type: 'NOTE_ADDED',
        title: 'New Note',
        content: `${params.addedBy.name} added a note to "${params.eventTitle}": "${params.notePreview}"`,
        link: `/events/${params.eventId}?ref=inbox#notes`,
        eventId: params.eventId,
        eventTitle: params.eventTitle,
        eventDate: params.eventDate,
        campgroundName: params.campgroundName,
        actorId: params.addedBy.id,
        actorName: params.addedBy.name,
      })
    );
    return Promise.all(promises);
  },

  // Checklist Item Assigned
  async notifyChecklistAssigned(params: {
    userId: string;
    eventId: string;
    eventTitle: string;
    eventDate: Date;
    campgroundName?: string;
    itemTitle: string;
    dueDate?: string;
    assignedBy: { id: string; name: string };
  }) {
    return this.create({
      userId: params.userId,
      type: 'CHECKLIST_ASSIGNED',
      title: 'Task Assigned',
      content: `${params.assignedBy.name} assigned "${params.itemTitle}" to you in "${params.eventTitle}"${params.dueDate ? `\nDue: ${params.dueDate}` : ''}`,
      link: `/events/${params.eventId}?ref=inbox#tasks`,
      eventId: params.eventId,
      eventTitle: params.eventTitle,
      eventDate: params.eventDate,
      campgroundName: params.campgroundName,
      actorId: params.assignedBy.id,
      actorName: params.assignedBy.name,
    });
  },

  // Checklist Item Completed
  async notifyChecklistCompleted(params: {
    userIds: string[];
    eventId: string;
    eventTitle: string;
    eventDate: Date;
    campgroundName?: string;
    itemTitle: string;
    completedBy: { id: string; name: string };
  }) {
    const promises = params.userIds.map(userId =>
      this.create({
        userId,
        type: 'CHECKLIST_COMPLETED',
        title: 'Task Completed',
        content: `${params.completedBy.name} completed "${params.itemTitle}" in "${params.eventTitle}"`,
        link: `/events/${params.eventId}?ref=inbox#tasks`,
        eventId: params.eventId,
        eventTitle: params.eventTitle,
        eventDate: params.eventDate,
        campgroundName: params.campgroundName,
        actorId: params.completedBy.id,
        actorName: params.completedBy.name,
      })
    );
    return Promise.all(promises);
  },

  // RSVP Change
  async notifyRSVPChange(params: {
    userIds: string[];
    eventId: string;
    eventTitle: string;
    eventDate: Date;
    campgroundName?: string;
    rsvpStatus: string; // 'ATTENDING', 'MAYBE', 'DECLINED'
    changedBy: { id: string; name: string };
  }) {
    const promises = params.userIds.map(userId =>
      this.create({
        userId,
        type: 'RSVP_CHANGE',
        title: 'RSVP Updated',
        content: `${params.changedBy.name} changed RSVP to "${params.rsvpStatus}" for "${params.eventTitle}"`,
        link: `/events/${params.eventId}?ref=inbox#rsvp`,
        eventId: params.eventId,
        eventTitle: params.eventTitle,
        eventDate: params.eventDate,
        campgroundName: params.campgroundName,
        actorId: params.changedBy.id,
        actorName: params.changedBy.name,
      })
    );
    return Promise.all(promises);
  },

  // Comment Added
  async notifyCommentAdded(params: {
    userIds: string[];
    eventId: string;
    eventTitle: string;
    eventDate: Date;
    campgroundName?: string;
    commentPreview: string;
    commentedBy: { id: string; name: string };
  }) {
    const promises = params.userIds.map(userId =>
      this.create({
        userId,
        type: 'COMMENT_ADDED',
        title: 'New Comment',
        content: `${params.commentedBy.name} commented on "${params.eventTitle}": "${params.commentPreview}"`,
        link: `/events/${params.eventId}?ref=inbox#comments`,
        eventId: params.eventId,
        eventTitle: params.eventTitle,
        eventDate: params.eventDate,
        campgroundName: params.campgroundName,
        actorId: params.commentedBy.id,
        actorName: params.commentedBy.name,
      })
    );
    return Promise.all(promises);
  },

  // Campground Added to Event
  async notifyCampgroundAdded(params: {
    userIds: string[];
    eventId: string;
    eventTitle: string;
    eventDate: Date;
    campgroundName: string;
    addedBy: { id: string; name: string };
  }) {
    const promises = params.userIds.map(userId =>
      this.create({
        userId,
        type: 'CAMPGROUND_ADDED',
        title: 'Campground Added',
        content: `${params.addedBy.name} added ${params.campgroundName} to "${params.eventTitle}"`,
        link: `/events/${params.eventId}`,
        eventId: params.eventId,
        eventTitle: params.eventTitle,
        eventDate: params.eventDate,
        campgroundName: params.campgroundName,
        actorId: params.addedBy.id,
        actorName: params.addedBy.name,
      })
    );
    return Promise.all(promises);
  },
};
