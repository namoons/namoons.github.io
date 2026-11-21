/*!
 * 2027 월급 실수령액 · 이직 연봉 비교 계산 엔진
 * 기준: 2026년 / 2027년 1월 시행 요율 (2026년 11월 21일 확인)
 * 의존성 없음. 브라우저(window.SalCalc)와 자체 검증 페이지에서 함께 씁니다.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SalCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * 기준값
   * ------------------------------------------------------------------ */
  var C = {
    BASIC_DEDUCTION: 1500000,      // 기본공제 1인당
    EARNED_DEDUCTION_CAP: 20000000, // 근로소득공제 한도
    STANDARD_CREDIT: 130000,       // 표준세액공제
    LOCAL_RATE: 0.10,              // 지방소득세 = 소득세 × 10%

    NP_FLOOR: 410000,              // 기준소득월액 하한 (2026.7~2027.6)
    NP_CAP: 6590000,               // 2026.7~2027.6 상한

    NONTAXABLE_MEAL: 200000,       // 식대 비과세 월 20만원
    NONTAXABLE_GUARD: 400000,      // 식대 20만 + 자가운전보조금 20만 (입력 상한)

    MIN_WAGE: {
      2026: { hourly: 10320, monthly: 2156880, hours: 209 },
      2027: { hourly: 10700, monthly: 2236300, hours: 209 }
    },

    RATES: {
      2026: {
        np: 0.0475,                // 국민연금 근로자 4.75%
        npCapH1: 6370000,          // 2026.1~6 기준소득월액 상한
        npCapH2: 6590000,          // 2026.7~12
        hi: 0.03595,               // 건강보험 7.19%의 절반
        ltcRatio: 0.1314,          // 장기요양 = 건강보험료 × 13.14% (소득 대비 0.9448%)
        ei: 0.009                  // 고용보험 실업급여 근로자 0.9%
      },
      2027: {
        np: 0.05,                  // 국민연금 근로자 5.0%
        npCapH1: 6590000,          // 2027.6까지 확정
        npCapH2: 6590000,          // 2027.7분부터는 미고시 → 6,590,000원 가정
        hi: 0.03595,               // 건강보험 7.19% 동결
        ltcRatio: 0.1390,          // 장기요양 = 건강보험료 × 13.90% (소득 대비 0.9994%)
        ei: 0.009                  // 현행 법령. 개정안 반영 시 1.0%
      }
    },

    EI_REFORM_2027: 0.010          // 고용보험 개정안(근로자 1.0%) — 2026.11 기준 미확정
  };

  var TAX_BRACKETS = [
    { limit: 14000000, rate: 0.06, progressive: 0 },
    { limit: 50000000, rate: 0.15, progressive: 1260000 },
    { limit: 88000000, rate: 0.24, progressive: 5760000 },
    { limit: 150000000, rate: 0.35, progressive: 15440000 },
    { limit: 300000000, rate: 0.38, progressive: 19940000 },
    { limit: 500000000, rate: 0.40, progressive: 25940000 },
    { limit: 1000000000, rate: 0.42, progressive: 35940000 },
    { limit: Infinity, rate: 0.45, progressive: 65940000 }
  ];

  /* ------------------------------------------------------------------ *
   * 공통 도우미
   * ------------------------------------------------------------------ */
  function num(v) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }
  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

  function earnedIncomeDeduction(gross) {
    gross = num(gross);
    if (gross <= 0) return 0;
    var d;
    if (gross <= 5000000) d = gross * 0.7;
    else if (gross <= 15000000) d = 3500000 + (gross - 5000000) * 0.4;
    else if (gross <= 45000000) d = 7500000 + (gross - 15000000) * 0.15;
    else if (gross <= 100000000) d = 12000000 + (gross - 45000000) * 0.05;
    else d = 14750000 + (gross - 100000000) * 0.02;
    return Math.min(Math.floor(d), C.EARNED_DEDUCTION_CAP, gross);
  }

  function taxOnBase(base) {
    base = Math.max(0, num(base));
    for (var i = 0; i < TAX_BRACKETS.length; i++) {
      var b = TAX_BRACKETS[i];
      if (base <= b.limit) return Math.max(0, Math.floor(base * b.rate - b.progressive));
    }
    return 0;
  }

  function marginalRate(base) {
    base = Math.max(0, num(base));
    for (var i = 0; i < TAX_BRACKETS.length; i++) {
      if (base <= TAX_BRACKETS[i].limit) return TAX_BRACKETS[i].rate;
    }
    return 0.45;
  }

  function earnedIncomeTaxCredit(tax, gross) {
    tax = num(tax); gross = num(gross);
    if (tax <= 0) return 0;
    var credit = tax <= 1300000 ? tax * 0.55 : 715000 + (tax - 1300000) * 0.30;
    var limit;
    if (gross <= 33000000) limit = 740000;
    else if (gross <= 70000000) limit = Math.max(660000, 740000 - (gross - 33000000) * 0.008);
    else if (gross <= 120000000) limit = Math.max(500000, 660000 - (gross - 70000000) * 0.5);
    else limit = Math.max(200000, 500000 - (gross - 120000000) * 0.5);
    return Math.min(Math.floor(credit), Math.floor(limit));
  }

  function childTaxCredit(count) {
    count = Math.max(0, Math.floor(count || 0));
    if (count === 0) return 0;
    if (count === 1) return 250000;
    if (count === 2) return 550000;
    return 550000 + (count - 2) * 400000;
  }

  /* ------------------------------------------------------------------ *
   * 4대보험 (연간)
   * ------------------------------------------------------------------ */
  function socialInsurance(monthlyTaxable, year, eiRate) {
    var r = C.RATES[year] || C.RATES[2027];
    var monthly = Math.max(0, Math.floor(monthlyTaxable));
    /* 국민연금: 1~6월 / 7~12월 상한이 다를 수 있어 월별로 계산 */
    var np = 0, npBaseH1 = 0, npBaseH2 = 0;
    for (var m = 0; m < 12; m++) {
      var cap = m < 6 ? r.npCapH1 : r.npCapH2;
      var base = clamp(monthly, C.NP_FLOOR, cap);
      if (m === 0) npBaseH1 = base;
      if (m === 6) npBaseH2 = base;
      np += Math.floor(base * r.np);
    }

    var hiMonthly = Math.floor(monthly * r.hi);
    var ltcMonthly = Math.floor(hiMonthly * r.ltcRatio);
    var eiMonthly = Math.floor(monthly * (eiRate || r.ei));

    return {
      np: np,
      hi: hiMonthly * 12,
      ltc: ltcMonthly * 12,
      ei: eiMonthly * 12,
      total: np + (hiMonthly + ltcMonthly + eiMonthly) * 12,
      monthly: { np: Math.floor(np / 12), hi: hiMonthly, ltc: ltcMonthly, ei: eiMonthly },
      npBase: { h1: npBaseH1, h2: npBaseH2 },
      capped: monthly > Math.min(r.npCapH1, r.npCapH2)
    };
  }

  /* ------------------------------------------------------------------ *
   * 한 사람의 월 실수령액
   * input: { annualSalary, monthlyNonTaxable, dependents, children,
   *          ei2027Reform, severanceIncluded }
   * ------------------------------------------------------------------ */
  function normalizePerson(p) {
    p = p || {};
    var annual = num(p.annualSalary);
    var nontaxable = Math.min(num(p.monthlyNonTaxable), C.NONTAXABLE_GUARD);
    if (nontaxable > Math.floor(annual / 12)) nontaxable = Math.floor(annual / 12);
    var dependents = Math.max(0, Math.floor(num(p.dependents)));
    var children = Math.max(0, Math.floor(num(p.children)));
    if (children > dependents) dependents = children;
    return {
      annualSalary: annual,
      monthlyNonTaxable: nontaxable,
      dependents: dependents,
      children: children,
      ei2027Reform: !!p.ei2027Reform
    };
  }

  function computePerson(raw, year) {
    var p = normalizePerson(raw);
    year = year === 2026 ? 2026 : 2027;
    var rates = C.RATES[year];

    var annualGross = p.annualSalary;
    var monthlyGross = Math.floor(annualGross / 12);
    var annualNonTaxable = p.monthlyNonTaxable * 12;
    var annualTaxable = Math.max(0, annualGross - annualNonTaxable);
    var monthlyTaxable = Math.max(0, monthlyGross - p.monthlyNonTaxable);

    var eiRate = (year === 2027 && p.ei2027Reform) ? C.EI_REFORM_2027 : rates.ei;
    var ins = socialInsurance(monthlyTaxable, year, eiRate);

    /* 소득세: 근로소득공제 → 인적공제 → 연금보험료공제 → (건강·고용보험료 특별소득공제) */
    var earnedDeduction = earnedIncomeDeduction(annualTaxable);
    var earnedIncome = Math.max(0, annualTaxable - earnedDeduction);
    var basicCount = 1 + p.dependents;
    var basicDeduction = basicCount * C.BASIC_DEDUCTION;

    var pensionDeduction = Math.min(ins.np, earnedIncome);
    var afterPersonal = Math.max(0, earnedIncome - basicDeduction - pensionDeduction);
    var healthDeduction = Math.min(ins.hi + ins.ltc + ins.ei, afterPersonal);

    var childCredit = childTaxCredit(p.children);

    function variant(useSpecialDeduction) {
      var healthDed = useSpecialDeduction ? healthDeduction : 0;
      var base = Math.max(0, afterPersonal - healthDed);
      var tax = taxOnBase(base);
      var earned = earnedIncomeTaxCredit(tax, annualTaxable);
      var credits = earned + childCredit + (useSpecialDeduction ? 0 : C.STANDARD_CREDIT);
      var used = Math.min(credits, tax);
      return {
        specialDeduction: useSpecialDeduction,
        taxableBase: base,
        calculatedTax: tax,
        earnedCredit: earned,
        childCredit: childCredit,
        standardCredit: useSpecialDeduction ? 0 : C.STANDARD_CREDIT,
        totalCredits: credits,
        usedCredits: used,
        determinedTax: tax - used,
        healthDeduction: healthDed
      };
    }

    var withSpecial = variant(true);
    var withStandard = variant(false);
    var best = withSpecial.determinedTax <= withStandard.determinedTax ? withSpecial : withStandard;
    var determinedTax = best.determinedTax;
    var localTax = Math.floor(determinedTax * C.LOCAL_RATE);

    var monthly = {
      gross: monthlyGross,
      nontaxable: p.monthlyNonTaxable,
      taxable: monthlyTaxable,
      np: Math.floor(ins.np / 12),
      hi: ins.monthly.hi,
      ltc: ins.monthly.ltc,
      ei: ins.monthly.ei,
      insurance: Math.floor(ins.total / 12),
      incomeTax: Math.floor(determinedTax / 12),
      localTax: Math.floor(localTax / 12)
    };
    monthly.deduction = monthly.np + monthly.hi + monthly.ltc + monthly.ei +
      monthly.incomeTax + monthly.localTax;
    monthly.net = monthly.gross - monthly.deduction;

    var annualNet = annualGross - ins.total - determinedTax - localTax;

    return {
      year: year,
      input: p,
      monthly: monthly,
      annual: {
        gross: annualGross,
        taxable: annualTaxable,
        np: ins.np,
        hi: ins.hi,
        ltc: ins.ltc,
        ei: ins.ei,
        insurance: ins.total,
        incomeTax: determinedTax,
        localTax: localTax,
        deduction: ins.total + determinedTax + localTax,
        net: annualNet
      },
      tax: {
        earnedDeduction: earnedDeduction,
        earnedIncome: earnedIncome,
        basicCount: basicCount,
        basicDeduction: basicDeduction,
        pensionDeduction: pensionDeduction,
        healthDeduction: healthDeduction,
        appliedHealthDeduction: best.healthDeduction,
        taxableBase: best.taxableBase,
        calculatedTax: best.calculatedTax,
        earnedCredit: best.earnedCredit,
        childCredit: best.childCredit,
        standardCredit: best.standardCredit,
        margin: marginalRate(best.taxableBase),
        specialDeductionUsed: best.specialDeduction
      },
      insurance: ins,
      rates: {
        np: rates.np,
        hi: rates.hi,
        ltcRatio: rates.ltcRatio,
        ei: eiRate,
        ltcOfIncome: Math.round(rates.hi * rates.ltcRatio * 1000000) / 1000000
      },
      effectiveRate: monthlyGross > 0 ? monthly.deduction / monthlyGross : 0,
      minimumWage: {
        hourly: C.MIN_WAGE[year].hourly,
        monthly: C.MIN_WAGE[year].monthly,
        ok: monthlyGross >= C.MIN_WAGE[year].monthly,
        gap: monthlyGross - C.MIN_WAGE[year].monthly
      }
    };
  }

  /* ------------------------------------------------------------------ *
   * 2026 vs 2027 비교
   * ------------------------------------------------------------------ */
  function compareYears(raw) {
    var p = normalizePerson(raw);
    var y2026 = computePerson(p, 2026);
    var y2027 = computePerson(p, 2027);
    var diff = {
      monthlyNet: y2027.monthly.net - y2026.monthly.net,
      annualNet: y2027.annual.net - y2026.annual.net,
      np: y2027.annual.np - y2026.annual.np,
      hi: y2027.annual.hi - y2026.annual.hi,
      ltc: y2027.annual.ltc - y2026.annual.ltc,
      ei: y2027.annual.ei - y2026.annual.ei,
      insurance: y2027.annual.insurance - y2026.annual.insurance,
      incomeTax: y2027.annual.incomeTax - y2026.annual.incomeTax,
      localTax: y2027.annual.localTax - y2026.annual.localTax,
      monthlyGrossSame: y2026.monthly.gross === y2027.monthly.gross
    };
    diff.monthlyInsurance = y2027.monthly.insurance - y2026.monthly.insurance;
    diff.monthlyIncomeTax = y2027.monthly.incomeTax - y2026.monthly.incomeTax;
    diff.monthlyLocalTax = y2027.monthly.localTax - y2026.monthly.localTax;
    return { p: p, y2026: y2026, y2027: y2027, diff: diff };
  }

  /* ------------------------------------------------------------------ *
   * 이직 비교
   * current / offer: { annualSalary, monthlyNonTaxable, incentive }
   * ------------------------------------------------------------------ */
  function compareOffer(raw) {
    var cur = normalizePerson(raw.current);
    var off = normalizePerson(raw.offer);
    var dependents = Math.max(0, Math.floor(num(raw.dependents)));
    var children = Math.max(0, Math.floor(num(raw.children)));
    var common = {
      dependents: dependents,
      children: children,
      ei2027Reform: !!raw.ei2027Reform
    };

    function withIncentive(p, incentive) {
      return {
        annualSalary: p.annualSalary + num(incentive),
        monthlyNonTaxable: p.monthlyNonTaxable,
        dependents: dependents,
        children: children,
        ei2027Reform: common.ei2027Reform
      };
    }

    var curIncentive = num(raw.current && raw.current.incentive);
    var offIncentive = num(raw.offer && raw.offer.incentive);

    var current = computePerson(withIncentive(cur, curIncentive), 2027);
    var offer = computePerson(withIncentive(off, offIncentive), 2027);

    var currentTotal = cur.annualSalary + curIncentive;
    var offerTotal = off.annualSalary + offIncentive;

    var severanceCurrent = Math.floor(currentTotal / 12);
    var severanceOffer = Math.floor(offerTotal / 12);

    var diff = {
      monthlyGross: offer.monthly.gross - current.monthly.gross,
      monthlyNet: offer.monthly.net - current.monthly.net,
      annualGross: offerTotal - currentTotal,
      annualNet: offer.annual.net - current.annual.net,
      insurance: offer.annual.insurance - current.annual.insurance,
      incomeTax: offer.annual.incomeTax - current.annual.incomeTax,
      localTax: offer.annual.localTax - current.annual.localTax,
      severance: severanceOffer - severanceCurrent
    };
    diff.nominalRaise = currentTotal > 0 ? diff.annualGross / currentTotal : 0;
    diff.realRaise = current.annual.net > 0 ? diff.annualNet / current.annual.net : 0;
    diff.monthlyRealRaise = current.monthly.net > 0 ? diff.monthlyNet / current.monthly.net : 0;

    return {
      current: current,
      offer: offer,
      currentTotal: currentTotal,
      offerTotal: offerTotal,
      currentIncentive: curIncentive,
      offerIncentive: offIncentive,
      severance: { current: severanceCurrent, offer: severanceOffer, diff: diff.severance },
      diff: diff
    };
  }

  return {
    C: C,
    TAX_BRACKETS: TAX_BRACKETS,
    earnedIncomeDeduction: earnedIncomeDeduction,
    taxOnBase: taxOnBase,
    earnedIncomeTaxCredit: earnedIncomeTaxCredit,
    childTaxCredit: childTaxCredit,
    socialInsurance: socialInsurance,
    computePerson: computePerson,
    compareYears: compareYears,
    compareOffer: compareOffer,
    normalizePerson: normalizePerson
  };
});
