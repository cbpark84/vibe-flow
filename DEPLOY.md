# Vibe Flow — 마켓플레이스 배포 가이드

> 처음 배포하는 경우를 위한 단계별 상세 가이드입니다.  
> 예상 소요 시간: 약 1~2시간 (계정 생성 포함)

---

## 전체 흐름

```
Step 1  아이콘 변환 (SVG → PNG)          ← 즉시 가능, 5분
Step 2  VS Code Marketplace Publisher 계정 생성  ← Microsoft 계정 필요, 10분
Step 3  package.json Publisher 업데이트   ← 코드 수정, 2분
Step 4  스크린샷 촬영                     ← F5 실행 후 촬영, 20분
Step 5  GitHub 설정                      ← Branch Protection + VSCE_PAT, 15분
Step 6  첫 릴리스                        ← 태그 push → 자동 배포, 10분
```

---

## Step 1 — 아이콘 변환 (SVG → PNG)

VS Code 마켓플레이스는 SVG 아이콘을 허용하지 않습니다.  
`resources/icon.svg` 파일을 128×128 PNG로 변환해야 합니다.

### 방법 A: rsvg-convert (권장)

```bash
# librsvg 설치 (Homebrew 필요)
brew install librsvg

# 변환 실행
rsvg-convert -w 128 -h 128 \
  /Users/sanai/Desktop/ai_project/projects/cc_플러그인_개발/resources/icon.svg \
  -o /Users/sanai/Desktop/ai_project/projects/cc_플러그인_개발/resources/icon.png

# 결과 확인 (파일 크기 출력)
ls -lh /Users/sanai/Desktop/ai_project/projects/cc_플러그인_개발/resources/icon.png
```

### 방법 B: ImageMagick (대안)

```bash
brew install imagemagick

magick \
  /Users/sanai/Desktop/ai_project/projects/cc_플러그인_개발/resources/icon.svg \
  -resize 128x128 \
  /Users/sanai/Desktop/ai_project/projects/cc_플러그인_개발/resources/icon.png
```

### 완료 확인

- Finder에서 `resources/icon.png` 파일이 존재하는지 확인
- 파일을 미리보기로 열어 이미지가 정상 표시되는지 확인

> **주의**: `brew install librsvg` 이후 `rsvg-convert` 명령어가 즉시 사용 가능합니다.
> Homebrew가 없는 경우 https://brew.sh 에서 먼저 설치하세요.

- [ ] `resources/icon.png` (128×128 PNG) 생성 완료

---

## Step 2 — VS Code Marketplace Publisher 계정 만들기

Publisher 계정은 **Microsoft 계정만 있으면 생성 가능**합니다.  
Azure DevOps 조직을 별도로 만들 필요는 없습니다.

### 2-1. Microsoft 계정 로그인 확인

1. 브라우저에서 https://marketplace.visualstudio.com/manage 접속
2. 우측 상단 **Sign in** 클릭
3. Microsoft 계정(Outlook, Hotmail, Live 등) 또는 GitHub 계정으로 로그인

> **팁**: 이미 Microsoft 계정이 있다면 새로 만들 필요 없습니다.  
> c.b.park84@gmail.com Gmail 계정은 직접 사용 불가 → Microsoft 계정을 Gmail 주소로 만드는 방법:  
> https://account.microsoft.com → "새 Microsoft 계정 만들기" → "이메일 주소 사용"에서 Gmail 입력

### 2-2. Publisher 생성

1. https://marketplace.visualstudio.com/manage 에 로그인된 상태에서 접속
2. 페이지 중앙에 **"Create publisher"** 버튼이 표시됩니다
   - 이미 Publisher가 있다면 바로 관리 화면이 표시됩니다 (이 단계 건너뜀)
3. 다음 항목을 입력합니다:

   | 항목 | 입력값 | 비고 |
   |------|--------|------|
   | **Publisher ID** (ID) | `cbpark84` | **배포 후 변경 불가**. 영문/숫자/하이픈만 허용 |
   | **Display Name** | `cbpark84` 또는 원하는 이름 | 마켓플레이스에 표시되는 이름 |
   | Email | c.b.park84@gmail.com | 알림 수신용 |

4. **Create** 버튼 클릭
5. 관리 페이지로 이동하면 Publisher 생성 완료

