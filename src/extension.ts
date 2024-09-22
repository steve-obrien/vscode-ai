// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from 'axios';


// Function to call ChatGPT API with the selected code
async function callChatGPTAPI(selectedText: string, instructions: string = ''): Promise<string | null> {
	try {
		const apiKey = ''; // Replace with your actual API key
		const response = await axios.post('https://api.openai.com/v1/chat/completions',
			{
				model: 'gpt-4o', // Adjust the model based on your need
				messages: [{ "role": "user", "content": `I have this code: \n\n${selectedText}\n\n ${instructions}. Please return only the code as this will be used in a diff.` }],
			},
			{
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`,
				},
			}
		);
		// Access the content of the message returned by the ChatGPT API
		const editedCode = response.data.choices[0].message.content.trim();
		return editedCode;
	} catch (error: any) {
		vscode.window.showErrorMessage('Error calling ChatGPT API: ' + error.message);
		return null;
	}
}

// Function to show the diff and allow accepting/rejecting
function showDiff(document: vscode.TextDocument, originalText: string, editedText: string) {
	const originalUri = vscode.Uri.parse('untitled:OriginalCode');
	const editedUri = vscode.Uri.parse('untitled:EditedCode');

	const originalDoc = vscode.workspace.openTextDocument(originalUri);
	const editedDoc = vscode.workspace.openTextDocument(editedUri);

	originalDoc.then(doc => {
		const edit = new vscode.WorkspaceEdit();
		edit.insert(originalUri, new vscode.Position(0, 0), originalText);
		vscode.workspace.applyEdit(edit).then(() => {
			editedDoc.then(editedDoc => {
				const edit = new vscode.WorkspaceEdit();
				edit.insert(editedUri, new vscode.Position(0, 0), editedText);
				vscode.workspace.applyEdit(edit).then(() => {
					vscode.commands.executeCommand(
						'vscode.diff',
						originalUri,
						editedUri,
						'ChatGPT Code Changes'
					);
				});
			});
		});
	});
}

export class SelectionCodeLensProvider implements vscode.CodeLensProvider {
	private onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event;

	private selection: vscode.Selection | null = null;

	constructor() {
		// Listen for selection changes
		vscode.window.onDidChangeTextEditorSelection((e) => {
			this.selection = e.selections[0];
			this.onDidChangeCodeLensesEmitter.fire();
		});
	}

	public provideCodeLenses(
		document: vscode.TextDocument,
		token: vscode.CancellationToken
	): vscode.CodeLens[] {
		const codeLenses: vscode.CodeLens[] = [];

		if (this.selection && !this.selection.isEmpty) {
			const range = new vscode.Range(this.selection.start, this.selection.end);

			// Create CodeLens items for the selected range
			const chatCommand: vscode.Command = {
				title: 'Chat ⌘L',
				command: 'cai.chatCommand',
				arguments: [document, this.selection],
			};

			const editCommand: vscode.Command = {
				title: 'Edit ⌘K',
				command: 'cai.editCommand',
				arguments: [document, this.selection],
			};

			// Add the CodeLens items
			codeLenses.push(new vscode.CodeLens(range, chatCommand));
			codeLenses.push(new vscode.CodeLens(range, editCommand));
		}

		return codeLenses;
	}
}

/**
 * ----------------------------------------------------
 * Activate
 * ----------------------------------------------------
 * @param context 
 */
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Get config
	const config = vscode.workspace.getConfiguration('cai');
	const apiToken = config.get('apiToken') as string | undefined;

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "cai" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const hello = vscode.commands.registerCommand('cai.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from cai!');
	});

	context.subscriptions.push(hello);

	const codeLensProvider = new SelectionCodeLensProvider();
	context.subscriptions.push(
		vscode.languages.registerCodeLensProvider(
			{ scheme: 'file', language: '*' },
			codeLensProvider
		)
	);

	/**
	 * ⌘L Chat Panel Command
	 */
	const chatCommand = vscode.commands.registerCommand('cai.chatCommand', async () => {
		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}

		// Get the selected text from the editor
		const selection = editor.selection;
		const selectedText = editor.document.getText(selection);

		// Create and show the panel
		const panel = vscode.window.createWebviewPanel(
			'chatPanel', // Identifies the type of the webview panel
			'Chat with AI', // Title of the panel displayed to the user
			vscode.ViewColumn.Two, // Show the panel to the right of the editor
			{
				enableScripts: true, // Enable JavaScript in the webview
			}
		);
		// Set the content of the webview with the selected code in a textbox
		panel.webview.html = getWebviewContent(panel.webview, context, selectedText);
	});
	context.subscriptions.push(chatCommand);


	const viewProvider = new MyWebviewViewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			MyWebviewViewProvider.viewId,
			viewProvider,
			{
				webviewOptions: { retainContextWhenHidden: true, }
			}
		)
	);

	/**
	 * ⌘K Chat Edit Command
	 */
	context.subscriptions.push(
		vscode.commands.registerCommand('cai.editCommand', async (document, selection) => {
			const selectedText = document.getText(selection);

			// Show an input box to allow the user to provide additional instructions
			const userInstructions = await vscode.window.showInputBox({
				prompt: 'Add instructions for editing (e.g., improve readability, optimize performance, etc.)',
				placeHolder: 'e.g., improve readability, optimize performance...',
				value: '' // Default value is empty
			});

			// Call ChatGPT API with the selected code
			const editedText = await callChatGPTAPI(selectedText, userInstructions);
			if (!editedText) {
				return; // Handle error or empty response
			}

			// Show the diff between the original and edited text
			showDiff(document, selectedText, editedText);

			// Optional: Provide user options to accept or reject the change
			const result = await vscode.window.showInformationMessage(
				'Do you want to accept the changes?',
				'Accept',
				'Reject'
			);
			if (result === 'Accept') {
				const edit = new vscode.WorkspaceEdit();
				edit.replace(document.uri, selection, editedText);
				await vscode.workspace.applyEdit(edit);
			}
		})
	);
}





// Function to generate the webview content with a textarea
function getWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext, selectedCode: string): string {
	// const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'app.js'));
	const scriptUri = webview.asWebviewUri(webview.asWebviewUri(vscode.Uri.file(context.extensionPath + '/out/app/bundle.js')));

	return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Chat with AI</title>
		<style>
			body {
				font-family: sans-serif;
				padding: 10px;
				display: flex;
				flex-direction: column;
				background-color: var(--vscode-sideBar-background); /* Match Explorer background color */
				color: var(--vscode-sideBar-foreground); /* Match Explorer text color */
			}
		</style>
	</head>
	<body>
		<div id="app"></div>
		<script src="${scriptUri}"></script>
	</body>
	</html>
	`;
}


class MyWebviewViewProvider implements vscode.WebviewViewProvider 
{
	public static readonly viewId = 'cai.chatgpt';

	private _view?: vscode.WebviewView;

	constructor(private readonly context: vscode.ExtensionContext) { }

	public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken): void 
	{
		this._view = webviewView;

		// Set up webview options
		webviewView.webview.options = {
			enableScripts: true
		};

		// Set the content of the webview
		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		// Send VS Code config settings
		const config = vscode.workspace.getConfiguration('cai');
		webviewView.webview.postMessage({ command: 'updateConfig', config: config });
	}

	private _getHtmlForWebview(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'out', 'app', 'bundle.js'));

		// You can include external scripts/styles if needed by using webview.asWebviewUri
		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Chat with AI</title>
			<style>
			body {
				font-family: sans-serif;
				padding: 10px;
				display: flex;
				flex-direction: column;
				background-color: var(--vscode-sideBar-background); /* Match Explorer background color */
				color: var(--vscode-sideBar-foreground); /* Match Explorer text color */
			}
			</style>
		</head>
		<body>
			<div id="app"></div>
			<script src="${scriptUri}"></script>
		</body>
		</html>`;
	}
}


// This method is called when your extension is deactivated
export function deactivate() { }