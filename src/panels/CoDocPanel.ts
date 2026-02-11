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
  UserState
} from "../type.js";
import { PlanningService } from "../services/planningService.js";

export class CoDocView implements WebviewViewProvider {
  public static readonly viewType = "codocView";

  private _view?: WebviewView;
  private _disposables: Disposable[] = [];
  private planningService: PlanningService;
  private threadId: string;
  private _conversationHistory: Array<HumanMessage | ToolCallMessage | ToolResultMessage | AssistantMessage>;

  constructor(private readonly _extensionUri: Uri, planningService: PlanningService, userState: UserState, private setUserState: (newState: UserState) => void) {
    this.planningService = planningService;
    this.threadId = this._generateThreadId();
    this._conversationHistory = userState.messageHistory ? [...userState.messageHistory] : [];
  }

  private _generateThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
              this.sendMessage({ type: "initialize", data: { messages: [...this._conversationHistory] } });
              break;
            case "chatMessage":
              if (message.text) {
                await this._handleChatMessage(message.text);
              }
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

  private async _handleChatMessage(instruction: string) {
    try {
      const messages = [...this._conversationHistory];
      const newMessage = humanMessage(instruction);
      this._conversationHistory.push(newMessage);
      this.sendMessage({ type: "message", data: { messages: [newMessage] } });


      const responses = await this.planningService.executePlanningLoop({messages: messages, newMessage: newMessage});
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
      
      this.setUserState({
        initialized: true,
        messageHistory: this._conversationHistory
      });
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : "Unknown error";
      this.sendMessage({ type: "error", data: { text: errorText } });
    }
  }

  resetConversation() {
    this.sendMessage({ type: "clearState", data: { text: "" } });
    this._conversationHistory = [];
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

