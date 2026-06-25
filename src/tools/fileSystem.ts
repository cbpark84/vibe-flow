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

/**
 * search_code 도구: 워크스페이스에서 정규식 패턴으로 코드를 검색한다.
 * @param pattern - 검색할 정규식 또는 문자열
 * @param include - 검색할 파일 glob 패턴 (예: '**\/*.ts', 기본값: 모든 파일)
 * @param maxResults - 최대 결과 수 (기본값: 50)
 */
export async function searchCode(
  pattern: string,
  include: string = '**/*',
  maxResults: number = 50
): Promise<Array<{ file: string; line: number; text: string }>> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('워크스페이스가 열려 있지 않습니다.');
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const results: Array<{ file: string; line: number; text: string }> = [];

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, 'i');
  } catch {
    // 정규식이 아니면 리터럴 문자열로 검색
    regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  // glob으로 파일 목록 가져오기
  const uris = await vscode.workspace.findFiles(include, '**/node_modules/**', maxResults * 10);

  for (const uri of uris) {
    if (results.length >= maxResults) break;

    // 워크스페이스 외부 파일 제외
    if (!uri.fsPath.startsWith(workspaceRoot)) continue;

    let content: string;
    try {
      content = await fs.readFile(uri.fsPath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        results.push({
          file: path.relative(workspaceRoot, uri.fsPath),
          line: i + 1,
          text: lines[i].trim(),
        });
        if (results.length >= maxResults) break;
      }
    }
  }

  return results;
}
