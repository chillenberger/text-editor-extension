import { useEffect, useRef, useState, useCallback } from 'react'
import './App.css'
import type { VsCodeMessage, AssistantMessage, HumanMessage, SpecialInstruction } from '../../src/type'
import * as marked from 'marked'
import DOMPurify from 'dompurify'

declare const vscode: {
  postMessage: (message: any) => void
}

type ModalView = 'list' | 'edit';

function App() {
  const messageBoard = useRef<HTMLDivElement>(null)
  const [update, setUpdate] = useState<string | null>(null)
  marked.setOptions({ async: false })

  // Special instructions state
  const [specialInstructions, setSpecialInstructions] = useState<SpecialInstruction[]>([])
  const [activeInstructionId, setActiveInstructionId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [modalView, setModalView] = useState<ModalView>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  const activeInstruction = specialInstructions.find(i => i.id === activeInstructionId) ?? null

  useEffect(() => {
    vscode.postMessage({ command: 'ready' })
  }, [])

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
      switch (message.type) {
        case 'initialize':
          message.data.messages.forEach((msg: HumanMessage | AssistantMessage) =>
            appendMessageToBoard(msg)
          )
          if (message.data.specialInstructions) {
            setSpecialInstructions(message.data.specialInstructions)
          }
          if (message.data.activeSpecialInstructionId !== undefined) {
            setActiveInstructionId(message.data.activeSpecialInstructionId)
          }
          setUpdate(null)
          break
        case 'message':
          message.data.messages.forEach((msg: HumanMessage | AssistantMessage) =>
            appendMessageToBoard(msg)
          )
          setUpdate(null)
          break
        case 'specialInstructionsUpdated':
          if (message.data.specialInstructions) {
            setSpecialInstructions(message.data.specialInstructions)
          }
          if (message.data.activeSpecialInstructionId !== undefined) {
            setActiveInstructionId(message.data.activeSpecialInstructionId)
          }
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
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [appendMessageToBoard, clearMessageBoard])

  // --- Chat actions ---

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const input = (e.target as HTMLFormElement).elements[0] as HTMLTextAreaElement
    if (!input.value.trim()) return
    const message: VsCodeMessage = { command: "chatMessage", text: input.value }
    vscode.postMessage(message)
    input.value = ''
  }

  const resetChat = () => {
    vscode.postMessage({ command: "refresh" } as VsCodeMessage)
  }

  // --- Special instructions actions ---

  const openModal = () => {
    setModalView('list')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setModalView('list')
    setEditingId(null)
    setEditTitle('')
    setEditContent('')
  }

  const startCreate = () => {
    setEditingId(null)
    setEditTitle('')
    setEditContent('')
    setModalView('edit')
  }

  const startEdit = (instruction: SpecialInstruction) => {
    setEditingId(instruction.id)
    setEditTitle(instruction.title)
    setEditContent(instruction.content)
    setModalView('edit')
  }

  const saveInstruction = () => {
    if (editingId) {
      vscode.postMessage({
        command: "updateSpecialInstruction",
        data: { id: editingId, title: editTitle, content: editContent }
      } as VsCodeMessage)
    } else {
      vscode.postMessage({
        command: "createSpecialInstruction",
        data: { title: editTitle, content: editContent }
      } as VsCodeMessage)
    }
    setModalView('list')
    setEditingId(null)
    setEditTitle('')
    setEditContent('')
  }

  const cancelEdit = () => {
    setModalView('list')
    setEditingId(null)
    setEditTitle('')
    setEditContent('')
  }

  const deleteInstruction = (id: string) => {
    vscode.postMessage({
      command: "deleteSpecialInstruction",
      data: { id }
    } as VsCodeMessage)
  }

  const selectInstruction = (id: string | null) => {
    vscode.postMessage({
      command: "setActiveSpecialInstruction",
      data: { id }
    } as VsCodeMessage)
  }

  return (
    <div className="root-container">

      {/* Control Bar */}
      <div className="control-bar">
        <button onClick={resetChat}>New Chat</button>
        <button onClick={openModal}>Special Instructions</button>
      </div>

      {/* Active Instruction Badge */}
      {activeInstruction && (
        <div className="active-instruction-banner">
          <details>
            <summary>
              <span className="active-dot" />
              {activeInstruction.title}
            </summary>
            <p className="active-instruction-content">{activeInstruction.content}</p>
          </details>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>

            {/* ---- LIST VIEW ---- */}
            {modalView === 'list' && (
              <>
                <div className="modal-header">
                  <h3>Special Instructions</h3>
                  <button className="modal-close-btn" onClick={closeModal}>✕</button>
                </div>

                <p className="modal-description">
                  Choose which instructions to send to the assistant, or create a new set.
                </p>

                <div className="instruction-list">
                  {/* None option */}
                  <label className={`instruction-item ${activeInstructionId === null ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="activeInstruction"
                      checked={activeInstructionId === null}
                      onChange={() => selectInstruction(null)}
                    />
                    <span className="instruction-item-label">None</span>
                  </label>

                  {specialInstructions.map(si => (
                    <div
                      key={si.id}
                      className={`instruction-item ${activeInstructionId === si.id ? 'active' : ''}`}
                    >
                      <label className="instruction-item-main">
                        <input
                          type="radio"
                          name="activeInstruction"
                          checked={activeInstructionId === si.id}
                          onChange={() => selectInstruction(si.id)}
                        />
                        <div className="instruction-item-info">
                          <span className="instruction-item-title">{si.title}</span>
                          <span className="instruction-item-preview">
                            {si.content.length > 80
                              ? si.content.slice(0, 80) + '…'
                              : si.content}
                          </span>
                        </div>
                      </label>
                      <div className="instruction-item-actions">
                        <button
                          className="icon-btn"
                          title="Edit"
                          onClick={() => startEdit(si)}
                        >
                          ✎
                        </button>
                        <button
                          className="icon-btn danger"
                          title="Delete"
                          onClick={() => deleteInstruction(si.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="create-btn" onClick={startCreate}>
                  + Create New
                </button>
              </>
            )}

            {/* ---- EDIT / CREATE VIEW ---- */}
            {modalView === 'edit' && (
              <>
                <div className="modal-header">
                  <button className="back-btn" onClick={cancelEdit}>←</button>
                  <h3>{editingId ? 'Edit Instruction' : 'New Instruction'}</h3>
                </div>

                <div className="edit-form">
                  <label className="edit-label" htmlFor="si-title">Title</label>
                  <input
                    id="si-title"
                    className="edit-input"
                    type="text"
                    placeholder="e.g. Code Review Rules"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                  />

                  <label className="edit-label" htmlFor="si-content">Instructions</label>
                  <textarea
                    id="si-content"
                    className="edit-textarea"
                    rows={10}
                    placeholder="Enter the instructions the assistant should follow…"
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                  />
                </div>

                <div className="modal-footer">
                  <button className="cancel-btn" onClick={cancelEdit}>Cancel</button>
                  <button
                    className="save-btn"
                    onClick={saveInstruction}
                    disabled={!editTitle.trim() && !editContent.trim()}
                  >
                    {editingId ? 'Save Changes' : 'Create'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messageBoard}
        id="message-board"
        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
      />

      <div id="update-board" style={{ marginTop: '16px' }}>
        {update && update === "Working..." ? <WorkingLoader /> : <span>{update}</span>}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit}>
        <textarea placeholder="Type a message..." rows={5} />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}

export default App

function WorkingLoader() {
  return (
    <div className="loader">
      <span style={{ animation: 'wave 1.4s infinite', animationDelay: '0s' }}>.</span>
      <span style={{ animation: 'wave 1.4s infinite', animationDelay: '0.2s' }}>.</span>
      <span style={{ animation: 'wave 1.4s infinite', animationDelay: '0.4s' }}>.</span>
    </div>
  )
}