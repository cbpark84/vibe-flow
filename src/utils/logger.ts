import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | null = null;

export function getLogger(name: string) {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Vibe Flow');
  }

  return {
    info: (message: string) => {
      outputChannel!.appendLine(`[${name}] INFO: ${message}`);
    },
    warn: (message: string) => {
      outputChannel!.appendLine(`[${name}] WARN: ${message}`);
    },
    error: (message: string | Error) => {
      const msg = message instanceof Error ? message.message : message;
      outputChannel!.appendLine(`[${name}] ERROR: ${msg}`);
    },
  };
}

export function showOutputChannel() {
  outputChannel?.show(true);
}
