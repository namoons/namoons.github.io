/*!
 * 명세 — 2027 건강보험 피부양자 탈락·지역건보료 모의계산 엔진
 * 기준: 국민건강보험법 시행규칙(시행 2026. 9. 28.) 별표 1·별표 1의2,
 *       시행령(시행 2026. 10. 1.) 제41조·제42조·제44조·별표 4,
 *       2027년 건강보험료율 7.19%·장기요양보험료율 13.90%.
 * 재산 점수당 금액 211.5원과 월 보험료 상·하한은 2027년 고시 전이므로 2026년 값을 가정합니다.
 * 의존성 없음. 브라우저(window.HealthCalc)와 Node·quickjs에서 같이 씁니다.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HealthCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * 상수
   * ------------------------------------------------------------------ */
  var C = {
    RATE: 0.0719,                 // 2027 건강보험료율 (2026. 9. 8. 동결 확정)
    LTC_RATE: 0.1390,             // 2027 장기요양보험료율 (2026. 10. 30. 확정)
    LTC_RATE_2026: 0.1314,
    POINT_WON: 211.5,             // 재산보험료부과점수당 금액 — 2026 고시, 2027 미고시 가정
    PROP_DEDUCT: 100000000,       // 재산 기본공제 1억원
    MIN_PREMIUM: 20160,           // 월 보험료 하한 — 2026 고시 가정
    MAX_PREMIUM: 4591740,         // 월 보험료 상한 — 2026 고시 가정
    INCOME_LIMIT: 20000000,       // 피부양자 소득 합계 2,000만원
    PROP_LIMIT: 540000000,        // 재산세 과표 5.4억원
    PROP_HIGH: 900000000,         // 재산세 과표 9억원
    HIGH_INCOME_LIMIT: 10000000,  // 5.4억 초과~9억 이하 구간의 소득 1,000만원
    SIBLING_LIMIT: 180000000,     // 형제자매 재산 1.8억원
    BUSINESS_EXCEPTION: 5000000,  // 사업소득 500만원 예외
    FINANCIAL_EXCEPTION: 10000000,// 지역보험료: 이자·배당 1,000만원 이하 합산 제외
    JEONSE_RATE: 0.30,            // 전월세 평가 30%
    JEONSE_RENT_MULT: 40,         // 월세 × 40
    BORDER: 0.05                  // 경계 표시 ±5%
  };

  /* 재산등급별 점수표 (시행령 별표 4) — 상한 금액 단위: 만원 */
  var GRADES = [
    [450, 22], [900, 44], [1350, 66], [1800, 97], [2250, 122],
    [2700, 146], [3150, 171], [3600, 195], [4050, 219], [4500, 244],
    [5020, 268], [5590, 294], [6220, 320], [6930, 344], [7710, 365],
    [8590, 386], [9570, 412], [10700, 439], [11900, 465], [13300, 490],
    [14800, 516], [16400, 535], [18300, 559], [20400, 586], [22700, 611],
    [25300, 637], [28100, 659], [31300, 681], [34900, 706], [38800, 731],
    [43200, 757], [48100, 785], [53600, 812], [59700, 841], [66500, 881],
    [74000, 921], [82400, 961], [91800, 1001], [103000, 1041], [114000, 1091],
    [127000, 1141], [142000, 1191], [158000, 1241], [176000, 1291], [196000, 1341],
    [218000, 1391], [242000, 1451], [270000, 1511], [300000, 1571], [330000, 1641],
    [363000, 1711], [399300, 1781], [439230, 1851], [483153, 1921], [531468, 1991],
    [584615, 2061], [643077, 2131], [707385, 2201], [778124, 2271], [Infinity, 2341]
  ];

  /* ------------------------------------------------------------------ *
   * 도우미
   * ------------------------------------------------------------------ */
  function num(v) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }
  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

  var INCOME_KEYS = ["earned", "business", "rental", "publicPension", "privatePension", "interestDividend", "other"];

  function normalizeIncome(raw) {
    raw = raw || {};
    var out = {};
    INCOME_KEYS.forEach(function (k) { out[k] = num(raw[k]); });
    out.nonTaxable = num(raw.nonTaxable);
    out.businessRegistered = raw.businessRegistered === true;
    return out;
  }

  function incomeTotal(inc) {
    return INCOME_KEYS.reduce(function (sum, k) { return sum + num(inc[k]); }, 0);
  }

  function normalize(raw) {
    raw = raw || {};
    var inc = normalizeIncome(raw.income);
    var spouseIncome = normalizeIncome(raw.spouseIncome);
    var property = raw.property || {};
    return {
      relation: raw.relation || "parent",
      age: num(raw.age),
      marital: raw.marital === "married" ? "married" : (raw.marital === "ended" ? "ended" : "single"),
      sameHousehold: raw.sameHousehold !== false,
      siblingWithParent: !!raw.siblingWithParent,
      siblingWithParentIncome: !!raw.siblingWithParentIncome,
      siblingIncome: !!raw.siblingIncome,
      parentExists: raw.parentExists !== false,
      parentIncome: !!raw.parentIncome,
      childExists: raw.childExists !== false,
      childIncome: !!raw.childIncome,
      disabled: !!raw.disabled,
      veteran: !!raw.veteran,
      medicalAid: !!raw.medicalAid,
      income: inc,
      spouseIncome: spouseIncome,
      spouseHasIncome: raw.spouseHasIncome === true,
      spouseLabor: raw.spouseLabor !== false,
      property: {
        house: num(property.house),
        other: num(property.other),
        houseCount: Math.max(1, num(property.houseCount) || 1),
        oneHouse: property.oneHouse !== false
      },
      jeonseDeposit: num(raw.jeonseDeposit),
      monthlyRent: num(raw.monthlyRent),
      loanDeduction: num(raw.loanDeduction),
      extraProperty: num(raw.extraProperty),
      extraIncome: num(raw.extraIncome),
      extraLabor: raw.extraLabor !== false,
      basisMonth: num(raw.basisMonth) === 1 ? 1 : 11,
      year: num(raw.year) === 2026 ? 2026 : 2027
    };
  }

  /* ------------------------------------------------------------------ *
   * 1. 부양요건 (시행규칙 별표 1)
   * ------------------------------------------------------------------ */
  function supportCheck(h) {
    if (h.medicalAid) return { ok: false, code: "medical", text: "의료급여 수급권자는 피부양자가 될 수 없습니다." };

    switch (h.relation) {
      case "spouse":
        return { ok: true };

      case "parent":
        if (h.sameHousehold) return { ok: true };
        if (!h.siblingWithParent || !h.siblingWithParentIncome) return { ok: true };
        return { ok: false, code: "support", text: "같은 주소에 사는 형제자매에게 소득이 있으면 비동거 부모는 피부양자로 인정되지 않습니다." };

      case "grandparent":
        if (h.sameHousehold) return { ok: true };
        if (!h.parentExists || !h.parentIncome) return { ok: true };
        return { ok: false, code: "support", text: "비동거 조부모는 함께 사는 직계비속(자녀)이 없거나 소득이 없어야 합니다." };

      case "child":
        if (h.sameHousehold) return { ok: true };
        if (h.marital === "married") return { ok: false, code: "support", text: "비동거 자녀는 미혼이어야 피부양자로 인정됩니다." };
        if (h.marital === "ended" && h.childExists && h.childIncome) {
          return { ok: false, code: "support", text: "이혼·사별한 자녀는 자녀가 없거나 소득이 없어야 합니다." };
        }
        return { ok: true };

      case "grandchild":
        if (h.sameHousehold) {
          if (!h.parentExists || !h.parentIncome) return { ok: true };
          return { ok: false, code: "support", text: "동거 손자녀는 부모가 없거나 소득이 없어야 합니다." };
        }
        if (h.marital !== "married" && !h.parentExists) return { ok: true };
        return { ok: false, code: "support", text: "비동거 손자녀는 미혼이고 부모가 없어야 합니다." };

      case "childSpouse":
        if (h.sameHousehold) return { ok: true };
        return { ok: false, code: "support", text: "사위·며느리는 함께 살 때만 피부양자로 인정됩니다." };

      case "spouseParent":
        if (h.sameHousehold) return { ok: true };
        if (!h.siblingWithParent || !h.siblingWithParentIncome) return { ok: true };
        return { ok: false, code: "support", text: "배우자의 부모와 함께 사는 배우자의 형제자매에게 소득이 있으면 인정되지 않습니다." };

      case "spouseChild":
        if (h.sameHousehold) {
          if (h.marital !== "married") return { ok: true };
          return { ok: false, code: "support", text: "동거하는 배우자의 자녀는 미혼이어야 합니다." };
        }
        return { ok: false, code: "support", text: "배우자의 직계비속은 함께 살 때만 피부양자로 인정됩니다." };

      case "sibling":
        if (!(h.age < 30 || h.age >= 65 || h.disabled || h.veteran)) {
          return { ok: false, code: "age", text: "형제자매는 30세 미만·65세 이상·등록 장애인·국가유공 상이자 중 하나여야 합니다." };
        }
        if (h.marital === "married") {
          return { ok: false, code: "support", text: "형제자매는 미혼이어야 피부양자로 인정됩니다." };
        }
        if (h.parentExists && h.parentIncome) {
          return { ok: false, code: "support", text: "형제자매는 부모가 없거나 부모에게 소득이 없어야 합니다." };
        }
        if (!h.sameHousehold && h.siblingIncome) {
          return { ok: false, code: "support", text: "비동거 형제자매는 다른 형제자매에게 소득이 없어야 합니다." };
        }
        return { ok: true };

      default:
        return { ok: true };
    }
  }

  /* ------------------------------------------------------------------ *
   * 2·3. 소득·재산 요건
   * ------------------------------------------------------------------ */
  function judge(raw) {
    var h = normalize(raw);
    var reasons = [];
    var borderNotes = [];

    var support = supportCheck(h);
    if (!support.ok) reasons.push({ code: support.code, text: support.text });

    var total = incomeTotal(h.income);
    var business = h.income.business;
    var businessException = business <= C.BUSINESS_EXCEPTION &&
      (!h.income.businessRegistered || h.disabled || h.veteran);
    if (total > C.INCOME_LIMIT) {
      reasons.push({ code: "income", text: "소득 합계 " + won(total) + "이 기준 2,000만원을 넘습니다." });
    }
    if (business > 0 && !businessException) {
      reasons.push({
        code: "business",
        text: "사업소득 " + won(business) + "이 있습니다. 사업자등록이 없거나 장애인·국가유공자이면서 500만원 이하일 때만 '없는 것'으로 봅니다."
      });
    }
    if (h.income.rental > 0) {
      reasons.push({ code: "rental", text: "주택임대소득 " + won(h.income.rental) + "은 금액과 관계없이 사업소득 예외가 적용되지 않습니다." });
    }
    if (h.relation !== "spouse" && h.marital === "married" && h.spouseHasIncome && incomeTotal(h.spouseIncome) > C.INCOME_LIMIT) {
      reasons.push({ code: "spouse", text: "배우자 소득 합계가 2,000만원을 넘어 기혼자는 부부 모두 요건을 충족하지 못합니다." });
    }

    var property = h.property.house + h.property.other;
    if (h.relation === "sibling") {
      if (property > C.SIBLING_LIMIT) {
        reasons.push({ code: "propertySibling", text: "형제자매는 재산세 과표 1.8억원을 넘으면 탈락합니다." });
      }
    } else {
      if (property > C.PROP_HIGH) {
        reasons.push({ code: "property", text: "재산세 과표 " + won(property) + "이 9억원을 넘습니다." });
      } else if (property > C.PROP_LIMIT && total > C.HIGH_INCOME_LIMIT) {
        reasons.push({
          code: "propertyHigh",
          text: "재산세 과표가 5.4억원을 넘고 소득도 1,000만원을 넘습니다(재산 " + won(property) + " · 소득 " + won(total) + ")."
        });
      }
    }

    /* 경계 표시 — 단정하지 않고 공단 확인을 권합니다 */
    function near(value, base, label) {
      if (base <= 0) return;
      var diff = value - base;
      if (Math.abs(diff) <= base * C.BORDER) {
        var msg = diff === 0
          ? "기준과 정확히 같습니다."
          : (diff > 0 ? "기준을 " + won(diff) + " 넘습니다." : "기준보다 " + won(-diff) + " 여유가 있습니다.");
        borderNotes.push(label + " — " + msg);
      }
    }
    near(total, C.INCOME_LIMIT, "소득");
    near(property, C.PROP_LIMIT, "재산(5.4억)");
    if (property > C.PROP_LIMIT) {
      near(property, C.PROP_HIGH, "재산(9억)");
      near(total, C.HIGH_INCOME_LIMIT, "소득(1,000만)");
    }
    near(business, C.BUSINESS_EXCEPTION, "사업소득");
    if (h.relation === "sibling") near(property, C.SIBLING_LIMIT, "형제자매 재산");

    var status = reasons.length ? "lose" : "keep";
    return {
      status: status,
      tone: status === "lose" ? "lose" : (borderNotes.length ? "border" : "keep"),
      reasons: reasons,
      border: borderNotes.length > 0,
      borderNotes: borderNotes,
      incomeTotal: total,
      business: business,
      businessException: businessException,
      propertyTotal: property,
      support: support,
      spouseIncomeTotal: incomeTotal(h.spouseIncome),
      thresholds: {
        income: C.INCOME_LIMIT,
        property: C.PROP_LIMIT,
        propertyHigh: C.PROP_HIGH,
        highIncome: C.HIGH_INCOME_LIMIT,
        sibling: C.SIBLING_LIMIT,
        business: C.BUSINESS_EXCEPTION
      },
      input: h
    };
  }

  /* ------------------------------------------------------------------ *
   * 4. 지역가입자 보험료
   * ------------------------------------------------------------------ */
  function propertyPoints(amount) {
    var man = Math.max(0, amount) / 10000;
    if (amount <= 0) return { grade: 0, points: 0 };
    for (var i = 0; i < GRADES.length; i++) {
      if (man <= GRADES[i][0] + 1e-9) return { grade: i + 1, points: GRADES[i][1] };
    }
    return { grade: 60, points: 2341 };
  }

  function premiumBase(h) {
    var inc = h.income;
    /* 소득 평가: 근로·연금 50%, 사업·기타·임대 100%, 이자·배당 1,000만원 이하 합산 제외 */
    var financial = inc.interestDividend > C.FINANCIAL_EXCEPTION ? inc.interestDividend : 0;
    var annual = inc.earned * 0.5 + inc.publicPension * 0.5 + inc.privatePension * 0.5 +
      inc.business + inc.rental + inc.other + financial;
    if (h.relation !== "spouse" && h.marital === "married" && h.spouseHasIncome) {
      var spouseTotal = incomeTotal(h.spouseIncome);
      annual += spouseTotal * (h.spouseLabor ? 0.5 : 1);
    }
    annual += h.extraIncome * (h.extraLabor ? 0.5 : 1);

    var jeonse = Math.floor((h.jeonseDeposit + h.monthlyRent * C.JEONSE_RENT_MULT) * C.JEONSE_RATE);
    var property = h.property.house + h.property.other + h.extraProperty + jeonse -
      C.PROP_DEDUCT - h.loanDeduction;
    return { annual: annual, jeonse: jeonse, property: property };
  }

  function premium(raw) {
    var h = raw && raw.input && raw.input.income ? raw.input : normalize(raw);
    var base = premiumBase(h);
    var monthlyIncome = base.annual / 12;
    var incomePart = Math.floor(monthlyIncome * C.RATE);
    var grade = propertyPoints(base.property);
    var propertyPart = Math.floor(grade.points * C.POINT_WON);
    var health = clamp(incomePart + propertyPart, C.MIN_PREMIUM, C.MAX_PREMIUM);
    var ltcRate = h.year === 2026 ? C.LTC_RATE_2026 : C.LTC_RATE;
    var ltc = Math.floor(health * ltcRate);
    return {
      annualIncome: Math.floor(base.annual),
      monthlyIncome: Math.floor(monthlyIncome),
      incomePart: incomePart,
      propertyBase: Math.floor(base.property),
      jeonseEvaluation: base.jeonse,
      grade: grade.grade,
      points: grade.points,
      propertyPart: propertyPart,
      health: health,
      ltcRate: ltcRate,
      ltc: ltc,
      total: health + ltc,
      capped: health === C.MIN_PREMIUM || health === C.MAX_PREMIUM,
      year: h.year
    };
  }

  /* 직장가입자의 보수 외 소득 건보료 (연 2,000만원 초과분) */
  function sideIncome(raw) {
    var annual = num((raw || {}).annual);
    var year = num((raw || {}).year) === 2026 ? 2026 : 2027;
    var excess = Math.max(0, annual - C.INCOME_LIMIT);
    var monthly = excess / 12;
    var health = Math.floor(monthly * C.RATE);
    var ltcRate = year === 2026 ? C.LTC_RATE_2026 : C.LTC_RATE;
    var ltc = Math.floor(health * ltcRate);
    return {
      annual: annual,
      threshold: C.INCOME_LIMIT,
      excess: excess,
      monthlyBase: Math.floor(monthly),
      health: health,
      ltcRate: ltcRate,
      ltc: ltc,
      total: health + ltc,
      year: year
    };
  }

  /* 역산 — 기준까지 남은 금액 */
  function headroom(j) {
    return {
      income: C.INCOME_LIMIT - j.incomeTotal,
      property: C.PROP_LIMIT - j.propertyTotal,
      propertyHigh: C.PROP_HIGH - j.propertyTotal,
      highIncome: C.HIGH_INCOME_LIMIT - j.incomeTotal,
      sibling: C.SIBLING_LIMIT - j.propertyTotal,
      business: C.BUSINESS_EXCEPTION - j.business
    };
  }

  function dataNote(h) {
    var basis = h.basisMonth === 1 ? "2026년 1~10월" : "2026년 11~12월";
    var incomeYear = h.basisMonth === 1 ? "2024년" : "2025년";
    return basis + " 기준: " + incomeYear + " 소득 + 2026년 6월 1일 재산세 자료";
  }

  function run(raw) {
    var j = judge(raw);
    var p = premium(j.input);
    return {
      judge: j,
      premium: j.status === "lose" ? p : {
        annualIncome: p.annualIncome, monthlyIncome: p.monthlyIncome,
        incomePart: 0, propertyBase: p.propertyBase, jeonseEvaluation: p.jeonseEvaluation,
        grade: p.grade, points: p.points, propertyPart: 0,
        health: 0, ltcRate: p.ltcRate, ltc: 0, total: 0, capped: false, year: p.year
      },
      potential: p,
      headroom: headroom(j),
      dataNote: dataNote(j.input)
    };
  }

  function won(v) {
    return Math.round(Number(v) || 0).toLocaleString("ko-KR") + "원";
  }

  return {
    C: C,
    GRADES: GRADES,
    normalize: normalize,
    incomeTotal: incomeTotal,
    supportCheck: supportCheck,
    judge: judge,
    propertyPoints: propertyPoints,
    premium: premium,
    sideIncome: sideIncome,
    headroom: headroom,
    run: run,
    won: won
  };
});
