import { Uri, Webview } from "vscode";
import type { WorkspaceFolder } from "vscode";

/**
 * A helper function which will get the webview URI of a given file or resource.
 *
 * @remarks This URI can be used within a webview's HTML as a link to the
 * given file/resource.
 *
 * @param webview A reference to the extension webview
 * @param extensionUri The URI of the directory containing the extension
 * @param pathList An array of strings representing the path to a file/resource
 * @returns A URI pointing to the file/resource
 */
export function getUri(
  webview: Webview,
  extensionUri: Uri,
  pathList: string[]
) {
  return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}

/**
 * A helper function that returns a unique alphanumeric identifier called a nonce.
 *
 * @remarks This function is primarily used to help enforce content security
 * policies for resources/scripts being executed in a webview context.
 *
 * @returns A nonce
 */
export function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/** 
 * A helper function to resolve the URI of a file given its path and the workspace folders. It handles both absolute and workspace-relative paths, and ensures that the resulting URI is correctly formed for use in VS Code.
 */
export function resolveUri(path: string, workspaceFolders: readonly WorkspaceFolder[]): Uri {
    const workspaceFolder = workspaceFolders.find(folder => folder.name === path.split('/')[0]) || workspaceFolders[0];

    // Check if path is already absolute (starts with / on Unix or drive letter on Windows)
    if (path.startsWith('/') || path.match(/^[a-zA-Z]:/)) {
      return Uri.file(path);
    }
    
    // Strip workspace folder name from the beginning if present
    const workspaceName = workspaceFolder.name;
    if (path.startsWith(workspaceName + '/') || path.startsWith(workspaceName + '\\')) {
      path = path.substring(workspaceName.length + 1);
    }
    
    // Treat as workspace-relative path
    return Uri.joinPath(workspaceFolder.uri, path);
  }