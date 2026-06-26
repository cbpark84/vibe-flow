import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | null = null;

export function getLogger(name: string): {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string | Error) => void;
} {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Vibe Flow');
  }

  return {
    info: (message: string): void => {
      outputChannel!.appendLine(`[${name}] INFO: ${message}`);
    },
    warn: (message: string): void => {
      outputChannel!.appendLine(`[${name}] WARN: ${message}`);
    },
    error: (message: string | Error): void => {
      const msg = message instanceof Error ? message.message : message;
      outputChannel!.appendLine(`[${name}] ERROR: ${msg}`);
    },
  };
}

export function showOutputChannel(): void {
  outputChannel?.show(true);
}
