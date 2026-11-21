/* 계산 엔진 자체 검증 — 2026년 귀속
 * 1) 국세청·공개 계산 사례(외부 출처)와 대조
 * 2) 손으로 검산한 맞벌이 배분 시나리오
 * 3) 개별 공제 산식(카드 한도, 자녀세액공제, 표준세액공제 등)
 * 4) P0 회귀: 연금저축 600만 / IRP 합산 900만 한도, 장애 자녀 추가공제, 월세 무주택 요건
 * 4-1) P1 회귀: 주택자금 3종·종합한도, 산후조리원, 부녀자, 중소기업 감면, 맞벌이 월세 각자, 문화체육 전환
 * 5) 무작위 50가구 교차검증(최적 분할이 몰아주기보다 나쁘지 않아야 함)
 */
(function () {
  "use strict";

  var rows = [];
  var pass = 0, fail = 0;

  function fmt(n) {
    if (n === null || n === undefined) return "-";
    if (typeof n === "number") return n.toLocaleString("ko-KR");
    return String(n);
  }
  function check(name, expected, actual, note) {
    var ok = expected === actual;
    if (ok) pass++; else fail++;
    rows.push({ name: name, expected: fmt(expected), actual: fmt(actual), ok: ok, note: note || "" });
  }
  function checkTrue(name, actual, note) {
    check(name, true, !!actual, note);
  }

  function single(overrides) {
    var h = {
      mode: "single",
      husband: Object.assign({
        gross: 0, prepaid: 0, pension: 0, irp: 0, insurance: 0,
        card: { credit: 0, check: 0, traditional: 0, transit: 0, culture: 0 }
      }, overrides && overrides.husband),
      children: (overrides && overrides.children) || [],
      parents: (overrides && overrides.parents) || { count: 0, seniors: 0, disabled: 0 },
      childCard: (overrides && overrides.childCard) || 0,
      dependentCard: (overrides && overrides.dependentCard) || { credit: 0, check: 0, traditional: 0, transit: 0 },
      medical: (overrides && overrides.medical) || { general: 0, unlimited: 0 },
      education: (overrides && overrides.education) || { school: 0, college: 0 },
      donation: (overrides && overrides.donation) || 0,
      rent: (overrides && overrides.rent) || 0,
      rentW: (overrides && overrides.rentW) || 0,
      postpartum: (overrides && overrides.postpartum) || 0,
      births: (overrides && overrides.births) || 1,
      housing: (overrides && overrides.housing) || null,
      womanDeduction: !!(overrides && overrides.womanDeduction),
      rentEligible: !!(overrides && overrides.rentEligible),
      spouseDependent: !!(overrides && overrides.spouseDependent),
      singleParent: !!(overrides && overrides.singleParent),
      autoInsurance: !(overrides && overrides.autoInsurance === false)
    };
    return YECalc.run(h);
  }

  /* ---------------------------------------------------------------
   * 1. 외부 공개 계산 사례 (4대보험만 반영한 1인 가구)
   * --------------------------------------------------------------- */
  var std30 = single({ husband: { gross: 30000000 } }).scenario.husband;
  check("총급여 3,000만 · 표준세액공제 적용", true, std30.standardCreditApplied);
  check("총급여 3,000만 · 과세표준(표준 적용)", 17325000, std30.taxableBase);
  check("총급여 3,000만 · 결정세액(표준 적용)", 482125, std30.determinedTax, "외부 사례와 일치");

  var g30 = single({ husband: { gross: 30000000 }, donation: 1000000 }).scenario.husband;
  check("총급여 3,000만 · 과세표준", 15834792, g30.taxableBase, "외부 사례 대조");
  check("총급여 3,000만 · 산출세액", 1115218, g30.calculatedTax);
  check("총급여 3,000만 · 근로소득세액공제", 613369, g30.credits.earnedIncome);
  check("총급여 3,000만 · 결정세액(기부금 반영)", 351849, g30.determinedTax);

  var g50 = single({ husband: { gross: 50000000 } }).scenario.husband;
  check("총급여 5,000만 · 과세표준", 31391344, g50.taxableBase);
  check("총급여 5,000만 · 산출세액", 3448701, g50.calculatedTax);
  check("총급여 5,000만 · 결정세액", 2788701, g50.determinedTax);

  var g70 = single({ husband: { gross: 70000000 } }).scenario.husband;
  check("총급여 7,000만 · 과세표준", 48447860, g70.taxableBase);
  check("총급여 7,000만 · 산출세액", 6007179, g70.calculatedTax);
  check("총급여 7,000만 · 결정세액", 5347179, g70.determinedTax);

  var g100 = single({ husband: { gross: 100000000 } }).scenario.husband;
  check("총급여 1억 · 과세표준", 75089036, g100.taxableBase);
  check("총급여 1억 · 산출세액", 12261368, g100.calculatedTax);
  check("총급여 1억 · 근로소득세액공제", 500000, g100.credits.earnedIncome);
  check("총급여 1억 · 결정세액", 11761368, g100.determinedTax);

  var bCase = single({
    husband: {
      gross: 50000000,
      card: { credit: 15000000, check: 6000000, traditional: 0, transit: 600000, culture: 0 },
      pension: 3000000,
      insurance: 600000
    }
  }).scenario.husband;
  check("5,000만 + 카드·연금·보험 · 신용카드 소득공제", 2415000, bCase.cardDeductionApplied, "외부 사례 대조");
  check("5,000만 + 카드·연금·보험 · 과세표준", 28976344, bCase.taxableBase);
  check("5,000만 + 카드·연금·보험 · 산출세액", 3086451, bCase.calculatedTax);
  check("5,000만 + 카드·연금·보험 · 결정세액", 1904451, bCase.determinedTax);

  var cCase = single({
    husband: {
      gross: 50000000,
      card: { credit: 15000000, check: 6000000, traditional: 0, transit: 600000, culture: 0 },
      pension: 3000000,
      insurance: 600000
    },
    children: [{ birthYear: 2016, school: "school" }]
  }).scenario.husband;
  check("5,000만 + 자녀 1명 · 과세표준", 27476344, cCase.taxableBase);
  check("5,000만 + 자녀 1명 · 자녀세액공제", 250000, cCase.credits.child);
  check("5,000만 + 자녀 1명 · 결정세액", 1429451, cCase.determinedTax);

  /* ---------------------------------------------------------------
   * 2. 맞벌이 배분 손검산
   * --------------------------------------------------------------- */
  function couple(h, w, extras) {
    extras = extras || {};
    return YECalc.run(Object.assign({
      mode: "couple",
      husband: Object.assign({ gross: h, prepaid: 0, pension: 0, irp: 0, insurance: 0, card: {} }, extras.husband || {}),
      wife: Object.assign({ gross: w, prepaid: 0, pension: 0, irp: 0, insurance: 0, card: {} }, extras.wife || {}),
      children: extras.children || [],
      parents: extras.parents || { count: 0, seniors: 0, disabled: 0 },
      childCard: extras.childCard || 0,
      medical: extras.medical || { general: 0, unlimited: 0 },
      education: extras.education || { school: 0, college: 0 },
      donation: extras.donation || 0,
      rent: extras.rent || 0,
      rentW: extras.rentW || 0,
      postpartum: extras.postpartum || 0,
      births: extras.births || 1,
      housing: extras.housing || null,
      rentEligible: !!extras.rentEligible
    }, {}));
  }

  var p1 = couple(60000000, 30000000, {
    children: [{ birthYear: 2012, school: "school" }, { birthYear: 2015, school: "school" }]
  });
  check("맞벌이 손검산 · 남편 몰아주기 결정세액 합", 3550060, p1.husbandAll.total.determinedTax);
  check("맞벌이 손검산 · 아내 몰아주기 결정세액 합", 4067935, p1.wifeAll.total.determinedTax);
  check("맞벌이 손검산 · 최적 분할 결정세액 합", 3550060, p1.optimal.total.determinedTax);
  checkTrue("맞벌이 손검산 · 최적해가 최소", p1.optimal.total.determinedTax <= Math.min(p1.husbandAll.total.determinedTax, p1.wifeAll.total.determinedTax));

  var p2 = couple(60000000, 30000000, { medical: { general: 3000000, unlimited: 0 } });
  check("의료비 300만 · 남편 몰아주기 세액", 4370060, p2.husbandAll.total.determinedTax, "남편 18만 + 아내 표준세액공제");
  check("의료비 300만 · 아내 몰아주기 세액", 4254784, p2.wifeAll.total.determinedTax, "문턱 차이 90만×15%=13.5만");
  check("의료비 300만 · 최적 분할 세액", 4254784, p2.optimal.total.determinedTax);
  check("의료비 300만 · 최적 배분은 아내", 0, p2.optimal.alloc.medicalShareH);

  /* ---------------------------------------------------------------
   * 3. 개별 산식
   * --------------------------------------------------------------- */
  var cardNoChild = single({
    husband: { gross: 60000000, card: { credit: 40000000, check: 0, traditional: 0, transit: 0, culture: 0 } }
  }).scenario.husband;
  check("카드 한도 · 자녀 0명(300만원)", 3000000, cardNoChild.cardDeductionApplied);

  var cardTwoChild = single({
    husband: { gross: 60000000, card: { credit: 40000000, check: 0, traditional: 0, transit: 0, culture: 0 } },
    children: [{ birthYear: 2012, school: "school" }, { birthYear: 2015, school: "school" }]
  }).scenario.husband;
  check("카드 한도 · 자녀 2명(400만원)", 3750000, cardTwoChild.cardDeductionApplied);

  var cardWiki = single({
    husband: {
      gross: 60000000,
      card: { credit: 35000000, check: 5000000, traditional: 2500000, transit: 1500000, culture: 0 }
    },
    children: [{ birthYear: 2012, school: "school" }, { birthYear: 2015, school: "school" }]
  }).scenario.husband;
  check("카드 계산 · 외부 예시(560만원)", 5600000, cardWiki.cardDeductionApplied, "기본한도 400 + 추가 160");

  var cardExtra = single({
    husband: {
      gross: 60000000,
      card: { credit: 35000000, check: 5000000, traditional: 2500000, transit: 1500000, culture: 0 }
    }
  }).scenario.husband;
  check("카드 추가한도 · 자녀 0명(기본 300 + 추가 160)", 4600000, cardExtra.cardDeductionApplied);

  var ageCase = single({
    husband: { gross: 60000000 },
    children: [
      { birthYear: 2016, school: "school" },
      { birthYear: 2017, school: "school" },
      { birthYear: 2018, school: "school" }
    ]
  }).scenario.husband;
  check("자녀세액공제 · 2016년생만 인정(25만원)", 250000, ageCase.credits.child, "2017년생 제외");
  check("자녀 기본공제 · 3명 + 본인 = 4명", 6000000, ageCase.personal.basic);

  var adultChild = single({
    husband: { gross: 60000000 },
    children: [{ birthYear: 2005, school: "college" }],
    education: { school: 0, college: 9000000 }
  }).scenario.husband;
  check("20세 초과 자녀 · 기본공제 제외", 1500000, adultChild.personal.basic);
  check("20세 초과 자녀 · 자녀세액공제 제외", 0, adultChild.credits.child);
  check("20세 초과 자녀 · 교육비 공제 제외", 0, adultChild.credits.education);

  var parentsCase = single({
    husband: { gross: 60000000 },
    parents: { count: 1, seniors: 1, disabled: 1 }
  }).scenario.husband;
  check("부모님 1명(70세 이상·장애인) 인적공제", 6000000, parentsCase.personal.total, "150+150+100+200만");

  var limit33 = single({ husband: { gross: 33000000 } }).scenario.husband;
  check("근로소득세액공제 한도 · 3,300만원", 740000, limit33.credits.earnedIncome);
  var limit40 = single({ husband: { gross: 40000000 } }).scenario.husband;
  check("근로소득세액공제 한도 · 4,000만원", 684000, limit40.credits.earnedIncome);
  var limit80 = single({ husband: { gross: 80000000 } }).scenario.husband;
  check("근로소득세액공제 한도 · 8,000만원", 500000, limit80.credits.earnedIncome);
  var limit130 = single({ husband: { gross: 130000000 } }).scenario.husband;
  check("근로소득세액공제 한도 · 1억3,000만원", 200000, limit130.credits.earnedIncome);

  var stdCase = single({ husband: { gross: 15000000 } }).scenario.husband;
  check("표준세액공제 · 적용 여부", true, stdCase.standardCreditApplied);
  check("표준세액공제 · 결정세액", 12763, stdCase.determinedTax, "보험료 공제 포기하고 13만원");

  var medCap = single({
    husband: { gross: 50000000 },
    medical: { general: 10000000, unlimited: 0 }
  }).scenario.husband;
  check("의료비 · 일반 700만원 한도", 825000, medCap.credits.medical, "(700만−150만)×15%");

  var medUnlimited = single({
    husband: { gross: 50000000 },
    medical: { general: 0, unlimited: 10000000 }
  }).scenario.husband;
  check("의료비 · 본인 등 한도 없음", 1275000, medUnlimited.credits.medical, "(1,000만−150만)×15%");

  var rentCase = single({ husband: { gross: 50000000 }, rent: 12000000, rentEligible: true }).scenario.husband;
  check("월세 세액공제 · 17%·1,000만 한도", 1700000, rentCase.credits.rent);

  var rentHigh = single({ husband: { gross: 60000000 }, rent: 12000000, rentEligible: true }).scenario.husband;
  check("월세 세액공제 · 15%", 1500000, rentHigh.credits.rent);

  var donationCase = single({ husband: { gross: 50000000 }, donation: 15000000 }).scenario.husband;
  check("기부금 · 1,000만 초과분 30%", 3000000, donationCase.credits.donation);

  var spouseCase = single({ husband: { gross: 50000000 }, spouseDependent: true }).scenario.husband;
  var spouseOff = single({ husband: { gross: 50000000 }, spouseDependent: false }).scenario.husband;
  check("단독 모드 · 소득 없는 배우자 기본공제", 3000000, spouseCase.personal.basic);
  check("배우자 공제 체크 전 기본공제 인원(본인만)", 1, spouseOff.personal.basicCount);
  check("배우자 공제 체크 후 기본공제 인원(본인+배우자)", 2, spouseCase.personal.basicCount);
  check("배우자 공제 정확히 +150만원", 1500000, spouseCase.personal.total - spouseOff.personal.total);
  check("배우자 공제 과세표준 150만원 감소", 1500000, spouseOff.taxableBase - spouseCase.taxableBase);
  check("배우자 공제 결정세액 225,000원 감소(15% 구간)", 225000, spouseOff.determinedTax - spouseCase.determinedTax);
  checkTrue("배우자 공제는 인적공제 한도(근로소득금액) 내", spouseCase.personal.total <= 3000000);

  var spouseKids = single({
    husband: { gross: 50000000 },
    spouseDependent: true,
    children: [{ birthYear: 2012, school: "school" }, { birthYear: 2015, school: "school" }]
  }).scenario.husband;
  check("배우자+자녀 2명 기본공제 인원", 4, spouseKids.personal.basicCount);
  check("배우자+자녀 2명 기본공제액", 6000000, spouseKids.personal.basic);

  /* ---------------------------------------------------------------
   * 3-1. 1인 · 외벌이: 배우자·부양가족 카드 사용액 합산
   * --------------------------------------------------------------- */
  var famBelow = single({
    husband: { gross: 40000000, card: { credit: 9000000 } }
  }).scenario.husband;
  var famAbove = single({
    husband: { gross: 40000000, card: { credit: 9000000 } },
    dependentCard: { credit: 2000000 }
  }).scenario.husband;
  check("가족카드 없음 · 문턱 미달로 카드 공제 0원", 0, famBelow.card.deduction);
  check("가족카드 합산 · 카드 사용액 1,100만원", 11000000, famAbove.card.total);
  check("가족카드 합산 · 문턱 넘긴 100만원×15%", 150000, famAbove.card.deduction, "(1,100만−1,000만)×15%");
  check("가족카드 합산 · 결정세액 22,500원 감소", 22500,
    famBelow.determinedTax - famAbove.determinedTax, "공제 15만원의 15%");
  check("가족카드 합산 · 출력에 합산액 기록", 2000000, famAbove.cardFamily);

  var famSplit = single({
    husband: { gross: 60000000, card: { credit: 10000000, check: 2000000 } },
    dependentCard: { credit: 8000000, check: 3000000, traditional: 1000000, transit: 1000000 }
  }).scenario.husband;
  var famOwn = single({
    husband: { gross: 60000000, card: { credit: 18000000, check: 5000000, traditional: 1000000, transit: 1000000 } }
  }).scenario.husband;
  check("가족카드 합산 = 본인 카드에 더한 값 · 사용액", 25000000, famSplit.card.total);
  check("가족카드 합산 = 본인 카드에 더한 값 · 소득공제", famOwn.card.deduction, famSplit.card.deduction);
  check("가족카드 합산 = 본인 카드에 더한 값 · 결정세액", famOwn.determinedTax, famSplit.determinedTax);

  var famCap = single({
    husband: { gross: 50000000, card: { credit: 0 } },
    dependentCard: { credit: 20000000 }
  }).scenario.husband;
  check("가족카드 합산 · 기본한도 300만원", 1125000, famCap.card.deduction, "(2,000만−1,250만)×15%는 112.5만");
  var famChild = single({
    husband: { gross: 60000000, card: { credit: 40000000 } },
    children: [{ birthYear: 2012, school: "school" }],
    dependentCard: { check: 5000000 }
  }).scenario.husband;
  check("가족카드 합산 · 자녀 1명 기본한도 350만원", 3500000, famChild.card.deduction);

  var famSpecial = single({
    husband: { gross: 60000000, card: { credit: 20000000 } },
    dependentCard: { traditional: 10000000, transit: 5000000 }
  }).scenario.husband;
  check("가족카드 합산 · 전통시장·대중교통 추가한도", 6000000, famSpecial.card.deduction,
    "기본 300만 + 추가 300만(특별 600만 한도 내)");

  var coupleFam = YECalc.run({
    mode: "couple",
    husband: { gross: 50000000, card: { credit: 10000000 } },
    wife: { gross: 30000000 },
    children: [], parents: { count: 0 },
    dependentCard: { credit: 9000000 },
    autoInsurance: true, medical: {}, education: {}, donation: 0, rent: 0, childCard: 0
  });
  check("맞벌이 · 가족카드 입력은 합산하지 않음", 10000000, coupleFam.husbandAll.husband.card.total);
  check("맞벌이 · 가족카드 합산액 0원", 0, coupleFam.husbandAll.husband.cardFamily);

  var coupleIgnore = YECalc.run({
    mode: "couple", husband: { gross: 50000000 }, wife: { gross: 30000000 },
    children: [], parents: { count: 0 }, spouseDependent: true,
    autoInsurance: true, medical: {}, education: {}, donation: 0, rent: 0, childCard: 0
  }).husbandAll.husband;
  check("맞벌이 모드에서는 배우자 공제 무시", 1500000, coupleIgnore.personal.basic);

  /* ---------------------------------------------------------------
   * 4. P0 회귀 — 연금저축 600만 / IRP 합산 900만 한도
   * --------------------------------------------------------------- */
  var penSaving = single({ husband: { gross: 50000000, pension: 6000000, irp: 3000000 } }).scenario.husband;
  check("연금저축 600만 + IRP 300만 · 15%", 1350000, penSaving.credits.pension, "합산 900만까지 인정");
  check("연금저축 600만 + IRP 300만 · 인정액", 9000000, penSaving.bases.pension.total);

  var penOnly = single({ husband: { gross: 50000000, pension: 12000000 } }).scenario.husband;
  check("연금저축만 1,200만 · 600만만 인정", 6000000, penOnly.bases.pension.savings, "P0: 600만 한도");
  check("연금저축만 1,200만 · 세액공제 90만", 900000, penOnly.credits.pension, "300만×15%=45만 과대 방지");
  check("연금저축만 1,200만 · IRP 인정 0", 0, penOnly.bases.pension.irp);

  var irpOnly = single({ husband: { gross: 50000000, pension: 0, irp: 12000000 } }).scenario.husband;
  check("IRP만 1,200만 · 900만 인정", 9000000, irpOnly.bases.pension.total);
  check("IRP만 1,200만 · 세액공제 135만", 1350000, irpOnly.credits.pension);

  var penBoth = single({ husband: { gross: 50000000, pension: 6000000, irp: 6000000 } }).scenario.husband;
  check("연금저축 600만 + IRP 600만 · 합산 900만 한도", 9000000, penBoth.bases.pension.total);
  check("연금저축 600만 + IRP 600만 · 세액공제 135만", 1350000, penBoth.credits.pension);

  var penHigh = single({ husband: { gross: 60000000, pension: 6000000, irp: 3000000 } }).scenario.husband;
  check("총급여 6,000만 · 연금계좌 12%", 1080000, penHigh.credits.pension);
  check("총급여 6,000만 · 적용 공제율", 0.12, penHigh.bases.pensionRate);

  /* ---------------------------------------------------------------
   * 5. P0 회귀 — 장애 자녀 추가공제
   * --------------------------------------------------------------- */
  var disChild = single({
    husband: { gross: 60000000 },
    children: [{ birthYear: 2015, school: "school", disabled: true }]
  }).scenario.husband;
  var noDisChild = single({
    husband: { gross: 60000000 },
    children: [{ birthYear: 2015, school: "school", disabled: false }]
  }).scenario.husband;
  check("장애 자녀 · 기본공제 인원은 그대로(본인+자녀)", 3000000, disChild.personal.basic);
  check("장애 자녀 · 장애인 추가공제 200만원", 2000000, disChild.personal.disabled);
  check("장애 자녀 · 인적공제 합계 500만원", 5000000, disChild.personal.total);
  check("장애 자녀 · 장애인 자녀 수 1명", 1, disChild.personal.disabledChildren);
  check("장애 자녀 · 과세표준 200만원 감소", 2000000, noDisChild.taxableBase - disChild.taxableBase);
  check("장애 자녀 · 결정세액 30만원 감소(15% 구간)", 300000, noDisChild.determinedTax - disChild.determinedTax);

  var disMix = single({
    husband: { gross: 60000000 },
    children: [
      { birthYear: 2013, school: "school", disabled: true },
      { birthYear: 2016, school: "school", disabled: true }
    ],
    parents: { count: 1, seniors: 0, disabled: 1 }
  }).scenario.husband;
  check("장애 자녀 2명 + 장애 부모 1명 · 장애인 공제 600만", 6000000, disMix.personal.disabled);
  check("장애 추가공제 · 인적공제에 합산(본인+자녀2+부모1)", 12000000, disMix.personal.total, "기본 600만 + 장애 600만");
  check("자녀 장애는 부모님이 없어도 계산", 2, disMix.personal.disabledChildren);

  /* ---------------------------------------------------------------
   * 6. P0 회귀 — 월세 무주택 세대주 요건
   * --------------------------------------------------------------- */
  var rentNo = single({ husband: { gross: 50000000 }, rent: 12000000, rentEligible: false }).scenario.husband;
  check("월세 · 요건 미체크면 세액공제 0", 0, rentNo.credits.rent);
  check("월세 · 요건 미체크면 공제대상 0", 0, rentNo.bases.rent);
  var rentYes = single({ husband: { gross: 50000000 }, rent: 12000000, rentEligible: true }).scenario.husband;
  check("월세 · 요건 체크하면 17% 공제", 1700000, rentYes.credits.rent);
  check("월세 · 요건 체크 표시", true, rentYes.bases.rentEligible);

  var rentCouple = couple(60000000, 30000000, { rent: 8000000, rentEligible: false });
  check("맞벌이 · 월세 요건 미체크면 양쪽 모두 0",
    0, rentCouple.optimal.husband.credits.rent + rentCouple.optimal.wife.credits.rent);

  /* ---------------------------------------------------------------
   * 4-1. P1 회귀 — 주택자금·산후조리원·부녀자·중소기업·맞벌이 월세·문화체육
   * --------------------------------------------------------------- */
  function housing(over) {
    return Object.assign({ eligible: true, savings: 0, rentLoan: 0, mortgageInterest: 0, mortgageType: "none", owner: 0 }, over || {});
  }

  var hSave = single({ husband: { gross: 50000000 }, housing: housing({ savings: 3000000 }) }).scenario.husband;
  check("P1 주택청약 · 300만원 납입 40%", 1200000, hSave.housing.total);
  check("P1 주택청약 · 소득공제 반영액", 1200000, hSave.housingApplied);

  var hSaveOver = single({ husband: { gross: 80000000 }, housing: housing({ savings: 5000000 }) }).scenario.husband;
  check("P1 주택청약 · 총급여 8,000만은 공제 0", 0, hSaveOver.housing.savings);
  check("P1 주택청약 · 7,000만 초과에도 전세대출은 가능", 2000000,
    single({ husband: { gross: 80000000 }, housing: housing({ rentLoan: 5000000 }) }).scenario.husband.housing.total);

  var hBoth = single({ husband: { gross: 50000000 }, housing: housing({ savings: 3000000, rentLoan: 10000000 }) }).scenario.husband;
  check("P1 청약+전세대출 · 합산 400만원 한도", 4000000, hBoth.housing.total);
  check("P1 청약+전세대출 · 전세대출 몫", 2800000, hBoth.housing.rentLoan);

  var hMort = single({ husband: { gross: 60000000 }, housing: housing({ mortgageInterest: 25000000, mortgageType: "m15_fixed_nod" }) }).scenario.husband;
  check("P1 주담대 · 15년+고정+비거치 2,000만 한도", 20000000, hMort.housing.mortgage);
  check("P1 주담대 · 소득공제 반영액", 20000000, hMort.housingApplied);

  var hMort10 = single({ husband: { gross: 60000000 }, housing: housing({ mortgageInterest: 25000000, mortgageType: "m10_one" }) }).scenario.husband;
  check("P1 주담대 · 10~15년 하나 충족 600만 한도", 6000000, hMort10.housing.mortgage);

  var hMortNone = single({ husband: { gross: 60000000 }, housing: housing({ mortgageInterest: 25000000, mortgageType: "none" }) }).scenario.husband;
  check("P1 주담대 · 상환조건 미선택이면 0", 0, hMortNone.housing.mortgage);

  var hNoElig = single({ husband: { gross: 50000000 }, housing: housing({ savings: 3000000, eligible: false }) }).scenario.husband;
  check("P1 주택자금 · 세대주 요건 미체크면 0", 0, hNoElig.housingApplied);

  var hCap = single({
    husband: { gross: 60000000, card: { credit: 35000000, check: 5000000, traditional: 2500000, transit: 1500000 } },
    children: [{ birthYear: 2012, school: "school" }, { birthYear: 2015, school: "school" }],
    housing: housing({ mortgageInterest: 25000000, mortgageType: "m15_fixed_nod" })
  }).scenario.husband;
  check("P1 소득공제 종합한도 · 카드 560만 + 주택자금", 19400000, hCap.housingApplied, "2,500만 − 560만");
  check("P1 소득공제 종합한도 · 합계 2,500만", 25000000, hCap.cardDeductionApplied + hCap.housingApplied);

  var post1 = single({ husband: { gross: 50000000 }, postpartum: 3000000 }).scenario.husband;
  check("P1 산후조리원 · 1회 200만원 한도", 2000000, post1.bases.postpartum);
  check("P1 산후조리원 · 3% 문턱 차감", 500000, post1.bases.medical, "200만 − 150만");

  var post2 = single({ husband: { gross: 50000000 }, postpartum: 5000000, births: 2 }).scenario.husband;
  check("P1 산후조리원 · 출산 2회 400만원 한도", 4000000, post2.bases.postpartum);

  var womanOn = single({ husband: { gross: 30000000 }, womanDeduction: true }).scenario.husband;
  check("P1 부녀자 공제 · 종합소득 3,000만 이하 50만원", 500000, womanOn.personal.woman);
  var womanOff = single({ husband: { gross: 30000000 } }).scenario.husband;
  check("P1 부녀자 공제 · 체크 전과 차이 50만원", 500000, womanOn.personal.total - womanOff.personal.total);
  check("P1 부녀자 공제 · 종합소득 3,000만 초과면 0", 0,
    single({ husband: { gross: 50000000 }, womanDeduction: true }).scenario.husband.personal.woman);
  check("P1 부녀자 공제 · 한부모와 중복이면 부녀자 0", 0,
    single({ husband: { gross: 30000000 }, womanDeduction: true, singleParent: true }).scenario.husband.personal.woman);

  var smeYouth = single({ husband: { gross: 50000000, sme: "youth" } }).scenario.husband;
  check("P1 중소기업 청년 90% 감면 · 산출세액", 3448701, smeYouth.calculatedTax);
  check("P1 중소기업 청년 90% 감면 · 연 200만원 한도", 2000000, smeYouth.smeExemption);
  check("P1 중소기업 감면 후 세액", 1448701, smeYouth.taxAfterExemption);

  var smeOther = single({ husband: { gross: 30000000, sme: "other" } }).scenario.husband;
  check("P1 중소기업 고령·경력단절 70%", Math.floor(smeOther.calculatedTax * 0.7), smeOther.smeExemption);

  var rentEach = couple(50000000, 60000000, { rent: 8000000, rentW: 6000000, rentEligible: true });
  check("P1 맞벌이 월세 각자 · 남편 17%", 1360000, rentEach.optimal.husband.credits.rent);
  check("P1 맞벌이 월세 각자 · 아내 15%", 900000, rentEach.optimal.wife.credits.rent);
  var rentCap = couple(50000000, 60000000, { rent: 15000000, rentW: 15000000, rentEligible: true });
  check("P1 맞벌이 월세 각자 · 각 1,000만 한도", 1700000, rentCap.optimal.husband.credits.rent);

  var cultureOver = single({ husband: { gross: 80000000, card: { credit: 0, check: 0, traditional: 0, transit: 0, culture: 1000000 } } }).scenario.husband;
  check("P1 문화체육 · 7,000만 초과는 신용 15%로 전환", 1000000, cultureOver.card.cultureConverted);
  var cultureUnder = single({ husband: { gross: 60000000, card: { credit: 0, check: 0, traditional: 0, transit: 0, culture: 1000000 } } }).scenario.husband;
  check("P1 문화체육 · 7,000만 이하는 30% 유지", 0, cultureUnder.card.cultureConverted);
  check("P1 문화체육 · 30% 가중치", 300000, cultureUnder.card.weighted);

  /* ---------------------------------------------------------------
   * 7. 무작위 교차검증
   * --------------------------------------------------------------- */
  var seed = 20261122;
  function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }

  var worst = null;
  var badRent = null;
  for (var i = 0; i < 50; i++) {
    var kids = [];
    var kn = Math.floor(rnd() * 4);
    for (var k = 0; k < kn; k++) {
      kids.push({
        birthYear: 2008 + Math.floor(rnd() * 14),
        school: pick(["school", "school", "preschool", "college", "none"]),
        disabled: rnd() < 0.15
      });
    }
    var h = {
      mode: "couple",
      husband: {
        gross: Math.floor(rnd() * 90000000 / 100000) * 100000,
        prepaid: Math.floor(rnd() * 4000000 / 10000) * 10000,
        pension: Math.floor(rnd() * 12000000 / 10000) * 10000,
        irp: Math.floor(rnd() * 12000000 / 10000) * 10000,
        insurance: Math.floor(rnd() * 2000000 / 10000) * 10000,
        card: {
          credit: Math.floor(rnd() * 40000000 / 10000) * 10000,
          check: Math.floor(rnd() * 15000000 / 10000) * 10000,
          traditional: Math.floor(rnd() * 4000000 / 10000) * 10000,
          transit: Math.floor(rnd() * 3000000 / 10000) * 10000,
          culture: 0
        }
      },
      wife: {
        gross: Math.floor(rnd() * 90000000 / 100000) * 100000,
        prepaid: Math.floor(rnd() * 4000000 / 10000) * 10000,
        pension: Math.floor(rnd() * 12000000 / 10000) * 10000,
        irp: Math.floor(rnd() * 12000000 / 10000) * 10000,
        insurance: Math.floor(rnd() * 2000000 / 10000) * 10000,
        card: {
          credit: Math.floor(rnd() * 40000000 / 10000) * 10000,
          check: Math.floor(rnd() * 15000000 / 10000) * 10000,
          traditional: Math.floor(rnd() * 4000000 / 10000) * 10000,
          transit: Math.floor(rnd() * 3000000 / 10000) * 10000,
          culture: 0
        }
      },
      children: kids,
      parents: { count: Math.floor(rnd() * 3), seniors: 0, disabled: Math.floor(rnd() * 2) },
      childCard: Math.floor(rnd() * 3000000 / 10000) * 10000,
      medical: { general: Math.floor(rnd() * 15000000 / 10000) * 10000, unlimited: Math.floor(rnd() * 5000000 / 10000) * 10000 },
      education: { school: Math.floor(rnd() * 9000000 / 10000) * 10000, college: Math.floor(rnd() * 9000000 / 10000) * 10000 },
      donation: Math.floor(rnd() * 10000000 / 10000) * 10000,
      rent: Math.floor(rnd() * 12000000 / 10000) * 10000,
      rentEligible: rnd() < 0.7
    };
    h.parents.seniors = Math.min(h.parents.count, Math.floor(rnd() * (h.parents.count + 1)));
    h.parents.disabled = Math.min(h.parents.count, h.parents.disabled);
    var o = YECalc.run(h);
    var bad = !(isFinite(o.optimal.total.determinedTax) && o.optimal.total.determinedTax >= 0);
    if (o.optimal.total.determinedTax > o.husbandAll.total.determinedTax + 0.5) bad = true;
    if (o.optimal.total.determinedTax > o.wifeAll.total.determinedTax + 0.5) bad = true;
    if (bad && !worst) worst = { i: i, out: o };
    if (!h.rentEligible && o.optimal.husband.credits.rent + o.optimal.wife.credits.rent !== 0 && !badRent) badRent = i;
  }
  checkTrue("무작위 50가구 · 최적 분할이 몰아주기보다 나쁘지 않음", !worst, worst ? "case " + worst.i : "");
  checkTrue("무작위 50가구 · 월세 요건 미체크 가구는 월세 공제 0", badRent === null, badRent === null ? "" : "case " + badRent);

  /* ---------------------------------------------------------------
   * 결과 출력
   * --------------------------------------------------------------- */
  var tbody = document.getElementById("rows");
  tbody.innerHTML = rows.map(function (r, i) {
    return '<tr class="' + (r.ok ? "" : "bad") + '"><td>' + (i + 1) + "</td><td>" + r.name +
      (r.note ? ' <code>' + r.note + "</code>" : "") + "</td><td class='num'>" + r.expected +
      "</td><td class='num'>" + r.actual + "</td><td><span class='tag " + (r.ok ? "ok" : "fail") + "'>" +
      (r.ok ? "PASS" : "FAIL") + "</span></td></tr>";
  }).join("");
  document.getElementById("summary").innerHTML =
    '<span class="' + (fail ? "fail" : "ok") + '">' + pass + "건 통과 · " + fail + "건 실패</span> (전체 " + rows.length + "건)";

  window.__TEST_RESULTS = { passed: pass, failed: fail, total: rows.length, rows: rows };
})();
