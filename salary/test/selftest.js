/* 2027 월급·이직 계산 엔진 자체 검증 (브라우저에서 실행) */
(function () {
  "use strict";

  var rows = [];
  function check(name, expected, actual) {
    var pass = typeof expected === "number" && typeof actual === "number"
      ? Math.abs(expected - actual) <= 1
      : expected === actual;
    rows.push({ name: name, expected: expected, actual: actual, pass: pass, ok: pass });
  }
  function checkClose(name, expected, actual, tol) {
    var ok = Math.abs(expected - actual) <= (tol || 2);
    rows.push({ name: name, expected: expected, actual: actual, pass: ok, ok: ok });
  }

  function checkTrue(name, actual, note) {
    check(name, true, !!actual, note);
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

  var c1eok = SalCalc.compareYears({ annualSalary: 100000000, monthlyNonTaxable: 200000, dependents: 2, children: 1 });
  check("2026 월 실수령(1억)", 6679850, c1eok.y2026.monthly.net);
  check("2027 월 실수령(1억)", 6662244, c1eok.y2027.monthly.net);
  check("1억 월 차이", -17606, c1eok.diff.monthlyNet);
  check("1억 연 차이", -211279, c1eok.diff.annualNet);

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
  var overNon = SalCalc.normalizePerson({ annualSalary: 1200000, monthlyNonTaxable: 200000 });
  check("비과세가 월급보다 크면 월급까지만", 100000, overNon.monthlyNonTaxable);
  var zeroOut = SalCalc.compareYears({ annualSalary: 0, monthlyNonTaxable: 0, dependents: 0, children: 0 });
  check("연봉 0 · 월 실수령 0", 0, zeroOut.y2027.monthly.net);
  check("연봉 0 · NaN 없음", true, isFinite(zeroOut.y2027.monthly.net) && isFinite(zeroOut.diff.monthlyNet));

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


  /* 13. P0 회귀 — 퇴직금 포함/별도 */
  var sevSep = SalCalc.compareYears({ annualSalary: 52000000, monthlyNonTaxable: 200000, dependents: 2, children: 1 });
  check("퇴직금 별도 · 월 세전 = 연봉÷12", 4333333, sevSep.y2027.monthly.gross);
  var sevInc = SalCalc.compareYears({ annualSalary: 52000000, monthlyNonTaxable: 200000, dependents: 2, children: 1, severanceIncluded: true });
  check("퇴직금 포함 · 월 세전 = 연봉÷13", 4000000, sevInc.y2027.monthly.gross);
  checkTrue("퇴직금 포함이면 월 실수령이 더 적다", sevInc.y2027.monthly.net < sevSep.y2027.monthly.net);
  check("퇴직금 포함/별도 · 연 과세급여는 같다", sevSep.y2027.annual.taxable, sevInc.y2027.annual.taxable);
  check("퇴직금 포함 표시", true, sevInc.y2027.input.severanceIncluded);

  var mixed = SalCalc.compareOffer({
    current: { annualSalary: 50000000, monthlyNonTaxable: 200000, incentive: 0, severanceIncluded: false },
    offer: { annualSalary: 50000000, monthlyNonTaxable: 200000, incentive: 0, severanceIncluded: true },
    dependents: 2, children: 1
  });
  check("같은 연봉 · 현 직장(별도) 퇴직금 1년분", 4166666, mixed.severance.current);
  check("같은 연봉 · 제안(포함) 퇴직금 1년분", 3846153, mixed.severance.offer);
  checkTrue("같은 연봉에서 포함 제안의 월 실수령이 낮다", mixed.offer.monthly.net < mixed.current.monthly.net);
  check("포함/별도 혼합 · 총보상 차이", -4166666, mixed.diff.totalComp, "별도 5,417만 vs 포함 5,000만");
  check("포함/별도 혼합 · 세전 총보상 인상률 음수", true, mixed.diff.nominalRaise < 0);
  check("포함 제안 · 총보상 = 연봉", 50000000, mixed.totalComp.offer);
  check("별도 현 직장 · 총보상 = 연봉 + 퇴직금 1년분", 54166666, mixed.totalComp.current);

  /* 14. P0 회귀 — 자녀세액공제 대상 분리 */
  var noCreditKid = SalCalc.computePerson({ annualSalary: 50000000, dependents: 3, children: 2, creditChildren: 0 }, 2027);
  check("자녀 2명 · 세액공제 대상 0명이면 자녀세액공제 0", 0, noCreditKid.tax.childCredit);
  var oneCreditKid = SalCalc.computePerson({ annualSalary: 50000000, dependents: 3, children: 2, creditChildren: 1 }, 2027);
  check("자녀 2명 중 1명만 대상 · 자녀세액공제 25만", 250000, oneCreditKid.tax.childCredit);
  check("자녀세액공제 대상 기본값은 자녀 수", 2, SalCalc.normalizePerson({ annualSalary: 50000000, dependents: 3, children: 2 }).creditChildren);
  check("자녀세액공제 대상은 자녀 수를 넘을 수 없다", 2, SalCalc.normalizePerson({ annualSalary: 50000000, dependents: 3, children: 2, creditChildren: 5 }).creditChildren);
  var noCreditPay = SalCalc.compareYears({ annualSalary: 50000000, dependents: 3, children: 2, creditChildren: 0 });
  var oneCreditPay = SalCalc.compareYears({ annualSalary: 50000000, dependents: 3, children: 2, creditChildren: 1 });
  check("세액공제 대상 1명 추가 시 연 소득세 25만 감소", 250000, noCreditPay.y2027.annual.incomeTax - oneCreditPay.y2027.annual.incomeTax);

  /* 15. P0 회귀 — 비과세 항목 분리와 한도 초과 과세 전환 */
  var ntAll = SalCalc.normalizePerson({ annualSalary: 40000000, nonTaxable: { meal: 200000, car: 200000, childcare: 200000, other: 0 }, preschoolChildren: 1 });
  check("비과세 · 식대+자가운전+보육(1명) = 60만 인정", 600000, ntAll.monthlyNonTaxable);
  check("비과세 · 전환 0", 0, ntAll.nonTaxable.converted);
  var ntNoKid = SalCalc.normalizePerson({ annualSalary: 40000000, nonTaxable: { meal: 200000, car: 200000, childcare: 200000 }, preschoolChildren: 0 });
  check("비과세 · 6세 이하 자녀 0명이면 보육수당 20만 과세 전환", 400000, ntNoKid.monthlyNonTaxable);
  check("비과세 · 과세 전환액 20만", 200000, ntNoKid.nonTaxable.converted);
  var ntCarOver = SalCalc.normalizePerson({ annualSalary: 40000000, nonTaxable: { meal: 300000, car: 300000 } });
  check("비과세 · 항목 한도 초과분은 인정 안 함", 400000, ntCarOver.monthlyNonTaxable);
  check("비과세 · 초과 20만 과세 전환", 200000, ntCarOver.nonTaxable.converted);
  var ntOther = SalCalc.normalizePerson({ annualSalary: 40000000, nonTaxable: { meal: 200000, other: 100000 } });
  check("비과세 · 기타 항목 합산", 300000, ntOther.monthlyNonTaxable);
  var nt2Kids = SalCalc.normalizePerson({ annualSalary: 40000000, nonTaxable: { childcare: 400000 }, preschoolChildren: 2 });
  check("비과세 · 보육수당 6세 이하 2명이면 40만", 400000, nt2Kids.monthlyNonTaxable);
  var ntClamp = SalCalc.normalizePerson({ annualSalary: 6000000, nonTaxable: { meal: 200000, car: 200000, other: 200000 } });
  check("비과세가 월급보다 크면 월급까지만", 500000, ntClamp.monthlyNonTaxable);
  check("비과세 · 월급 초과분도 과세 전환", 100000, ntClamp.nonTaxable.converted);
  var kidPay = SalCalc.compareYears({ annualSalary: 40000000, dependents: 3, children: 2, creditChildren: 1, nonTaxable: { meal: 200000, childcare: 200000 }, preschoolChildren: 1 });
  var noKidPay = SalCalc.compareYears({ annualSalary: 40000000, dependents: 3, children: 2, creditChildren: 1, nonTaxable: { meal: 200000, childcare: 200000 }, preschoolChildren: 0 });
  check("보육수당 비과세 반영 · 과세 월급 20만 감소", 200000, noKidPay.y2027.monthly.taxable - kidPay.y2027.monthly.taxable);
  checkTrue("보육수당 비과세 반영 · 월 실수령 증가", kidPay.y2027.monthly.net > noKidPay.y2027.monthly.net);

  /* 16. 기존 단일 비과세 입력(호환) */
  var legacy = SalCalc.normalizePerson({ annualSalary: 40000000, monthlyNonTaxable: 600000 });
  check("구형 단일 입력 · 40만까지 인정", 400000, legacy.monthlyNonTaxable);
  check("구형 단일 입력 · 20만 과세 전환", 200000, legacy.nonTaxable.converted);

  var offerNt = SalCalc.compareOffer({
    current: { annualSalary: 50000000, incentive: 0 },
    offer: { annualSalary: 60000000, incentive: 5000000 },
    nonTaxable: { meal: 200000 }, dependents: 2, children: 1
  });
  check("이직 비교 · 비과세 공통 입력이 제안에 적용", 200000, offerNt.offer.input.nonTaxable.applied);
  check("이직 비교 · 비과세 공통 입력이 현 직장에도 적용", 200000, offerNt.current.input.nonTaxable.applied);

  var failed = rows.filter(function (r) { return !r.pass; });
  window.__TEST_RESULTS = {
    total: rows.length,
    passed: rows.length - failed.length,
    failed: failed.length,
    rows: rows
  };
})();
