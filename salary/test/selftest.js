/* 2027 월급·이직 계산 엔진 자체 검증 (브라우저에서 실행) */
(function () {
  "use strict";

  var rows = [];
  function check(name, expected, actual) {
    var pass = typeof expected === "number" && typeof actual === "number"
      ? Math.abs(expected - actual) <= 1
      : expected === actual;
    rows.push({ name: name, expected: expected, actual: actual, pass: pass });
  }
  function checkClose(name, expected, actual, tol) {
    rows.push({ name: name, expected: expected, actual: actual, pass: Math.abs(expected - actual) <= (tol || 2) });
  }

  var C = SalCalc.C;

  /* 1. 기준값 */
  check("2027 최저임금 시급", 10700, C.MIN_WAGE[2027].hourly);
  check("2027 최저임금 월 환산", 2236300, C.MIN_WAGE[2027].monthly);
  check("2026 최저임금 월 환산", 2156880, C.MIN_WAGE[2026].monthly);
  check("2027 국민연금 근로자 요율", 0.05, C.RATES[2027].np);
  check("2026 국민연금 근로자 요율", 0.0475, C.RATES[2026].np);

  /* 2. 4대보험 */
  var i27 = SalCalc.socialInsurance(3000000, 2027);
  check("2027 국민연금 월 300만", 150000, i27.monthly.np);
  check("2027 건강보험 월 300만", 107850, i27.monthly.hi);
  check("2027 장기요양 월 300만", 14991, i27.monthly.ltc);
  check("2027 고용보험 월 300만", 27000, i27.monthly.ei);
  checkClose("2027 장기요양 소득 대비 0.9994%", 0.009994, C.RATES[2027].hi * 2 * C.RATES[2027].ltcRatio, 0.000001);
  check("2027 장기요양 요율(건보 대비)", 0.139, C.RATES[2027].ltcRatio);

  var i26 = SalCalc.socialInsurance(3000000, 2026);
  check("2026 장기요양 월 300만", 14171, i26.monthly.ltc);
  check("2026 국민연금 월 300만", 142500, i26.monthly.np);

  var cap27 = SalCalc.socialInsurance(9000000, 2027);
  check("2027 국민연금 상한 적용", 329500, cap27.monthly.np);
  check("2027 국민연금 상한 연간", 3954000, cap27.np);

  var cap26 = SalCalc.socialInsurance(7000000, 2026);
  check("2026 상반기 기준소득월액 상한", 6370000, cap26.npBase.h1);
  check("2026 하반기 기준소득월액 상한", 6590000, cap26.npBase.h2);
  check("2026 국민연금 연간(6+6개월)", 3693600, cap26.np);

  check("고용보험 개정안 1.0%", 30000, SalCalc.socialInsurance(3000000, 2027, 0.01).monthly.ei);

  /* 3. 실수령액 기준 케이스 */
  var c5000 = SalCalc.compareYears({ annualSalary: 50000000, monthlyNonTaxable: 200000, dependents: 2, children: 1 });
  check("2026 월 실수령(5,000만)", 3617893, c5000.y2026.monthly.net);
  check("2027 월 실수령(5,000만)", 3608707, c5000.y2027.monthly.net);
  check("월 차이(5,000만)", -9186, c5000.diff.monthlyNet);
  check("연 차이(5,000만)", -110230, c5000.diff.annualNet);
  checkClose("연 실수령 = 월×12", c5000.y2027.annual.net, c5000.y2027.monthly.net * 12, 12);

  var c3000 = SalCalc.compareYears({ annualSalary: 30000000, monthlyNonTaxable: 200000, dependents: 2, children: 1 });
  check("2026 월 실수령(3,000만)", 2276501, c3000.y2026.monthly.net);
  check("2027 월 실수령(3,000만)", 2270122, c3000.y2027.monthly.net);
  check("3,000만 소득세 0(2027)", 0, c3000.y2027.monthly.incomeTax);

  var c8000 = SalCalc.compareYears({ annualSalary: 80000000, monthlyNonTaxable: 200000, dependents: 3, children: 2 });
  check("2026 월 실수령(8,000만·4인)", 5554774, c8000.y2026.monthly.net);
  check("2027 월 실수령(8,000만·4인)", 5539884, c8000.y2027.monthly.net);

  /* 4. 2027이 항상 2026보다 적은지 (같은 조건) */
  var allLower = true;
  [3000, 4000, 5000, 6000, 8000, 10000, 15000].forEach(function (m) {
    var r = SalCalc.compareYears({ annualSalary: m * 10000, monthlyNonTaxable: 200000, dependents: 2, children: 1 });
    if (!(r.y2027.monthly.net < r.y2026.monthly.net)) allLower = false;
  });
  check("연봉 3천~1.5억 모두 2027 실수령 감소", true, allLower);

  /* 5. 차액 구성 */
  check("차액 = 보험+소득세+지방세",
    -c5000.diff.monthlyNet,
    (c5000.y2027.monthly.insurance - c5000.y2026.monthly.insurance) +
    (c5000.y2027.monthly.incomeTax - c5000.y2026.monthly.incomeTax) +
    (c5000.y2027.monthly.localTax - c5000.y2026.monthly.localTax));

  /* 6. 고용보험 개정안 반영 */
  var reform = SalCalc.compareYears({ annualSalary: 50000000, monthlyNonTaxable: 200000, dependents: 2, children: 1, ei2027Reform: true });
  check("개정안 반영 시 고용보험 월액", 39667, reform.y2027.monthly.ei);
  check("개정안 반영 시 실수령 3~4천원 감소", true,
    (c5000.y2027.monthly.net - reform.y2027.monthly.net) > 3000 &&
    (c5000.y2027.monthly.net - reform.y2027.monthly.net) < 4000);

  /* 7. 입력 가드 */
  var capNon = SalCalc.normalizePerson({ annualSalary: 50000000, monthlyNonTaxable: 900000 });
  check("비과세 입력 상한 40만원", 400000, capNon.monthlyNonTaxable);
  var neg = SalCalc.normalizePerson({ annualSalary: -100, monthlyNonTaxable: -5, dependents: -2, children: -1 });
  check("음수 입력 0 처리", 0, neg.annualSalary);
  check("부양가족 음수 0 처리", 0, neg.dependents);
  var family = SalCalc.normalizePerson({ annualSalary: 50000000, dependents: 0, children: 2 });
  check("자녀 수가 부양가족 수보다 크면 보정", 2, family.dependents);
  check("기본공제 인원(본인 포함)", 3, SalCalc.computePerson({ annualSalary: 50000000, dependents: 2, children: 1 }, 2027).tax.basicCount);
  check("자녀세액공제 1명", 250000, SalCalc.childTaxCredit(1));
  check("자녀세액공제 2명", 550000, SalCalc.childTaxCredit(2));
  check("자녀세액공제 3명", 950000, SalCalc.childTaxCredit(3));

  /* 8. 최저임금 판정 */
  var mwOk = SalCalc.computePerson({ annualSalary: 2236300 * 12, monthlyNonTaxable: 0, dependents: 0, children: 0 }, 2027);
  check("최저임금 월 환산 정확히 일치", true, mwOk.minimumWage.ok);
  check("최저임금 차액 0", 0, mwOk.minimumWage.gap);
  var mwLow = SalCalc.computePerson({ annualSalary: 2000000 * 12, monthlyNonTaxable: 0, dependents: 0, children: 0 }, 2027);
  check("최저임금 미달 판정", false, mwLow.minimumWage.ok);
  check("최저임금 부족액", -236300, mwLow.minimumWage.gap);

  /* 9. 표준세액공제 자동 선택 */
  var std = SalCalc.computePerson({ annualSalary: 30000000, monthlyNonTaxable: 200000, dependents: 1, children: 0 }, 2026);
  check("3,000만·1부양가족 표준세액공제 적용", false, std.tax.specialDeductionUsed);
  check("3,000만·1부양가족 월 소득세", 20439, std.monthly.incomeTax);

  /* 10. 이직 비교 */
  var o = SalCalc.compareOffer({
    current: { annualSalary: 50000000, monthlyNonTaxable: 200000, incentive: 0 },
    offer: { annualSalary: 58000000, monthlyNonTaxable: 200000, incentive: 0 },
    dependents: 2, children: 1
  });
  check("이직 5,000→5,800 월 세후 차액", 506531, o.diff.monthlyNet);
  check("이직 5,000→5,800 연 세후 차액", 6078357, o.diff.annualNet);
  check("명목 인상률 16%", 0.16, o.diff.nominalRaise);
  checkClose("실질 인상률 14.0%", 0.1400, o.diff.realRaise, 0.001);
  check("퇴직금 1년분(5,000만)", 4166666, o.severance.current);
  check("퇴직금 1년분(5,800만)", 4833333, o.severance.offer);

  var o2 = SalCalc.compareOffer({
    current: { annualSalary: 50000000, monthlyNonTaxable: 200000, incentive: 0 },
    offer: { annualSalary: 60000000, monthlyNonTaxable: 200000, incentive: 5000000 },
    dependents: 2, children: 1
  });
  check("인센티브 포함 총보상(6,500만)", 65000000, o2.offerTotal);
  check("인센티브 포함 2027 월 실수령", 4558450, o2.offer.monthly.net);
  check("인센티브 포함 퇴직금 1년분", 5416666, o2.severance.offer);

  var same = SalCalc.compareOffer({
    current: { annualSalary: 50000000, monthlyNonTaxable: 200000, incentive: 0 },
    offer: { annualSalary: 50000000, monthlyNonTaxable: 200000, incentive: 0 },
    dependents: 2, children: 1
  });
  check("같은 연봉이면 차액 0", 0, same.diff.monthlyNet);
  check("같은 연봉이면 실질 인상률 0", 0, same.diff.realRaise);

  /* 11. 고연봉 상한 */
  var high = SalCalc.computePerson({ annualSalary: 200000000, monthlyNonTaxable: 200000, dependents: 0, children: 0 }, 2027);
  check("2억 연봉 국민연금 월 상한액", 329500, high.monthly.np);
  check("2억 연봉 실수령 계산 정상", true, high.monthly.net > 0 && high.annual.net > 0);

  /* 12. 월 소득세 합리성 */
  var t5 = SalCalc.computePerson({ annualSalary: 50000000, monthlyNonTaxable: 200000, dependents: 2, children: 1 }, 2027);
  check("5,000만 한계세율 15%", 0.15, t5.tax.margin);
  check("5,000만 2027 월 소득세", 146823, t5.monthly.incomeTax);
  check("공제율 13%대", true, t5.effectiveRate > 0.13 && t5.effectiveRate < 0.14);

  var failed = rows.filter(function (r) { return !r.pass; });
  window.__TEST_RESULTS = {
    total: rows.length,
    passed: rows.length - failed.length,
    failed: failed.length,
    rows: rows
  };
})();
