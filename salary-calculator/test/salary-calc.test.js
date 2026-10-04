const { calcNetSalary } = require('../js/salary-calc.js');

const cases = [
  { annualSalary: 30000000, nonTaxableMonthly: 200000, dependents: 1, childrenUnder20: 0 },
  { annualSalary: 40000000, nonTaxableMonthly: 200000, dependents: 1, childrenUnder20: 0 },
  { annualSalary: 50000000, nonTaxableMonthly: 200000, dependents: 2, childrenUnder20: 1 },
  { annualSalary: 70000000, nonTaxableMonthly: 200000, dependents: 3, childrenUnder20: 2 },
  { annualSalary: 100000000, nonTaxableMonthly: 200000, dependents: 4, childrenUnder20: 2 },
  { annualSalary: 0, nonTaxableMonthly: 0, dependents: 1, childrenUnder20: 0 },
];

let ok = true;

for (const c of cases) {
  const r = calcNetSalary(c);
  const pct = c.annualSalary > 0 ? ((r.totalDeduction * 12) / c.annualSalary) * 100 : 0;
  console.log(
    `연봉 ${c.annualSalary.toLocaleString()}원 / 부양 ${c.dependents}명 / 자녀 ${c.childrenUnder20}명 -> ` +
      `월 실수령액 ${r.monthlyNet.toLocaleString()}원 (세전 월 ${r.monthlyGross.toLocaleString()}원, 공제율 ${pct.toFixed(1)}%)`
  );
  console.log('  세부:', r.deductions);

  // 기본 검증: 실수령액은 세전보다 작아야 하고, 음수가 되면 안 됨
  if (r.monthlyNet < 0) {
    console.error('  !! 실수령액이 음수입니다');
    ok = false;
  }
  if (r.monthlyNet > r.monthlyGross) {
    console.error('  !! 실수령액이 세전 급여보다 큽니다');
    ok = false;
  }
  Object.entries(r.deductions).forEach(([k, v]) => {
    if (v < 0) {
      console.error(`  !! ${k} 값이 음수입니다: ${v}`);
      ok = false;
    }
  });
}

// 연봉이 높을수록 공제율(실효세율+보험료율)이 커져야 함(누진 구조 확인)
const low = calcNetSalary({ annualSalary: 30000000, nonTaxableMonthly: 200000, dependents: 1, childrenUnder20: 0 });
const high = calcNetSalary({ annualSalary: 100000000, nonTaxableMonthly: 200000, dependents: 1, childrenUnder20: 0 });
const lowPct = (low.totalDeduction * 12) / 30000000;
const highPct = (high.totalDeduction * 12) / 100000000;
if (!(highPct > lowPct)) {
  console.error('!! 누진 구조 검증 실패: 고소득 공제율이 저소득보다 높지 않음');
  ok = false;
}

console.log(ok ? '\n모든 검증 통과' : '\n검증 실패 항목 있음');
process.exit(ok ? 0 : 1);
