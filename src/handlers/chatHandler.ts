import { 
  ExtensionPostCommand, 
  humanMessageSchema, 
  HumanMessage, 
  APICallToolRequest,
  ExtensionAPIUseToolResponse,
  AssistantMessage, 
  UserState,
  RelativePath,
} from "../type.js";
import { PlanningService } from "../services/planningService.js";
import { ToolExecutor } from "../services/toolExecutor.js";

export class ChatHandler {

  private _conversationHistory: Array<HumanMessage | APICallToolRequest | ExtensionAPIUseToolResponse | AssistantMessage>;
  private planningService: PlanningService;

  constructor(
    private _userState: UserState, 
    private _setUserState: (newState: UserState) => void, 
    private _sendMessage: (message: ExtensionPostCommand) => void
  ) {
    this._conversationHistory = _userState.messageHistory ? [..._userState.messageHistory] : [];
		const toolExecutor = new ToolExecutor();
    this.planningService = new PlanningService(toolExecutor);
    this.planningService.setWebviewMessenger(this._sendMessage);
  }

  getChatHistory() {
    return this._conversationHistory;
  }

  async handleChatMessage(instruction: string, activeSpecialInstructionContent?: string, referenceFiles?: Array<RelativePath>) {
    try {
      const newMessage = humanMessageSchema.parse({ content: instruction });
      this._conversationHistory.push(newMessage);

      // Update UI with request immediately
      this._sendMessage({ command: "postMessage", data: { messages: [newMessage] } });

      // Always keep special instructions current
      const specialInstructions = activeSpecialInstructionContent || "";

      // Call server
      const responses = await this.planningService.executePlanningLoop({
        messages: [...this._conversationHistory],
        specialInstructions,
        referenceFiles,
      });

      // Update conversation history and UI with responses from server
      for (const msg of responses) {
        this._conversationHistory.push(msg);
        if (msg.type === "assistant") {
          this._sendMessage({ command: "postMessage", data: { messages: [msg] } });
        }
      }

      // Capture current state to persistent storage
      this._persistState();
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : "Unknown error";
      this._sendMessage({ command: "setError", data: { text: errorText } });
    }
  }

  resetConversation() {
    this._sendMessage({ command: "clearMessages"});
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