/*!
 * 연말정산 · 맞벌이 몰아주기 계산 엔진
 * 기준: 2026년 귀속 (2027년 1~2월 연말정산), 2026년 11월 확인 법령
 * 의존성 없음. 브라우저(window.YECalc)와 테스트(node/browser)에서 같이 씁니다.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.YECalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * 2026년 귀속 기준값
   * ------------------------------------------------------------------ */
  var C = {
    BASIC: 1500000,             // 기본공제 1인당
    SENIOR: 1000000,            // 경로우대(70세 이상) 1인당
    DISABLED: 2000000,          // 장애인 1인당
    SINGLE_PARENT: 1000000,     // 한부모
    EARNED_DEDUCTION_CAP: 20000000, // 근로소득공제 한도

    MED_RATE: 0.15,
    MED_THRESHOLD: 0.03,        // 총급여 3% 초과분
    MED_GENERAL_CAP: 7000000,   // 일반 부양가족 의료비 한도

    EDU_RATE: 0.15,
    EDU_SCHOOL_CAP: 3000000,    // 취학 전·초중고 1명당
    EDU_COLLEGE_CAP: 9000000,   // 대학생 1명당

    DONATION_RATE: 0.15,
    DONATION_HIGH_RATE: 0.30,
    DONATION_HIGH_BASE: 10000000,

    INSURANCE_RATE: 0.12,
    INSURANCE_CAP: 1000000,

    PENSION_CAP: 9000000,       // 연금저축 600만 + IRP 합산 900만
    PENSION_LOW_GROSS: 55000000,

    RENT_CAP: 10000000,
    RENT_HIGH_GROSS: 55000000,  // 17%
    RENT_LOW_GROSS: 80000000,   // 15%

    STANDARD_CREDIT: 130000,

    CARD_THRESHOLD: 0.25,
    CARD_LIMIT_LOW: 3000000,
    CARD_LIMIT_HIGH: 2500000,
    CARD_CHILD_ADD_LOW: 500000,
    CARD_CHILD_ADD_HIGH: 250000,
    CARD_EXTRA_LIMIT_LOW: 3000000,
    CARD_EXTRA_LIMIT_HIGH: 2000000,
    CARD_LOW_GROSS: 70000000,

    NP_RATE: 0.0475,            // 국민연금 근로자 4.75% (2026)
    NP_CAP_H1: 6370000,         // 기준소득월액 상한 2026.1~6
    NP_CAP_H2: 6590000,         // 2026.7~12
    NP_FLOOR: 410000,
    HI_RATE: 0.03595,           // 건강보험 7.19%의 절반
    LTC_RATE: 0.1314,           // 장기요양 = 건강보험료 × 13.14%
    EI_RATE: 0.009,             // 고용보험 실업급여 근로자 0.9%

    LOCAL_RATE: 0.10,
    OVERALL_DEDUCTION_CAP: 25000000
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

  /* 신용카드 등 소득공제 (조특법 §126의2, 2026년 사용분) */
  function cardDeduction(input) {
    var gross = num(input.gross);
    var credit = num(input.credit);
    var check = num(input.check);
    var traditional = num(input.traditional);
    var transit = num(input.transit);
    var culture = num(input.culture);
    var childCount = Math.max(0, Math.floor(input.cardChildCount || 0));

    var lowIncome = gross <= C.CARD_LOW_GROSS;
    if (!lowIncome) { credit += culture; culture = 0; } // 7천만 초과는 문화체육 30% 칸 없음

    var total = credit + check + culture + traditional + transit;
    var threshold = gross * C.CARD_THRESHOLD;
    var out = {
      total: total, threshold: threshold, weighted: 0, beforeThreshold: 0,
      baseLimit: 0, extraLimit: 0, extra: 0, deduction: 0, lowIncome: lowIncome
    };
    if (gross <= 0 || total <= 0) return out;

    var weighted = credit * 0.15 + check * 0.30 + culture * 0.30 +
      traditional * 0.40 + transit * 0.40;
    // 25% 문턱은 공제율이 낮은 칸부터 채운 것으로 계산
    var filled;
    if (credit >= threshold) {
      filled = threshold * 0.15;
    } else if (credit + check + culture >= threshold) {
      filled = credit * 0.15 + (threshold - credit) * 0.30;
    } else {
      var rest = threshold - credit - check - culture;
      filled = credit * 0.15 + (check + culture) * 0.30 +
        Math.min(rest, traditional + transit) * 0.40;
    }
    var raw = Math.max(0, Math.floor(weighted - filled));

    var childAdd = lowIncome ? C.CARD_CHILD_ADD_LOW : C.CARD_CHILD_ADD_HIGH;
    var baseLimit = (lowIncome ? C.CARD_LIMIT_LOW : C.CARD_LIMIT_HIGH) +
      Math.min(childCount, 2) * childAdd;
    var extraLimit = lowIncome ? C.CARD_EXTRA_LIMIT_LOW : C.CARD_EXTRA_LIMIT_HIGH;
    var special = Math.floor(traditional * 0.40 + transit * 0.40 +
      (lowIncome ? culture * 0.30 : 0));
    var extra = 0;
    var ded = Math.min(raw, baseLimit);
    if (raw > baseLimit) {
      extra = Math.min(raw - baseLimit, special, extraLimit);
      ded = baseLimit + extra;
    }
    out.weighted = Math.floor(weighted);
    out.beforeThreshold = Math.floor(filled);
    out.baseLimit = baseLimit;
    out.extraLimit = extraLimit;
    out.special = special;
    out.extra = extra;
    out.deduction = ded;
    return out;
  }

  function nationalPension(gross) {
    gross = num(gross);
    if (gross <= 0) return 0;
    var monthly = Math.floor(gross / 12);
    var total = 0;
    for (var m = 0; m < 12; m++) {
      var cap = m < 6 ? C.NP_CAP_H1 : C.NP_CAP_H2;
      var base = clamp(monthly, C.NP_FLOOR, cap);
      total += Math.floor(base * C.NP_RATE);
    }
    return total;
  }

  function healthInsurance(gross) {
    gross = num(gross);
    var monthly = Math.floor(gross / 12);
    var health = Math.floor(monthly * C.HI_RATE);
    var ltc = Math.floor(health * C.LTC_RATE);
    var employment = Math.floor(monthly * C.EI_RATE);
    return {
      health: health * 12,
      longTermCare: ltc * 12,
      employment: employment * 12,
      total: (health + ltc + employment) * 12
    };
  }

  /* ------------------------------------------------------------------ *
   * 한 사람 계산
   * ------------------------------------------------------------------ */
  function computePerson(p) {
    var gross = num(p.gross);
    var prepaid = num(p.prepaid);
    var children = p.children || [];
    var parents = p.parents || { count: 0, seniors: 0, disabled: 0 };
    var autoInsurance = p.autoInsurance !== false;

    /* 1. 근로소득공제 */
    var earnedDeduction = earnedIncomeDeduction(gross);
    var earnedIncome = Math.max(0, gross - earnedDeduction);

    /* 2. 인적공제 */
    var parentCount = Math.max(0, Math.floor(parents.count || 0));
    var basicCount = 1 + children.length + (p.spouseDependent ? 1 : 0) + parentCount;
    var basic = basicCount * C.BASIC;
    var senior = Math.min(Math.max(0, Math.floor(parents.seniors || 0)), parentCount) * C.SENIOR;
    var disabled = Math.min(Math.max(0, Math.floor(parents.disabled || 0)), parentCount) * C.DISABLED;
    var singleParent = p.singleParent ? C.SINGLE_PARENT : 0;
    var personalRaw = basic + senior + disabled + singleParent;
    var personal = Math.min(personalRaw, earnedIncome); // 인적공제 ≤ 종합소득금액

    /* 3. 연금보험료공제 / 건강·장기요양·고용보험료 */
    var np = autoInsurance ? nationalPension(gross) : 0;
    var hi = autoInsurance ? healthInsurance(gross) : { health: 0, longTermCare: 0, employment: 0, total: 0 };
    var remaining = Math.max(0, earnedIncome - personal);
    var pensionDeduction = Math.min(np, remaining);
    remaining -= pensionDeduction;
    var healthDeduction = Math.min(hi.total, remaining);
    remaining -= healthDeduction;

    /* 4. 신용카드 등 소득공제 (종합한도 2,500만원) */
    var card = cardDeduction({
      gross: gross,
      credit: p.card && p.card.credit,
      check: p.card && p.card.check,
      traditional: p.card && p.card.traditional,
      transit: p.card && p.card.transit,
      culture: p.card && p.card.culture,
      cardChildCount: p.cardChildCount || 0
    });
    var cardDeductionApplied = Math.min(card.deduction, C.OVERALL_DEDUCTION_CAP);
    cardDeductionApplied = Math.min(cardDeductionApplied, remaining);
    remaining -= cardDeductionApplied;

    /* 5. 과세표준 · 산출세액 */
    var taxableBase = Math.max(0, earnedIncome - personal - pensionDeduction - healthDeduction - cardDeductionApplied);
    var calculatedTax = taxOnBase(taxableBase);

    /* 6. 세액공제 */
    var earnedCredit = earnedIncomeTaxCredit(calculatedTax, gross);
    var childCredit = childTaxCredit(p.childCreditCount || 0);
    var pensionCredit = Math.floor(
      Math.min(num(p.pensionPaid), C.PENSION_CAP) *
      (gross <= C.PENSION_LOW_GROSS ? 0.15 : 0.12)
    );

    var medGeneral = Math.min(num(p.medical && p.medical.general), C.MED_GENERAL_CAP);
    var medUnlimited = num(p.medical && p.medical.unlimited);
    var medThreshold = Math.floor(gross * C.MED_THRESHOLD);
    var medBase = Math.max(0, medGeneral + medUnlimited - medThreshold);
    var medicalCredit = Math.floor(medBase * C.MED_RATE);

    var schoolChildren = p.schoolChildCount || 0;
    var collegeChildren = p.collegeChildCount || 0;
    var eduSchoolBase = Math.min(num(p.education && p.education.school), C.EDU_SCHOOL_CAP * schoolChildren);
    var eduCollegeBase = Math.min(num(p.education && p.education.college), C.EDU_COLLEGE_CAP * collegeChildren);
    var educationBase = eduSchoolBase + eduCollegeBase;
    var educationCredit = Math.floor(educationBase * C.EDU_RATE);

    var donationBase = num(p.donation);
    var donationCredit = Math.floor(
      Math.min(donationBase, C.DONATION_HIGH_BASE) * C.DONATION_RATE +
      Math.max(0, donationBase - C.DONATION_HIGH_BASE) * C.DONATION_HIGH_RATE
    );

    var insuranceBase = Math.min(num(p.insurancePaid), C.INSURANCE_CAP);
    var insuranceCredit = Math.floor(insuranceBase * C.INSURANCE_RATE);

    var rentBase = Math.min(num(p.rent), C.RENT_CAP);
    var rentRate = gross <= C.RENT_HIGH_GROSS ? 0.17 : (gross <= C.RENT_LOW_GROSS ? 0.15 : 0);
    var rentCredit = Math.floor(rentBase * rentRate);

    var specialCredits = insuranceCredit + medicalCredit + educationCredit + donationCredit;
    var specialAndRent = specialCredits + rentCredit;

    /* 7. 표준세액공제(13만원)와 특별세액공제 비교
       - 표준세액공제를 받으면 특별소득공제(건강·장기요양·고용보험료)와
         특별세액공제·월세 세액공제를 포기해야 하므로 두 경우를 모두 계산해 유리한 쪽을 씁니다. */
    function makeVariant(useStandard) {
      var healthDed = useStandard ? 0 : healthDeduction;
      var base = Math.max(0, earnedIncome - personal - pensionDeduction - healthDed - cardDeductionApplied);
      var tax = taxOnBase(base);
      var earned = earnedIncomeTaxCredit(tax, gross);
      var credits = earned + childCredit + pensionCredit +
        (useStandard ? C.STANDARD_CREDIT : specialCredits + rentCredit);
      var used = Math.min(credits, tax);
      return {
        standard: useStandard,
        earnedCredit: earned,
        specialCredits: useStandard ? 0 : specialCredits,
        rentCredit: useStandard ? 0 : rentCredit,
        healthDeduction: healthDed,
        taxableBase: base,
        calculatedTax: tax,
        totalCredits: credits,
        usedCredits: used,
        determinedTax: tax - used
      };
    }

    var best = makeVariant(false);
    if (specialAndRent < C.STANDARD_CREDIT) {
      var alt = makeVariant(true);
      if (alt.determinedTax < best.determinedTax) best = alt;
    }

    var localTax = Math.floor(best.determinedTax * C.LOCAL_RATE);
    var refund = prepaid - best.determinedTax;

    return {
      gross: gross,
      prepaid: prepaid,
      earnedDeduction: earnedDeduction,
      earnedIncome: earnedIncome,
      personal: {
        basicCount: basicCount,
        basic: basic,
        senior: senior,
        disabled: disabled,
        singleParent: singleParent,
        total: personal
      },
      pensionDeduction: pensionDeduction,
      healthDeduction: best.healthDeduction,
      healthBreakdown: hi,
      card: card,
      cardDeductionApplied: cardDeductionApplied,
      taxableBase: best.taxableBase,
      calculatedTax: best.calculatedTax,
      credits: {
        earnedIncome: best.earnedCredit,
        child: childCredit,
        pension: pensionCredit,
        insurance: best.standard ? 0 : insuranceCredit,
        medical: best.standard ? 0 : medicalCredit,
        education: best.standard ? 0 : educationCredit,
        donation: best.standard ? 0 : donationCredit,
        rent: best.standard ? 0 : rentCredit,
        standard: best.standard ? C.STANDARD_CREDIT : 0,
        specialTotal: best.specialCredits,
        total: best.totalCredits,
        used: best.usedCredits
      },
      bases: {
        medical: medBase,
        medicalThreshold: medThreshold,
        medicalGeneral: medGeneral,
        medicalUnlimited: medUnlimited,
        education: educationBase,
        educationSchool: eduSchoolBase,
        educationCollege: eduCollegeBase,
        donation: donationBase,
        insurance: insuranceBase,
        rent: rentBase,
        rentRate: rentRate
      },
      standardCreditApplied: best.standard,
      healthDeductionIfSpecial: healthDeduction,
      determinedTax: best.determinedTax,
      localTax: localTax,
      refund: refund,
      refundWithLocal: Math.floor(refund * (1 + C.LOCAL_RATE)),
      marginalRate: marginalRate(best.taxableBase)
    };
  }

  /* ------------------------------------------------------------------ *
   * 부부 시나리오
   * ------------------------------------------------------------------ */
  function childAge(child, year) {
    var by = Number(child && child.birthYear);
    if (!isFinite(by) || by < 1900) return 99;
    return (year || 2026) - by;
  }
  function isBasicChild(child) {          // 기본공제 대상: 20세 이하
    return childAge(child) <= 20;
  }
  function isChildCreditChild(child) {    // 자녀세액공제: 2026년 9세 이상, 2017년생 제외
    var by = Number(child.birthYear);
    return childAge(child) <= 20 && by <= 2016;
  }
  function isCardChild(child) {           // 카드 한도 가산: 20세 이하
    return childAge(child) <= 20;
  }

  function normalizeHousehold(h) {
    h = h || {};
    var husband = h.husband || {};
    var wife = h.wife || {};
    return {
      mode: h.mode === "single" ? "single" : "couple",
      year: 2026,
      husband: {
        gross: num(husband.gross),
        prepaid: num(husband.prepaid),
        pension: num(husband.pension),
        insurance: num(husband.insurance),
        card: {
          credit: num(husband.card && husband.card.credit),
          check: num(husband.card && husband.card.check),
          traditional: num(husband.card && husband.card.traditional),
          transit: num(husband.card && husband.card.transit),
          culture: num(husband.card && husband.card.culture)
        }
      },
      wife: {
        gross: num(wife.gross),
        prepaid: num(wife.prepaid),
        pension: num(wife.pension),
        insurance: num(wife.insurance),
        card: {
          credit: num(wife.card && wife.card.credit),
          check: num(wife.card && wife.card.check),
          traditional: num(wife.card && wife.card.traditional),
          transit: num(wife.card && wife.card.transit),
          culture: num(wife.card && wife.card.culture)
        }
      },
      children: (h.children || []).map(function (c) {
        return {
          birthYear: Number(c.birthYear) || 2016,
          school: ["preschool", "school", "college", "none"].indexOf(c.school) >= 0 ? c.school : "school"
        };
      }),
      parents: {
        count: num(h.parents && h.parents.count),
        seniors: num(h.parents && h.parents.seniors),
        disabled: num(h.parents && h.parents.disabled)
      },
      childCard: num(h.childCard),
      medical: {
        general: num(h.medical && h.medical.general),
        unlimited: num(h.medical && h.medical.unlimited)
      },
      education: {
        school: num(h.education && h.education.school),
        college: num(h.education && h.education.college)
      },
      donation: num(h.donation),
      rent: num(h.rent),
      spouseDependent: !!h.spouseDependent,
      singleParent: !!h.singleParent,
      autoInsurance: h.autoInsurance !== false
    };
  }

  function allocateHousehold(h) {
    var alloc = {
      childOwner: h.children.map(function () { return 0; }),
      parentOwner: 0,
      medicalShareH: 1,
      donationOwner: 0,
      rentOwner: 0
    };
    return alloc;
  }

  function personInputs(h, which, alloc) {
    var person = which === 0 ? h.husband : h.wife;
    var myChildren = [];
    h.children.forEach(function (c, i) { if (alloc.childOwner[i] === which) myChildren.push(c); });
    var totalChildren = h.children.length || 0;
    var share = which === 0 ? alloc.medicalShareH : (1 - alloc.medicalShareH);
    // 교육비는 기본공제 대상(20세 이하) 자녀 몫만 인정됩니다.
    var schoolAll = h.children.filter(function (c) { return isBasicChild(c) && (c.school === "school" || c.school === "preschool"); }).length;
    var collegeAll = h.children.filter(function (c) { return isBasicChild(c) && c.school === "college"; }).length;
    var mySchool = myChildren.filter(function (c) { return isBasicChild(c) && (c.school === "school" || c.school === "preschool"); }).length;
    var myCollege = myChildren.filter(function (c) { return isBasicChild(c) && c.school === "college"; }).length;
    var eduSchoolShare = schoolAll > 0 ? h.education.school * (mySchool / schoolAll) : 0;
    var eduCollegeShare = collegeAll > 0 ? h.education.college * (myCollege / collegeAll) : 0;
    var childCardShare = totalChildren > 0 ? h.childCard * (myChildren.length / totalChildren) : 0;

    return {
      gross: person.gross,
      prepaid: person.prepaid,
      pensionPaid: person.pension,
      insurancePaid: person.insurance,
      card: {
        credit: person.card.credit,
        check: person.card.check + childCardShare,
        traditional: person.card.traditional,
        transit: person.card.transit,
        culture: person.card.culture
      },
      cardChildCount: myChildren.filter(isCardChild).length,
      children: myChildren.filter(isBasicChild),
      childCreditCount: myChildren.filter(isChildCreditChild).length,
      parents: alloc.parentOwner === which ? h.parents : { count: 0, seniors: 0, disabled: 0 },
      spouseDependent: h.mode === "single" && h.spouseDependent,
      singleParent: h.singleParent && (h.mode === "single" ? which === 0 : false),
      medical: {
        general: h.medical.general * share,
        unlimited: h.medical.unlimited * share
      },
      education: { school: eduSchoolShare, college: eduCollegeShare },
      schoolChildCount: mySchool,
      collegeChildCount: myCollege,
      donation: alloc.donationOwner === which ? h.donation : 0,
      rent: alloc.rentOwner === which ? h.rent : 0,
      autoInsurance: h.autoInsurance
    };
  }

  function computeScenario(h, alloc) {
    var husband = computePerson(personInputs(h, 0, alloc));
    var wife = h.mode === "single" ? null : computePerson(personInputs(h, 1, alloc));
    var total = {
      determinedTax: husband.determinedTax + (wife ? wife.determinedTax : 0),
      prepaid: husband.prepaid + (wife ? wife.prepaid : 0),
      localTax: husband.localTax + (wife ? wife.localTax : 0),
      healthDeduction: husband.healthDeduction + (wife ? wife.healthDeduction : 0)
    };
    total.refund = total.prepaid - total.determinedTax;
    total.refundWithLocal = Math.floor(total.refund * (1 + C.LOCAL_RATE));
    return { husband: husband, wife: wife, total: total, alloc: alloc };
  }

  function allToOne(h, which) {
    return {
      childOwner: h.children.map(function () { return which; }),
      parentOwner: which,
      medicalShareH: which === 0 ? 1 : 0,
      donationOwner: which,
      rentOwner: which
    };
  }

  function better(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (a.total.determinedTax !== b.total.determinedTax) {
      return a.total.determinedTax < b.total.determinedTax ? a : b;
    }
    // 세액이 같으면 더 단순한 배분(몰아주기)을 선호
    var pa = simplicity(a.alloc), pb = simplicity(b.alloc);
    if (pa !== pb) return pa < pb ? a : b;
    return a.total.refund >= b.total.refund ? a : b;
  }

  function simplicity(alloc) {
    var score = 0;
    // 의료비는 한 사람에게 몰아주는 쪽(0 또는 1)을 선호
    score += Math.min(alloc.medicalShareH, 1 - alloc.medicalShareH) * 1000;
    var owners = {};
    alloc.childOwner.forEach(function (o) { owners[o] = true; });
    if (Object.keys(owners).length > 1) score += 100;
    return score;
  }

  function optimize(h) {
    var n = h.children.length;
    var parentChoices = h.parents.count > 0 ? [0, 1] : [0];
    var rentChoices = h.rent > 0 ? [0, 1] : [0];
    var donationChoices = h.donation > 0 ? [0, 1] : [0];
    var best = null;
    var masks = Math.pow(2, n);

    for (var mask = 0; mask < masks; mask++) {
      var childOwner = [];
      for (var i = 0; i < n; i++) childOwner.push((mask >> i) & 1);
      for (var pi = 0; pi < parentChoices.length; pi++) {
        for (var di = 0; di < donationChoices.length; di++) {
          for (var ri = 0; ri < rentChoices.length; ri++) {
            for (var step = 0; step <= 20; step++) {
              var alloc = {
                childOwner: childOwner,
                parentOwner: parentChoices[pi],
                medicalShareH: step / 20,
                donationOwner: donationChoices[di],
                rentOwner: rentChoices[ri]
              };
              best = better(best, computeScenario(h, alloc));
            }
          }
        }
      }
    }

    // 의료비 배분을 1% 단위로 한 번 더 다듬기
    if (h.medical.general + h.medical.unlimited > 0) {
      var baseShare = best.alloc.medicalShareH;
      for (var s = Math.max(0, baseShare - 0.1); s <= Math.min(1, baseShare + 0.1) + 1e-9; s += 0.01) {
        var candidate = {
          childOwner: best.alloc.childOwner.slice(),
          parentOwner: best.alloc.parentOwner,
          medicalShareH: Math.round(s * 100) / 100,
          donationOwner: best.alloc.donationOwner,
          rentOwner: best.alloc.rentOwner
        };
        best = better(best, computeScenario(h, candidate));
      }
    }
    return best;
  }

  /* ------------------------------------------------------------------ *
   * 전체 실행
   * ------------------------------------------------------------------ */
  function run(rawHousehold) {
    var h = normalizeHousehold(rawHousehold);
    var husbandAll, wifeAll, optimal;

    if (h.mode === "single") {
      var allocSingle = allocateHousehold(h);
      var single = computeScenario(h, allocSingle);
      return {
        household: h,
        scenario: single,
        single: true
      };
    }

    husbandAll = computeScenario(h, allToOne(h, 0));
    wifeAll = computeScenario(h, allToOne(h, 1));
    optimal = optimize(h);

    var bestSingle = husbandAll.total.determinedTax <= wifeAll.total.determinedTax ? husbandAll : wifeAll;

    return {
      household: h,
      single: false,
      husbandAll: husbandAll,
      wifeAll: wifeAll,
      optimal: optimal,
      bestSingle: bestSingle,
      savingsVsHusbandAll: husbandAll.total.determinedTax - optimal.total.determinedTax,
      savingsVsWifeAll: wifeAll.total.determinedTax - optimal.total.determinedTax,
      savingsVsBestSingle: bestSingle.total.determinedTax - optimal.total.determinedTax,
      savingsRefundVsHusbandAll: optimal.total.refund - husbandAll.total.refund,
      savingsRefundVsWifeAll: optimal.total.refund - wifeAll.total.refund
    };
  }

  return {
    C: C,
    TAX_BRACKETS: TAX_BRACKETS,
    earnedIncomeDeduction: earnedIncomeDeduction,
    taxOnBase: taxOnBase,
    earnedIncomeTaxCredit: earnedIncomeTaxCredit,
    childTaxCredit: childTaxCredit,
    cardDeduction: cardDeduction,
    nationalPension: nationalPension,
    healthInsurance: healthInsurance,
    computePerson: computePerson,
    computeScenario: computeScenario,
    optimize: optimize,
    run: run,
    normalizeHousehold: normalizeHousehold,
    childAge: childAge,
    isBasicChild: isBasicChild,
    isChildCreditChild: isChildCreditChild
  };
});