> **주의**: Publisher ID는 `package.json`의 `publisher` 필드와 **정확히 일치**해야 합니다.  
> 대소문자 구분 없음 (모두 소문자로 통일 권장).

> **주의**: Publisher ID 선택 시 이미 사용 중인 ID라면 오류가 표시됩니다.  
> 다른 ID를 시도하거나 숫자를 추가해보세요 (예: `cbpark84-dev`).

### 2-3. Publisher 생성 완료 확인

- https://marketplace.visualstudio.com/manage 에서 본인 Publisher 이름이 목록에 보이면 성공
- 또는 vsce 명령어로 확인 (Step 5 이후 가능):
  ```bash
  npx vsce ls-publishers
  ```

- [ ] Microsoft 계정 로그인 완료
- [ ] VS Code Marketplace Publisher 계정 생성 완료 (ID 확정)

---

## Step 3 — package.json Publisher 업데이트

Publisher ID가 확정되면 코드를 업데이트합니다.

### 3-1. package.json 수정

`/Users/sanai/Desktop/ai_project/projects/cc_플러그인_개발/package.json` 파일을 열고  
`publisher` 필드가 생성한 Publisher ID와 일치하는지 확인합니다:

```json
{
  "publisher": "cbpark84"
}
```

현재 값이 이미 `cbpark84`라면 변경 불필요합니다.  
다른 ID를 선택했다면 해당 ID로 수정합니다.

### 3-2. 변경사항 커밋 및 Push

```bash
cd /Users/sanai/Desktop/ai_project/projects/cc_플러그인_개발

# publisher 변경이 있었을 경우만 실행
git add package.json
git commit -m "chore: update publisher id to cbpark84"
git push origin main
```

- [ ] `package.json` publisher 필드 확인/수정 완료
- [ ] git push 완료 (변경사항 있을 경우)

---

## Step 4 — 스크린샷 촬영

마켓플레이스 페이지에 표시될 스크린샷 6장을 촬영합니다.

### 4-1. Extension Development Host 실행

1. VSCode에서 이 프로젝트 폴더를 열기
2. 키보드에서 **F5** 키를 누르거나, 메뉴에서 **Run → Start Debugging** 선택
3. 새 VSCode 창("Extension Development Host"라고 표시됨)이 열립니다
4. 새 창의 Activity Bar(왼쪽 아이콘 줄)에서 Vibe Flow 아이콘을 클릭합니다

> **팁**: Extension Development Host 창이 열리지 않으면 터미널에서 `npm run compile` 먼저 실행 후 재시도

### 4-2. 촬영 목록 및 방법

macOS에서 스크린샷 단축키: **Shift + Cmd + 4** → 드래그로 영역 선택 → 자동 저장

| 파일명 | 촬영 내용 | 권장 크기 |
|--------|-----------|-----------|
| `images/chat-overview.png` | 채팅 패널 전체 (메시지 주고받는 장면) | 1280×800 |
| `images/provider-select.png` | 프로바이더 선택 드롭다운이 열린 화면 | 800×600 |
| `images/file-diff-preview.png` | write_file Diff 미리보기 + 승인 버튼 | 1280×800 |
| `images/terminal-approval.png` | run_terminal 승인 UI | 1280×600 |
| `images/settings-panel.png` | Settings Panel — API Keys 탭 | 1280×800 |
| `images/settings-context.png` | Settings Panel — Context 탭 (슬라이더) | 1280×800 |

> **팁**: 촬영 시 VSCode 다크 테마, 기본 폰트 크기(14px), 창 크기 1280×800 이상 권장

### 4-3. 파일 저장 위치

촬영된 파일을 프로젝트의 `images/` 폴더로 이동합니다:

```bash
# images 폴더가 없으면 생성
mkdir -p /Users/sanai/Desktop/ai_project/projects/cc_플러그인_개발/images

# 파일을 해당 폴더로 이동 (예시 — 실제 파일명 확인 후 실행)
mv ~/Desktop/Screenshot\ *.png /Users/sanai/Desktop/ai_project/projects/cc_플러그인_개발/images/
```

### 4-4. README.md 스크린샷 주석 해제

`README.md`의 `## Screenshots` 섹션에서 `<!-- ... -->` 주석을 제거합니다:

