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
  UserState,
} from "../type.js";
import { SpecialInstructionsHandler } from "../handlers/specialInstructionsHandler.js";
import { ChatHandler } from "../handlers/chatHandler.js";

export class CoDocView implements WebviewViewProvider {
  public static readonly viewType = "codocView";

  private _view?: WebviewView;
  private _disposables: Disposable[] = [];
  private _specialInstructionsHandler: SpecialInstructionsHandler;
  private chatHandler: ChatHandler;

  constructor(
    private readonly _extensionUri: Uri,
    userState: UserState,
    private _setUserState: (newState: UserState) => void
  ) {
    this._specialInstructionsHandler = new SpecialInstructionsHandler(userState, this._setUserState, this.sendMessage.bind(this));
    this.chatHandler = new ChatHandler(userState, this._setUserState, this.sendMessage.bind(this));
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
              const test = this._specialInstructionsHandler.getSpecialInstructions();
              this.sendMessage({
                type: "initialize",
                data: {
                  messages: [...this.chatHandler.getChatHistory()],
                  specialInstructions: [...this._specialInstructionsHandler.getSpecialInstructions()],
                  activeSpecialInstructionId: this._specialInstructionsHandler.getActiveSpecialInstructionId()
                }
              });
              break;

            case "chatMessage":
              if (message.text) {
                await this.chatHandler.handleChatMessage(message.text, this._specialInstructionsHandler.getActiveInstructionContent());
              }
              break;

            case "createSpecialInstruction":
              if (message.data?.title !== undefined && message.data?.content !== undefined) {
                this._specialInstructionsHandler.createSpecialInstruction(message.data.title, message.data.content);
              }
              break;

            case "updateSpecialInstruction":
              if (message.data?.id) {
                this._specialInstructionsHandler.updateSpecialInstruction(
                  message.data.id,
                  message.data.title,
                  message.data.content
                );
              }
              break;

            case "deleteSpecialInstruction":
              if (message.data?.id) {
                this._specialInstructionsHandler.deleteSpecialInstruction(message.data.id);
              }
              break;

            case "setActiveSpecialInstruction":
              // data.id can be undefined/null to deactivate
              this._specialInstructionsHandler.setActiveSpecialInstruction(message.data?.id ?? null);
              break;

            case "refresh":
              this.chatHandler.resetConversation();
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

  public webViewReset() {
    this.chatHandler.resetConversation();
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