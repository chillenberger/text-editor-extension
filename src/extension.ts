import * as vscode from 'vscode';
import { CoDocView } from './panels/CoDocPanel';
import { UserState } from './type';
import { fileToMessage, uriToFile, getActiveTabUri } from './utilities';

export function activate(context: vscode.ExtensionContext) {
	const extensionManager = new ExtensionManager(context);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(CoDocView.viewType, extensionManager.getProvider())
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('co-doc.refresh', () => {
			extensionManager.clearUserState();
			vscode.window.showInformationMessage('CoDoc user state cleared.');
		})
	);

	let activeViewStateChangeListener = vscode.window.tabGroups.onDidChangeTabGroups(event => {
		const uri = getActiveTabUri();

    if (uri) {
        const file = uriToFile(uri);
        const message = fileToMessage(file);
        extensionManager.getProvider().sendMessage(message);
    }
	});
	context.subscriptions.push(activeViewStateChangeListener);
}

export function deactivate() {}

class ExtensionManager {
	private provider: CoDocView;
	private stateManager: StateManager;

	constructor(context: vscode.ExtensionContext) {
		this.stateManager = new StateManager(context);
		const userState = this.stateManager.getUserState();
		this.provider = new CoDocView(context.extensionUri, userState, this.stateManager.setUserState.bind(this.stateManager));
	}

	public clearUserState() {
		this.stateManager.clearUserState();
		this.provider.webViewReset();
	}

	public getProvider(): CoDocView {
		return this.provider;
	}
}

class StateManager {
	constructor(private context: vscode.ExtensionContext) {}

	public setUserState(newState: UserState) {
		this.context.globalState.update("coDocUserState", newState);
	}

	public getUserState(): UserState {
		return this.context.globalState.get("coDocUserState") || {initialized: true, messageHistory: []};
	}

	public clearUserState() {
		this.context.globalState.update("coDocUserState", undefined);
	}
}
