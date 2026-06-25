// VSCode WebView API type
interface VsCodeApi {
  postMessage(message: unknown): void;
}

let vscodeApi: VsCodeApi | null = null;

export function useVSCode(): VsCodeApi {
  if (!vscodeApi) {
    const api = (window as unknown as { acquireVsCodeApi?: () => VsCodeApi }).acquireVsCodeApi?.();
    if (!api) {
      throw new Error('VSCode API not available');
    }
    vscodeApi = api;
  }
  return vscodeApi;
}
