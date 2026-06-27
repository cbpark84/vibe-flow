# Screenshot Guide

이 폴더에 마켓플레이스용 스크린샷을 저장하세요.  
스크린샷은 README.md의 `## Screenshots` 섹션에서 참조됩니다.

## 촬영 방법

1. VSCode에서 **F5** → Extension Development Host 실행
2. Activity Bar의 Vibe Flow 아이콘 클릭 → 채팅 패널 열기
3. 아래 각 장면을 촬영 → 이 폴더에 저장

## 필요한 스크린샷 목록

| 파일명 | 내용 | 권장 크기 |
|--------|------|-----------|
| `chat-overview.png` | 채팅 패널 전체 화면 (메시지 주고받는 장면) | 1280×800 |
| `provider-select.png` | 프로바이더 선택 드롭다운 열린 화면 | 800×600 |
| `file-diff-preview.png` | write_file Diff 미리보기 + 승인 버튼 | 1280×800 |
| `terminal-approval.png` | run_terminal 승인 UI | 1280×600 |
| `settings-panel.png` | Settings Panel (API 키 탭) | 1280×800 |
| `settings-context.png` | Settings Panel (Context 탭, 슬라이더) | 1280×800 |

## 촬영 팁

- **테마**: VSCode Dark (기본 다크 테마) 권장
- **폰트 크기**: 기본값 (14px)
- **윈도우 크기**: 1280×800 이상
- **Retina 대응**: @2x 해상도 촬영 후 절반으로 축소하면 선명함

## 아이콘 (resources/icon.png)

마켓플레이스는 SVG 아이콘을 지원하지 않습니다.  
`resources/icon.svg` → PNG 128×128 변환이 필요합니다.

**변환 방법 (macOS)**:
```bash
# Inkscape 사용
inkscape resources/icon.svg --export-png=resources/icon.png --export-width=128 --export-height=128

# 또는 rsvg-convert (Homebrew)
rsvg-convert -w 128 -h 128 resources/icon.svg -o resources/icon.png

# 또는 ImageMagick
magick resources/icon.svg -resize 128x128 resources/icon.png
```
