const { parseReceipt } = require('../js/parser.js');

const samples = [
  {
    name: '카페 영수증',
    text: `스타벅스 강남대로점
서울 강남구 강남대로 123
사업자번호: 123-45-67890
TEL: 02-1234-5678
2024-01-15 14:23

아메리카노(HOT)                4,500
카페라떼                       5,000

소계                           9,500
부가세                           950
합계금액                      10,450

카드결제                      10,450
승인번호: 12345678`,
  },
  {
    name: '마트 영수증',
    text: `이마트 역삼점
2024.03.02 19:05
사업자등록번호 111-22-33333

생수 2L                        1,200
바나나 1송이                    3,900
계란 30구                       7,500
과자                            2,300

합계                           14,900
현금                           14,900
거스름돈                            0`,
  },
  {
    name: '편의점 영수증 (합계 키워드 없음)',
    text: `CU 신촌점
2024/05/20

삼각김밥                        1,500
음료수                          2,000
------------------------
16,000
카드                          3,500`,
  },
];

let pass = 0;
for (const s of samples) {
  const result = parseReceipt(s.text);
  console.log(`\n=== ${s.name} ===`);
  console.log(JSON.stringify(result, null, 2));
  if (result.store && result.items.length > 0) {
    pass++;
  }
}

console.log(`\n${pass}/${samples.length} samples produced store + items`);
