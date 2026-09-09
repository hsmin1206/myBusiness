// 영수증 OCR 원문 텍스트 -> 구조화 데이터 파서
// 브라우저(<script>)와 Node.js(require) 양쪽에서 동작하도록 작성

(function (global) {
  const TOTAL_KEYWORDS = [
    '합계금액',
    '결제금액',
    '받을금액',
    '판매금액',
    '카드승인금액',
    '승인금액',
    '합계',
    '총액',
    '총 금액',
    '총금액',
  ];

  const SUMMARY_LINE_KEYWORDS = [
    '합계',
    '소계',
    '총액',
    '총금액',
    '과세',
    '면세',
    '부가세',
    '부가가치세',
    '공급가액',
    '받을금액',
    '받은금액',
    '거스름돈',
    '잔액',
    '카드',
    '현금',
    '승인번호',
    '할부',
    '포인트',
    '적립',
    '사업자',
    '대표자',
    'TEL',
    '전화',
    '주소',
    '가맹점',
    '단말기',
  ];

  const NUMBER_TRAIL_RE = /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*원?\s*$/;
  const DATE_RE = /(\d{4})[.\-/년]\s?(\d{1,2})[.\-/월]\s?(\d{1,2})/;

  function toInt(numStr) {
    return parseInt(numStr.replace(/,/g, ''), 10);
  }

  function cleanLines(text) {
    return text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  function extractDate(lines) {
    for (const line of lines) {
      const m = line.match(DATE_RE);
      if (m) {
        const [, y, mo, d] = m;
        return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    return null;
  }

  function extractStore(lines) {
    for (const line of lines) {
      if (DATE_RE.test(line)) continue;
      if (/\d{3}-\d{2}-\d{5}/.test(line)) continue; // 사업자번호
      if (/^[0-9\s\-:.,원]+$/.test(line)) continue; // 숫자/기호만 있는 줄
      const isSummary = SUMMARY_LINE_KEYWORDS.some((k) => line.includes(k));
      if (isSummary) continue;
      if (line.length < 2) continue;
      return line;
    }
    return lines[0] || '알 수 없음';
  }

  function extractTotal(lines) {
    for (const keyword of TOTAL_KEYWORDS) {
      const line = lines.find((l) => l.includes(keyword));
      if (line) {
        const m = line.match(NUMBER_TRAIL_RE) || line.match(/([0-9,]{4,})/);
        if (m) return toInt(m[1]);
      }
    }
    // 키워드로 못 찾으면 전체에서 가장 큰 숫자를 합계로 추정
    let max = 0;
    for (const line of lines) {
      const m = line.match(NUMBER_TRAIL_RE);
      if (m) {
        const val = toInt(m[1]);
        if (val > max) max = val;
      }
    }
    return max || null;
  }

  function extractItems(lines) {
    const items = [];
    for (const line of lines) {
      if (DATE_RE.test(line)) continue;
      if (/\d{3}-\d{2}-\d{5}/.test(line)) continue;
      const isSummary = SUMMARY_LINE_KEYWORDS.some((k) => line.includes(k));
      if (isSummary) continue;

      const m = line.match(NUMBER_TRAIL_RE);
      if (!m) continue;

      const price = toInt(m[1]);
      let name = line.slice(0, m.index).trim();
      // 수량 표기(x2, *2, 2개) 뒤에 남은 구분자 정리
      name = name.replace(/[\s\-:*xX]+$/, '').trim();

      if (!name || name.length < 1) continue;
      if (price <= 0) continue;

      items.push({ name, price });
    }
    return items;
  }

  function parseReceipt(rawText) {
    const lines = cleanLines(rawText || '');
    const store = extractStore(lines);
    const date = extractDate(lines);
    const total = extractTotal(lines);
    let items = extractItems(lines);

    // 합계 줄 자체가 items에 잘못 섞였을 경우를 대비해 총액과 값이 같은 마지막 항목 중
    // 이름이 요약성 키워드를 포함하면 제거 (2차 방어)
    items = items.filter((it) => !SUMMARY_LINE_KEYWORDS.some((k) => it.name.includes(k)));

    return {
      store,
      date,
      items,
      total,
      rawText,
    };
  }

  const api = { parseReceipt };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.ReceiptParser = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
