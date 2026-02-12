import {
  Disposable,
  Webview,
  Uri,
  WebviewViewProvider,
  WebviewView,
  WebviewViewResolveContext,
  CancellationToken,
} from "vscode";
import { getNonce, getUri } from "../utilities.js";
import { 
  VsCodeMessage, 
  MessageEvent, 
  humanMessage, 
  HumanMessage, 
  ToolCallMessage,
  ToolResultMessage,
  AssistantMessage, 
  UserState,
  SpecialInstruction
} from "../type.js";
import { PlanningService } from "../services/planningService.js";

export class CoDocView implements WebviewViewProvider {
  public static readonly viewType = "codocView";

  private _view?: WebviewView;
  private _disposables: Disposable[] = [];
  private planningService: PlanningService;
  private threadId: string;
  private _conversationHistory: Array<HumanMessage | ToolCallMessage | ToolResultMessage | AssistantMessage>;
  private _specialInstructions: SpecialInstruction[];
  private _activeSpecialInstructionId: string | null;

  constructor(
    private readonly _extensionUri: Uri,
    planningService: PlanningService,
    userState: UserState,
    private setUserState: (newState: UserState) => void
  ) {
    this.planningService = planningService;
    this.threadId = this._generateThreadId();
    this._conversationHistory = userState.messageHistory ? [...userState.messageHistory] : [];
    this._specialInstructions = userState.specialInstructions ? [...userState.specialInstructions] : [];
    this._activeSpecialInstructionId = userState.activeSpecialInstructionId ?? null;
  }

  private _generateThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private _generateInstructionId(): string {
    return `si_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  public resolveWebviewView(
    webviewView: WebviewView,
    _context: WebviewViewResolveContext,
    _token: CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        Uri.joinPath(this._extensionUri, "out"),
        Uri.joinPath(this._extensionUri, "webview-ui", "build"),
      ],
    };

    webviewView.webview.html = this._getWebviewContent(
      webviewView.webview,
      this._extensionUri
    );

    this._setWebviewMessageListener(webviewView.webview);
  }

  private _getWebviewContent(webview: Webview, extensionUri: Uri) {
    const stylesUri = getUri(webview, extensionUri, [
      "webview-ui",
      "build",
      "assets",
      "index.css",
    ]);
    const scriptUri = getUri(webview, extensionUri, [
      "webview-ui",
      "build",
      "assets",
      "index.js",
    ]);

    const nonce = getNonce();

    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>CoDoc</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      async (message: VsCodeMessage) => {
        try {
          switch (message.command) {
            case "ready":
              this.sendMessage({
                type: "initialize",
                data: {
                  messages: [...this._conversationHistory],
                  specialInstructions: [...this._specialInstructions],
                  activeSpecialInstructionId: this._activeSpecialInstructionId
                }
              });
              break;

            case "chatMessage":
              if (message.text) {
                await this._handleChatMessage(message.text);
              }
              break;

            case "createSpecialInstruction":
              if (message.data?.title !== undefined && message.data?.content !== undefined) {
                this._createSpecialInstruction(message.data.title, message.data.content);
              }
              break;

            case "updateSpecialInstruction":
              if (message.data?.id) {
                this._updateSpecialInstruction(
                  message.data.id,
                  message.data.title,
                  message.data.content
                );
              }
              break;

            case "deleteSpecialInstruction":
              if (message.data?.id) {
                this._deleteSpecialInstruction(message.data.id);
              }
              break;

            case "setActiveSpecialInstruction":
              // data.id can be undefined/null to deactivate
              this._setActiveSpecialInstruction(message.data?.id ?? null);
              break;

            case "refresh":
              this.resetConversation();
              break;

            default:
              this.sendMessage({
                type: "error",
                data: { text: `Unknown command: ${message.command}` }
              });
          }
        } catch (error) {
          const errorText =
            error instanceof Error ? error.message : "Unknown error";
          this.sendMessage({ type: "error", data: { text: errorText } });
        }
      },
      undefined,
      this._disposables
    );
  }

  // --- Special Instructions CRUD ---

  private _createSpecialInstruction(title: string, content: string) {
    const newInstruction: SpecialInstruction = {
      id: this._generateInstructionId(),
      title: title.trim() || "Untitled",
      content,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this._specialInstructions.push(newInstruction);
    this._activeSpecialInstructionId = newInstruction.id;
    this._persistState();
    this._broadcastSpecialInstructions();
  }

  private _updateSpecialInstruction(id: string, title?: string, content?: string) {
    const instruction = this._specialInstructions.find(i => i.id === id);
    if (!instruction) {
      this.sendMessage({ type: "error", data: { text: "Instruction not found." } });
      return;
    }

    if (title !== undefined) {
      instruction.title = title.trim() || "Untitled";
    }
    if (content !== undefined) {
      instruction.content = content;
    }
    instruction.updatedAt = Date.now();

    this._persistState();
    this._broadcastSpecialInstructions();
  }

  private _deleteSpecialInstruction(id: string) {
    this._specialInstructions = this._specialInstructions.filter(i => i.id !== id);

    if (this._activeSpecialInstructionId === id) {
      this._activeSpecialInstructionId = null;
    }

    this._persistState();
    this._broadcastSpecialInstructions();
  }

  private _setActiveSpecialInstruction(id: string | null) {
    if (id !== null) {
      const exists = this._specialInstructions.some(i => i.id === id);
      if (!exists) {
        this.sendMessage({ type: "error", data: { text: "Instruction not found." } });
        return;
      }
    }

    this._activeSpecialInstructionId = id;
    this._persistState();
    this._broadcastSpecialInstructions();
  }

  private _getActiveInstructionContent(): string | undefined {
    if (!this._activeSpecialInstructionId) {
      return undefined;
    }
    const active = this._specialInstructions.find(
      i => i.id === this._activeSpecialInstructionId
    );
    return active?.content;
  }

  private _broadcastSpecialInstructions() {
    this.sendMessage({
      type: "specialInstructionsUpdated",
      data: {
        specialInstructions: [...this._specialInstructions],
        activeSpecialInstructionId: this._activeSpecialInstructionId
      }
    });
  }

  // --- State persistence ---

  private _persistState() {
    this.setUserState({
      initialized: true,
      messageHistory: this._conversationHistory,
      specialInstructions: this._specialInstructions,
      activeSpecialInstructionId: this._activeSpecialInstructionId
    });
  }

  // --- Chat handling ---

  private async _handleChatMessage(instruction: string) {
    try {
      const messages = [...this._conversationHistory];
      const newMessage = humanMessage(instruction);
      this._conversationHistory.push(newMessage);
      this.sendMessage({ type: "message", data: { messages: [newMessage] } });

      const specialInstructions = this._getActiveInstructionContent();

      const responses = await this.planningService.executePlanningLoop({
        messages,
        newMessage,
        specialInstructions
      });

      if (!responses || responses.length === 0) {
        this.sendMessage({ type: "error", data: { text: "No response from planning service." } });
        return;
      }

      for (const msg of responses) {
        this._conversationHistory.push(msg);
        if (msg.type === "assistant") {
          this.sendMessage({ type: "message", data: { messages: [msg] } });
        }
      }

      this._persistState();
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : "Unknown error";
      this.sendMessage({ type: "error", data: { text: errorText } });
    }
  }

  resetConversation() {
    this.sendMessage({ type: "clearState", data: { text: "" } });
    this._conversationHistory = [];
    this._persistState();
  }

  public sendMessage(message: MessageEvent) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  public dispose() {
    this._disposables.forEach((d) => d.dispose());
  }
}