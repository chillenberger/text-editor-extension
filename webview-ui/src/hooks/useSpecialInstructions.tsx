import type { 
  SpecialInstruction, 
  ExtensionPostCommand, 
  WebviewPostCommandSetActiveSpecialInstruction, 
  WebviewPostCommandDeleteSpecialInstruction, 
  WebviewPostCommandUpdateSpecialInstruction, 
  WebviewPostCommandCreateSpecialInstruction,
} from "../../../src/type"
import { useEffect, useState } from "react"

type ModalView = 'list' | 'edit';

export interface UseSpecialInstructions {
  showModal: boolean
  modalView: ModalView
  editingId: string | null
  specialInstructions: SpecialInstruction[]
  activeInstructionId: string | null
  editTitle: string
  setEditTitle: (title: string) => void
  editContent: string
  setEditContent: (content: string) => void
  activeInstruction: SpecialInstruction | null
  openModal: () => void
  closeModal: () => void
  startCreate: () => void
  startEdit: (instruction: SpecialInstruction) => void
  saveInstruction: () => void
  cancelEdit: () => void
  deleteInstruction: (id: string) => void
  selectInstruction: (id: string | null) => void
}

export function useSpecialInstructions(): UseSpecialInstructions {
  const [showModal, setShowModal] = useState(false)
  const [modalView, setModalView] = useState<ModalView>('list')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [specialInstructions, setSpecialInstructions] = useState<SpecialInstruction[]>([])
  const [activeInstructionId, setActiveInstructionId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  const activeInstruction = specialInstructions.find(i => i.id === activeInstructionId) ?? null

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
    const message: WebviewPostCommandCreateSpecialInstruction | WebviewPostCommandUpdateSpecialInstruction = editingId ? {
          command: "updateSpecialInstruction",
          data: { id: editingId, title: editTitle, content: editContent }
        }
      : {
          command: "createSpecialInstruction",
          data: { title: editTitle, content: editContent }
        }
    vscode.postMessage(message)
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
    const message: WebviewPostCommandDeleteSpecialInstruction = {
      command: "deleteSpecialInstruction",
      data: { id }
    }
    vscode.postMessage(message)
  }

  const selectInstruction = (id: string | null) => {
    const message: WebviewPostCommandSetActiveSpecialInstruction = {
      command: "setActiveSpecialInstruction",
      data: { id }
    }
    vscode.postMessage(message)
  }


  useEffect(() => {
    const handleMessage = (event: globalThis.MessageEvent) => {
      const message: ExtensionPostCommand = event.data
      switch (message.command) {
        case "initialize":
          if (message.data?.specialInstructions) {
            setSpecialInstructions(message.data.specialInstructions)
          }
          if (message.data?.activeSpecialInstructionId !== undefined) {
            setActiveInstructionId(message.data.activeSpecialInstructionId)
          }
          break

        case 'updatedSpecialInstructions':
          if (message.data?.specialInstructions) {
            setSpecialInstructions(message.data.specialInstructions)
          }
          if (message.data?.activeSpecialInstructionId !== undefined) {
            setActiveInstructionId(message.data.activeSpecialInstructionId)
          }
          break
        default:
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return {
    showModal,
    modalView,
    editingId,
    specialInstructions,
    activeInstructionId,
    editTitle,
    setEditContent,
    setEditTitle,
    editContent,
    activeInstruction,
    openModal,
    closeModal,
    startCreate,
    startEdit,
    saveInstruction,
    cancelEdit,
    deleteInstruction,
    selectInstruction
  }
}
