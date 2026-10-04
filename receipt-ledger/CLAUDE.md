# 프로젝트 인수인계 (Claude Code용) — 영수증 스캔 가계부

Cowork(클라우드 Claude) 세션에서 진행하던 작업을 Claude Code로 넘기는 문서예요.
시작하면 이 파일을 먼저 읽고 아래 "즉시 할 일"부터 진행해주세요.
이 프로젝트는 **독립 도메인으로 따로 배포**하는 단일 목적 사이트이고, 같은 계열의 `salary-calculator`
프로젝트와는 코드·저장소·배포가 완전히 분리돼 있어요. 서로 링크나 공유 코드가 없어야 해요.

## 프로젝트 개요

- 목적: 구글 애드센스 수익화를 위한 웹사이트 (사용자: 홍반장, 부업 프로젝트)
- 기능: 영수증 사진 → Google Cloud Vision OCR → 파싱 → 수정 가능한 표 → localStorage 저장 → 엑셀 불러오기/다운로드
- 저장소: https://github.com/hsmin1206/myBusiness (브랜치 `main`, 원격 최신 커밋 `f48b858`)
- 로컬 경로: `C:\Users\shift\git\myBusiness` (Git Bash: `/c/Users/shift/git/myBusiness`)
- 배포: Vercel (GitHub 연동). 환경변수 `GOOGLE_VISION_API_KEY`는 Vercel 대시보드에만 등록
- 스택: 프레임워크 없는 HTML/CSS/JS + Vercel 서버리스 함수(`api/ocr.js`). DB 없음(localStorage만)

## 구조

```
index.html / style.css / script.js   # 페이지, 스타일, 클라이언트 로직
js/parser.js                         # OCR 텍스트 → 상호/날짜/품목/금액 파서
api/ocr.js                           # Vercel 서버리스 함수 (Vision API 호출, 키는 서버에서만 사용)
privacy.html                         # 개인정보 처리방침 (플레이스홀더 남아있음)
test/parser.test.js
```

테스트: `npm test` / 로컬 확인: `python -m http.server 8000` (OCR까지 보려면 `npx vercel dev` + `.env`)

## 즉시 할 일 (1순위)

Cowork 세션은 저장소 접근 정책 때문에 push가 막혀서, 아래 변경분이 **로컬 폴더에는 있지만 GitHub에는 없어요.**

1. **로컬 폴더 정리 (먼저!)**: 예전에 이 폴더에 연봉 계산기 파일이 섞여 들어갔어요. 이 프로젝트와 무관하니
   아래 파일이 있으면 **삭제하지 말고 먼저 사용자에게 보여주고**, 새 프로젝트 폴더
   (`C:\Users\shift\git\salary-calculator`)로 옮기도록 안내해주세요. (모두 untracked 파일이라 git에는 영향 없음)
   - `salary-calculator.html`, `js/salary-calc.js`, `js/salary-calculator-ui.js`, `test/salary-calc.test.js`
   - `index.html`에 상단 네비(`site-nav`)나 `icon-calculator`가 남아있으면 안 돼요 (이 패키지의 `index.html`이 정답본)
2. `git status`, `git diff`로 변경분 확인. 기대하는 변경은 `script.js`(OCR 업로드 오류 처리 개선)와 이 `CLAUDE.md` 정도예요.
   - `.env`는 gitignore 대상이라 절대 커밋하지 않기 (`git status`에 보이면 중단하고 알려주기)
3. `npm test` 통과 확인
4. 커밋 후 `git push origin main` — 이 PC에서 처음 push하면 GitHub 로그인 창(Git Credential Manager)이 뜰 수 있어요
   - 제안 커밋 메시지: `Fix silent receipt upload/scan failures with clearer error handling`
5. Vercel 자동 배포 확인 후 배포 URL에서 실제 영수증 사진으로 재테스트

## 작업 규칙 (사용자 선호)

- 솔직하고 직설적인 피드백, 복붙 가능한 완성된 코드 선호
- 요청하지 않은 기존 내용 변경 금지 (의도치 않은 수정에 민감함)
- UI에 이모지 금지, 인라인 SVG 아이콘 사용 / 한국어 UI
- DB 없음. 데이터 저장은 브라우저 localStorage만
- 애드센스 광고 영역(`.ad-slot`)은 승인 전이라 HTML 주석으로 비활성화돼 있음 — 승인 후 주석 해제

## 미해결 이슈 / 다음 할 일

- **영수증 업로드 오류**: 사용자가 실제 아이폰 영수증 사진으로 "업로드가 안 된다"고 보고. Chromium 로컬 재현은 정상(클라이언트
  리사이즈/인코딩 OK)이라 원인 확정 못 함. 오류 처리 개선은 `script.js`에 반영했으니 배포 후 실기기(Safari)에서 재테스트하고,
  실패하면 화면에 뜨는 정확한 에러 메시지를 확인할 것. Vercel Hobby 함수 타임아웃은 기본 300초라 원인 아님.
  Vercel에 `GOOGLE_VISION_API_KEY`가 실제로 등록돼 있는지도 확인.
- `privacy.html`의 `[연락처 이메일을 입력하세요]`, `[YYYY-MM-DD]` 채우기 (애드센스 심사 전 필수)
- SEO: `sitemap.xml`, `robots.txt`, meta/OG 태그, 구조화 데이터
- 도메인 연결 → 애드센스 신청 → 승인 후 광고 코드 삽입

## 보안 메모

- 이 문서에는 비밀값이 없어요. Vision API 키는 로컬 `.env`(gitignore)와 Vercel 환경변수에만 있어야 해요. 필요하면 사용자에게 요청하세요.
- 이전 Cowork 대화에서 **GitHub Personal Access Token**과 **Vision API 키**가 채팅에 평문으로 노출된 적이 있어요.
  토큰은 GitHub → Settings → Developer settings → Personal access tokens에서 폐기(Revoke)하고,
  API 키는 Google Cloud에서 재발급 + Cloud Vision API로만 제한하도록 사용자에게 안내해주세요.
  (Claude Code는 Git Credential Manager 로그인이면 충분해서 토큰이 필요 없어요.)
