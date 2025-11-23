export interface SendMessageRequest {
    message: string,
    stream?: boolean
}

export interface MessageEvent {
    response: string
    thinking: string
    done: boolean
}

export interface Callback {
    onMessage: (message: MessageEvent) => void
}

export interface ChatApi {
    sendMessage: (request: SendMessageRequest, callback?: Callback) => Promise<MessageEvent>
}

export const ChatApiFactory = (
    baseUrl: string
): ChatApi => {
    // TODO make sure the baseUrl does not have a trailing slash

    const sendMessage = async (
        request: SendMessageRequest,
        callback?: Callback
    ): Promise<MessageEvent> => {

        const res = await fetch(`${baseUrl}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        })

        if (!res.body) {
            // No stream support; try to parse whole body as JSON
            const txt = await res.text()
            try {
                const parsed = JSON.parse(txt)
                const ev: MessageEvent = {
                    response: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
                    thinking: '',
                    done: true
                }
                callback?.onMessage(ev)
                return ev
            } catch {
                const ev: MessageEvent = { response: txt, thinking: '', done: true }
                callback?.onMessage(ev)
                return ev
            }
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let lastEvent: MessageEvent = { response: '', thinking: '', done: true }

        const emitJson = (jsonStr: string) => {
            if (!jsonStr) return
            try {
                const parsed = JSON.parse(jsonStr)
                const ev: MessageEvent = {
                    response: typeof parsed.response === 'string' ? parsed.response : JSON.stringify(parsed),
                    thinking: typeof parsed.thinking === 'string' ? parsed.thinking : '',
                    done: typeof parsed.done === 'boolean' ? parsed.done : true
                }
                lastEvent = ev
                callback?.onMessage(ev)
            } catch {
                // If it isn't a structured MessageEvent, send raw string
                const ev: MessageEvent = { response: jsonStr, thinking: '', done: true }
                lastEvent = ev
                callback?.onMessage(ev)
            }
        }

        // Read stream chunks and attempt two strategies:
        // 1) NDJSON / newline-delimited objects
        // 2) Concatenated JSON objects using brace counting with basic string/escape handling
        let done = false
        while (!done) {
            const { value, done: streamDone } = await reader.read()
            done = !!streamDone
            buffer += value ? decoder.decode(value, { stream: true }) : ''

            // Handle newline-delimited objects first
            let nlIndex: number
            while ((nlIndex = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, nlIndex).trim()
                buffer = buffer.slice(nlIndex + 1)
                if (line) emitJson(line)
            }

            // Attempt to extract concatenated objects from remaining buffer
            // Basic state machine to handle strings and escapes so braces inside strings don't break parsing
            let braceDepth = 0
            let inString = false
            let escape = false
            let start = -1
            for (let i = 0; i < buffer.length; i++) {
                const ch = buffer[i]
                if (escape) {
                    escape = false
                    continue
                }
                if (ch === '\\') {
                    escape = true
                    continue
                }
                if (ch === '"' ) {
                    inString = !inString
                    continue
                }
                if (inString) continue
                if (ch === '{') {
                    if (braceDepth === 0) start = i
                    braceDepth++
                } else if (ch === '}') {
                    braceDepth--
                    if (braceDepth === 0 && start >= 0) {
                        const objStr = buffer.slice(start, i + 1)
                        emitJson(objStr)
                        buffer = buffer.slice(i + 1)
                        // reset scanner to beginning of new buffer
                        i = -1
                        start = -1
                    }
                }
            }
        }

        // After stream end, try to parse any leftover content
        const leftover = buffer.trim()
        if (leftover) {
            // Try newline split first, then fallback to single JSON parse
            const parts = leftover.split('\n').map(p => p.trim()).filter(Boolean)
            if (parts.length > 1) {
                parts.forEach(emitJson)
            } else {
                emitJson(leftover)
            }
        }

        return lastEvent
    }

    return {
        sendMessage
    }
}