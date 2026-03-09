import { useEffect, useState } from 'react'
import type { ExtensionPostCommand, RelativePath, WebviewPostCommandPostMessage } from '../../../../src/type'

export default function ChatArea() {
  const [referenceFile, setReferenceFile] = useState<RelativePath | null>(null)

  useEffect(() => {
    const handleMessage = (event: globalThis.MessageEvent) => {
      const message = event.data as ExtensionPostCommand
      if (message.command === 'setActiveTab' || message.command === 'initialize') {
        setReferenceFile(message.data?.activeTab?.relativePath || null)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const input = (e.target as HTMLFormElement).elements[0] as HTMLTextAreaElement
    if (!input.value.trim()) return

    const message: WebviewPostCommandPostMessage = { 
      command: "postMessage",
      data: {
        content: input.value,
        referenceFiles: referenceFile ? [referenceFile] : [] 
      } 
    }

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