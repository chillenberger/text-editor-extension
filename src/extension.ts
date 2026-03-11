import * as vscode from 'vscode';
import { CoDocView } from './panels/CoDocPanel';
import { UserState } from './type';
import { fileToMessage, uriToFile, getActiveTabUri } from './utilities';
import webviewComms from './services/webviewComms';

export function activate(context: vscode.ExtensionContext) {

	// Create the CoDocView and register it as a WebviewViewProvider
	const coDocProvider: CoDocView = new CoDocView(
		context.extensionUri, 
		context.globalState.get("coDocUserState") || {initialized: true, messageHistory: []}, 
		(newState: UserState) => {context.globalState.update("coDocUserState", newState);}
	);

	// Register the CoDocView provider for the view container
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(CoDocView.viewType, coDocProvider)
	);

	// Register a command to reset the user state and refresh the view
	context.subscriptions.push(
		vscode.commands.registerCommand('co-doc.refresh', () => {
			context.globalState.update("coDocUserState", undefined);
			coDocProvider.webViewReset();
			vscode.window.showInformationMessage('CoDoc user state cleared.');
		})
	);

	// Keep view aware of active tab in editor
	context.subscriptions.push(
		vscode.window.tabGroups.onDidChangeTabGroups(_ => {
			const uri = getActiveTabUri();

			if (uri) {
					const file = uriToFile(uri);
					const message = fileToMessage(file);
					webviewComms.postMessage(message);
			}
		})
	);
}

export function deactivate() {
	webviewComms.dispose();
}