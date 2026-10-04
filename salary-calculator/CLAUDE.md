# 프로젝트 인수인계 (Claude Code용) — 연봉 실수령액 계산기

Cowork(클라우드 Claude) 세션에서 만든 프로젝트를 Claude Code로 넘기는 문서예요.
시작하면 이 파일을 먼저 읽고 아래 "즉시 할 일"부터 진행해주세요.
이 프로젝트는 **독립 도메인으로 따로 배포**하는 단일 목적 사이트예요. 같은 계열의 `receipt-ledger`
(영수증 스캔 가계부)와는 코드·저장소·배포가 완전히 분리돼 있어요. 서로 링크나 공유 코드가 없어야 해요.

## 프로젝트 개요

- 목적: 구글 애드센스 수익화를 위한 웹사이트 (사용자: 홍반장, 부업 프로젝트)
- 기능: 연봉·비과세액·부양가족 수·8~20세 자녀 수 입력 → 2026년 4대보험·소득세 반영 월 실수령액과 항목별 공제 내역
- 스택: 프레임워크·서버·DB·API 없음. 순수 HTML/CSS/JS 정적 사이트 (Vercel 무료 플랜, 환경변수 불필요)
- 저장소: **아직 없음 — 새로 만들어야 해요** (아래 즉시 할 일 참고). 권장 이름 `salary-calculator`
- 로컬 경로: `C:\Users\shift\git\salary-calculator` (Git Bash: `/c/Users/shift/git/salary-calculator`)

## 구조

```
index.html                  # 계산기 페이지
privacy.html                # 개인정보 처리방침 (플레이스홀더 남아있음)
style.css
js/salary-calc.js           # 계산 로직 (순수 함수, 2026 요율 상수는 파일 상단)
js/salary-calculator-ui.js  # 입력폼 ↔ 계산 로직 연결
test/salary-calc.test.js    # npm test
```

테스트: `npm test` / 로컬 확인: `python -m http.server 8000`

## 즉시 할 일 (1순위)

1. 사용자가 GitHub에서 **빈 저장소**(README/.gitignore 추가 없이)를 만들어야 해요. 이름 제안: `salary-calculator`.
   저장소 URL을 사용자에게 물어보세요. (`gh` CLI가 로그인돼 있으면 `gh repo create`로 만들어도 되지만, 먼저 사용자에게 확인)
2. `npm test` 통과 확인
3. `git init` → `git add .` → 커밋 → `git branch -M main` → `git remote add origin <URL>` → `git push -u origin main`
   - 이 PC에서 처음 push하면 GitHub 로그인 창(Git Credential Manager)이 뜰 수 있어요
   - 제안 커밋 메시지: `Initial commit: 2026 salary net-pay calculator`
4. Vercel에서 이 저장소 Import → 배포 (프레임워크 프리셋 "Other", 빌드 명령 없음, 환경변수 없음) → 도메인 연결

> 참고: 예전에 `C:\Users\shift\git\myBusiness` 폴더(영수증 가계부 프로젝트)에 이 계산기 파일이 임시로 섞여 들어간 적이 있어요.
> 거기 있는 `salary-calculator.html`, `js/salary-calc*.js`, `test/salary-calc.test.js`는 이 프로젝트의 옛 사본이니
> 이 폴더가 정답본이에요. 그쪽 정리는 사용자에게 먼저 확인받고 진행하세요.

## 작업 규칙 (사용자 선호)

- 솔직하고 직설적인 피드백, 복붙 가능한 완성된 코드 선호
- 요청하지 않은 기존 내용 변경 금지 (의도치 않은 수정에 민감함)
- UI에 이모지 금지, 인라인 SVG 아이콘 사용 / 한국어 UI
- 애드센스 광고 영역(`.ad-slot`)은 승인 전이라 HTML 주석으로 비활성화돼 있음 — 승인 후 주석 해제

## 계산 기준 (2026년, `js/salary-calc.js` 상단 상수)

- 국민연금 근로자 4.75%(전체 9.5%), 기준소득월액 하한 41만원·상한 659만원 (2026.7~)
- 건강보험 근로자 3.595%(전체 7.19%), 장기요양보험 = 건강보험료의 13.14%(전체 0.9448%), 고용보험 근로자 0.9%
- 소득세: 국세청 간이세액표 산식 근사 (근로소득공제 → 인적공제 150만원/인 → 8단계 누진세율(6~45%) → 근로소득세액공제 → 자녀세액공제)
  → 실제 간이세액표/연말정산과 소액 차이 가능 (페이지에 안내 문구 있음)
- 매년 연초에 요율·세법 변경 여부를 확인해 상수를 갱신해야 해요.

## 다음 할 일

- `privacy.html`의 `[연락처 이메일을 입력하세요]`, `[YYYY-MM-DD]` 채우기 (애드센스 심사 전 필수)
- SEO: `sitemap.xml`, `robots.txt`, meta/OG 태그, 구조화 데이터(FAQ 등), 계산 방법 설명 콘텐츠 보강
- 도메인 연결 → 애드센스 신청 → 승인 후 광고 코드 삽입
- 기능 확장 후보: 월급 → 연봉 역산, 퇴직금/최저임금 등은 **별도 프로젝트·도메인**으로 분리

## 보안 메모

- 이 프로젝트에는 비밀값이 전혀 필요 없어요. API 키/토큰을 코드나 문서에 넣지 마세요.
