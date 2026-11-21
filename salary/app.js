/*!
 * 2027 월급 실수령액 · 이직 연봉 비교 계산기 UI
 * 계산은 calc.js(SalCalc)에서만 하고, 이 파일은 입력을 읽어 결과를 그립니다.
 */
(function () {
  "use strict";

  var nf = new Intl.NumberFormat("ko-KR");
  var $ = function (id) { return document.getElementById(id); };
  var mode = "compare";

  /* ---------------- 숫자·문자 도우미 ---------------- */
  function digits(v) { return String(v == null ? "" : v).replace(/[^\d]/g, ""); }
  function numOf(id) { var d = digits($(id).value); return d ? Number(d) : 0; }
  function manOf(id) { return numOf(id) * 10000; }
  function fmtInput(el) {
    var d = digits(el.value);
    el.value = d ? nf.format(Number(d)) : "";
  }
  function won(v) {
    var n = Math.round(Number(v) || 0);
    return nf.format(n) + "원";
  }
  function signedWon(v) {
    var n = Math.round(Number(v) || 0);
    if (n === 0) return "0원";
    return (n > 0 ? "+" : "−") + nf.format(Math.abs(n)) + "원";
  }
  function manwon(v) {
    var n = Math.round(Number(v) || 0);
    var sign = n < 0 ? "−" : "";
    n = Math.abs(n);
    if (n >= 100000000) {
      var eok = Math.floor(n / 100000000);
      var rest = Math.round((n % 100000000) / 10000);
      return sign + eok + "억" + (rest ? " " + nf.format(rest) + "만" : "") + "원";
    }
    var m = Math.round(n / 10000);
    return sign + nf.format(m) + "만원";
  }
  function pct(v, digits) {
    var d = digits == null ? 1 : digits;
    return (Number(v) * 100).toFixed(d) + "%";
  }
  function signedPct(v, digits) {
    var d = digits == null ? 1 : digits;
    var n = Number(v) * 100;
    if (Math.abs(n) < 0.05) return "0.0%";
    return (n > 0 ? "+" : "−") + Math.abs(n).toFixed(d) + "%";
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function clsOf(n) { return n > 0 ? "pos" : (n < 0 ? "neg" : ""); }

  /* ---------------- 상태 ---------------- */
  function readCompare() {
    return {
      annualSalary: manOf("salaryInput"),
      monthlyNonTaxable: numOf("nontaxableInput"),
      dependents: numOf("dependentsA"),
      children: numOf("childrenA"),
      ei2027Reform: $("eiReformA").checked
    };
  }

  function readOffer() {
    return {
      current: {
        annualSalary: manOf("curSalary"),
        monthlyNonTaxable: numOf("curNontaxable"),
        incentive: manOf("curIncentive")
      },
      offer: {
        annualSalary: manOf("offSalary"),
        monthlyNonTaxable: numOf("offNontaxable"),
        incentive: manOf("offIncentive")
      },
      dependents: numOf("dependentsB"),
      children: numOf("childrenB"),
      ei2027Reform: $("eiReformB").checked
    };
  }

  /* ---------------- 표 조각 ---------------- */
  function cmpRow(label, a, b, opts) {
    opts = opts || {};
    var diff = b - a;
    var diffText = diff === 0 ? "0원" : signedWon(diff);
    return '<div class="cmp-row' + (opts.sum ? " is-sum" : "") + '">' +
      '<div class="cmp-label">' + label +
      (opts.sub ? '<span class="sub">' + opts.sub + "</span>" : "") + "</div>" +
      '<div class="cmp-cell">' + won(a) + "</div>" +
      '<div class="cmp-cell">' + won(b) + "</div>" +
      '<div class="cmp-cell delta ' + (diff === 0 ? "" : clsOf(diff)) + '">' + diffText + "</div>" +
      "</div>";
  }

  function compareTable(c) {
    var a = c.y2026, b = c.y2027;
    var rows = [];
    rows.push(cmpRow("세전 월급", a.monthly.gross, b.monthly.gross, { sub: "비과세 포함" }));
    rows.push(cmpRow("국민연금", a.monthly.np, b.monthly.np, { sub: pct(a.rates.np, 2) + " → " + pct(b.rates.np, 2) }));
    rows.push(cmpRow("건강보험", a.monthly.hi, b.monthly.hi, { sub: "7.19% 동결" }));
    rows.push(cmpRow("장기요양", a.monthly.ltc, b.monthly.ltc, { sub: "건보료의 13.14% → 13.90%" }));
    rows.push(cmpRow("고용보험", a.monthly.ei, b.monthly.ei, { sub: pct(b.rates.ei, 1) + " 기준" }));
    rows.push(cmpRow("소득세", a.monthly.incomeTax, b.monthly.incomeTax, {}));
    rows.push(cmpRow("지방소득세", a.monthly.localTax, b.monthly.localTax, {}));
    rows.push(cmpRow("월 실수령액", a.monthly.net, b.monthly.net, { sum: true }));
    rows.push(cmpRow("연 실수령액", a.annual.net, b.annual.net, { sum: true, sub: "12개월 합계" }));

    return '<div class="cmp-table">' +
      '<div class="cmp-head">' +
      '<div class="cmp-label">항목</div><div class="cmp-cell">2026년</div>' +
      '<div class="cmp-cell">2027년</div><div class="cmp-cell">차이</div></div>' +
      rows.join("") + "</div>";
  }

  function taxDetail(p, label) {
    var t = p.tax, m = p.monthly;
    var rows = [];
    rows.push(["총급여(연)", won(p.annual.gross), "월 " + won(m.gross) + " × 12"]);
    if (p.input.monthlyNonTaxable) {
      rows.push(["비과세", "−" + won(p.input.monthlyNonTaxable * 12), "월 " + won(p.input.monthlyNonTaxable) + " (식대 등)"]);
    }
    rows.push(["과세급여", won(p.annual.taxable), ""]);
    rows.push(["근로소득공제", "−" + won(t.earnedDeduction), ""]);
    rows.push(["근로소득금액", won(t.earnedIncome), ""]);
    rows.push(["기본공제", "−" + won(t.basicDeduction), "본인 포함 " + t.basicCount + "명 × 150만원"]);
    rows.push(["국민연금 보험료 공제", "−" + won(t.pensionDeduction), ""]);
    if (t.specialDeductionUsed) {
      rows.push(["건강·장기요양·고용보험료 공제", "−" + won(t.appliedHealthDeduction),
        "표준세액공제(13만원)보다 유리"]);
    } else {
      rows.push(["표준세액공제", "−" + won(t.standardCredit), "보험료 소득공제 " + won(t.healthDeduction) + "를 포기하고 적용"]);
    }
    rows.push(["과세표준", won(t.taxableBase), "한계세율 " + pct(t.margin, 0)]);
    rows.push(["산출세액", won(t.calculatedTax), ""]);
    if (t.earnedCredit) rows.push(["근로소득세액공제", "−" + won(t.earnedCredit), ""]);
    if (t.childCredit) rows.push(["자녀세액공제", "−" + won(t.childCredit), ""]);
    rows.push(["결정세액(연)", won(p.annual.incomeTax), "월 " + won(m.incomeTax)]);
    rows.push(["지방소득세(연)", won(p.annual.localTax), "월 " + won(m.localTax)]);
    rows.push(["연 실수령액", won(p.annual.net), "월 평균 " + won(Math.round(p.annual.net / 12)), "sum"]);

    return '<details class="person-detail">' +
      "<summary><span>" + esc(label) + " 세액 계산</span><span>연 소득세 " + won(p.annual.incomeTax) + "</span></summary>" +
      '<div class="breakdown">' +
      rows.map(function (r) {
        var isSum = r[3] === "sum";
        return '<div class="bk-row' + (isSum ? " sum" : "") + '">' +
          '<div class="bk-label">' + r[0] +
          (r[2] ? '<span class="sub">' + esc(r[2]) + "</span>" : "") +
          '</div><div class="bk-value">' + r[1] + "</div></div>";
      }).join("") +
      "</div></details>";
  }

  /* ---------------- 결과: 2026 vs 2027 ---------------- */
  function renderCompare(c) {
    var a = c.y2026, b = c.y2027, d = c.diff;
    var bannerCls = d.monthlyNet < 0 ? "" : " zero";
    var banner;
    if (d.monthlyNet < 0) {
      banner = '<div class="diff-banner">2027년 1월부터 <strong>같은 연봉이면 월 ' +
        nf.format(Math.abs(d.monthlyNet)) + "원</strong> 덜 받습니다. 연간으로는 <strong>" +
        won(Math.abs(d.annualNet)) + "</strong> 줄어듭니다. 국민연금 요율이 4.75%→5.0%로 오르고, " +
        "장기요양보험료가 건강보험료의 13.14%→13.90%로 오른 영향입니다.</div>";
    } else if (d.monthlyNet > 0) {
      banner = '<div class="diff-banner zero">2027년 월 실수령액이 오히려 ' + won(d.monthlyNet) +
        " 늘어납니다. 소득세가 줄어든 경우입니다.</div>";
    } else {
      banner = '<div class="diff-banner zero">2026년과 2027년 월 실수령액이 같습니다.</div>';
    }

    var mw = b.minimumWage;
    var mwBanner = mw.ok
      ? '<div class="mw-check"><span class="mw-badge ok">최저임금 이상</span> 2027년 최저임금 월 환산액 ' +
        won(mw.monthly) + "(시급 " + won(mw.hourly) + " · 209시간)보다 <b>" + won(mw.gap) + "</b> 높습니다.</div>"
      : '<div class="mw-check"><span class="mw-badge warn">최저임금 미달</span> 세전 월급이 2027년 최저임금 월 환산액 ' +
        won(mw.monthly) + "보다 <b>" + won(-mw.gap) + "</b> 낮습니다. 최저임금은 비과세를 포함한 세전 임금으로 판단합니다.</div>";

    return '<div class="result-card">' +
      '<div class="result-head"><h2>2027년 월 실수령액</h2><span class="stamp">2027년 1월 시행 기준</span></div>' +
      '<p class="result-big">' + won(b.monthly.net) + "</p>" +
      '<p class="result-sub">세전 월 ' + won(b.monthly.gross) + " · 공제율 " + pct(b.effectiveRate) + "</p>" +
      '<p class="result-note">2026년 ' + won(a.monthly.net) + "보다 <b class=\"" + clsOf(d.monthlyNet) + "\">" +
        signedWon(d.monthlyNet) + "</b> (연 " + signedWon(d.annualNet) + ")</p>" +
      banner +
      '<div class="section-label">항목별 비교 <span>월 기준</span></div>' +
      compareTable(c) +
      mwBanner +
      taxDetail(b, "2027년") +
      taxDetail(a, "2026년") +
      '<p class="small-note">2027년 국민연금 기준소득월액 상한은 6,590,000원(2027년 6월분까지 확정)으로 계산했습니다. ' +
      "7월분부터의 상한은 아직 고시 전이라 같은 금액을 가정했습니다. 고용보험은 현행 0.9% 기준이며, " +
      "개정안(근로자 1.0%)을 켜면 반영됩니다.</p>" +
      "</div>";
  }

  /* ---------------- 결과: 이직 비교 ---------------- */
  function offerRows(o) {
    var c = o.current, f = o.offer;
    var rows = [];
    rows.push(cmpRow("세전 월급", c.monthly.gross, f.monthly.gross, { sub: "인센티브 포함 월 환산" }));
    rows.push(cmpRow("4대보험", c.monthly.insurance, f.monthly.insurance, { sub: "근로자 부담" }));
    rows.push(cmpRow("소득세", c.monthly.incomeTax, f.monthly.incomeTax, {}));
    rows.push(cmpRow("지방소득세", c.monthly.localTax, f.monthly.localTax, {}));
    rows.push(cmpRow("월 실수령액", c.monthly.net, f.monthly.net, { sum: true }));
    rows.push(cmpRow("연 실수령액", c.annual.net, f.annual.net, { sum: true, sub: "12개월 합계" }));
    rows.push(cmpRow("퇴직금 1년분", o.severance.current, o.severance.offer, { sub: "총보상 ÷ 12, 세전" }));

    return '<div class="cmp-table is-offer">' +
      '<div class="cmp-head"><div class="cmp-label">항목</div>' +
      '<div class="cmp-cell">현 직장</div><div class="cmp-cell">이직 제안</div><div class="cmp-cell">차이</div></div>' +
      rows.join("") + "</div>";
  }

  function renderOffer(o) {
    var d = o.diff;
    var headline = d.monthlyNet >= 0 ? "+" + won(d.monthlyNet) : "−" + won(-d.monthlyNet);
    var banner;
    if (d.monthlyNet > 0 || d.monthlyNet < 0) {
      banner = '<div class="diff-banner' + (d.monthlyNet < 0 ? " zero" : "") + '">' +
        "세전 연봉은 <strong>" + signedPct(d.nominalRaise) + "</strong>(" + signedWon(d.annualGross) + ") 늘지만, " +
        "세후로는 <strong>" + signedPct(d.realRaise) + "</strong>(" + signedWon(d.annualNet) + ") 늘어납니다. " +
        "세금·4대보험을 빼면 인상분의 " + pct(d.annualGross > 0 ? d.annualNet / d.annualGross : 0, 0) +
        "가 손에 들어옵니다.</div>";
    } else {
      banner = '<div class="diff-banner zero">두 제안의 세후 월 실수령액이 같습니다.</div>';
    }

    var incentiveNote = "";
    if (o.offerIncentive > 0) {
      incentiveNote = '<p class="small-note">이직 제안의 인센티브 ' + manwon(o.offerIncentive) +
        "은 매월 균등하게 받는다고 가정해 12로 나눠 반영했습니다. 실제 지급 시점·성과 조건에 따라 월 실수령액은 달라지고, " +
        "퇴직금 산정의 평균임금에도 포함될 수 있습니다.</p>";
    }

    return '<div class="result-card">' +
      '<div class="result-head"><h2>이직 세후 월 차액</h2><span class="stamp">2027년 요율 기준</span></div>' +
      '<p class="result-big ' + clsOf(d.monthlyNet) + '">' + headline + "</p>" +
      '<p class="result-sub">실질 인상률 ' + signedPct(d.realRaise) + " (세전 " + signedPct(d.nominalRaise) + ")</p>" +
      '<p class="result-note">현 직장 월 ' + won(o.current.monthly.net) + " → 이직 후 월 " +
        won(o.offer.monthly.net) + " · 연 " + signedWon(d.annualNet) + "</p>" +
      banner +
      '<div class="section-label">조건 비교 <span>월 기준</span></div>' +
      offerRows(o) +
      '<div class="offer-cards">' +
      '<div class="offer-card"><span class="oc-name">현 직장</span>' +
      '<span class="oc-net">' + won(o.current.monthly.net) + "</span>" +
      '<span class="oc-meta">세전 월 ' + won(o.current.monthly.gross) + " · 연봉 " + manwon(o.currentTotal) + "</span></div>" +
      '<div class="offer-card is-best"><span class="oc-name">이직 제안</span>' +
      '<span class="oc-net">' + won(o.offer.monthly.net) + "</span>" +
      '<span class="oc-meta">세전 월 ' + won(o.offer.monthly.gross) + " · 연봉 " + manwon(o.offerTotal) + "</span></div>" +
      "</div>" +
      '<div class="plan"><h3>이직 판단에서 놓치기 쉬운 것</h3><ul>' +
      "<li>퇴직금은 총보상의 약 1/12입니다. 이직 시 <b>퇴직금 포함 연봉</b>인지 <b>별도</b>인지 반드시 확인하세요. 포함이면 실질 연봉은 " +
        manwon(Math.round(o.offerTotal * 12 / 13)) + " 수준입니다.</li>" +
      "<li>연봉이 국민연금 기준소득월액 상한(월 659만원)을 넘으면 국민연금은 더 오르지 않습니다. 고연봉일수록 세후 인상률이 세전보다 높게 나옵니다.</li>" +
      "<li>인센티브·성과급은 확정 급여가 아닙니다. 지급 조건과 최근 3년 지급률을 확인하고, 기본급 기준으로도 비교해 보세요.</li>" +
      "<li>비과세(식대 월 20만원 등)가 줄면 세전 연봉이 같아도 실수령액이 줄어듭니다.</li>" +
      "</ul></div>" +
      taxDetail(o.offer, "이직 제안") +
      taxDetail(o.current, "현 직장") +
      incentiveNote +
      '<p class="small-note">퇴직금 1년분은 근속 1년 기준의 세전 적립액(총보상 ÷ 12)입니다. 퇴직소득세와 근속기간은 반영하지 않았습니다.</p>' +
      "</div>";
  }

  /* ---------------- 미니바 ---------------- */
  function updateMini(text, value) {
    if (!$("miniBar")) return;
    $("miniLabel").textContent = text;
    $("miniValue").textContent = value;
  }

  /* ---------------- 렌더 ---------------- */
  var timer = null;
  function render() {
    try {
      if (mode === "compare") {
        var c = SalCalc.compareYears(readCompare());
        $("results").innerHTML = renderCompare(c);
        updateMini("2027 월 실수령", won(c.y2027.monthly.net));
      } else {
        var o = SalCalc.compareOffer(readOffer());
        $("results").innerHTML = renderOffer(o);
        updateMini("세후 월 차액", signedWon(o.diff.monthlyNet));
      }
    } catch (e) {
      console.error(e);
      $("results").innerHTML = '<div class="result-card"><p>입력값을 확인해 주세요.</p></div>';
      updateMini("계산 오류", "-");
    }
  }
  function scheduleRender() {
    clearTimeout(timer);
    timer = setTimeout(render, 90);
  }

  /* ---------------- 모드 ---------------- */
  function setMode(next) {
    mode = next;
    var isCompare = next === "compare";
    $("tabCompare").classList.toggle("is-active", isCompare);
    $("tabCompare").setAttribute("aria-selected", String(isCompare));
    $("tabOffer").classList.toggle("is-active", !isCompare);
    $("tabOffer").setAttribute("aria-selected", String(!isCompare));
    $("formCompare").hidden = !isCompare;
    $("formOffer").hidden = isCompare;
    render();
  }

  /* ---------------- 초기값·초기화 ---------------- */
  var DEFAULTS = {
    salaryInput: "5,000",
    nontaxableInput: "200,000",
    dependentsA: "2",
    childrenA: "1",
    curSalary: "5,000",
    curNontaxable: "200,000",
    curIncentive: "0",
    offSalary: "6,000",
    offNontaxable: "200,000",
    offIncentive: "500",
    dependentsB: "2",
    childrenB: "1"
  };

  function resetAll() {
    Object.keys(DEFAULTS).forEach(function (id) {
      if ($(id)) $(id).value = DEFAULTS[id];
    });
    $("eiReformA").checked = false;
    $("eiReformB").checked = false;
    render();
  }

  /* ---------------- 이벤트 ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    if ($("miniBar")) $("miniBar").hidden = false;
    $("tabCompare").addEventListener("click", function () { setMode("compare"); });
    $("tabOffer").addEventListener("click", function () { setMode("offer"); });

    ["formCompare", "formOffer"].forEach(function (id) {
      var form = $(id);
      form.addEventListener("input", scheduleRender);
      form.addEventListener("change", scheduleRender);
      form.addEventListener("focusout", function (e) {
        if (e.target.matches('input[type="text"]')) fmtInput(e.target);
      });
    });

    $("resetBtn").addEventListener("click", resetAll);
    if ($("resetBtn2")) $("resetBtn2").addEventListener("click", resetAll);
    $("miniJump").addEventListener("click", function () {
      $("results").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    render();
  });

  if (document.readyState !== "loading" && document.getElementById("results")) {
    render();
  }
})();
