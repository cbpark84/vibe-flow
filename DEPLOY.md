# Vibe Flow — 배포 전 체크리스트

마켓플레이스 배포 전에 직접 완료해야 하는 작업 목록입니다.  
CI/CD 자동화 워크플로우(`.github/workflows/`)는 이미 구성되어 있으며,  
아래 항목들은 자동화할 수 없는 **1회성 수동 작업**입니다.

---

## Step 1 — 아이콘 변환 (즉시 가능)

VS Code 마켓플레이스는 SVG 아이콘을 지원하지 않습니다.  
`resources/icon.svg` → `resources/icon.png` (128×128 PNG) 변환이 필요합니다.

```bash
# 방법 A: rsvg-convert (Homebrew)
brew install librsvg
rsvg-convert -w 128 -h 128 resources/icon.svg -o resources/icon.png

# 방법 B: ImageMagick (Homebrew)
brew install imagemagick
magick resources/icon.svg -resize 128x128 resources/icon.png

# 방법 C: Inkscape
inkscape resources/icon.svg --export-png=resources/icon.png --export-width=128 --export-height=128
```

변환 후 `resources/icon.png` 파일이 생성되었는지 확인.

- [ ] `resources/icon.png` (128×128) 생성 완료

---

## Step 2 — Publisher 계정 생성 및 확인

현재 `package.json`의 `publisher` 필드는 임시값(`cbpark84`)으로 설정되어 있습니다.  
실제 마켓플레이스 배포 전에 Publisher 계정을 만들고 이름을 확정해야 합니다.

### 2-1. Azure DevOps 조직 생성

1. [https://dev.azure.com](https://dev.azure.com) 접속 → Microsoft 계정으로 로그인
2. 새 조직 생성 (이름은 Publisher ID와 동일하게 권장)

### 2-2. VS Code Marketplace Publisher 생성

1. [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) 접속
2. **Create publisher** 클릭
3. Publisher ID 입력 (예: `cbpark84`) — **배포 후 변경 불가**
4. 이름, 이메일 입력 → 생성

### 2-3. package.json 업데이트

Publisher ID가 확정되면 `package.json`의 `publisher` 필드를 실제 값으로 업데이트:

```json
"publisher": "실제-publisher-id"
```

- [ ] Azure DevOps 조직 생성 완료
- [ ] VS Code Marketplace Publisher 계정 생성 완료
- [ ] `package.json` publisher 필드 실제 값으로 업데이트

---

## Step 3 — 스크린샷 촬영

`images/` 폴더에 저장 후 `README.md`의 주석을 해제하면 마켓플레이스에 표시됩니다.

### 촬영 방법

1. VSCode에서 **F5** → Extension Development Host 실행
2. Activity Bar의 Vibe Flow 아이콘 클릭 → 채팅 패널 열기
3. 아래 장면을 촬영 → `images/` 폴더에 저장

### 필요한 스크린샷 (6개)

| 파일명 | 촬영 장면 | 권장 크기 |
|--------|-----------|-----------|
| `chat-overview.png` | 채팅 패널 전체 (메시지 주고받는 장면) | 1280×800 |
| `provider-select.png` | 프로바이더 선택 드롭다운 열린 화면 | 800×600 |
| `file-diff-preview.png` | write_file Diff 미리보기 + 승인 버튼 | 1280×800 |
| `terminal-approval.png` | run_terminal 승인 UI | 1280×600 |
| `settings-panel.png` | Settings Panel — API Keys 탭 | 1280×800 |
| `settings-context.png` | Settings Panel — Context 탭 (슬라이더) | 1280×800 |

> **팁**: VSCode 다크 테마, 폰트 크기 기본값(14px), 윈도우 1280×800 이상에서 촬영 권장

### 촬영 완료 후 README.md 수정

`README.md`의 `## Screenshots` 섹션에서 주석(` <!-- ... --> `) 제거:

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
- [ ] `README.md` 스크린샷 주석 해제

---

## Step 4 — GitHub 설정 (CI/CD)

### 4-1. Branch Protection 설정

GitHub 저장소 → **Settings → Branches → Add rule**

```
Branch name pattern : main
☑ Require status checks to pass before merging
  → Search: "CI Gate (All Checks Passed)" 추가
☑ Require branches to be up to date before merging
```

- [ ] Branch Protection 규칙 설정 완료

### 4-2. VSCE_PAT 발급 (마켓플레이스 자동 배포용)

마켓플레이스 자동 배포를 원할 경우에만 필요합니다.  
없으면 GitHub Release만 생성되고 마켓플레이스 배포는 수동으로 해야 합니다.

1. [https://dev.azure.com](https://dev.azure.com) → 우측 상단 사용자 아이콘 → **Personal access tokens**
2. **New Token** 생성
   - Name: `vibe-flow-marketplace`
   - Organization: `All accessible organizations`
   - Scopes: **Marketplace → Manage** 체크
3. 생성된 토큰 복사

GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**

```
Name  : VSCE_PAT
Value : (복사한 토큰)
```

- [ ] Azure DevOps PAT 생성 완료
- [ ] GitHub Secret `VSCE_PAT` 등록 완료

---

## Step 5 — 첫 릴리스

위 모든 단계 완료 후 실행합니다.

### 5-1. 빌드 확인

```bash
npm run compile  # 빌드 성공 확인
npm run lint     # ESLint 0 경고 확인
npm run test     # 테스트 통과 확인
```

### 5-2. Dry Run (선택 — 배포 없이 VSIX 빌드만 테스트)

GitHub → **Actions → Release → Run workflow**  
`dry_run: true` (기본값) → VSIX 파일 생성만 확인

### 5-3. 릴리스 실행

```bash
# package.json 버전 확인 (현재: 0.1.0)
cat package.json | grep '"version"'

# 태그 생성 및 push → Release 워크플로우 자동 실행
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions → Release 워크플로우 진행 확인  
완료 후 GitHub Releases 탭에서 VSIX 파일 확인

- [ ] Dry Run 성공 확인 (선택)
- [ ] `git tag v0.1.0 && git push origin v0.1.0` 실행
- [ ] GitHub Release 생성 및 VSIX 파일 첨부 확인
- [ ] VS Code Marketplace 배포 확인 (VSCE_PAT 설정한 경우)

---

## 완료 기준

| 항목 | 확인 방법 |
|------|-----------|
| 아이콘 | `resources/icon.png` 128×128 PNG 존재 |
| Publisher | [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) 에 계정 존재 |
| 스크린샷 | `images/*.png` 6개 파일 존재, README 주석 해제 |
| CI | PR 생성 시 GitHub Actions 자동 실행 확인 |
| 릴리스 | GitHub Releases 탭에 v0.1.0 + VSIX 첨부 |
| 마켓플레이스 | [marketplace.visualstudio.com](https://marketplace.visualstudio.com) 에서 "Vibe Flow" 검색 시 노출 |
