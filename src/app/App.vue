<template>
	<div id="app">
		<h2>Chat with AI - from vue with love</h2>
		config:
		<pre>{{ jsonStrArray }}</pre>
		<pre>{{ response }}</pre>
		<form class="inputbox" @submit.prevent="sendPrompt">
			<textarea v-model="prompt" rows="4">wefwfe</textarea>
			<div style="display:flex;justify-content: space-between;align-items: center;">
				<div class="modelPicker">model picker</div>
				<button type="submit" class="goBtn">Go button</button>
			</div>
		</form>
	</div>
</template>

<script>
export default {
	props: ['selectedCode'],
	data() {
		return {
			config: {},
			response: '',
			prompt: '',
			loading: false,
		}
	},
	mounted() {

		//const vscode = acquireVsCodeApi();

		window.addEventListener('message', event => {
			const message = event.data; // The JSON data our extension sent
			if (message.command === 'updateConfig') {
				this.config = message.config;
				console.log('Received config:', this.config);
			}
		});

		// To test sending a message back to the extension
		// vscode.postMessage({
		// 	command: 'testMessage',
		// 	text: 'Hello from webview!'
		// });

	},
	methods: {
		async sendPrompt() {
			this.response = '';
			this.loading = true;

			try {
				const apiKey = '';
				const url = 'https://api.openai.com/v1/chat/completions'; // Example endpoint for ChatGPT

				const headers = new Headers({
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				});

				const body = JSON.stringify({
					model: 'gpt-3.5-turbo', // Model name might be different based on your subscription
					messages: [{ role: 'user', content: this.prompt }],
					stream: true
				});

				const response = await fetch(url, {
					method: 'POST',
					headers: headers,
					body: body
				});

				if (!response.body) {
					throw new Error('ReadableStream not supported in this browser.');
				}

				const reader = response.body.getReader();
				const decoder = new TextDecoder();

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const chunk = decoder.decode(value, { stream: true });
					const jsonStrArray = chunk.split('\n')
					.filter(line => line.trim())
					.map(line => {
						if (line == "data: [DONE]") return null;
						if (line.startsWith("data: ")) {
							const jsonStr = line.slice(6); // Remove "data: " prefix
							try {
								return JSON.parse(jsonStr);
							} catch (error) {
								console.error('Error parsing JSON:', error);
								return null;
							}
						}
					})
					.filter(Boolean);

					jsonStrArray.forEach(event => {
						const { choices } = event;
						if (choices && choices.length > 0) {
							this.response += choices[0].delta.content || ''
						}
					});

				}

				this.loading = false;
			} catch (error) {
				console.error('Error making API call:', error);
				this.loading = false;
			}
		},
	},
	beforeDestroy() {
		if (this.eventSource) {
			this.eventSource.close();
		}
	}
}

</script>

<style scopes>
.inputbox {
	display: flex;
	flex-direction: column;
	border: 1px solid var(--vscode-editorGroup-border, #000);
}

textarea {
	width: 100%;
	height: 80%;
	font-family: monospace;
	font-size: 14px;
	flex-grow: 1;
	width: 100%;
	font-family: monospace;
	font-size: 14px;
	background-color: var(--vscode-editor-background);
	/* Match editor background */
	color: var(--vscode-editor-foreground);
	/* Match editor text color */
	border: 1px solid var(--vscode-editorGroup-border);
}

button {
	margin-top: 10px;
	padding: 10px;
}

button {
	margin-top: 10px;
	padding: 10px;
	background-color: var(--vscode-button-background);
	color: var(--vscode-button-foreground);
	border: none;
	cursor: pointer;
}

button:hover {
	background-color: var(--vscode-button-hoverBackground);
}
</style>