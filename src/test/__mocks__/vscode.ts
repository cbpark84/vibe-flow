// VSCode API mock (테스트용)
export const workspace = {
  workspaceFolders: [{ uri: { fsPath: '/tmp/test-workspace' } }],
  getConfiguration: (): { get: (key: string, defaultValue: unknown) => unknown } => ({
    get: (key: string, defaultValue: unknown): unknown => defaultValue,
  }),
  findFiles: async (): Promise<unknown[]> => [],
};

export const window = {
  showErrorMessage: (msg: string): string => msg,
  showInformationMessage: (msg: string): string => msg,
};

export const Uri = {
  file: (path: string): { fsPath: string } => ({ fsPath: path }),
};

export const ExtensionContext = {};
export const SecretStorage = {};
