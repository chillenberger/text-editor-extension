import { useEffect, useRef, useState, useCallback } from 'react'
import './App.css'
import type { VsCodeMessage, AssistantMessage, HumanMessage } from '../../src/type'
import * as marked from 'marked'
import DOMPurify from 'dompurify'

declare const vscode: {
  postMessage: (message: any) => void
}

function App() {
  const messageBoard = useRef<HTMLDivElement>(null)
  const [update, setUpdate] = useState<string | null>(null)
  const [showPromptEditor, setShowPromptEditor] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [promptDraft, setPromptDraft] = useState('')
  marked.setOptions({async: false})

  useEffect(() => {
    vscode.postMessage({ command: 'ready' })
  }, [])

  // Parse markdown content and sanitize it to prevent XSS attacks
  const parseMarkdownToHtml = useCallback((text: string): string => {
    const html = marked.parse(text) as string
    return DOMPurify.sanitize(html)
  }, [])

  const appendMessageToBoard = useCallback((message: HumanMessage | AssistantMessage) => {
    if (messageBoard.current) {
      const content = parseMarkdownToHtml(message.content)
      const messageHtml = `<div class="${message.type}-message"><strong>${message.type === "assistant" ? "Assistant" : "Human"}:</strong> ${content}</div>`
      messageBoard.current.innerHTML += messageHtml
    }
  }, [parseMarkdownToHtml])

  const clearMessageBoard = useCallback(() => {
    if (messageBoard.current) {
      messageBoard.current.innerHTML = ''
    }
  }, [])

  useEffect(() => {
    window.addEventListener('message', event => {
      const message = event.data
      switch (message.type) {
        case 'initialize':
          message.data.messages.forEach((msg: HumanMessage | AssistantMessage) => appendMessageToBoard(msg))
          if (message.data.text) {
            setSystemPrompt(message.data.text)
          }
          setUpdate(null)
          break
        case 'message':
          const newMessages = message.data.messages.map((msg: HumanMessage | AssistantMessage) => ({ ...msg, content: parseMarkdownToHtml(msg.content) }))
          newMessages.forEach((msg: HumanMessage | AssistantMessage) => appendMessageToBoard(msg))
          setUpdate(null)
          break
        case 'tool_call':
          setUpdate(`Executing tool: ${message.data.messages[0].tool.name} ${JSON.stringify(message.data.messages[0].tool.args)}`)
          break
        case 'tool_use':
          setUpdate(message.data.text)
          break
        case 'working':
          setUpdate("Working...")
          break
        case 'systemPromptSaved':
          setSystemPrompt(message.data.text)
          setUpdate('System prompt saved.')
          setTimeout(() => setUpdate(null), 2000)
          break
        case 'clearState':
          clearMessageBoard()
          setUpdate(null)
          break
        case 'error':
          setUpdate(`Error: ${message.data.text}`)
          break
        default:
          console.log(`Unknown message type: ${message.type}`)
      }
    })

    return () => {
      window.removeEventListener('message', () => {})
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const input = (e.target as HTMLFormElement).elements[0] as HTMLInputElement
    const message: VsCodeMessage = {
      command: "chatMessage",
      text: input.value
    }

    if (typeof vscode !== 'undefined') {
      vscode.postMessage(message)
      input.value = ''
    }
  }

  const resetChat = () => {
    const message: VsCodeMessage = {
      command: "refresh",
    }

    if (typeof vscode !== 'undefined') {
      vscode.postMessage(message)
    }
  }

  const saveSystemPrompt = () => {
    if (typeof vscode !== 'undefined') {
      vscode.postMessage({ command: 'setSystemPrompt', text: promptDraft })
    }
    setShowPromptEditor(false)
  }

  const cancelPromptEdit = () => {
    setPromptDraft(systemPrompt)
    setShowPromptEditor(false)
  }

  return (
    <div className="root-container">
      <div className="control-bar">
        <button onClick={resetChat}>New Chat</button>
        <button
          onClick={() => {
            setPromptDraft(systemPrompt)
            setShowPromptEditor(!showPromptEditor)
          }}
          className={systemPrompt ? 'has-prompt' : ''}
          title="Edit system prompt"
        >
          ⚙ System Prompt
        </button>
      </div>

      {showPromptEditor && (
        <div className="system-prompt-editor">
          <label htmlFor="system-prompt-input">System Prompt</label>
          <p className="system-prompt-hint">
            This message is sent to the assistant at the start of every conversation.
          </p>
          <textarea
            id="system-prompt-input"
            value={promptDraft}
            onChange={(e) => setPromptDraft(e.target.value)}
            placeholder="e.g. You are a helpful coding assistant that writes concise TypeScript…"
            rows={5}
          />
          <div className="system-prompt-actions">
            <button onClick={saveSystemPrompt} className="primary">
              Save
            </button>
            <button onClick={cancelPromptEdit}>Cancel</button>
          </div>
        </div>
      )}

      <div ref={messageBoard} id="message-board" style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
      </div>
      <div id="update-board" style={{marginTop: '16px'}}>
        {update && update === "Working..." ? <WorkingLoader /> : <span>{update}</span>}
      </div>
      <form onSubmit={e => handleSubmit(e)}>
        <textarea placeholder="Type a message..." rows={5} />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}

export default App

// interface MessageProps {
//   content: string
//   key: React.Key
// }

// function AssistantMessage({content, key}: MessageProps) {
//   return (
//     <div className="assistant-message" key={key}>
//       <strong>Assistant:</strong> {content}
//     </div>
//   )
// }

// function HumanMessage({content, key}: MessageProps) {
//   return (
//     <div className="human-message" key={key}>
//       <strong>Human:</strong> {content}
//     </div>
//   )
// }

function WorkingLoader() {
  return (
    <div className="loader">
      <span style={{ animation: 'wave 1.4s infinite', animationDelay: '0s' }}>.</span>
      <span style={{ animation: 'wave 1.4s infinite', animationDelay: '0.2s' }}>.</span>
      <span style={{ animation: 'wave 1.4s infinite', animationDelay: '0.4s' }}>.</span>
    </div>
  )
}
