import { useEffect } from 'react'
import type { VsCodeMessage } from '../../src/type'
import ChatArea from './components/chatArea/ChatArea'
import SpecialInstructions from './components/specialInstructions/SpecialInstructions'
import { useSpecialInstructions } from './hooks/useSpecialInstructions'
import type { UseSpecialInstructions } from './hooks/useSpecialInstructions'
import MessageBoard from './components/messageBoard/MessageBoard'
import './App.css'

declare const vscode: {
  postMessage: (message: any) => void
}

function App() {
  const specialInstructionsControl: UseSpecialInstructions = useSpecialInstructions()

  useEffect(() => {
    vscode.postMessage({ command: 'ready' })
  }, [])

  const resetChat = () => {
    vscode.postMessage({ command: "refresh" } as VsCodeMessage)
  }

  return (
    <div className="root-container">
      <div className="control-bar">
        <button onClick={resetChat}>New Chat</button>
        <button onClick={specialInstructionsControl.openModal}>Special Instructions</button>
      </div>

      <SpecialInstructions useSpecialInstructions={specialInstructionsControl} />

      <MessageBoard />

      <ChatArea />
    </div>
  )
}

export default App