```markdown
![Chat Overview](images/chat-overview.png)
*멀티 프로바이더 AI 채팅 인터페이스*

![Diff Preview](images/file-diff-preview.png)
*파일 수정 전 Diff 미리보기 및 사용자 승인*

![Settings Panel](images/settings-panel.png)
*프로바이더별 API 키 관리 및 설정*
```

- [ ] `images/chat-overview.png` 저장
- [ ] `images/provider-select.png` 저장
- [ ] `images/file-diff-preview.png` 저장
- [ ] `images/terminal-approval.png` 저장
- [ ] `images/settings-panel.png` 저장
- [ ] `images/settings-context.png` 저장
- [ ] `README.md` 스크린샷 주석 해제 후 저장

---

## Step 5 — GitHub 설정

### 5-1. Branch Protection (Ruleset 방식 — 2025년 권장)

GitHub는 기존 "Classic branch protection rules" 외에 **Rulesets**라는 새로운 방식을 제공합니다.  
2025년 기준 Rulesets가 권장 방식이며 더 세밀한 제어가 가능합니다.

#### Ruleset 생성 경로

1. GitHub에서 이 저장소 페이지로 이동
2. 상단 탭에서 **Settings** 클릭
   - Settings 탭이 보이지 않으면 저장소 주소 끝에 `/settings` 직접 입력
3. 왼쪽 사이드바에서 **Code and automation** 섹션 → **Rules** → **Rulesets** 클릭
4. 우측 상단 **New ruleset** 드롭다운 클릭 → **New branch ruleset** 선택

#### Ruleset 설정값

| 항목 | 값 |
|------|----|
| Ruleset Name | `Protect main` |
| Enforcement status | **Active** |
| Target branches → Add target | `Include default branch` 선택 |

**Require status checks to pass** 체크 항목:

- **Require status checks to pass before merging** 체크
- **Require branches to be up to date before merging** 체크
- 검색창에 `CI Gate (All Checks Passed)` 입력 → 검색 결과에서 선택하여 추가

> **주의**: Status check 이름은 `CI Gate (All Checks Passed)`와 **정확히 일치**해야 합니다.  
> GitHub Actions가 한 번도 실행되지 않은 경우 검색 결과에 나타나지 않을 수 있습니다.  
> 이 경우 Step 6의 Dry Run을 먼저 실행하면 Actions가 트리거되어 검색 가능해집니다.

5. 페이지 하단 **Create** 버튼 클릭

#### 완료 확인

- Rulesets 목록에 `Protect main` 이 Active 상태로 표시되면 성공

> **팁**: 기존 Classic branch protection rules를 사용해도 됩니다.  
> 경로: Settings → Branches → Add branch protection rule → Branch name pattern에 `main` 입력

- [ ] Branch Protection Ruleset 생성 완료

---

### 5-2. VSCE_PAT 발급 (마켓플레이스 자동 배포용)

> **⚠️ 2026년 3월 변경사항**: "All accessible organizations" 범위의 Global PAT는 신규 생성이 차단되었습니다.
> 아래 가이드는 **조직 특정 PAT** 방식을 사용합니다. 동작 방식은 동일합니다.

#### 5-2-1. Azure DevOps 조직 만들기

