import { useEffect, useState } from 'react'
import type { VsCodeMessage, MessageEvent, RelativePath } from '../../../../src/type'

export default function ChatArea() {
  const [referenceFile, setReferenceFile] = useState<RelativePath | null>(null)

  useEffect(() => {
    const handleMessage = (event: globalThis.MessageEvent) => {
      const message = event.data as MessageEvent
      switch (message.type) {
        case 'activeTabUpdate':
          setReferenceFile(message.data.activeTab?.relativePath || null)
          break
        case 'initialize':
          setReferenceFile(message.data.activeTab?.relativePath || null)
          break
        default:
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const input = (e.target as HTMLFormElement).elements[0] as HTMLTextAreaElement
    if (!input.value.trim()) return
    const message: VsCodeMessage = { command: "chatMessage", text: input.value, data: { referenceFiles: referenceFile ? [referenceFile] : [] } }
    vscode.postMessage(message)
    input.value = ''
  }

  return (
    <form onSubmit={handleSubmit}>
      <p>Referenced file: {referenceFile}</p>
      <textarea placeholder="Type a message..." rows={5} />
      <button type="submit">Send</button>
    </form>
  )
}