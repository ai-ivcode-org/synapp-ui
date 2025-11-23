import React, { useState, useRef, useEffect, useImperativeHandle, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import './Chat.css'
import {Message, Sender} from "./ChatModel";


/**
 * Props for the Chat component.
 *
 * @property onSend Optional callback that is invoked when the *user* explicitly
 * submits a message via the UI (click Send / Enter).
 *
 *
 * @property initialMessages Optional pre-seeded messages to populate the chat.
 * These are added into the internal Map on mount (keeps insertion order).
 */
interface ChatProps {
  onSend?: (msg: Message) => void
  initialMessages?: Message[]
}

/**
 * Imperative handle exposed by the `Chat` component via `forwardRef`.
 *
 * Purpose:
 * - Describes the methods a parent can call on the Chat component instance.
 * - Intended for programmatic control from a parent (e.g. adding a message,
 *   appending streaming text to an existing message).
 *
 * Usage (parent):
 * const chatRef = useRef<ChatHandle | null>(null)
 * // insert a new message
 * chatRef.current?.addMessage({ id: Date.now(), text: 'Hello', sender: 'assistant', time: Date.now() })
 * // append streaming text to an existing message by id
 * chatRef.current?.updateMessage({ id: existingId, text: ' more chunk', sender: 'assistant', time: Date.now() })
 *
 * Notes for callers (behavioral contract):
 * - `addMessage` is used to insert a new message object into the chat. It is the
 *   correct method to call when you want a message to appear as a distinct item
 *   (for example, when creating a placeholder before streaming).
 * - `updateMessage` is used to append additional text to an already-existing
 *   message identified by `incoming.id` (typical streaming/partial-update use
 *   case). Callers must ensure the target message exists first.
 * - These signatures document the public API and do not expose internal
 *   implementation details; rely on the behavioral contract above when using them.
 */
export type ChatHandle = {
  /**
   * Append text to an existing message.
   *
   * What to use it for:
   * - Streaming responses that arrive in chunks: create a message (via `addMessage`)
   *   then repeatedly call `appendMessage` to append each chunk to that message.
   *
   * Caller expectations:
   * - `incoming.id` must match an existing message previously inserted.
   * - `incoming.text` contains the piece to append (the exact concatenation
   *   semantics are part of the component's contract; callers provide only the text).
   */
  appendMessage: (incoming: Message) => void

  /**
   * Insert a new message object into the chat.
   *
   * What to use it for:
   * - Programmatically adding a message that should appear in the chat UI.
   * - Creating a placeholder message before streaming updates are appended.
   *
   * Caller expectations:
   * - Provide a `Message` object (id/time/sender may be supplied or left to be
   *   populated by the caller/component depending on your integration).
   * - This method is the correct entry-point for adding new messages from code;
   *   it is distinct from the component's UI submit flow.
   */
  addMessage: (msg: Message) => void
}

/**
 * Chat component
 *
 * Purpose:
 * - Renders a chat UI and provides a programmatic API to the parent via a forwarded ref.
 *
 * Props summary (passed via the function parameters below):
 * - `onSend?: (msg: Message) => void` — optional callback invoked when the *user* submits a message from the UI.
 * - `initialMessages?: Message[]` — optional array of messages used to seed the chat on mount.
 *
 * Ref/API:
 * - The component forwards a ref whose type is `ChatHandle`. The parent can call methods
 *   on that handle (for example `addMessage` to insert a message or `appendMessage`
 *   to stream/append text to an existing message).
 *
 * Usage (parent):
 * ```ts
 * const chatRef = useRef<ChatHandle | null>(null)
 * <Chat ref={chatRef} onSend={handleSend} initialMessages={seed} />
 * // programmatically add:
 * chatRef.current?.addMessage({ id: 123, text: 'Hello', sender: 'assistant', time: Date.now() })
 * // append to existing:
 * chatRef.current?.appendMessage({ id: 123, text: ' more chunk', sender: 'assistant', time: Date.now() })
 */
const Chat = React.forwardRef<ChatHandle, ChatProps>(function Chat({ onSend, initialMessages = [] }: ChatProps, ref) {

  /** Messages displayed in the chat */
  const [messages, setMessages] = useState<Map<number, Message>>(() => {
    const m = new Map<number, Message>()
    // seed a welcome message (avoid overwriting if initialMessages include same id)
    m.set(1, { id: 1, text: 'Welcome to **chat**!\n\nYou can use _Markdown_ (e.g. `inline code`, lists, tables).', sender: 'assistant', time: Date.now() })
    for (const im of initialMessages) m.set(im.id, im)
    return m
  })

  /** Current input value */
  const [input, setInput] = useState('')

  /** Current user selection */
  const [user, setUser] = useState<Sender>('user')

  /** Ref to the messages container for scrolling */
  const containerRef = useRef<HTMLDivElement | null>(null)

  // flag to indicate that the next messages update should trigger a smooth scroll
  const shouldScrollRef = useRef(false)


  /**
   * Scroll-to-bottom effect for the messages container.
   *
   * Purpose:
   * - When the component's `messages` state is updated and the `shouldScrollRef`
   *   flag is set, this effect scrolls the messages container to the bottom.
   *
   * When it runs:
   * - The effect depends on `messages` and therefore runs on mount and whenever
   *   the `messages` reference changes.
   * - It only performs the scroll action if `shouldScrollRef.current` is true.
   *
   * External contract / how to use:
   * - To request a scroll-to-bottom for the next messages update, set
   *   `shouldScrollRef.current = true` immediately before calling the state update
   *   that changes `messages` (for example, inside `addMessage`).
   * - For updates that should NOT scroll (for example, appending streaming text
   *   to an existing message or deleting a message), ensure `shouldScrollRef.current`
   *   is false (the component's append/delete helpers already clear it).
   *
   * Behavior:
   * - The effect checks `containerRef.current` for the scrollable element; if missing,
   *   it clears the flag and exits safely.
   * - The actual scroll is performed after paint (via requestAnimationFrame) and uses
   *   a smooth scroll behavior so the user sees an animated scroll instead of a jump.
   *
   * Notes:
   * - This effect implements the visible behavior (smooth scroll) only when explicitly
   *   requested by the caller via the `shouldScrollRef` flag; it does not scroll on
   *   every message's update.
   */
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


  /**
   * Insert a Message object into the chat state.
   *
   * Purpose / When to use:
   * - Use this method to programmatically add a message to the chat UI.
   * - Typical uses include creating a placeholder message (e.g. before streaming content)
   *   or inserting messages received from an external source.
   *
   * Parameter:
   * @param msg - A Message object describing the message to insert. Callers may
   *              provide an object containing at least `text`. Other fields (id, sender, time)
   *              can be provided by the caller when available.
   *
   * Caller expectations:
   * - Callers should provide the message text (`msg.text`). If your integration
   *   supplies an id/time/sender, include them; otherwise the component will
   *   accept the provided object as the canonical message to render.
   * - This function is for local insertion of messages into the component's state;
   *   it is distinct from the component's UI submit flow. If you need to notify
   *   an external service (send to a server), do so from the caller as appropriate.
   *
   * Return:
   * - This callback does not return a value; it enqueues the message into the chat state.
   */
  const addMessage = useCallback((msg: Message) => {
    const trimmed = msg.text?.trim()
    if (!trimmed) return

    const messageWithMeta: Message = {
      id: msg.id ?? Date.now(),
      text: trimmed,
      sender: msg.sender ?? 'user',
      time: msg.time ?? Date.now(),
    }

    // request a smooth scroll for this update only
    shouldScrollRef.current = true
    setMessages(prev => {
      const next = new Map(prev)
      next.set(messageWithMeta.id, messageWithMeta)
      return next
    })
  }, [])

  /**
   * Append additional text to an existing message by id.
   *
   * Purpose:
   * - Used for streaming or partial updates where new content arrives in chunks
   *   and should be appended to an already-rendered message.
   *
   * Parameters:
   * @param incoming - A Message object containing at minimum the `id` of the
   *                   target message and the `text` to append.
   *
   * Caller expectations / contract:
   * - `incoming.id` must refer to an existing message previously inserted
   *   via `addMessage` (or otherwise present in the chat). The caller is
   *   responsible for creating that initial message before appending.
   * - The `text` provided will be appended to the existing message's text.
   * - This operation intentionally does NOT trigger an automatic scroll.
   *
   * Behavior notes:
   * - The implementation merges text by concatenation.
   * - If no message exists with the provided id, the current implementation
   *   throws an Error to surface logic mistakes early.
   */
  const appendMessage = useCallback((incoming: Message) => {
    // ensure we do not trigger scroll for updates
    shouldScrollRef.current = false

    setMessages(prev => {
      const next = new Map(prev)
      const existing = next.get(incoming.id)

      if (existing) {
        const appendedText = existing.text ? `${existing.text}${incoming.text}` : incoming.text
        next.set(incoming.id, { ...existing, text: appendedText, time: incoming.time ?? existing.time })
      } else {
        throw new Error(`Message with id ${incoming.id} does not exist and cannot be appended to.`)
      }
      return next
    })
  }, [])


  /**
   * Expose the component's imperative API to a parent via `ref`.
   *
   * Exposed methods (ChatHandle):
   * - updateMessage: append/update an existing message by id.
   *   Usage: parentRef.current?.updateMessage({ id, text, ... })
   *
   * - addMessage: insert a new message into the chat.
   *   Usage: parentRef.current?.addMessage({ id?, text, sender?, time? })
   *
   * Contract & notes for callers:
   * - Call `addMessage` to create a new chat item (e.g. a placeholder before streaming).
   * - Call `updateMessage` to append partial/streamed text to an already-created message.
   * - The parent can call these through a ref typed as `ChatHandle`.
   * - The dependency array ensures the handle is updated if the internal callbacks change.
   */
  useImperativeHandle(ref, () => ({
    appendMessage,
    addMessage,
  }), [appendMessage, addMessage])

  function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault()
    // construct a Message and pass it to addMessage
    const toAdd: Message = { id: Date.now(), text: input, sender: user, time: Date.now() }
    addMessage(toAdd)
    setInput('')
    if (toAdd && onSend) onSend(toAdd)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // create an ordered array for rendering from the Map values
  const messageList = Array.from(messages.values())

  return (
    <div className="chat">
      <div className="chat__list_container" ref={containerRef}>
        <div className="chat__list">
          {messageList.map(m => (
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
})

export default Chat
