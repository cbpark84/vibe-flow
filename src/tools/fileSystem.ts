import * as fs from 'fs/promises';
import * as path from 'path';
import { createTwoFilesPatch } from 'diff';
import * as vscode from 'vscode';

interface ApprovalRequest {
  resolve: (approved: boolean) => void;
  reject: (error: Error) => void;
}

const pendingApprovals = new Map<string, ApprovalRequest>();

export async function handleApproveWriteFile(
  requestId: string,
  approved: boolean
): Promise<void> {
  const approval = pendingApprovals.get(requestId);
  if (approval) {
    approval.resolve(approved);
    pendingApprovals.delete(requestId);
  }
}

/**
 * read_file 도구: 파일 내용을 읽는다
 */
export async function readFile(filePath: string): Promise<string> {
  try {
    // 절대 경로 확인
    const resolvedPath = path.resolve(filePath);
    const content = await fs.readFile(resolvedPath, 'utf-8');
    return content;
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${(error as Error).message}`);
  }
}

/**
 * write_file 도구: 파일을 쓴다 (사용자 승인 필요)
 * requestId와 onApprovalRequest를 통해 WebView와의 승인 흐름을 지원한다
 */
export async function writeFile(
  filePath: string,
  content: string,
  requestId: string,
  onApprovalRequest: (diff: string, isNewFile: boolean) => void
): Promise<{ success: boolean; message: string }> {
  try {
    const resolvedPath = path.resolve(filePath);

    // 기존 파일 읽기
    let originalContent = '';
    let isNewFile = false;
    try {
      originalContent = await fs.readFile(resolvedPath, 'utf-8');
    } catch {
      isNewFile = true;
    }

    // diff 생성
    const diff = createTwoFilesPatch(
      filePath,
      filePath,
      originalContent,
      content,
      undefined,
      undefined,
      { context: 3 }
    );

    // 승인 요청
    onApprovalRequest(diff, isNewFile);

    // 승인 대기
    const approved = await new Promise<boolean>((resolve, reject) => {
      pendingApprovals.set(requestId, { resolve, reject });
    });

    if (!approved) {
      return { success: false, message: 'User rejected the file write' };
    }

    // 디렉토리 생성
    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });

    // 파일 쓰기
    await fs.writeFile(resolvedPath, content, 'utf-8');

    return { success: true, message: `File written to ${filePath}` };
  } catch (error) {
    return {
      success: false,
      message: `Failed to write file: ${(error as Error).message}`,
    };
  }
}

/**
 * list_directory 도구: 디렉토리 목록을 읽는다
 */
export async function listDirectory(dirPath: string): Promise<string[]> {
  try {
    const resolvedPath = path.resolve(dirPath);

    // 워크스페이스 루트 확인
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      if (!resolvedPath.startsWith(workspaceRoot)) {
        throw new Error('Path is outside workspace root');
      }
    }

    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
    return entries.map(entry => {
      const type = entry.isDirectory() ? 'dir' : 'file';
      return `${type}: ${entry.name}`;
    });
  } catch (error) {
    throw new Error(`Failed to list directory ${dirPath}: ${(error as Error).message}`);
  }
}
