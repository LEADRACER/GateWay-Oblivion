'use client';

// ── GateWay:Oblivion — WebSocket Hook with Auto-Reconnect ──────────

import { useCallback, useEffect, useRef, useState } from 'react';

export type WSStatus = 'disconnected' | 'connecting' | 'connected';

export interface WSMessage {
  type: string;
  payload: unknown;
  timestamp: string;
}

interface UseWSOptions {
  url?: string;
  onMessage?: (msg: WSMessage) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

const DEFAULT_RECONNECT_MS = 3000;
const DEFAULT_MAX_ATTEMPTS = 20;

export function useWS({
  url,
  onMessage,
  reconnectInterval = DEFAULT_RECONNECT_MS,
  maxReconnectAttempts = DEFAULT_MAX_ATTEMPTS,
}: UseWSOptions = {}) {
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!url || !mountedRef.current) return;

    setStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) {
        ws.close();
        return;
      }
      setStatus('connected');
      reconnectAttempts.current = 0;
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('disconnected');
      wsRef.current = null;

      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(connect, reconnectInterval);
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        setLastMessage(msg);
        onMessage?.(msg);
      } catch {
        // Binary or unparseable messages are ignored
      }
    };
  }, [url, onMessage, reconnectInterval, maxReconnectAttempts]);

  const send = useCallback((data: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const disconnect = useCallback(() => {
    mountedRef.current = false;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { status, lastMessage, send, disconnect, reconnect: connect };
}
