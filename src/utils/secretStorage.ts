import * as vscode from 'vscode';

let secretStorage: vscode.SecretStorage | null = null;

export function initializeSecretStorage(storage: vscode.SecretStorage) {
  secretStorage = storage;
}

export async function getSecret(key: string): Promise<string | undefined> {
  if (!secretStorage) {
    throw new Error('SecretStorage not initialized');
  }
  return await secretStorage.get(key);
}

export async function setSecret(key: string, value: string): Promise<void> {
  if (!secretStorage) {
    throw new Error('SecretStorage not initialized');
  }
  await secretStorage.store(key, value);
}

export async function deleteSecret(key: string): Promise<void> {
  if (!secretStorage) {
    throw new Error('SecretStorage not initialized');
  }
  await secretStorage.delete(key);
}
