import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { tokenStorage, API_BASE_URL } from '@/services/api';
import type { Notification } from '@/types';

/**
 * Derive WebSocket base URL from the HTTP API base URL.
 * e.g. "http://localhost:8000/api/v1" → "ws://localhost:8000"
 */
const WS_BASE = API_BASE_URL
  .replace(/^https:/, 'wss:')
  .replace(/^http:/, 'ws:')
  .replace(/\/api\/v1\/?$/, '');

const RECONNECT_DELAY_MS = 3_000;

/**
 * Opens a WebSocket to /ws/notifications/ and updates the React Query
 * ['notifications'] cache in real-time whenever the server pushes a new
 * notification. Reconnects automatically on close/error and whenever the
 * app returns to the foreground.
 *
 * @param enabled - pass `isAuthenticated` so we only connect when logged in
 */
export function useNotificationSocket(enabled: boolean): void {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  const clearRetry = useCallback(() => {
    if (retryRef.current !== null) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearRetry();
    if (wsRef.current) {
      // Null out handlers before closing so onclose doesn't schedule a retry
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [clearRetry]);

  const connect = useCallback(async () => {
    if (!mountedRef.current || !enabled) return;

    // Don't open a second socket if one is already open/connecting
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const token = await tokenStorage.getAccess();
    if (!token || !mountedRef.current) return;

    const url = `${WS_BASE}/ws/notifications/?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      clearRetry();
    };

    ws.onmessage = (event) => {
      try {
        const incoming: Notification = JSON.parse(event.data as string);
        queryClient.setQueryData(['notifications'], (old: any) => {
          if (!old?.results) return old;
          // Idempotent: skip if already in cache
          const exists = old.results.some((n: Notification) => n.id === incoming.id);
          if (exists) return old;
          return {
            ...old,
            count: (old.count ?? 0) + 1,
            results: [incoming, ...old.results],
          };
        });
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      // onclose fires right after onerror; reconnect logic lives there
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (mountedRef.current && enabled) {
        clearRetry();
        retryRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };
  }, [enabled, queryClient, clearRetry]);

  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      connect();
    }

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active' && enabled) {
        connect();
      } else if (nextState === 'background') {
        // Optionally disconnect in background to save battery
        // disconnect();
      }
    };

    const appStateSub = AppState.addEventListener('change', handleAppState);

    return () => {
      mountedRef.current = false;
      appStateSub.remove();
      disconnect();
    };
  }, [enabled, connect, disconnect]);
}
