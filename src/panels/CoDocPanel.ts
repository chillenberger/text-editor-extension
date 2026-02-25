import {
  Disposable,
  Webview,
  Uri,
  WebviewViewProvider,
  WebviewView,
  WebviewViewResolveContext,
  CancellationToken,
} from "vscode";
import { getNonce, getUri, uriToFile, getActiveTabUri} from "../utilities.js";
import { 
  WebviewPostCommand, 
  ExtensionPostCommand,
  UserState,
} from "../type.js";
import { SpecialInstructionsHandler } from "../handlers/specialInstructionsHandler.js";
import { ChatHandler } from "../handlers/chatHandler.js";

export class CoDocView implements WebviewViewProvider {
  public static readonly viewType = "codocView";

  private _view?: WebviewView;
  private _disposables: Disposable[] = [];
  private _chatHandler: ChatHandler;
  private _specialInstructionsHandler: SpecialInstructionsHandler;

  /* 
  * Initialize the View
  *
  * _extensionUri: URI of the extension, used to load local resources into the webview
  * userState: The persisted state for the user, containing conversation history and special instructions
  * _setUserState: A function to update the persisted user state when changes occur (e.g., new messages, updated instructions)
  */
  constructor(
    private readonly _extensionUri: Uri,
    userState: UserState,
    private _setUserState: (newState: UserState) => void
  ) {
    this._chatHandler = new ChatHandler(userState, this._setUserState, this.sendMessage.bind(this));
    this._specialInstructionsHandler = new SpecialInstructionsHandler(userState, this._setUserState, this.sendMessage.bind(this));
  }

  // Webview boilerplate to initialization and message handling setup
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

  // Generate the HTML from react build and set up message listener for communication from the webview.
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

  // Parse and execute messages received from the webview
  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      async (message: WebviewPostCommand) => {
        try {
          switch (message.command) {
            case "ready":
              // When webview is ready, send the initial state including conversation history, special instructions and active tab info
              const uri = getActiveTabUri();
              this.sendMessage({
                type: "initialize",
                data: {
                  messages: [...this._chatHandler.getChatHistory()],
                  specialInstructions: [...this._specialInstructionsHandler.getSpecialInstructions()],
                  activeSpecialInstructionId: this._specialInstructionsHandler.getActiveSpecialInstructionId(),
                  activeTab: uri ? uriToFile(uri) : null,
                }
              });
              break;

            case "refresh":
              // When the webview requests a refresh, reset the conversation
              this._chatHandler.resetConversation();
              break;

            case "chatMessage":
              // When the webview sends a chat message, handle it and update the conversation
              if (message.text) {
                await this._chatHandler.handleChatMessage(message.text, this._specialInstructionsHandler.getActiveInstructionContent(), message?.data?.referenceFiles || []);
              }
              break;

            case "createSpecialInstruction":
              // When the webview sends a request to create a new special instruction, create it and update the list
              if (message.data?.title !== undefined && message.data?.content !== undefined) {
                this._specialInstructionsHandler.createSpecialInstruction(message.data.title, message.data.content);
              }
              break;

            case "updateSpecialInstruction":
              // When the webview sends a request to update an existing special instruction, update it and refresh the list
              if (message.data?.id) {
                this._specialInstructionsHandler.updateSpecialInstruction(
                  message.data.id,
                  message.data.title,
                  message.data.content
                );
              }
              break;

            case "deleteSpecialInstruction":
              // When the webview sends a request to delete a special instruction, delete it and refresh the list
              if (message.data?.id) {
                this._specialInstructionsHandler.deleteSpecialInstruction(message.data.id);
              }
              break;

            case "setActiveSpecialInstruction":
              // When the webview sends a request to set the active special instruction, update it
              this._specialInstructionsHandler.setActiveSpecialInstruction(message.data?.id ?? null);
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
    this._chatHandler.resetConversation();
  }

  public sendMessage(message: ExtensionPostCommand) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  public dispose() {
    this._disposables.forEach((d) => d.dispose());
  }
}