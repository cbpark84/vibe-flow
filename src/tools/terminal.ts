import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /rm\s+-rf?\s+[/~]/, reason: 'rm -rf: 루트/홈 하위 재귀 삭제' },
  { pattern: /rm\s+-rf?\s+\*/, reason: 'rm -rf *: 와일드카드 재귀 삭제' },
  { pattern: /\bsudo\b/, reason: 'sudo: 관리자 권한 실행' },
  { pattern: /\bsu\b/, reason: 'su: 사용자 전환' },
  { pattern: /chmod\s+[0-7]*7[0-7][0-7]/, reason: 'chmod 777급: 과도한 권한 부여' },
  { pattern: /chown\s+root/, reason: 'chown root: 소유권 변경' },
  { pattern: /mkfs\./, reason: 'mkfs: 파일시스템 포맷' },
  { pattern: /dd\s+if=/, reason: 'dd: 블록 디바이스 덮어쓰기' },
  { pattern: />\s*\/dev\/sd/, reason: '블록 디바이스 직접 쓰기' },
  { pattern: /curl[^|]*\|\s*(ba)?sh/, reason: 'curl pipe sh: 원격 스크립트 즉시 실행' },
  { pattern: /wget[^|]*\|\s*(ba)?sh/, reason: 'wget pipe sh: 원격 스크립트 즉시 실행' },
  { pattern: /:(){ :|:& };:/, reason: 'Fork bomb: 프로세스 폭탄' },
  { pattern: /shutdown|reboot|halt/, reason: '시스템 종료/재시작' },
  { pattern: /pkill|killall\s+-9/, reason: 'killall -9: 강제 프로세스 종료' },
  { pattern: /npm\s+publish/, reason: 'npm publish: 패키지 공개 배포' },
  { pattern: /git\s+push\s+.*--force/, reason: 'git push --force: 강제 푸시' },
];

interface TerminalApprovalRequest {
  resolve: (approved: boolean) => void;
  reject: (error: Error) => void;
}

const pendingApprovals = new Map<string, TerminalApprovalRequest>();

export function checkDangerousPattern(command: string): { isDangerous: boolean; reason?: string } {
  const lowerCommand = command.toLowerCase();
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(lowerCommand)) {
      return { isDangerous: true, reason };
    }
  }
  return { isDangerous: false };
}

export async function handleApproveTerminal(
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
 * run_terminal 도구: 터미널 명령을 실행한다 (사용자 승인 필요)
 */
export async function runTerminal(
  command: string,
  requestId: string,
  onApprovalRequest: (isDangerous: boolean, dangerReason?: string) => void,
  signal?: AbortSignal
): Promise<{ success: boolean; output: string }> {
  try {
    // 위험도 확인
    const { isDangerous, reason } = checkDangerousPattern(command);

    // 승인 요청
    onApprovalRequest(isDangerous, reason);

    // 승인 대기
    const approved = await new Promise<boolean>((resolve, reject) => {
      pendingApprovals.set(requestId, { resolve, reject });

      if (signal?.aborted) {
        reject(new Error('Aborted'));
        return;
      }

      signal?.addEventListener('abort', () => {
        reject(new Error('Aborted'));
      });
    });

    if (!approved) {
      return { success: false, output: 'User rejected the command' };
    }

    if (signal?.aborted) {
      return { success: false, output: 'Aborted' };
    }

    // 명령 실행
    try {
      const { stdout, stderr } = await execAsync(command, { signal });
      const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');
      return { success: true, output };
    } catch (error) {
      const errorMsg = (error as Error).message;
      return { success: false, output: `Command failed: ${errorMsg}` };
    }
  } catch (error) {
    if ((error as Error).message === 'Aborted') {
      return { success: false, output: 'User cancelled' };
    }
    return { success: false, output: `Error: ${(error as Error).message}` };
  }
}
