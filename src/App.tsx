import React from 'react'
import './App.css'
import Chat from './components/chat/Chat'

export default function App() {
  return (
      <>
          <div style={{ width: '100%', maxWidth: "800px", display: "inline-block", height: "100%" }}>
              <Chat />
          </div>
      </>
  )
}
