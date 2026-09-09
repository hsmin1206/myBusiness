# 영수증 스캔 가계부

영수증 사진을 올리면 OCR로 글자를 인식하고, 상호/품목/금액을 자동으로 구분해서
가계부처럼 정리해주는 정적 웹사이트입니다. 회원가입·DB 없이 브라우저
localStorage에만 데이터를 저장하며, Vercel 무료 플랜 + Google Cloud Vision
무료 티어(월 1,000건)만으로 운영할 수 있게 설계했습니다.

## 폴더 구조

```
receipt-ledger/
├── index.html          # 메인 페이지 (업로드, 결과 확인/수정, 히스토리)
├── privacy.html         # 개인정보 처리방침 템플릿 (애드센스 심사에 필요, 내용 채워야 함)
├── style.css
├── script.js            # 클라이언트 로직 (업로드, 저장, CSV 내보내기)
├── js/parser.js          # OCR 텍스트 → 상호/품목/금액 파싱 로직
├── api/ocr.js            # Vercel 서버리스 함수 (Google Cloud Vision 호출)
├── test/parser.test.js   # 파서 동작 확인용 테스트 (node test/parser.test.js)
├── .env.example
└── package.json
```

## 1. Google Cloud Vision API 키 발급 (무료)

1. [Google Cloud Console](https://console.cloud.google.com/)에서 새 프로젝트를 만듭니다.
2. 좌측 메뉴에서 "API 및 서비스 > 라이브러리"로 이동해 **Cloud Vision API**를 검색해 사용 설정합니다.
3. "API 및 서비스 > 사용자 인증 정보"에서 "사용자 인증 정보 만들기 > API 키"를 클릭해 키를 발급받습니다.
4. (권장) 발급받은 키를 클릭해 "API 제한사항"을 Cloud Vision API로만 제한해두면 안전합니다.
5. Cloud Vision API는 **매월 1,000 units까지 무료**이며, 그 이상은 1,000건당 약 $1.5 수준입니다. 개인 사이드 프로젝트 초기 트래픽에서는 사실상 무료로 운영됩니다.

> 참고: Google Cloud를 처음 쓰는 경우 결제 정보(카드) 등록이 필요할 수 있지만, 무료 한도 내에서는 청구되지 않습니다. 예산 알림(Budget Alert)을 설정해두면 안심할 수 있어요.

## 2. 로컬에서 테스트

```bash
npm test          # 파서 로직 테스트
npx vercel dev     # 로컬에서 API 라우트까지 포함해 실행 (Vercel CLI 필요: npm i -g vercel)
```

`npx vercel dev` 실행 전, 프로젝트 루트에 `.env` 파일을 만들고 아래처럼 키를 넣어주세요.

```
GOOGLE_VISION_API_KEY=발급받은_키
```

## 3. Vercel 배포

1. 이 폴더를 GitHub 레포로 올리거나, `vercel` CLI로 바로 배포합니다.
   ```bash
   npm i -g vercel
   vercel
   ```
2. Vercel 대시보드 > 프로젝트 > **Settings > Environment Variables**에서
   `GOOGLE_VISION_API_KEY`를 등록합니다. (Production, Preview 둘 다 체크 권장)
3. 다시 배포하면(`vercel --prod`) API 함수가 키를 읽어 동작합니다.
4. 별도의 DB(Supabase 등)는 필요 없습니다 — 모든 가계부 데이터는 사용자 브라우저의
   localStorage에만 저장되고, 서버는 이미지 → 텍스트 변환만 담당합니다.

## 4. 애드센스 신청 전 체크리스트

- `privacy.html`의 `[연락처 이메일을 입력하세요]`, `[YYYY-MM-DD]` 부분을 실제 정보로 채워주세요.
- 애드센스는 콘텐츠가 충분하고 개인정보 처리방침이 있는 사이트를 선호합니다. 실제 도메인을
  연결하고, 어느 정도 실사용(방문/이용) 흔적이 쌓인 뒤 신청하는 것을 권장합니다.
- 승인 전에는 `index.html`의 `.ad-slot` 영역을 비워두고, 승인 후 발급받는
  `<ins class="adsbygoogle">` 코드와 `<script>` 태그를 해당 위치에 넣어주세요.
  (요청하신 대로 광고 코드 삽입은 직접 하실 수 있도록 자리만 만들어뒀습니다.)

## 5. OCR/파싱 정확도에 대해

영수증은 매장마다 형식이 크게 달라서, 정규식 기반 파싱이 100% 정확할 수는 없습니다.
그래서 인식 결과를 **저장 전에 항상 수정할 수 있는 표**로 보여주도록 만들었습니다.
사용 데이터가 쌓이면 파싱 규칙(`js/parser.js`의 키워드 목록)을 보강하거나,
필요 시 GPT-4o-mini 같은 LLM Vision API로 교체해 정확도를 높일 수 있습니다
(비용은 건당 매우 저렴하지만 완전 무료는 아니라서 1차 버전에서는 제외했습니다).

## 6. 향후 확장 아이디어

- 계산기 모음 사이트로 확장 시, 같은 배포에 `/health-insurance.html`,
  `/car-tax.html` 같은 페이지를 추가하고 상단 네비게이션만 공유하면 됩니다.
- 카테고리별/월별 지출 차트(막대그래프 등) 추가
- PWA(홈 화면 추가) 지원으로 재방문율 개선
