/* 건강보험 피부양자·지역건보료 계산 엔진 자체 검증
 * 1) 기획안 5.4 샘플 검산 8건 (2027년 요율 기준)
 * 2) 경계값 19건 이상 — 소득 2,000만·재산 5.4억/9억/1.8억·사업소득 500만·부부 합산
 * 3) 지역보험료 산식(점수표·1억 공제·전월세 평가·상하한·장기요양)
 * 4) 부양요건·자료 연도·역산
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

  function person(over) {
    var base = {
      relation: "parent",
      age: 68,
      marital: "single",
      sameHousehold: false,
      income: {},
      spouseIncome: {},
      property: {},
      basisMonth: 11
    };
    var merged = Object.assign({}, base, over || {});
    merged.income = Object.assign({}, over && over.income);
    merged.spouseIncome = Object.assign({}, over && over.spouseIncome);
    merged.property = Object.assign({}, over && over.property);
    return merged;
  }
  function run(over) { return HealthCalc.run(person(over)); }

  /* ---------------------------------------------------------------
   * 1. 기획안 5.4 샘플 8건
   * --------------------------------------------------------------- */
  var s1 = run({ age: 68, income: {}, property: { house: 400000000 } });
  check("샘플1 · 부모 소득0 재산4억 판정", "keep", s1.judge.status);
  check("샘플1 · 부모 소득0 재산4억 보험료", 0, s1.premium.total);

  var s2 = run({ age: 68, income: { publicPension: 24000000 }, property: { house: 400000000 } });
  check("샘플2 · 공적연금 2,400만 판정", "lose", s2.judge.status, "소득 초과");
  check("샘플2 · 소득분", 71900, s2.premium.incomePart);
  check("샘플2 · 재산분", 144031, s2.premium.propertyPart);
  check("샘플2 · 건강보험료", 215931, s2.premium.health);
  check("샘플2 · 장기요양(13.90%)", 30014, s2.premium.ltc);
  check("샘플2 · 월 합계", 245945, s2.premium.total);

  var s3 = run({ income: { earned: 11000000 }, property: { house: 600000000 } });
  check("샘플3 · 소득1,100만 재산6억 판정", "lose", s3.judge.status, "재산+소득");
  check("샘플3 · 소득분", 32954, s3.premium.incomePart);
  check("샘플3 · 재산분", 171738, s3.premium.propertyPart);
  check("샘플3 · 건강보험료", 204692, s3.premium.health);
  check("샘플3 · 장기요양", 28452, s3.premium.ltc);
  check("샘플3 · 월 합계", 233144, s3.premium.total);

  var s4 = run({ income: {}, property: { house: 950000000 } });
  check("샘플4 · 재산9.5억 판정", "lose", s4.judge.status, "재산 초과");
  check("샘플4 · 소득분", 0, s4.premium.incomePart);
  check("샘플4 · 재산분", 211711, s4.premium.propertyPart);
  check("샘플4 · 건강보험료", 211711, s4.premium.health);
  check("샘플4 · 장기요양", 29427, s4.premium.ltc);
  check("샘플4 · 월 합계", 241138, s4.premium.total);

  var s5 = run({ income: { business: 6000000, businessRegistered: false }, property: { house: 200000000 } });
  check("샘플5 · 사업소득600만 판정", "lose", s5.judge.status, "사업소득");
  check("샘플5 · 소득분", 35950, s5.premium.incomePart);
  check("샘플5 · 재산분", 92848, s5.premium.propertyPart);
  check("샘플5 · 건강보험료", 128798, s5.premium.health);
  check("샘플5 · 장기요양", 17902, s5.premium.ltc);
  check("샘플5 · 월 합계", 146700, s5.premium.total);

  var s6 = run({ relation: "childSpouse", sameHousehold: false, income: {}, property: {} });
  check("샘플6 · 부양요건 미충족 판정", "lose", s6.judge.status);
  check("샘플6 · 하한 건강보험료", 20160, s6.premium.health);
  check("샘플6 · 장기요양", 2802, s6.premium.ltc);
  check("샘플6 · 월 합계", 22962, s6.premium.total);

  var s7 = run({ relation: "childSpouse", sameHousehold: false, jeonseDeposit: 500000000 });
  check("샘플7 · 전세 5억 판정", "lose", s7.judge.status);
  check("샘플7 · 전세 평가 30%", 150000000, s7.premium.jeonseEvaluation);
  check("샘플7 · 재산분", 56682, s7.premium.propertyPart);
  check("샘플7 · 장기요양", 7878, s7.premium.ltc);
  check("샘플7 · 월 합계", 64560, s7.premium.total);

  var s8 = run({ income: { earned: 9000000 }, property: { house: 600000000 } });
  check("샘플8 · 소득900만 재산6억 판정", "keep", s8.judge.status, "5.4억 초과 구간 소득 1,000만 이하");
  check("샘플8 · 유지 시 보험료 0", 0, s8.premium.total);

  /* ---------------------------------------------------------------
   * 2. 경계값
   * --------------------------------------------------------------- */
  check("경계 · 소득 정확히 2,000만", "keep", run({ income: { earned: 20000000 } }).judge.status);
  check("경계 · 소득 2,000만+1", "lose", run({ income: { earned: 20000001 } }).judge.status);
  check("경계 · 재산 5.4억 정확히 + 소득 2,000만", "keep",
    run({ income: { earned: 20000000 }, property: { house: 540000000 } }).judge.status);
  check("경계 · 재산 5.4억+1 + 소득 1,000만", "keep",
    run({ income: { earned: 10000000 }, property: { house: 540000001 } }).judge.status);
  check("경계 · 재산 5.4억+1 + 소득 1,000만+1", "lose",
    run({ income: { earned: 10000001 }, property: { house: 540000001 } }).judge.status);
  check("경계 · 재산 9억 정확히 + 소득 1,000만", "keep",
    run({ income: { earned: 10000000 }, property: { house: 900000000 } }).judge.status);
  check("경계 · 재산 9억+1 + 소득 0", "lose",
    run({ income: {}, property: { house: 900000001 } }).judge.status);
  check("경계 · 사업소득 500만 정확히(미등록)", "keep",
    run({ income: { business: 5000000, businessRegistered: false } }).judge.status);
  check("경계 · 사업소득 500만+1", "lose",
    run({ income: { business: 5000001, businessRegistered: false } }).judge.status);
  check("경계 · 주택임대소득 1만원", "lose", run({ income: { rental: 10000 } }).judge.status);
  check("경계 · 기혼 본인0 배우자 2,000만", "keep",
    run({ marital: "married", spouseHasIncome: true, spouseIncome: { earned: 20000000 } }).judge.status);
  check("경계 · 기혼 배우자 2,000만+1", "lose",
    run({ marital: "married", spouseHasIncome: true, spouseIncome: { earned: 20000001 } }).judge.status);
  check("경계 · 공동명의 과표 2.9억 + 소득 1,200만", "keep",
    run({ income: { earned: 12000000 }, property: { house: 290000000 } }).judge.status);
  check("경계 · 단독명의 과표 5.85억 + 소득 1,200만", "lose",
    run({ income: { earned: 12000000 }, property: { house: 585000000 } }).judge.status);
  check("경계 · 비동거 부모 + 동거 형제 소득", "lose",
    run({ relation: "parent", sameHousehold: false, siblingWithParent: true, siblingWithParentIncome: true }).judge.status);
  check("경계 · 사위·며느리 비동거", "lose", run({ relation: "childSpouse", sameHousehold: false }).judge.status);
  check("경계 · 형제자매 재산 1.8억+1", "lose",
    run({ relation: "sibling", age: 66, property: { house: 180000001 } }).judge.status);
  check("경계 · 형제자매 재산 1.8억 정확히", "keep",
    run({ relation: "sibling", age: 66, property: { house: 180000000 } }).judge.status);

  var low = HealthCalc.premium(person({ income: {}, property: {} }));
  check("경계 · 지역가입자 소득·재산0 하한", 20160, low.health);
  check("경계 · 지역가입자 소득·재산0 장기요양", 2802, low.ltc);
  check("경계 · 지역가입자 소득·재산0 합계", 22962, low.total);

  var high = HealthCalc.premium(person({ income: { business: 2000000000 }, property: { house: 8000000000 } }));
  check("경계 · 고소득·고재산 상한", 4591740, high.health);
  check("경계 · 상한 장기요양(13.90%)", 638251, high.ltc);
  check("경계 · 상한 합계", 5229991, high.total);

  /* ---------------------------------------------------------------
   * 3. 산식 세부
   * --------------------------------------------------------------- */
  var g = HealthCalc.propertyPoints(300000000);
  check("점수표 · 과표 3억(공제 후 2억)", 681, g.points);
  check("점수표 · 과표 3억 등급", 28, g.grade);
  check("점수표 · 공제 후 0원은 0점", 0, HealthCalc.propertyPoints(0).points);
  check("점수표 · 공제 후 450만원", 22, HealthCalc.propertyPoints(4500000).points);
  check("점수표 · 공제 후 450만+1", 44, HealthCalc.propertyPoints(4500001).points);

  var jeonse = HealthCalc.premium(person({ jeonseDeposit: 300000000, monthlyRent: 500000 }));
  check("전월세 평가 · (보증금+월세×40)×30%", 96000000, jeonse.jeonseEvaluation);
  check("전월세 평가 · 1억 공제 후 0 → 재산분 0", 0, jeonse.propertyPart);

  var fin = HealthCalc.premium(person({ income: { interestDividend: 10000000 } }));
  check("금융소득 1,000만 이하 · 지역보험료 소득 합산 제외", 0, fin.incomePart);
  var finOver = HealthCalc.premium(person({ income: { interestDividend: 10000001 } }));
  check("금융소득 1,000만 초과 · 전액 합산", 59916, finOver.incomePart);

  var loan = HealthCalc.premium(person({ property: { house: 300000000 }, loanDeduction: 50000000 }));
  check("주택대출 차감 · 재산분 감소", 113152, loan.propertyPart, "3억−1억−5천만=1.5억 → 22등급 535점");

  check("2026년 기준 장기요양 13.14%", 37790,
    Math.floor(HealthCalc.premium(person({ income: { business: 48000000 }, year: 2026 })).health * 0.1314));

  /* 부양요건·자료 연도 */
  check("부모 60세 미만도 건강보험은 나이 제한 없음", "keep",
    run({ age: 45, income: {}, property: {} }).judge.status);
  check("형제자매 40세·장애 없음", "lose", run({ relation: "sibling", age: 40 }).judge.status);
  check("형제자매 40세·장애인", "keep", run({ relation: "sibling", age: 40, disabled: true }).judge.status);
  check("형제자매 30세 미만", "keep", run({ relation: "sibling", age: 28 }).judge.status);
  check("의료급여 수급권자", "lose", run({ medicalAid: true }).judge.status);
  check("자료 연도 · 11월은 전년도 소득", "2026년 11~12월 기준: 2025년 소득 + 2026년 6월 1일 재산세 자료", s8.dataNote);
  check("자료 연도 · 1~10월은 전전년도 소득", "2026년 1~10월 기준: 2024년 소득 + 2026년 6월 1일 재산세 자료",
    run({ basisMonth: 1 }).dataNote);

  /* 역산 */
  check("역산 · 소득 2,000만까지 남은 금액", 8000000, run({ income: { earned: 12000000 } }).headroom.income);
  check("역산 · 재산 5.4억까지 남은 금액", 140000000, run({ property: { house: 400000000 } }).headroom.property);

  /* 경계 표시 */
  checkTrue("경계 표시 · 소득 1,950만은 경계", run({ income: { earned: 19500000 } }).judge.border);
  check("경계 표시 · 경계여도 판정은 유지", "keep", run({ income: { earned: 19500000 } }).judge.status);
  checkTrue("경계 표시 · 소득 1,500만은 경계 아님", !run({ income: { earned: 15000000 } }).judge.border);

  /* ---------------------------------------------------------------
   * 출력
   * --------------------------------------------------------------- */
  var tbody = document.getElementById("rows");
  tbody.innerHTML = rows.map(function (r, i) {
    return '<tr class="' + (r.ok ? "" : "bad") + '"><td>' + (i + 1) + "</td><td>" + r.name +
      (r.note ? " <code>" + r.note + "</code>" : "") + "</td><td class='num'>" + r.expected +
      "</td><td class='num'>" + r.actual + "</td><td><span class='tag " + (r.ok ? "ok" : "fail") + "'>" +
      (r.ok ? "PASS" : "FAIL") + "</span></td></tr>";
  }).join("");
  document.getElementById("summary").innerHTML =
    '<span class="' + (fail ? "fail" : "ok") + '">' + pass + "건 통과 · " + fail + "건 실패</span> (전체 " + rows.length + "건)";

  window.__TEST_RESULTS = { passed: pass, failed: fail, total: rows.length, rows: rows };
})();
