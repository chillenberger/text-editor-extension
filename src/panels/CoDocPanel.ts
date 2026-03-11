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
import WebviewComms from "../services/webviewComms.js";

export class CoDocView implements WebviewViewProvider {
  public static readonly viewType = "codocView";

  view?: WebviewView;
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
    // Initialize needed handlers
    this._chatHandler = new ChatHandler(userState, this._setUserState);
    this._specialInstructionsHandler = new SpecialInstructionsHandler(userState, this._setUserState);
  }

  // Webview boilerplate to initialization and message handling setup
  public resolveWebviewView(
    webviewView: WebviewView,
    _context: WebviewViewResolveContext,
    _token: CancellationToken
  ) {
    this.view = webviewView;

    WebviewComms.setWebview(webviewView);

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

  // Route messages from webview
  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      async (message: WebviewPostCommand) => {
        try {
          switch (message.command) {
            case "ready":
              this._onReady();
              break;

            case "refresh":
              this.webViewReset();
              break;

            case "postMessage":
              await this._onChatMessage(message.data?.content);
              break;

            case "createSpecialInstruction":
              this._onCreateSpecialInstruction(message.data?.title, message.data?.content);
              break;

            case "updateSpecialInstruction":
              this._onUpdateSpecialInstruction(message.data?.id, message.data?.title, message.data?.content);
              break;

            case "deleteSpecialInstruction":
              this._onDeleteSpecialInstruction(message.data?.id);
              break;

            case "setActiveSpecialInstruction":
              this._onSetActiveSpecialInstruction(message.data?.id);
              break;

            default:
              WebviewComms.postMessage({
                command: "setError",
                data: { text: `Unknown command: ${message}` }
              });
          }
        } catch (error) {
          const errorText =
            error instanceof Error ? error.message : "Unknown error";
          WebviewComms.postMessage({ command: "setError", data: { text: errorText } });
        }
      },
      undefined,
      this._disposables
    );
  }

  // Initialize webview with persisted state
  private _onReady() {
    const uri = getActiveTabUri();
    WebviewComms.postMessage({
      command: "initialize",
      data: {
        messages: [...this._chatHandler.getChatHistory()],
        specialInstructions: [...this._specialInstructionsHandler.getSpecialInstructions()],
        activeSpecialInstructionId: this._specialInstructionsHandler.getActiveSpecialInstructionId(),
        activeTab: uri ? uriToFile(uri) : null,
      }
    });
  }

  private async _onChatMessage(message: string | undefined) {
    const uri = getActiveTabUri(); 
    if (message) {
      await this._chatHandler.handleChatMessage(message, this._specialInstructionsHandler.getActiveInstructionContent(), uri ? [uriToFile(uri).relativePath] : []);
    }
  }

  private _onCreateSpecialInstruction(title: string | undefined, content: string | undefined) {
    if (title !== undefined && content !== undefined) {
      this._specialInstructionsHandler.createSpecialInstruction(title, content);
    }
  }

  private _onUpdateSpecialInstruction(id: string | undefined, title: string | undefined, content: string | undefined) {
    if (id !== undefined && title !== undefined && content !== undefined) {
      this._specialInstructionsHandler.updateSpecialInstruction(id, title, content);
    }
  }

  private _onDeleteSpecialInstruction(id: string | undefined) {
    if (id !== undefined) {
      this._specialInstructionsHandler.deleteSpecialInstruction(id);
    }
  }

  private _onSetActiveSpecialInstruction(id: string | null | undefined) {
    if (id !== undefined) {
      this._specialInstructionsHandler.setActiveSpecialInstruction(id);
    }
  }

  public webViewReset() {
    this._chatHandler.resetConversation();
  }

  public dispose() {
    this._disposables.forEach((d) => d.dispose());
  }
}