(function () {
  'use strict';

  const els = {
    salary: document.getElementById('input-salary'),
    nontax: document.getElementById('input-nontax'),
    dependents: document.getElementById('input-dependents'),
    children: document.getElementById('input-children'),
    calcBtn: document.getElementById('calc-btn'),
    resultCard: document.getElementById('result-card'),
    monthlyNet: document.getElementById('result-monthly-net'),
    monthlyGross: document.getElementById('result-monthly-gross'),
    annualNet: document.getElementById('result-annual-net'),
    deductionBody: document.getElementById('deduction-body'),
    totalDeduction: document.getElementById('result-total-deduction'),
    year: document.getElementById('year'),
  };

  const DEDUCTION_LABELS = [
    ['nps', '국민연금'],
    ['health', '건강보험'],
    ['ltc', '장기요양보험'],
    ['employment', '고용보험'],
    ['incomeTax', '소득세'],
    ['localIncomeTax', '지방소득세'],
  ];

  els.year.textContent = new Date().getFullYear();

  function formatWon(n) {
    return Math.round(n).toLocaleString('ko-KR') + '원';
  }

  function parseNumber(str) {
    const n = parseFloat(String(str || '').replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  // 천단위 콤마 자동 포맷 (숫자 입력 필드)
  function attachCommaFormat(input) {
    input.addEventListener('input', () => {
      const caretFromEnd = input.value.length - input.selectionStart;
      const digits = input.value.replace(/[^0-9]/g, '');
      const formatted = digits ? Number(digits).toLocaleString('ko-KR') : '';
      input.value = formatted;
      const pos = Math.max(0, input.value.length - caretFromEnd);
      input.setSelectionRange(pos, pos);
    });
  }

  attachCommaFormat(els.salary);
  attachCommaFormat(els.nontax);

  function runCalculation() {
    const input = {
      annualSalary: parseNumber(els.salary.value),
      nonTaxableMonthly: parseNumber(els.nontax.value),
      dependents: parseNumber(els.dependents.value) || 1,
      childrenUnder20: parseNumber(els.children.value) || 0,
    };

    if (input.annualSalary <= 0) {
      els.salary.focus();
      return;
    }

    const result = SalaryCalc.calcNetSalary(input);

    els.monthlyNet.textContent = formatWon(result.monthlyNet);
    els.monthlyGross.textContent = formatWon(result.monthlyGross);
    els.annualNet.textContent = formatWon(result.annualNet);
    els.totalDeduction.textContent = formatWon(result.totalDeduction);

    els.deductionBody.innerHTML = '';
    DEDUCTION_LABELS.forEach(([key, label]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${label}</td><td class="price-cell">${formatWon(result.deductions[key])}</td>`;
      els.deductionBody.appendChild(tr);
    });

    els.resultCard.style.display = 'block';
    els.resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  els.calcBtn.addEventListener('click', runCalculation);

  [els.salary, els.nontax, els.dependents, els.children].forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runCalculation();
    });
  });
})();
