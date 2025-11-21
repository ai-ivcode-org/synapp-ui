import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import './Chat.css'

export type Sender = 'user' | 'assistant'

export interface Message {
  id: number
  text: string
  sender: Sender
  time: number
}

interface ChatProps {
  onSend?: (msg: Message) => void
  initialMessages?: Message[]
}

export default function Chat({ onSend, initialMessages = [] }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: 'Welcome to **chat**!\n\nYou can use _Markdown_ (e.g. `inline code`, lists, tables).', sender: 'assistant', time: Date.now() },
    ...initialMessages
  ])

  const [input, setInput] = useState('')
  const [user, setUser] = useState<Sender>('user')
  const containerRef = useRef<HTMLDivElement | null>(null)

  // flag to indicate that the next messages update should trigger a smooth scroll
  const shouldScrollRef = useRef(false)

  useEffect(() => {
    if (!shouldScrollRef.current) return
    const el = containerRef.current
    if (!el) {
      shouldScrollRef.current = false
      return
    }

    // run after paint to allow smooth scrolling without a jump
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      shouldScrollRef.current = false
    })
  }, [messages])

  function addMessage(text: string, sender: Sender = 'user') {
    const trimmed = text?.trim()
    if (!trimmed) return
    const msg: Message = { id: Date.now(), text: trimmed, sender, time: Date.now() }

    // request a smooth scroll for this update only
    shouldScrollRef.current = true
    setMessages(prev => [...prev, msg])
    if (onSend) onSend(msg)
  }

  function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault()
    addMessage(input, user)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="chat">
      <div className="chat__list_container" ref={containerRef}>
        <div className="chat__list">
          {messages.map(m => (
            <div key={m.id} className={`chat__message ${m.sender === 'user' ? 'user' : 'assistant'}`}>
              <div className="chat__bubble">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                  {m.text}
                </ReactMarkdown>
              </div>
              <div className="chat__time">{new Date(m.time).toLocaleTimeString()}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="chat__input_container">
        <form className="chat__form" onSubmit={handleSubmit}>
          <select
              value={user}
              onChange={e => setUser(e.target.value as Sender)}
          >
              <option value="user">User</option>
              <option value="assistant">Assistant</option>
          </select>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Anything..."
            aria-label="Message"
            rows={2}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  )
}