1. [https://dev.azure.com](https://dev.azure.com) 접속 → Microsoft 계정으로 로그인
2. 첫 화면에서 **"Create new organization"** 클릭
3. 조직 이름 입력 (예: `cbpark84-dev`) → 지역: **East Asia** 선택 → **Continue**
4. 프로젝트 이름은 아무 이름이나 입력 → **Create project**
   - 마켓플레이스 배포에는 프로젝트 내용이 필요 없음. 이름만 만들면 됨.

#### 5-2-2. Personal Access Token 발급

1. 조직 대시보드 우측 상단 → **사람 아이콘 (User settings)** 클릭 → **Personal access tokens** 클릭
2. **"New Token"** 파란 버튼 클릭
3. 아래와 같이 입력:

   | 항목 | 값 |
   |------|----|
   | Name | `vibe-flow-marketplace` |
   | Organization | **방금 만든 조직 선택** (All accessible organizations ❌ 선택 금지) |
   | Expiration | 1 year (최대치) |
   | Scopes | **Custom defined** 선택 후 아래 체크 |

4. Scopes에서 **"Marketplace"** 항목 찾기 → **"Manage"** 체크박스 선택
   - 💡 Marketplace 항목이 안 보이면 "Show all scopes" 링크 클릭

5. **"Create"** 버튼 클릭
6. 생성된 토큰이 화면에 표시됨 → **즉시 복사** (창을 닫으면 다시 볼 수 없음!)

   > ⚠️ 토큰은 생성 직후 한 번만 표시됩니다. 반드시 복사 후 안전한 곳에 임시 보관하세요.

#### 5-2-3. GitHub Secret 등록

1. GitHub 저장소 → **Settings** 탭 클릭
2. 왼쪽 메뉴: **Secrets and variables** → **Actions** 클릭
3. **"New repository secret"** 버튼 클릭
4. 입력:
   - Name: `VSCE_PAT`
   - Secret: (복사한 PAT 토큰 붙여넣기)
5. **"Add secret"** 클릭

#### 5-2-4. 확인

GitHub 저장소 → Settings → Secrets and variables → Actions 에서
`VSCE_PAT` 항목이 목록에 보이면 완료.

> **12월 이후 대안**: 2026년 12월 1일 이후에는 조직 특정 PAT도 폐지됩니다.
> 그때는 VS Code Marketplace 웹 UI(marketplace.visualstudio.com/manage)에서
> .vsix 파일을 수동으로 업로드하거나, Microsoft Entra ID 방식으로 전환하면 됩니다.
> 지금은 이 방법으로 충분합니다.

- [ ] Azure DevOps 조직 생성 완료
- [ ] Azure DevOps PAT 생성 완료 (Marketplace → Manage scope)
- [ ] GitHub Secret `VSCE_PAT` 등록 완료

---

## Step 6 — 첫 릴리스

모든 이전 단계가 완료된 후 실행합니다.

### 6-1. 빌드 확인

```bash
cd /Users/sanai/Desktop/ai_project/projects/cc_플러그인_개발

npm run compile   # TypeScript 컴파일 성공 확인
npm run lint      # ESLint 0 경고 확인
```

> **주의**: 오류가 있으면 태그를 push하지 마세요. CI가 실패합니다.

### 6-2. Dry Run (선택 — 권장)

실제 배포 없이 VSIX 파일 빌드만 테스트합니다.

1. GitHub 저장소 → 상단 **Actions** 탭 클릭
2. 왼쪽 목록에서 **Release** 워크플로우 클릭
3. 우측 상단 **Run workflow** 드롭다운 클릭
4. `dry_run` 옵션이 `true`인지 확인 → **Run workflow** 클릭
5. 워크플로우 진행 상황을 클릭하여 로그 확인
6. 성공 시 VSIX 파일이 워크플로우 Artifacts에 생성됩니다

> **팁**: Dry Run 실행 후 Actions 목록에 워크플로우 이름이 나타납니다.  
> 이 시점에서 Step 5-1의 Status Check 이름 검색이 가능해집니다.

### 6-3. 현재 버전 확인

```bash
# package.json의 현재 버전 확인
grep '"version"' /Users/sanai/Desktop/ai_project/projects/cc_플러그인_개발/package.json
```

출력 예시: `"version": "0.1.0"`

### 6-4. 릴리스 태그 Push

```bash
cd /Users/sanai/Desktop/ai_project/projects/cc_플러그인_개발

# 태그 생성 (package.json 버전과 일치시킬 것)
git tag v0.1.0

# 태그 push → Release 워크플로우 자동 실행
git push origin v0.1.0
```

> **주의**: 태그는 `v` 접두사를 포함해야 합니다 (`v0.1.0`, `v1.0.0` 형식).  
> 한 번 push한 태그는 되돌리기 어려우므로 신중하게 실행하세요.

### 6-5. 진행 상황 확인

1. GitHub 저장소 → **Actions** 탭에서 Release 워크플로우 진행 확인
   - 보통 3~5분 소요
2. 완료 후 **Releases** 탭에서 `v0.1.0` 릴리스 확인
   - `.vsix` 파일이 첨부파일로 포함되어 있어야 합니다
3. VSCE_PAT를 설정한 경우, 배포 후 10~30분 이내에 마켓플레이스 검색 가능:
   - https://marketplace.visualstudio.com 에서 "Vibe Flow" 검색

> **주의**: 마켓플레이스 반영은 최대 30분 소요될 수 있습니다.  
> 즉시 검색되지 않아도 정상입니다.

- [ ] Dry Run 성공 확인 (선택 — 권장)
- [ ] 빌드 및 린트 오류 없음 확인
- [ ] `git tag v0.1.0 && git push origin v0.1.0` 실행
- [ ] GitHub Release 생성 및 VSIX 파일 첨부 확인
- [ ] VS Code Marketplace 배포 확인 (VSCE_PAT 설정한 경우)

---

## 완료 기준

| 항목 | 확인 방법 |
|------|-----------|
| 아이콘 | `resources/icon.png` 128×128 PNG 존재 |
| Publisher | https://marketplace.visualstudio.com/manage 에서 계정 확인 |
| 스크린샷 | `images/*.png` 6개 파일 존재, README 주석 해제 |
| CI | PR 생성 시 GitHub Actions 자동 실행 확인 |
| 릴리스 | GitHub Releases 탭에 v0.1.0 + VSIX 첨부 확인 |
| 마켓플레이스 | https://marketplace.visualstudio.com 에서 "Vibe Flow" 검색 시 노출 |

---

## 문제 해결 (FAQ)

### Q1. `rsvg-convert: command not found` 오류

```bash
# Homebrew PATH가 설정되지 않은 경우
export PATH="/opt/homebrew/bin:$PATH"

# 또는 다시 설치
brew reinstall librsvg
```

### Q2. Publisher 생성 시 "Publisher ID already taken" 오류

Publisher ID가 이미 사용 중입니다. 다른 ID를 시도하세요:
- 숫자 추가: `cbpark84-ext`, `cbpark84dev`
- ID 변경 후 `package.json`의 `publisher` 필드도 동일하게 수정

### Q3. Branch Protection에서 Status Check 이름이 검색되지 않음

GitHub Actions가 한 번도 실행되지 않으면 검색 목록에 나타나지 않습니다.  
해결 방법:
1. Step 6-2의 Dry Run을 먼저 실행
2. 워크플로우가 완료된 후 다시 Branch Protection 설정으로 이동하여 검색

### Q4. VSCE_PAT 관련 오류 (`401 Unauthorized`)

- PAT 발급 시 **Marketplace → Manage** scope를 선택했는지 확인
- GitHub Secret 이름이 정확히 `VSCE_PAT`인지 확인 (대소문자 구분)
- PAT가 만료되지 않았는지 Azure DevOps에서 확인

### Q5. 마켓플레이스에 배포됐는데 검색이 안 됨

- 배포 후 최대 30분 소요. 기다린 후 재시도
- `package.json`의 `publisher` 필드가 실제 Publisher ID와 일치하는지 확인
- https://marketplace.visualstudio.com/manage 에서 Extension 상태 직접 확인

### Q6. 2026년 이후 PAT가 만료/차단된 경우

Azure DevOps는 2026년 12월 1일부터 Global PAT를 완전 폐지합니다.  
대안:
- **단일 조직 PAT**: 특정 Azure DevOps 조직으로 범위를 한정한 PAT는 계속 사용 가능
- **Microsoft Entra ID 인증**: `vsce publish --azure-credential` 명령어 사용 (자동화 환경에서 권장)
- 자세한 내용: https://code.visualstudio.com/api/working-with-extensions/publishing-extension

### Q7. `git tag v0.1.0` 실행 시 "already exists" 오류

```bash
# 로컬 태그 삭제
git tag -d v0.1.0

# 원격 태그 삭제 (이미 push한 경우)
git push origin --delete v0.1.0

# 다시 생성
git tag v0.1.0
git push origin v0.1.0
```

---

## 참고 링크

- VS Code 마켓플레이스 관리: https://marketplace.visualstudio.com/manage
- VS Code 배포 공식 문서: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- Azure DevOps PAT 관리: https://dev.azure.com
- GitHub Rulesets 공식 문서: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository

---

**최종 업데이트**: 2026-06-27  
**기준 환경**: macOS, GitHub Actions, vsce
