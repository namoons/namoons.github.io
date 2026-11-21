/*!
 * 건보료·피부양자 계산기 UI (2027년 요율 기준)
 * 계산은 health/calc.js(HealthCalc)에서만 하고, 이 파일은 입력을 읽어 결과를 그립니다.
 */
(function () {
  "use strict";

  var nf = new Intl.NumberFormat("ko-KR");
  var $ = function (id) { return document.getElementById(id); };

  var tab = "dependent";
  var isDemo = true;
  var applying = false;

  /* ---------------- 입력 도우미 ---------------- */
  function digits(v) { return String(v == null ? "" : v).replace(/[^\d]/g, ""); }
  function numOf(id) {
    var el = $(id);
    if (!el) return 0;
    var d = digits(el.value);
    return d ? Number(d) : 0;
  }
  function manOf(id) { return numOf(id) * 10000; }
  function fmtInput(el) {
    var d = digits(el.value);
    el.value = d ? nf.format(Number(d)) : "";
  }
  function won(v) {
    var n = Math.round(Number(v) || 0);
    return nf.format(n) + "원";
  }
  function manwon(v) {
    var n = Math.round(Number(v) || 0);
    if (Math.abs(n) >= 100000000) {
      var eok = Math.floor(n / 100000000);
      var rest = Math.round((n % 100000000) / 10000);
      return eok + "억" + (rest ? " " + nf.format(rest) + "만" : "") + "원";
    }
    return nf.format(Math.round(n / 10000)) + "만원";
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------- 상태 읽기 ---------------- */
  function radio(name, value) {
    var el = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    return !!(el && el.checked);
  }

  function readState() {
    return {
      relation: ($("relation") && $("relation").value) || "parent",
      age: numOf("age"),
      marital: ($("marital") && $("marital").value) || "single",
      sameHousehold: $("sameHousehold").checked,
      siblingWithParent: $("siblingWithParent").checked,
      siblingWithParentIncome: $("siblingWithParentIncome").checked,
      siblingIncome: $("siblingIncome").checked,
      parentExists: $("parentExists").checked,
      parentIncome: $("parentIncome").checked,
      childExists: $("childExists").checked,
      childIncome: $("childIncome").checked,
      disabled: $("disabled").checked,
      veteran: $("veteran").checked,
      medicalAid: $("medicalAid").checked,
      income: {
        earned: manOf("incEarned"),
        business: manOf("incBusiness"),
        businessRegistered: $("bizRegistered").checked,
        rental: manOf("incRental"),
        publicPension: manOf("incPubPension"),
        privatePension: manOf("incPrivPension"),
        interestDividend: manOf("incInterest"),
        other: manOf("incOther"),
        nonTaxable: manOf("incNonTax")
      },
      spouseHasIncome: $("spouseHasIncome").checked,
      spouseLabor: ($("spouseLabor") && $("spouseLabor").value) === "labor",
      spouseIncome: {
        earned: manOf("spouseIncome")
      },
      property: {
        house: manOf("propHouse"),
        other: manOf("propOther")
      },
      jeonseDeposit: manOf("jeonseDeposit"),
      monthlyRent: manOf("monthlyRent"),
      loanDeduction: manOf("loanDeduction"),
      extraIncome: manOf("extraIncome"),
      extraProperty: manOf("extraProperty"),
      extraLabor: true,
      basisMonth: ($("basisMonth") && $("basisMonth").value) === "1" ? 1 : 11,
      year: 2027
    };
  }

  /* ---------------- 단위 가드 ---------------- */
  var BIG_MAN = 100000;
  var MAN_FIELDS = [
    "incEarned", "incBusiness", "incRental", "incPubPension", "incPrivPension", "incInterest", "incOther",
    "incNonTax", "spouseIncome", "propHouse", "propOther", "jeonseDeposit", "monthlyRent",
    "loanDeduction", "extraIncome", "extraProperty", "sideAnnual"
  ];
  var warnEls = {};

  function setupGuards() {
    MAN_FIELDS.forEach(function (id) {
      var el = $(id);
      if (!el || warnEls[id]) return;
      var field = el.closest(".field");
      if (!field || !field.parentNode) return;
      var w = document.createElement("span");
      w.className = "field-warn";
      w.hidden = true;
      field.parentNode.insertBefore(w, field.nextSibling);
      warnEls[id] = w;
    });
  }

  function setWarn(id, html) {
    var w = warnEls[id];
    if (!w) return;
    if (w.__warnHtml === html) return;
    w.__warnHtml = html;
    if (html) { w.innerHTML = html; w.hidden = false; }
    else { w.hidden = true; w.innerHTML = ""; }
  }

  function updateGuards() {
    MAN_FIELDS.forEach(function (id) {
      var v = numOf(id);
      if (v >= BIG_MAN) {
        var btn = v % 10000 === 0
          ? '<button type="button" class="warn-btn" data-convert="' + id + '" data-from="' + v + '">원→만원으로 바꾸기 (' + nf.format(v / 10000) + ")</button>"
          : "";
        setWarn(id, "만원 단위 칸입니다. " + nf.format(v) + "만원 = " + nf.format(Math.round(v / 10000)) +
          "억원입니다. 원 단위로 입력한 것은 아닌지 확인해 주세요." + btn);
      } else {
        setWarn(id, "");
      }
    });
  }

  /* ---------------- 결과 ---------------- */
  function toolsBlock() {
    if (isDemo) {
      return '<div class="result-tools">' +
        '<span class="demo-badge">예시 데이터로 계산 중</span>' +
        '<span class="demo-text">아래 숫자는 예시입니다. 한 칸이라도 고치면 이 배지가 사라집니다.</span>' +
        '<button type="button" class="btn-tool is-primary" data-act="clear">내 값 입력하기</button>' +
        "</div>";
    }
    return '<div class="result-tools">' +
      '<button type="button" class="btn-tool" data-act="clear">모두 지우기</button>' +
      '<button type="button" class="btn-tool" data-act="demo">예시 불러오기</button>' +
      "</div>";
  }

  function judgeLabel(j) {
    if (j.status === "lose") return { cls: "neg", big: "탈락", sub: "지역가입자로 전환됩니다" };
    if (j.tone === "border") return { cls: "", big: "유지 · 경계", sub: "기준에 가까워 공단 확인이 필요합니다" };
    return { cls: "pos", big: "유지", sub: "지금은 피부양자 요건을 충족합니다" };
  }

  function line(label, value, sub, cls) {
    return '<div class="hc-line' + (cls ? " " + cls : "") + '">' +
      '<span>' + label + (sub ? '<span class="sub">' + sub + "</span>" : "") + "</span>" +
      "<b>" + value + "</b></div>";
  }

  function premiumBlock(p, title) {
    return '<div class="hc-block">' +
      '<h3>' + esc(title) + "</h3>" +
      line("소득분", won(p.incomePart), "연 소득 " + manwon(p.annualIncome) + "의 평가액 ÷ 12 × 7.19%") +
      line("재산분", won(p.propertyPart), p.points ? p.grade + "등급 " + nf.format(p.points) + "점 × 211.5원" : "공제 후 재산 0원") +
      line("건강보험료", won(p.health), p.capped ? (p.health === 20160 ? "하한 적용" : "상한 적용") : "") +
      line("장기요양보험료", won(p.ltc), "건강보험료 × " + (p.ltcRate * 100).toFixed(2) + "%") +
      line("월 합계", won(p.total), "연 " + won(p.total * 12), "total") +
      "</div>";
  }

  function renderDependent(out) {
    var j = out.judge;
    var lab = judgeLabel(j);
    var html = '<div class="result-card">' +
      '<div class="result-head"><h2>판정 결과</h2><span class="stamp">2027년 요율 기준</span></div>' +
      toolsBlock() +
      '<p class="hc-judge ' + (j.status === "lose" ? "lose" : (j.tone === "border" ? "border" : "keep")) + '">' +
      esc(lab.big) + "</p>" +
      '<p class="result-sub">' + esc(lab.sub) + "</p>";

    if (j.reasons.length) {
      html += '<div class="hc-reasons"><strong>탈락 사유</strong><ul>' +
        j.reasons.map(function (r) { return "<li>" + esc(r.text) + "</li>"; }).join("") +
        "</ul></div>";
    } else if (j.border) {
      html += '<div class="hc-reasons border"><strong>경계 — 공단 확인 권장</strong><ul>' +
        j.borderNotes.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
        "</ul></div>";
    } else {
      html += '<div class="hc-reasons ok"><strong>요건 충족</strong><p>부양요건·소득요건·재산요건을 모두 넘지 않았습니다.</p></div>';
    }

    if (j.status === "lose") {
      html += '<p class="result-big neg">' + won(out.premium.total) + "</p>" +
        '<p class="result-sub">탈락하면 한 달에 내는 돈 (건강보험 + 장기요양)</p>' +
        '<p class="result-note">지금은 0원 → 탈락 시 연 ' + won(out.premium.total * 12) + "</p>" +
        premiumBlock(out.premium, "월 보험료 계산");
    } else {
      html += '<div class="hc-now">' +
        "<strong>지금 내는 보험료 0원</strong>" +
        "<p>탈락하면 월 <b>" + won(out.potential.total) + "</b> (건강보험 " + won(out.potential.health) +
        " + 장기요양 " + won(out.potential.ltc) + ")</p></div>";
    }

    /* 역산 */
    var h = out.headroom;
    var reverse = [];
    if (j.incomeTotal <= 20000000) {
      reverse.push(h.income >= 0
        ? "소득을 " + manwon(h.income) + " 더 올리면 2,000만원을 넘습니다."
        : "소득이 기준을 " + manwon(-h.income) + " 넘었습니다.");
    }
    if (j.propertyTotal <= 540000000) {
      reverse.push("재산 과표를 " + manwon(h.property) + " 더 올리면 5.4억원을 넘습니다.");
    }
    if (j.propertyTotal > 540000000 && j.propertyTotal <= 900000000) {
      reverse.push("5.4억~9억 구간이라 소득 1,000만원 이하를 지켜야 합니다. 지금 여유 " + manwon(Math.max(0, h.highIncome)) + ".");
    }

    html += '<div class="hc-block"><h3>기준까지 남은 금액</h3>' +
      reverse.map(function (t) { return '<p class="hc-reverse">' + esc(t) + "</p>"; }).join("") +
      line("소득 합계", won(j.incomeTotal), "기준 2,000만원") +
      line("재산세 과표", won(j.propertyTotal), j.relation === "sibling" ? "형제자매 기준 1.8억원" : "기본 5.4억원 / 9억원") +
      (j.business > 0 ? line("사업소득", won(j.business), "예외 기준 500만원") : "") +
      "</div>";

    html += '<div class="hc-data">' + esc(out.dataNote) + "</div>" +
      '<p class="small-note">국민건강보험공단의 최종 판정이 아닙니다. 공단(1577-1000) 또는 관할 지사에서 확인하세요. ' +
      "재산 점수당 금액 211.5원과 월 보험료 상·하한은 2027년 고시 전이라 2026년 값을 가정했습니다.</p>" +
      "</div>";
    return html;
  }

  function renderSide(out) {
    var annual = manOf("sideAnnual");
    var r = HealthCalc.sideIncome({ annual: annual, year: 2027 });
    var html = '<div class="result-card">' +
      '<div class="result-head"><h2>추가 보험료</h2><span class="stamp">2027년 요율 기준</span></div>' +
      '<p class="result-sub" style="margin-top:0">직장가입자 본인의 연 보수 외 소득</p>';
    if (annual <= 0) {
      return html + '<div class="empty-state"><strong>연 보수 외 소득을 입력하면 추가 보험료가 나타납니다</strong>' +
        "<p>강의료·원고료·자문료·배당·이자처럼 근로소득 외에 번 돈의 연간 합계입니다.</p></div></div>";
    }
    if (r.excess <= 0) {
      return html +
        '<p class="hc-judge keep">추가 보험료 없음</p>' +
        '<p class="result-sub">보수 외 소득 ' + manwon(annual) + "은 기준 2,000만원 이하입니다.</p>" +
        '<div class="hc-block">' + line("기준까지 남은 금액", manwon(r.threshold - annual), "2,000만원") + "</div>" +
        '<p class="small-note">기준을 넘으면 초과분에 대해서만 소득월액보험료가 붙습니다.</p></div>';
    }
    html += '<p class="result-big neg">' + won(r.total) + "</p>" +
      '<p class="result-sub">매달 보수월액보험료에 더해지는 금액</p>' +
      '<div class="hc-block"><h3>계산</h3>' +
      line("연 보수 외 소득", won(annual), "") +
      line("기준 초과분", won(r.excess), "2,000만원 초과") +
      line("월 소득월액", won(r.monthlyBase), "초과분 ÷ 12") +
      line("건강보험료", won(r.health), "× 7.19%") +
      line("장기요양보험료", won(r.ltc), "× " + (r.ltcRate * 100).toFixed(2) + "%") +
      line("월 추가 합계", won(r.total), "연 " + won(r.total * 12), "total") +
      "</div>" +
      '<p class="small-note">보수 외 소득이 2,000만원을 넘으면 다음 해 11월부터 소득월액보험료가 추가로 부과됩니다. ' +
      "정산 방식과 상한은 공단(1577-1000)에서 확인하세요.</p></div>";
    return html;
  }

  function render() {
    var box = $("results");
    if (!box) return;
    try {
      var html;
      if (tab === "side") {
        html = renderSide();
        var r = HealthCalc.sideIncome({ annual: manOf("sideAnnual"), year: 2027 });
        updateMini(r.total > 0 ? "월 추가 보험료" : "추가 보험료", r.total > 0 ? won(r.total) : "없음");
      } else {
        var out = HealthCalc.run(readState());
        html = renderDependent(out);
        updateMini(out.judge.status === "lose" ? "판정 · 탈락" : (out.judge.tone === "border" ? "판정 · 경계" : "판정 · 유지"),
          out.judge.status === "lose" ? won(out.premium.total) : "0원");
      }
      box.innerHTML = html;
    } catch (e) {
      console.error(e);
      box.innerHTML = '<div class="result-card"><p>입력값을 확인해 주세요.</p></div>';
    }
    updateGuards();
  }

  function updateMini(label, value) {
    var l = $("miniLabel");
    var v = $("miniValue");
    if (!l || !v) return;
    l.textContent = label;
    v.textContent = value;
    v.style.color = label.indexOf("탈락") >= 0 ? "#b42318" : (label.indexOf("경계") >= 0 ? "#8a5a00" : "#0b7a53");
  }

  var timer = null;
  function scheduleRender() {
    clearTimeout(timer);
    timer = setTimeout(render, 90);
  }

  /* ---------------- 부양요건 입력 표시 ---------------- */
  function updateSupportFields() {
    var rel = ($("relation") && $("relation").value) || "parent";
    var show = {
      siblingParent: rel === "parent" || rel === "spouseParent",
      parent: rel === "grandparent" || rel === "sibling",
      child: rel === "child",
      sibling: rel === "sibling",
      marital: rel === "child" || rel === "grandchild" || rel === "sibling" || rel === "spouseChild",
      age: rel === "sibling" || rel === "spouse" || rel === "parent"
    };
    show.marital = true;
    Array.prototype.forEach.call(document.querySelectorAll("[data-sup]"), function (el) {
      var key = el.getAttribute("data-sup");
      el.hidden = !show[key];
    });
    if ($("disabledRow")) $("disabledRow").hidden = !(rel === "sibling");
    /* 기혼 여부를 바꾸면 배우자 소득 칸 표시 (배우자 본인이 후보자면 직장가입자 소득은 넣지 않습니다) */
    var married = ($("marital") && $("marital").value) === "married";
    if ($("spouseIncomeBlock")) $("spouseIncomeBlock").hidden = !married || rel === "spouse";
    if ((!married || rel === "spouse") && $("spouseHasIncome")) $("spouseHasIncome").checked = false;
  }

  /* ---------------- 예시 ---------------- */
  var EXAMPLES = {
    keep: {
      relation: "parent", age: "68", marital: "single", sameHousehold: "1",
      incEarned: "0", incBusiness: "0", incRental: "0", incPubPension: "0", incPrivPension: "0",
      incInterest: "0", incOther: "0", incNonTax: "0",
      propHouse: "40,000", propOther: "0", jeonseDeposit: "0", monthlyRent: "0",
      loanDeduction: "0", extraIncome: "0", extraProperty: "0"
    },
    income: {
      relation: "parent", age: "68", marital: "single", sameHousehold: "1",
      incEarned: "0", incBusiness: "0", incRental: "0", incPubPension: "2,400", incPrivPension: "0",
      incInterest: "0", incOther: "0", incNonTax: "0",
      propHouse: "40,000", propOther: "0", jeonseDeposit: "0", monthlyRent: "0",
      loanDeduction: "0", extraIncome: "0", extraProperty: "0"
    },
    property: {
      relation: "parent", age: "68", marital: "single", sameHousehold: "1",
      incEarned: "1,100", incBusiness: "0", incRental: "0", incPubPension: "0", incPrivPension: "0",
      incInterest: "0", incOther: "0", incNonTax: "0",
      propHouse: "60,000", propOther: "0", jeonseDeposit: "0", monthlyRent: "0",
      loanDeduction: "0", extraIncome: "0", extraProperty: "0"
    },
    border: {
      relation: "parent", age: "68", marital: "single", sameHousehold: "1",
      incEarned: "1,950", incBusiness: "0", incRental: "0", incPubPension: "0", incPrivPension: "0",
      incInterest: "0", incOther: "0", incNonTax: "0",
      propHouse: "40,000", propOther: "0", jeonseDeposit: "0", monthlyRent: "0",
      loanDeduction: "0", extraIncome: "0", extraProperty: "0"
    },
    sibling: {
      relation: "sibling", age: "67", marital: "single", sameHousehold: "1",
      incEarned: "0", incBusiness: "0", incRental: "0", incPubPension: "600", incPrivPension: "0",
      incInterest: "0", incOther: "0", incNonTax: "0",
      propHouse: "18,000", propOther: "0", jeonseDeposit: "0", monthlyRent: "0",
      loanDeduction: "0", extraIncome: "0", extraProperty: "0"
    },
    edge: {
      relation: "parent", age: "68", marital: "single", sameHousehold: "1",
      incEarned: "2,000", incBusiness: "0", incRental: "0", incPubPension: "0", incPrivPension: "0",
      incInterest: "0", incOther: "0", incNonTax: "0",
      propHouse: "54,000", propOther: "0", jeonseDeposit: "0", monthlyRent: "0",
      loanDeduction: "0", extraIncome: "0", extraProperty: "0"
    }
  };

  function applyExample(key) {
    var src = EXAMPLES[key] || EXAMPLES.keep;
    applying = true;
    var fields = ["relation", "age", "marital", "incEarned", "incBusiness", "incRental", "incPubPension",
      "incPrivPension", "incInterest", "incOther", "incNonTax", "propHouse", "propOther",
      "jeonseDeposit", "monthlyRent", "loanDeduction", "extraIncome", "extraProperty"];
    fields.forEach(function (id) {
      if (!$(id)) return;
      $(id).value = src[id] != null ? src[id] : (id === "relation" ? "parent" : (id === "marital" ? "single" : "0"));
    });
    $("sameHousehold").checked = src.sameHousehold === "1";
    ["siblingWithParent", "siblingWithParentIncome", "siblingIncome", "parentExists", "parentIncome",
      "childExists", "childIncome", "disabled", "veteran", "medicalAid", "bizRegistered", "spouseHasIncome"]
      .forEach(function (id) { if ($(id)) $(id).checked = false; });
    if ($("parentExists")) $("parentExists").checked = true;
    if ($("childExists")) $("childExists").checked = true;
    if ($("basisMonth")) $("basisMonth").value = "11";
    applying = false;
    isDemo = true;
    updateSupportFields();
    render();
  }

  function clearAll(focus) {
    applying = true;
    ["age", "incEarned", "incBusiness", "incRental", "incPubPension", "incPrivPension", "incInterest",
      "incOther", "incNonTax", "propHouse", "propOther", "jeonseDeposit", "monthlyRent",
      "loanDeduction", "extraIncome", "extraProperty", "spouseIncome", "sideAnnual"]
      .forEach(function (id) { if ($(id)) $(id).value = "0"; });
    ["siblingWithParent", "siblingWithParentIncome", "siblingIncome", "parentIncome", "childIncome",
      "disabled", "veteran", "medicalAid", "bizRegistered", "spouseHasIncome"]
      .forEach(function (id) { if ($(id)) $(id).checked = false; });
    if ($("parentExists")) $("parentExists").checked = true;
    if ($("childExists")) $("childExists").checked = true;
    $("sameHousehold").checked = true;
    applying = false;
    isDemo = false;
    updateSupportFields();
    render();
    if (focus !== false) {
      var g = $("relation");
      if (g) {
        try { g.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) { g.scrollIntoView(); }
        g.focus({ preventScroll: true });
      }
    }
  }

  /* ---------------- 탭 ---------------- */
  function setTab(next) {
    tab = next === "side" ? "side" : "dependent";
    $("tabDependent").classList.toggle("is-active", tab === "dependent");
    $("tabDependent").setAttribute("aria-selected", String(tab === "dependent"));
    $("tabSide").classList.toggle("is-active", tab === "side");
    $("tabSide").setAttribute("aria-selected", String(tab === "side"));
    $("formDependent").hidden = tab !== "dependent";
    $("formSide").hidden = tab !== "side";
    render();
  }

  /* ---------------- 이벤트 ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    setupGuards();

    $("tabDependent").addEventListener("click", function () { setTab("dependent"); });
    $("tabSide").addEventListener("click", function () { setTab("side"); });
    if ($("miniBar")) $("miniBar").hidden = false;
    if ($("miniJump")) $("miniJump").addEventListener("click", function () {
      $("results").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.addEventListener("input", function (e) {
      if (e.target.matches("input[type=text]")) {
        if (!applying) isDemo = false;
        scheduleRender();
      }
    });
    document.addEventListener("change", function (e) {
      if (!applying) isDemo = false;
      if (e.target.id === "relation" || e.target.id === "marital") updateSupportFields();
      scheduleRender();
    });
    document.addEventListener("focusout", function (e) {
      if (e.target.matches("input[type=text]")) fmtInput(e.target);
    });

    $("results").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      if (act === "clear") clearAll(true);
      else if (act === "demo") applyExample("keep");
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-example]"), function (b) {
      b.addEventListener("click", function () {
        applyExample(b.getAttribute("data-example"));
        $("results").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    $("resetBtn").addEventListener("click", function () { clearAll(true); });
    $("demoBtn").addEventListener("click", function () { applyExample("keep"); });
    if ($("sideReset")) $("sideReset").addEventListener("click", function () { $("sideAnnual").value = "0"; isDemo = false; render(); });

    function convertWon(e) {
      var b = e.target.closest("[data-convert]");
      if (!b) return;
      var id = b.getAttribute("data-convert");
      var from = Number(b.getAttribute("data-from"));
      var el = $(id);
      if (!el || !from) return;
      var v = digits(el.value) ? Number(digits(el.value)) : 0;
      if (v !== from) return;
      el.value = nf.format(Math.round(v / 10000));
      isDemo = false;
      render();
    }
    document.addEventListener("mousedown", convertWon);
    document.addEventListener("click", convertWon);

    updateSupportFields();
    applyExample("keep");
  });
})();
