import {
  HumanMessage, 
  APICallToolRequest,
  ExtensionAPIUseToolResponse,
  AssistantMessage, 
  UserState,
} from "../type.js";
import webviewComms from "../services/webviewComms.js";

export class ChatHandler {
  private _chatHistory: Array<HumanMessage | APICallToolRequest | ExtensionAPIUseToolResponse | AssistantMessage>;

  constructor(
    private _userState: UserState, 
    private _setUserState: (newState: UserState) => void
  ) {
    this._chatHistory = _userState.messageHistory ? [..._userState.messageHistory] : [];
  }

  getChatHistory() {
    return this._chatHistory;
  }

  appendToChatHistory(message: (HumanMessage | APICallToolRequest | ExtensionAPIUseToolResponse | AssistantMessage)[]) {
    this._chatHistory.push(...message);
    for (const msg of message) {
      if (msg.type === "assistant" || msg.type === "human") {
        webviewComms.postMessage({ command: "postMessage", data: { messages: [msg] } });
      }
    }
    this._persistState();
  }

  resetChatHistory() {
    webviewComms.postMessage({ command: "clearMessages"});
    this._chatHistory = [];
    this._persistState();
  }

  private _persistState() {
    this._setUserState({
      ...this._userState,
      messageHistory: this._chatHistory,
    });
  }
}