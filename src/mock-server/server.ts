import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import {SendMessageRequest} from "../services/chat-api/ChatApi";

const app = express()
app.use(cors())
app.use(bodyParser.json())

// Predefined responses to send back (can be replaced with fixtures)
const fixtures = [
  { response: 'First chunk', thinking: '...', done: false },
  { response: 'Second chunk', thinking: 'still thinking', done: false },
  { response: 'Final chunk', thinking: '', done: true }
]

// Helper to stream responses with a delay between chunks
const streamResponses = async (
  res: express.Response,
  mode: 'ndjson' | 'concat',
  delayMs = 300
) => {
  // Set a permissive content-type for streaming; use x-ndjson for NDJSON clients
  res.setHeader('Transfer-Encoding', 'chunked')
  res.setHeader('X-Mock-Server', 'true')
  if (mode === 'ndjson') {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
  } else {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
  }

  for (let i = 0; i < fixtures.length; i++) {
    const obj = fixtures[i]
    const payload = JSON.stringify(obj)
    // For NDJSON include newline; for concatenated send objects back-to-back
    const chunk = mode === 'ndjson' ? payload + '\n' : payload
    res.write(chunk)
    // flush via a short async delay so client receives chunks over time
    await new Promise((r) => setTimeout(r, delayMs))
  }

  res.end()
}

// POST /message
// Accepts body: { message: string, stream?: boolean }
// Optional query param: ?mode=ndjson|concat  (defaults to ndjson when streaming)
app.post('/message', async (req, res) => {
  const body = req.body as SendMessageRequest
  const wantStream = !!body?.stream
  const modeQuery = (req.query.mode as string) || 'ndjson'

  if (!wantStream) {
    // Non-streaming: return a single JSON response (could be a combined result)
    const combined = {
      response: fixtures.map((f) => f.response).join(' '),
      thinking: fixtures.map((f) => f.thinking).join(' '),
      done: true
    }
    res.json(combined)
    return
  }

  // Streaming modes
  const mode = modeQuery === 'concat' ? 'concat' : 'ndjson'
  try {
    await streamResponses(res, mode, 300)
  } catch (err) {
    // If something goes wrong while streaming
    if (!res.headersSent) {
      res.status(500).json({ error: 'stream error' })
    } else {
      try { res.end() } catch {}
    }
  }
})

// Simple health endpoint
app.get('/_health', (_req, res) => res.json({ ok: true }))

const port = process.env.PORT ? parseInt(process.env.PORT) : 4000
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock server listening on http://localhost:${port}`)
  console.log('POST /message with JSON body { message, stream }')
  console.log('Use ?mode=ndjson or ?mode=concat when streaming')
})