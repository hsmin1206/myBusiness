// 연봉 실수령액 계산 로직 (2026년 기준)
// - 4대보험(국민연금/건강보험/장기요양보험/고용보험) : 2026년 요율 적용
// - 소득세 : 국세청 근로소득 간이세액표의 산출 방식(총급여->근로소득공제->근로소득금액
//   ->인적공제->과세표준->산출세액->근로소득세액공제->결정세액)을 그대로 재현한 근사 계산.
//   실제 간이세액표는 월급여 구간별로 표를 찾아보는 방식이라 소액 차이가 날 수 있고,
//   최종 세액은 다음 해 연말정산에서 정산됩니다. (페이지에도 동일 안내 문구 표시)
//
// 브라우저(<script>)와 Node.js(require) 양쪽에서 동작하도록 작성 (parser.js와 동일 패턴)

(function (global) {
  // ---------- 2026년 기준 4대보험 요율 ----------
  const NPS_RATE_EMPLOYEE = 0.0475; // 국민연금 근로자 부담분 (전체 9.5%의 절반)
  const NPS_MIN_BASE = 410000; // 기준소득월액 하한액 (2026.7~)
  const NPS_MAX_BASE = 6590000; // 기준소득월액 상한액 (2026.7~)

  const HEALTH_RATE_EMPLOYEE = 0.03595; // 건강보험 근로자 부담분 (전체 7.19%의 절반)
  const LTC_RATE_OF_HEALTH = 0.1314; // 장기요양보험료율 (건강보험료 대비, 근로자/사용자 동일 비율)
  const EMPLOYMENT_RATE_EMPLOYEE = 0.009; // 고용보험(실업급여) 근로자 부담분

  // ---------- 근로소득공제 (총급여 기준) ----------
  function calcEarnedIncomeDeduction(annualGross) {
    if (annualGross <= 5000000) return annualGross * 0.7;
    if (annualGross <= 15000000) return 3500000 + (annualGross - 5000000) * 0.4;
    if (annualGross <= 45000000) return 7500000 + (annualGross - 15000000) * 0.15;
    if (annualGross <= 100000000) return 12000000 + (annualGross - 45000000) * 0.05;
    return 14750000 + (annualGross - 100000000) * 0.02;
  }

  // ---------- 종합소득세 기본세율 (2025년 귀속 기준, 8단계 누진세율) ----------
  const TAX_BRACKETS = [
    { limit: 14000000, rate: 0.06, deduction: 0 },
    { limit: 50000000, rate: 0.15, deduction: 1260000 },
    { limit: 88000000, rate: 0.24, deduction: 5760000 },
    { limit: 150000000, rate: 0.35, deduction: 15440000 },
    { limit: 300000000, rate: 0.38, deduction: 19940000 },
    { limit: 500000000, rate: 0.4, deduction: 25940000 },
    { limit: 1000000000, rate: 0.42, deduction: 35940000 },
    { limit: Infinity, rate: 0.45, deduction: 65940000 },
  ];

  function calcTaxByBracket(taxBase) {
    for (const b of TAX_BRACKETS) {
      if (taxBase <= b.limit) {
        return Math.max(0, taxBase * b.rate - b.deduction);
      }
    }
    return 0;
  }

  // ---------- 근로소득세액공제 ----------
  function calcEarnedIncomeTaxCredit(calculatedTax, annualGross) {
    let credit = calculatedTax <= 1300000 ? calculatedTax * 0.55 : 715000 + (calculatedTax - 1300000) * 0.3;

    let cap;
    if (annualGross <= 33000000) {
      cap = 740000;
    } else if (annualGross <= 70000000) {
      cap = Math.max(740000 - (annualGross - 33000000) * 0.008, 660000);
    } else if (annualGross <= 120000000) {
      cap = Math.max(660000 - (annualGross - 70000000) * 0.5, 500000);
    } else {
      cap = Math.max(500000 - (annualGross - 120000000) * 0.5, 200000);
    }

    return Math.min(credit, cap);
  }

  // ---------- 자녀세액공제 (8세~20세 자녀 수 기준) ----------
  function calcChildTaxCredit(childCount) {
    const n = Math.max(0, Math.floor(childCount || 0));
    if (n <= 0) return 0;
    if (n === 1) return 150000;
    if (n === 2) return 350000;
    return 350000 + (n - 2) * 300000;
  }

  /**
   * 연봉 실수령액 계산
   * @param {Object} input
   * @param {number} input.annualSalary 연봉(세전, 원)
   * @param {number} input.nonTaxableMonthly 비과세액(월, 원) - 식대 등
   * @param {number} input.dependents 부양가족 수 (본인 포함, 최소 1)
   * @param {number} input.childrenUnder20 8~20세 자녀 수
   */
  function calcNetSalary(input) {
    const annualSalary = Math.max(0, Number(input.annualSalary) || 0);
    const nonTaxableMonthly = Math.max(0, Number(input.nonTaxableMonthly) || 0);
    const dependents = Math.max(1, Math.floor(Number(input.dependents) || 1));
    const childrenUnder20 = Math.max(0, Math.floor(Number(input.childrenUnder20) || 0));

    const monthlyGross = annualSalary / 12;
    const monthlyTaxableBase = Math.max(0, monthlyGross - nonTaxableMonthly);

    // 4대보험 (월 기준). 과세대상 급여가 0이면(입력값 없음 등) 보험료도 0으로 처리.
    const npsBase =
      monthlyTaxableBase <= 0 ? 0 : Math.min(Math.max(monthlyTaxableBase, NPS_MIN_BASE), NPS_MAX_BASE);
    const nps = Math.round(npsBase * NPS_RATE_EMPLOYEE);
    const health = Math.round(monthlyTaxableBase * HEALTH_RATE_EMPLOYEE);
    const ltc = Math.round(health * LTC_RATE_OF_HEALTH);
    const employment = Math.round(monthlyTaxableBase * EMPLOYMENT_RATE_EMPLOYEE);

    // 소득세 (연 기준으로 계산 후 월할)
    const annualTaxableGross = Math.max(0, annualSalary - nonTaxableMonthly * 12);
    const earnedIncomeDeduction = calcEarnedIncomeDeduction(annualTaxableGross);
    const earnedIncomeAmount = Math.max(0, annualTaxableGross - earnedIncomeDeduction);
    const personalDeduction = dependents * 1500000;
    const taxBase = Math.max(0, earnedIncomeAmount - personalDeduction);
    const calculatedTax = calcTaxByBracket(taxBase);
    const earnedIncomeTaxCredit = calcEarnedIncomeTaxCredit(calculatedTax, annualTaxableGross);
    const childTaxCredit = calcChildTaxCredit(childrenUnder20);
    const annualIncomeTax = Math.max(0, calculatedTax - earnedIncomeTaxCredit - childTaxCredit);

    const incomeTax = Math.round(annualIncomeTax / 12);
    const localIncomeTax = Math.round(incomeTax * 0.1);

    const deductions = {
      nps,
      health,
      ltc,
      employment,
      incomeTax,
      localIncomeTax,
    };
    const totalDeduction = nps + health + ltc + employment + incomeTax + localIncomeTax;
    const monthlyNet = Math.round(monthlyGross - totalDeduction);

    return {
      monthlyGross: Math.round(monthlyGross),
      monthlyNet,
      annualNet: monthlyNet * 12,
      totalDeduction,
      deductions,
    };
  }

  const api = { calcNetSalary };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.SalaryCalc = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
