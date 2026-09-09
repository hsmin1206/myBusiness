(function () {
  'use strict';

  const CATEGORIES = ['식비', '카페/간식', '교통', '쇼핑', '생활용품', '문화/여가', '기타'];
  const STORAGE_KEY = 'receiptLedgerEntries';
  const MAX_IMAGE_WIDTH = 1280;
  const JPEG_QUALITY = 0.75;

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
    exportCsvBtn: document.getElementById('export-csv-btn'),
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
        els.uploadLabel.textContent = '✅ 사진 선택 완료 · 다른 사진으로 바꾸려면 다시 클릭';
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

  function addItemRow(name, price) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="item-name" value="${escapeAttr(name || '')}" placeholder="품목명" /></td>
      <td>
        <select class="item-category">
          ${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </td>
      <td class="price-cell"><input type="number" class="item-price" value="${price || 0}" min="0" /></td>
      <td class="row-actions"><button class="btn-danger remove-row">✕</button></td>
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
    els.uploadLabel.textContent = '📎 여기를 눌러 영수증 사진 선택 / 촬영';
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
        <td>${escapeHtml(entry.store || '')}</td>
        <td>${escapeHtml(entry.name || '')}${entry.category ? ` <span class="badge">${escapeHtml(entry.category)}</span>` : ''}</td>
        <td class="price-cell">${formatWon(entry.price || 0)}</td>
        <td class="row-actions"><button class="btn-danger remove-entry">✕</button></td>
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

  // ---------- CSV 내보내기 ----------

  els.exportCsvBtn.addEventListener('click', () => {
    const all = loadEntries().sort((a, b) => (a.date < b.date ? -1 : 1));
    if (all.length === 0) {
      els.status.textContent = '내보낼 내역이 없어요.';
      return;
    }
    const header = ['날짜', '상호', '항목', '분류', '금액'];
    const rows = all.map((e) => [e.date, e.store, e.name, e.category, e.price]);
    const csv = [header, ...rows]
      .map((row) => row.map(csvEscape).join(','))
      .join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `가계부_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  function csvEscape(val) {
    const s = String(val ?? '');
    if (/[",\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
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
