import type { VsCodeMessage } from '../../../../src/type'

export default function ChatArea() {

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const input = (e.target as HTMLFormElement).elements[0] as HTMLTextAreaElement
    if (!input.value.trim()) return
    const message: VsCodeMessage = { command: "chatMessage", text: input.value }
    vscode.postMessage(message)
    input.value = ''
  }

  return (
    <form onSubmit={handleSubmit}>
      <textarea placeholder="Type a message..." rows={5} />
      <button type="submit">Send</button>
    </form>
  )
}