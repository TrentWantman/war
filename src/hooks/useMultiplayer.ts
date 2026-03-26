import { useRef, useCallback, useEffect, useState } from 'react'

type ServerMessage = {
  type: string
  [key: string]: unknown
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

interface UseMultiplayerOptions {
  url: string
  onMessage: (message: ServerMessage) => void
  enabled?: boolean
}

export function useMultiplayer({ url, onMessage, enabled = true }: UseMultiplayerOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    if (!enabled) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setStatus('connecting')
    const ws = new WebSocket(url)

    ws.onopen = () => {
      setStatus('connected')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ServerMessage
        if (data.type === 'ping') return
        onMessageRef.current(data)
      } catch {
      }
    }

    ws.onclose = () => {
      setStatus('disconnected')
      wsRef.current = null
      if (enabled) {
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }

    ws.onerror = () => {
      ws.close()
    }

    wsRef.current = ws
  }, [url, enabled])

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
    wsRef.current?.close()
    wsRef.current = null
    setStatus('disconnected')
  }, [])

  const send = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  useEffect(() => {
    if (enabled) {
      connect()
    }
    return () => {
      disconnect()
    }
  }, [enabled, connect, disconnect])

  return { status, send, connect, disconnect }
}
