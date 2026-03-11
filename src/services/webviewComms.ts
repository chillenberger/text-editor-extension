import { WebviewView } from "vscode";
import type { ExtensionPostCommand } from "../type.js";

class WebviewComms {
  private _webviewView?: WebviewView;

  constructor() {}

  setWebview(view: WebviewView) {
    this._webviewView = view;
  }

  postMessage(message: ExtensionPostCommand) {
    if (!this._webviewView) {
      console.error("Webview not initialized yet");
      return;
    }

    this._webviewView.webview.postMessage(message);
  }

  dispose() {
    this._webviewView = undefined;
  }
}

const webviewComms = new WebviewComms();

export default webviewComms;