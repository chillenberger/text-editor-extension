import { useEffect, useRef, useState, useCallback } from 'react'
import type { AssistantMessage, HumanMessage } from '../../../../src/type'
import * as marked from 'marked'
import DOMPurify from 'dompurify'
import Loader from '../loader/Loader'
import "./messageBoard.css"

export default function MessageBoard() {
  const messageBoard = useRef<HTMLDivElement>(null)
  const [update, setUpdate] = useState<string | null>(null)

  marked.setOptions({ async: false })

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
    const handleMessage = (event: globalThis.MessageEvent) => {
      const message = event.data
      switch (message.command) {
        case 'initialize':
          message.data.messages.forEach((msg: HumanMessage | AssistantMessage) =>
            appendMessageToBoard(msg)
          )
          setUpdate(null)
          break
        case 'postMessage':
          message.data.messages.forEach((msg: HumanMessage | AssistantMessage) =>
            appendMessageToBoard(msg)
          )
          setUpdate(null)
          break
        case 'setToolCalled':
          setUpdate(`Executing tool: ${message.data.messages[0].tool.name} ${JSON.stringify(message.data.messages[0].tool.args)}`)
          break
        case 'setToolUsed':
          setUpdate(message.data.text)
          break
        case 'setWorking':
          setUpdate("Working...")
          break
        case 'clearMessages':
          clearMessageBoard()
          setUpdate(null)
          break
        default:
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [appendMessageToBoard, clearMessageBoard])

  return (
    <>
      <div
        ref={messageBoard}
        id="message-board"
        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
      />
      <div id="update-board" style={{ marginTop: '16px' }}>
        {update && update === "Working..." ? <Loader /> : <span>{update}</span>}
      </div>
    </>
  )
}