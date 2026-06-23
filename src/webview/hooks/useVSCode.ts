let vscodeApi: any = null;

export function useVSCode() {
  if (!vscodeApi) {
    vscodeApi = (window as any).acquireVsCodeApi?.();
    if (!vscodeApi) {
      throw new Error('VSCode API not available');
    }
  }
  return vscodeApi;
}
