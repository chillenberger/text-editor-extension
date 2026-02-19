import { 
  MessageEvent, 
  humanMessage, 
  HumanMessage, 
  ToolCallMessage,
  ToolResultMessage,
  AssistantMessage, 
  UserState,
  RelativePath,
} from "../type.js";
import { PlanningService } from "../services/planningService.js";
import { ToolExecutor } from "../services/toolExecutor.js";

export class ChatHandler {

  private _conversationHistory: Array<HumanMessage | ToolCallMessage | ToolResultMessage | AssistantMessage>;
  private planningService: PlanningService;

  constructor(
    private _userState: UserState, 
    private _setUserState: (newState: UserState) => void, 
    private _sendMessage: (message: MessageEvent) => void
  ) {
    this._conversationHistory = _userState.messageHistory ? [..._userState.messageHistory] : [];
		const toolExecutor = new ToolExecutor();
    this.planningService = new PlanningService(toolExecutor);
    this.planningService.setWebviewMessenger(this._sendMessage);
  }

  getChatHistory() {
    return this._conversationHistory;
  }

  // --- Chat handling ---
  async handleChatMessage(instruction: string, activeSpecialInstructionContent?: string, referenceFiles?: Array<RelativePath>) {
    try {
      const newMessage = humanMessage(instruction);
      this._conversationHistory.push(newMessage);
      this._sendMessage({ type: "message", data: { messages: [newMessage] } });

      const specialInstructions = activeSpecialInstructionContent || "";

      const responses = await this.planningService.executePlanningLoop({
        messages: this._conversationHistory,
        specialInstructions,
        referenceFiles,
      });

      if (!responses || responses.length === 0) {
        this._sendMessage({ type: "error", data: { text: "No response from planning service." } });
        return;
      }

      for (const msg of responses) {
        this._conversationHistory.push(msg);
        if (msg.type === "assistant") {
          this._sendMessage({ type: "message", data: { messages: [msg] } });
        }
      }

      this._persistState();
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : "Unknown error";
      this._sendMessage({ type: "error", data: { text: errorText } });
    }
  }

  resetConversation() {
    this._sendMessage({ type: "clearState", data: { text: "" } });
    this._conversationHistory = [];
    this._persistState();
  }

  private _persistState() {
    this._setUserState({
      ...this._userState,
      messageHistory: this._conversationHistory,
    });
  }
  
}