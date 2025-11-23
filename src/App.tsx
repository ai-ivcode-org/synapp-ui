import React, { useRef, useEffect, useMemo } from 'react'
import './App.css'
import Chat from './components/chat/Chat'
import { ChatController } from './services/chat-service/ChatController'
import type { ChatHandle } from './components/chat/Chat'

export default function App() {
  const chatRef = useRef<ChatHandle | null>(null)
  const controller = useMemo(() => new ChatController('http://localhost:4000'), [])

  useEffect(() => {
    controller.attach(chatRef)
    return () => controller.detach()
  }, [controller])

  return (
    <div style={{ width: '100%', display: 'inline-block', height: '100%' }}>
      <Chat ref={chatRef} onSend={controller.onSend} />
    </div>
  )
}