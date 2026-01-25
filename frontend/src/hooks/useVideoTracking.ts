import { useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface UseVideoTrackingOptions {
  videoId: string;
  totalDuration: number;
  source?: 'FEED' | 'PROFILE' | 'DIRECT' | 'SHARE' | 'DISCOVERY';
  onComplete?: () => void;
}

interface TrackingState {
  sessionId: string;
  watchedSeconds: number;
  maxWatchedSecond: number;
  rewatchCount: number;
  lastReportedSecond: number;
}

export function useVideoTracking({
  videoId,
  totalDuration,
  source = 'FEED',
  onComplete
}: UseVideoTrackingOptions) {
  const stateRef = useRef<TrackingState>({
    sessionId: uuidv4(),
    watchedSeconds: 0,
    maxWatchedSecond: 0,
    rewatchCount: 0,
    lastReportedSecond: 0
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Get device type
  const getDeviceType = (): string => {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'TABLET';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'MOBILE';
    }
    return 'DESKTOP';
  };

  // Report watch progress to backend
  const reportProgress = useCallback(async (dropOffSecond?: number) => {
    const state = stateRef.current;
    
    try {
      await fetch(`/api/analytics/video/${videoId}/watch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sessionId: state.sessionId,
          watchedSeconds: state.watchedSeconds,
          totalDuration,
          dropOffSecond,
          rewatchCount: state.rewatchCount,
          source,
          deviceType: getDeviceType()
        })
      });

      state.lastReportedSecond = state.watchedSeconds;
    } catch (error) {
      console.error('Error reporting video progress:', error);
    }
  }, [videoId, totalDuration, source]);

  // Handle time update (called frequently during playback)
  const handleTimeUpdate = useCallback((currentTime: number) => {
    const state = stateRef.current;
    const currentSecond = Math.floor(currentTime);

    // Update watched time (only counts forward progress)
    if (currentSecond > state.watchedSeconds) {
      state.watchedSeconds = currentSecond;
    }

    // Track rewatches (when user seeks back and watches again)
    if (currentSecond < state.maxWatchedSecond - 3) {
      // User went back more than 3 seconds
      state.rewatchCount++;
    }

    // Update max watched position
    if (currentSecond > state.maxWatchedSecond) {
      state.maxWatchedSecond = currentSecond;
    }

    // Report every 5 seconds of new progress
    if (state.watchedSeconds - state.lastReportedSecond >= 5) {
      reportProgress();
    }
  }, [reportProgress]);

  // Handle video pause or leave
  const handlePause = useCallback(() => {
    const state = stateRef.current;
    const currentTime = videoRef.current?.currentTime || 0;
    const completion = totalDuration > 0 ? (state.watchedSeconds / totalDuration) * 100 : 0;
    
    // If they didn't finish, record the drop-off point
    if (completion < 95) {
      reportProgress(Math.floor(currentTime));
    } else {
      reportProgress();
      onComplete?.();
    }
  }, [totalDuration, reportProgress, onComplete]);

  // Handle video end
  const handleEnded = useCallback(() => {
    const state = stateRef.current;
    state.watchedSeconds = totalDuration;
    reportProgress();
    onComplete?.();
  }, [totalDuration, reportProgress, onComplete]);

  // Initialize tracking on a video element
  const initTracking = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;

    // Reset state for new session
    stateRef.current = {
      sessionId: uuidv4(),
      watchedSeconds: 0,
      maxWatchedSecond: 0,
      rewatchCount: 0,
      lastReportedSecond: 0
    };

    // Set up event listeners
    const onTimeUpdate = () => handleTimeUpdate(video.currentTime);
    const onPause = () => handlePause();
    const onEnded = () => handleEnded();

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);

    // Cleanup
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      
      // Final report on unmount
      handlePause();
    };
  }, [handleTimeUpdate, handlePause, handleEnded]);

  // Report on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const state = stateRef.current;
      const currentTime = videoRef.current?.currentTime || 0;
      
      // Use sendBeacon for reliable delivery on page close
      navigator.sendBeacon(
        `/api/analytics/video/${videoId}/watch`,
        JSON.stringify({
          sessionId: state.sessionId,
          watchedSeconds: state.watchedSeconds,
          totalDuration,
          dropOffSecond: Math.floor(currentTime),
          rewatchCount: state.rewatchCount,
          source,
          deviceType: getDeviceType()
        })
      );
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [videoId, totalDuration, source]);

  return {
    initTracking,
    getCompletionRate: () => {
      return totalDuration > 0 
        ? Math.min(100, (stateRef.current.watchedSeconds / totalDuration) * 100)
        : 0;
    },
    getWatchedSeconds: () => stateRef.current.watchedSeconds,
    getRewatchCount: () => stateRef.current.rewatchCount
  };
}

// Simpler hook for just tracking a view (not detailed watch behavior)
export function useViewTracking() {
  const trackedRef = useRef<Set<string>>(new Set());

  const trackView = useCallback(async (
    contentId: string, 
    contentType: 'photo' | 'video',
    source: string = 'FEED'
  ) => {
    // Prevent duplicate tracking in same session
    const key = `${contentType}-${contentId}`;
    if (trackedRef.current.has(key)) return;
    trackedRef.current.add(key);

    try {
      // For photos, just increment view count
      if (contentType === 'photo') {
        await fetch(`/api/photos/${contentId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
      }
      // For videos, the view is tracked via the watch endpoint
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  }, []);

  return { trackView };
}

// Hook for tracking profile visits
export function useProfileTracking() {
  const trackProfileVisit = useCallback(async (
    profileUserId: string,
    source: 'CONTENT' | 'TAG' | 'MENTION' | 'SEARCH' | 'DIRECT' = 'DIRECT',
    sourceContentId?: string
  ) => {
    try {
      await fetch(`/api/analytics/profile-visit/${profileUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ source, sourceContentId })
      });
    } catch (error) {
      console.error('Error tracking profile visit:', error);
    }
  }, []);

  return { trackProfileVisit };
}

export default useVideoTracking;
