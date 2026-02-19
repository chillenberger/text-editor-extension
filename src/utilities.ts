import { Uri, Webview, window, TabInputCustom, TabInputNotebook, TabInputText, TabInputWebview } from "vscode";
import type { WorkspaceFolder } from "vscode";
import type { AbsolutePath, File, MessageEvent, RelativePath } from "./type";
import { workspace } from "vscode";
import * as path from 'path';

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

  export function uriToFile(uri: Uri): File {
      return {
          type: 'file',
          name: path.basename(uri.fsPath),
          relativePath: stripSystemPathFromUri(uri) as RelativePath,
          fullPath: uri.fsPath as AbsolutePath,
      };
  }
  
  export function fileToMessage(file: File | null): MessageEvent {
      return {
        type: "activeTabUpdate",
        data: {
          activeTab: file,
        }
      }
    }

    /* 
    * Strip common root of workspace folder. 
    */
    export function stripSystemPathFromUri(fileUri: Uri): string {
      const workspaceFolder = workspace.getWorkspaceFolder(fileUri)?.uri.fsPath.split('/');
      if (workspaceFolder) {
        workspaceFolder.pop();
        return fileUri.fsPath.substring(workspaceFolder.join("/").length + 1);
      }
      return fileUri.fsPath;
    }

export function getActiveTabUri(): Uri | null {
    const activeTab = window.tabGroups.activeTabGroup?.activeTab;
    if (!activeTab) return null;

    const input = activeTab.input;

    if (input instanceof TabInputText) {
        // Normal text files (.js, .ts, .py, etc.)
        return input.uri;
    } else if (input instanceof TabInputCustom) {
        // Custom editors (.pdf, .docx, images, etc.)
        return input.uri;
    } else if (input instanceof TabInputNotebook) {
        // Notebook files (.ipynb)
        return input.uri;
    } else if (input instanceof TabInputWebview) {
        // Webview panels (no file URI)
        return null;
    }

    return null;
}