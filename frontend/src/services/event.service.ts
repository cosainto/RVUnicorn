import api from './api';

export interface Event {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  siteNumber?: string;
  visibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE';
  creatorId: string;
  campgroundId?: string;
  creator: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  campground?: {
    id: string;
    name: string;
    slug: string;
    city: string;
    state: string;
  };
  invites?: EventInvite[];
  createdAt: string;
  updatedAt: string;
}

export interface EventInvite {
  id: string;
  eventId: string;
  inviteeId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'MAYBE';
  invitee: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

export const eventService = {
  async getEvents(filters?: {
    userId?: string;
    campgroundId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.campgroundId) params.append('campgroundId', filters.campgroundId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const { data } = await api.get<Event[]>(`/events?${params.toString()}`);
    return data;
  },

  async getEvent(eventId: string) {
    const { data } = await api.get<Event>(`/events/${eventId}`);
    return data;
  },

  async createEvent(eventData: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    campgroundId?: string;
    siteNumber?: string;
    visibility?: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE';
    inviteUserIds?: string[];
  }) {
    const { data } = await api.post<Event>('/events', eventData);
    return data;
  },

  async updateEvent(eventId: string, eventData: Partial<Event>) {
    const { data } = await api.put<Event>(`/events/${eventId}`, eventData);
    return data;
  },

  async deleteEvent(eventId: string) {
    await api.delete(`/events/${eventId}`);
  },

  async inviteUsers(eventId: string, userIds: string[]) {
    await api.post(`/events/${eventId}/invite`, { userIds });
  },

  async respondToInvite(eventId: string, status: 'ACCEPTED' | 'DECLINED' | 'MAYBE') {
    const { data } = await api.put(`/events/${eventId}/respond`, { status });
    return data;
  },

  async getMyInvites() {
    const { data } = await api.get('/events/my/invites');
    return data;
  },
};
