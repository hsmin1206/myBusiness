(function () {
  'use strict';

  const DEFAULT_CATEGORIES = ['식비', '카페/간식', '교통', '쇼핑', '생활용품', '문화/여가', '기타'];
  const STORAGE_KEY = 'receiptLedgerEntries';
  const CATEGORY_KEY = 'receiptLedgerCategories';
  const MAX_IMAGE_WIDTH = 1280;
  const JPEG_QUALITY = 0.75;

  // 엑셀 양식 레이아웃 (내보내기/불러오기가 공유)
  const SHEET_NAME = '가계부';
  const HEADER_ROW = 4; // 1-indexed: 날짜/분류/내용/금액/비고 헤더가 있는 행
  const DATA_START_ROW = HEADER_ROW + 1;
  const SUMIF_RANGE_END = 3000; // 합계 수식이 참조하는 마지막 행(넉넉하게 잡아서 나중에 행을 더 추가해도 자동 반영되게 함)

  const ICONS = {
    camera: '<svg class="icon"><use href="#icon-camera"/></svg>',
    check: '<svg class="icon"><use href="#icon-check"/></svg>',
    x: '<svg class="icon"><use href="#icon-x"/></svg>',
  };

  const els = {
    fileInput: document.getElementById('file-input'),
    uploadLabel: document.getElementById('upload-label'),
    preview: document.getElementById('preview'),
    scanBtn: document.getElementById('scan-btn'),
    status: document.getElementById('status'),
    resultCard: document.getElementById('result-card'),
    resultStore: document.getElementById('result-store'),
    resultDate: document.getElementById('result-date'),
    itemsBody: document.getElementById('items-body'),
    addRowBtn: document.getElementById('add-row-btn'),
    resultTotal: document.getElementById('result-total'),
    saveBtn: document.getElementById('save-btn'),
    historyTable: document.getElementById('history-table'),
    historyBody: document.getElementById('history-body'),
    historyEmpty: document.getElementById('history-empty'),
    monthTotalValue: document.getElementById('month-total-value'),
    importExcelBtn: document.getElementById('import-excel-btn'),
    importExcelInput: document.getElementById('import-excel-input'),
    templateBtn: document.getElementById('template-btn'),
    exportExcelBtn: document.getElementById('export-excel-btn'),
    clearAllBtn: document.getElementById('clear-all-btn'),
    year: document.getElementById('year'),
  };

  let currentImageBase64 = null;

  els.year.textContent = new Date().getFullYear();

  // ---------- 이미지 선택 & 리사이즈 ----------

  els.fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    handleFile(file);
  });

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > MAX_IMAGE_WIDTH) {
          height = Math.round((height * MAX_IMAGE_WIDTH) / width);
          width = MAX_IMAGE_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        currentImageBase64 = dataUrl.split(',')[1];

        els.preview.src = dataUrl;
        els.preview.style.display = 'block';
        els.uploadLabel.innerHTML = `${ICONS.check} 사진 선택 완료 · 다른 사진으로 바꾸려면 다시 클릭`;
        els.scanBtn.disabled = false;
        els.status.textContent = '';
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ---------- OCR 요청 ----------

  els.scanBtn.addEventListener('click', async () => {
    if (!currentImageBase64) return;
    setLoading(true, '영수증을 인식하는 중...');

    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: currentImageBase64 }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'OCR 요청에 실패했습니다.');
      }

      const parsed = ReceiptParser.parseReceipt(data.text || '');
      renderResult(parsed);
      els.status.textContent = '인식이 완료되었어요. 아래 내용을 확인해주세요.';
    } catch (err) {
      console.error(err);
      els.status.textContent = '인식에 실패했습니다: ' + err.message;
    } finally {
      setLoading(false);
    }
  });

  function setLoading(isLoading, message) {
    els.scanBtn.disabled = isLoading;
    els.status.textContent = isLoading ? message : els.status.textContent;
  }

  // ---------- 결과 렌더링 (수정 가능한 테이블) ----------

  function renderResult(parsed) {
    els.resultCard.style.display = 'block';
    els.resultStore.value = parsed.store || '';
    els.resultDate.value = parsed.date || new Date().toISOString().slice(0, 10);

    els.itemsBody.innerHTML = '';
    const items = parsed.items && parsed.items.length > 0 ? parsed.items : [{ name: '', price: 0 }];
    items.forEach((item) => addItemRow(item.name, item.price));

    updateResultTotal();
    els.resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function addItemRow(name, price, category) {
    const tr = document.createElement('tr');
    const categories = loadCategories();
    tr.innerHTML = `
      <td><input type="text" class="item-name" value="${escapeAttr(name || '')}" placeholder="품목명" /></td>
      <td>
        <select class="item-category">
          ${categories.map((c) => `<option value="${escapeAttr(c)}"${c === category ? ' selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        </select>
      </td>
      <td class="price-cell"><input type="number" class="item-price" value="${price || 0}" min="0" /></td>
      <td class="row-actions"><button class="btn-danger remove-row" aria-label="항목 삭제">${ICONS.x}</button></td>
    `;
    tr.querySelector('.remove-row').addEventListener('click', () => {
      tr.remove();
      updateResultTotal();
    });
    tr.querySelector('.item-price').addEventListener('input', updateResultTotal);
    els.itemsBody.appendChild(tr);
  }

  els.addRowBtn.addEventListener('click', () => addItemRow('', 0));

  function updateResultTotal() {
    const rows = els.itemsBody.querySelectorAll('tr');
    let sum = 0;
    rows.forEach((r) => {
      const price = parseInt(r.querySelector('.item-price').value, 10) || 0;
      sum += price;
    });
    els.resultTotal.textContent = formatWon(sum);
  }

  // ---------- 저장 (localStorage) ----------

  els.saveBtn.addEventListener('click', () => {
    const store = els.resultStore.value.trim() || '알 수 없음';
    const date = els.resultDate.value || new Date().toISOString().slice(0, 10);
    const rows = els.itemsBody.querySelectorAll('tr');

    const newEntries = [];
    rows.forEach((r) => {
      const name = r.querySelector('.item-name').value.trim();
      const price = parseInt(r.querySelector('.item-price').value, 10) || 0;
      const category = r.querySelector('.item-category').value;
      if (!name || price <= 0) return;
      newEntries.push({
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        date,
        store,
        name,
        price,
        category,
      });
    });

    if (newEntries.length === 0) {
      els.status.textContent = '저장할 항목이 없어요. 품목명과 금액을 확인해주세요.';
      return;
    }

    const all = loadEntries();
    all.push(...newEntries);
    saveEntries(all);

    els.status.textContent = `${newEntries.length}개 항목이 가계부에 저장되었어요.`;
    els.resultCard.style.display = 'none';
    resetUploadState();
    renderHistory();
  });

  function resetUploadState() {
    currentImageBase64 = null;
    els.fileInput.value = '';
    els.preview.style.display = 'none';
    els.uploadLabel.innerHTML = `${ICONS.camera} 여기를 눌러 영수증 사진 선택 / 촬영`;
    els.scanBtn.disabled = true;
  }

  // ---------- 히스토리 ----------

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveEntries(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.error('localStorage 저장 실패', e);
    }
  }

  function loadCategories() {
    try {
      const raw = localStorage.getItem(CATEGORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      /* ignore */
    }
    return DEFAULT_CATEGORIES.slice();
  }

  function saveCategories(categories) {
    try {
      localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories));
    } catch (e) {
      console.error('localStorage 저장 실패', e);
    }
  }

  // 같은 항목을 여러 번 불러와도 중복 저장되지 않도록 하는 식별 키
  function entryKey(e) {
    return [e.date, e.store, e.name, e.price].join('|');
  }

  function renderHistory() {
    const all = loadEntries().sort((a, b) => (a.date < b.date ? 1 : -1));
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonth = all.filter((e) => e.date && e.date.startsWith(ym));
    const monthTotal = thisMonth.reduce((sum, e) => sum + (e.price || 0), 0);

    els.monthTotalValue.textContent = formatWon(monthTotal);

    els.historyBody.innerHTML = '';
    if (all.length === 0) {
      els.historyTable.style.display = 'none';
      els.historyEmpty.style.display = 'block';
      return;
    }

    els.historyTable.style.display = 'table';
    els.historyEmpty.style.display = 'none';

    all.forEach((entry) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${entry.date || ''}</td>
        <td>${entry.category ? `<span class="badge">${escapeHtml(entry.category)}</span>` : ''}</td>
        <td>${escapeHtml(entry.name || '')}</td>
        <td class="price-cell">${formatWon(entry.price || 0)}</td>
        <td>${escapeHtml(entry.store || '')}</td>
        <td class="row-actions"><button class="btn-danger remove-entry" aria-label="내역 삭제">${ICONS.x}</button></td>
      `;
      tr.querySelector('.remove-entry').addEventListener('click', () => {
        const updated = loadEntries().filter((e) => e.id !== entry.id);
        saveEntries(updated);
        renderHistory();
      });
      els.historyBody.appendChild(tr);
    });
  }

  els.clearAllBtn.addEventListener('click', () => {
    if (loadEntries().length === 0) return;
    const ok = window.confirm('저장된 모든 내역을 삭제할까요? 이 작업은 되돌릴 수 없어요.');
    if (!ok) return;
    saveEntries([]);
    renderHistory();
  });

  // ---------- 엑셀(.xlsx) 양식 생성 (내보내기/빈 양식 공용) ----------

  function buildLedgerSheet(entries, categories) {
    const aoa = [];
    aoa.push(['총액', ...categories]); // 1행: 라벨
    aoa.push([]); // 2행: 합계 수식은 아래에서 직접 채움
    aoa.push([]); // 3행: 여백
    aoa.push(['날짜', '분류', '내용', '금액', '비고']); // 4행: 표 헤더
    entries.forEach((e) => {
      aoa.push([e.date || '', e.category || '', e.name || '', e.price || 0, e.store || '']);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // 합계/카테고리별 SUMIF 수식 (분류=B열, 금액=D열 기준)
    ws['A2'] = { t: 'n', f: `SUM(D${DATA_START_ROW}:D${SUMIF_RANGE_END})`, z: '#,##0' };
    categories.forEach((cat, idx) => {
      const col = XLSX.utils.encode_col(idx + 1); // B, C, D ...
      const safeCat = String(cat).replace(/"/g, '""');
      ws[`${col}2`] = {
        t: 'n',
        f: `SUMIF(B${DATA_START_ROW}:B${SUMIF_RANGE_END},"${safeCat}",D${DATA_START_ROW}:D${SUMIF_RANGE_END})`,
        z: '#,##0',
      };
    });

    // 금액 열 숫자 서식
    entries.forEach((e, i) => {
      const r = DATA_START_ROW - 1 + i; // 0-indexed
      const addr = XLSX.utils.encode_cell({ r, c: 3 });
      if (ws[addr]) ws[addr].z = '#,##0';
    });

    // 나중에 행을 더 추가해도 수식이 살아있도록 시트 범위를 넉넉하게 선언
    const maxCol = Math.max(categories.length, 4);
    const maxRow = Math.max(DATA_START_ROW - 1 + entries.length, SUMIF_RANGE_END) - 1;
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });

    ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 16 }];

    return ws;
  }

  function downloadLedger(entries, filename) {
    if (typeof XLSX === 'undefined') {
      els.status.textContent = '엑셀 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해주세요.';
      return;
    }
    const categories = loadCategories();
    const ws = buildLedgerSheet(entries, categories);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
    XLSX.writeFile(wb, filename);
  }

  els.exportExcelBtn.addEventListener('click', () => {
    const all = loadEntries().sort((a, b) => (a.date < b.date ? -1 : 1));
    if (all.length === 0) {
      els.status.textContent = '내보낼 내역이 없어요.';
      return;
    }
    downloadLedger(all, `가계부_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });

  els.templateBtn.addEventListener('click', () => {
    downloadLedger([], '영수증_가계부_양식.xlsx');
  });

  // ---------- 엑셀 불러오기 (같은 양식 파일에서 내역 가져오기) ----------

  els.importExcelBtn.addEventListener('click', () => {
    els.importExcelInput.click();
  });

  els.importExcelInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
      els.status.textContent = '엑셀 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해주세요.';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const imported = importEntriesFromWorkbook(workbook);

        if (imported.length === 0) {
          els.status.textContent =
            '엑셀에서 인식 가능한 내역을 찾지 못했어요. "날짜/분류/내용/금액" 열이 있는 표인지 확인해주세요.';
          return;
        }

        const existing = loadEntries();
        const seen = new Set(existing.map(entryKey));
        let addedCount = 0;
        imported.forEach((entry) => {
          const key = entryKey(entry);
          if (seen.has(key)) return;
          seen.add(key);
          existing.push(entry);
          addedCount++;
        });
        saveEntries(existing);

        const categories = loadCategories();
        let categoriesChanged = false;
        imported.forEach((entry) => {
          if (entry.category && !categories.includes(entry.category)) {
            categories.push(entry.category);
            categoriesChanged = true;
          }
        });
        if (categoriesChanged) saveCategories(categories);

        renderHistory();
        const dupCount = imported.length - addedCount;
        els.status.textContent = `엑셀에서 ${addedCount}건을 새로 가져왔어요.${dupCount > 0 ? ` (중복 ${dupCount}건 제외)` : ''}`;
      } catch (err) {
        console.error(err);
        els.status.textContent = '엑셀 파일을 읽는 중 오류가 발생했어요. 파일 형식을 확인해주세요.';
      } finally {
        els.importExcelInput.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  });

  function importEntriesFromWorkbook(workbook) {
    let all = [];
    workbook.SheetNames.forEach((sheetName) => {
      const ws = workbook.Sheets[sheetName];
      all = all.concat(extractEntriesFromSheet(ws));
    });
    return all;
  }

  function extractEntriesFromSheet(ws) {
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

    let headerRowIdx = -1;
    let col = {};
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const row = (rows[i] || []).map((c) => (c == null ? '' : String(c).trim()));
      if (row.includes('날짜') && row.includes('금액')) {
        headerRowIdx = i;
        col = {
          date: row.indexOf('날짜'),
          category: row.indexOf('분류'),
          content: row.indexOf('내용'),
          amount: row.indexOf('금액'),
          remark: row.indexOf('비고'),
        };
        break;
      }
    }
    if (headerRowIdx === -1) return [];

    const entries = [];
    let lastDate = null;

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const rawDate = col.date >= 0 ? row[col.date] : '';
      const content = col.content >= 0 ? String(row[col.content] || '').trim() : '';
      const rawAmount = col.amount >= 0 ? row[col.amount] : '';
      const amount = parseFloat(String(rawAmount || '').replace(/,/g, ''));

      const normalizedDate = normalizeDate(rawDate);
      if (normalizedDate) lastDate = normalizedDate;

      if (!content || !amount || amount <= 0) continue;

      entries.push({
        id: 'xlsx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        date: lastDate || new Date().toISOString().slice(0, 10),
        store: col.remark >= 0 ? String(row[col.remark] || '').trim() : '',
        name: content,
        price: Math.round(amount),
        category: (col.category >= 0 ? String(row[col.category] || '').trim() : '') || '기타',
      });
    }
    return entries;
  }

  function normalizeDate(val) {
    if (!val && val !== 0) return null;
    if (val instanceof Date && !isNaN(val)) {
      return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
    }
    const s = String(val).trim();
    const m = s.match(/(\d{4})[.\-/년]\s?(\d{1,2})[.\-/월]\s?(\d{1,2})/);
    if (m) {
      return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    }
    return null;
  }

  // ---------- 유틸 ----------

  function formatWon(n) {
    return n.toLocaleString('ko-KR') + '원';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }

  // ---------- 초기화 ----------

  renderHistory();
})();
