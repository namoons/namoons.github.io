/*!
 * 2027 월급 실수령액 · 이직 연봉 비교 계산기 UI
 * 계산은 calc.js(SalCalc)에서만 하고, 이 파일은 입력을 읽어 결과를 그립니다.
 */
(function () {
  "use strict";

  var nf = new Intl.NumberFormat("ko-KR");
  var $ = function (id) { return document.getElementById(id); };
  var mode = "compare";
  var isDemo = true;
  var applying = false;

  /* ---------------- 숫자·문자 도우미 ---------------- */
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
  function nonTaxableOf(suffix) {
    return {
      meal: numOf("ntMeal" + suffix),
      car: numOf("ntCar" + suffix),
      childcare: numOf("ntChild" + suffix),
      other: numOf("ntOther" + suffix)
    };
  }

  function readCompare() {
    return {
      annualSalary: manOf("salaryInput"),
      severanceIncluded: $("sevIncludedA").checked,
      nonTaxable: nonTaxableOf("A"),
      preschoolChildren: numOf("preschoolA"),
      dependents: numOf("dependentsA"),
      children: numOf("childrenA"),
      creditChildren: numOf("creditChildrenA"),
      ei2027Reform: $("eiReformA").checked
    };
  }

  function readOffer() {
    return {
      current: {
        annualSalary: manOf("curSalary"),
        incentive: manOf("curIncentive"),
        severanceIncluded: $("curSevIncluded").checked
      },
      offer: {
        annualSalary: manOf("offSalary"),
        incentive: manOf("offIncentive"),
        severanceIncluded: $("offSevIncluded").checked
      },
      nonTaxable: nonTaxableOf(""),
      preschoolChildren: numOf("preschoolB"),
      dependents: numOf("dependentsB"),
      children: numOf("childrenB"),
      creditChildren: numOf("creditChildrenB"),
      ei2027Reform: $("eiReformB").checked
    };
  }

  /* ---------------- 단위 가드 ---------------- */
  var BIG_MAN = 100000;   // 10억원 이상이면 단위 확인 경고
  var MAN_FIELDS = ["salaryInput", "curSalary", "curIncentive", "offSalary", "offIncentive"];
  var WON_FIELDS = ["ntMealA", "ntCarA", "ntChildA", "ntOtherA", "ntMeal", "ntCar", "ntChild", "ntOther"];
  var warnEls = {};

  function setupGuards() {
    MAN_FIELDS.concat(WON_FIELDS).forEach(function (id) {
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
    /* 같은 내용이면 DOM을 그대로 둡니다(경고 안의 환산 버튼을 눌러도 사라지지 않도록). */
    if (w.__warnHtml === html) return;
    w.__warnHtml = html;
    if (html) { w.innerHTML = html; w.hidden = false; }
    else { w.hidden = true; w.innerHTML = ""; }
  }

  function updateGuards() {
    MAN_FIELDS.forEach(function (id) {
      var v = numOf(id);
      if (v >= BIG_MAN) {
        var text = nf.format(v) + "만원 = " + nf.format(Math.round(v / 10000)) + "억원입니다. ";
        var btn = "";
        if (v % 10000 === 0) {
          btn = '<button type="button" class="warn-btn" data-convert="' + id + '" data-from="' + v + '">원→만원으로 바꾸기 (' +
            nf.format(v / 10000) + ')</button>';
        }
        setWarn(id, "만원 단위 칸입니다. " + text + "원 단위로 입력한 것은 아닌지 확인해 주세요." + btn);
      } else {
        setWarn(id, "");
      }
    });
    WON_FIELDS.forEach(function (id) {
      var v = numOf(id);
      if (v > 0 && v < 10000) {
        setWarn(id, "원 단위 칸입니다. " + nf.format(v) + "원은 너무 작습니다. " +
          nf.format(v * 10000) + "원을 의도한 것은 아닌지 확인해 주세요.");
      } else {
        setWarn(id, "");
      }
    });
  }

  /* ---------------- 비과세 요약 ---------------- */
  function nonTaxSummary(p) {
    var nt = p && (p.input ? p.input.nonTaxable : p.nonTaxable);
    if (!nt) return "";
    var parts = [];
    if (nt.applied > 0) parts.push("비과세 인정 월 <b>" + won(nt.applied) + "</b>");
    if (nt.converted > 0) parts.push("한도를 넘어 <b class=\"warn-text\">과세로 전환 " + won(nt.converted) + "</b>");
    if (!parts.length) return "비과세 항목이 없으면 전액 과세로 계산합니다.";
    return parts.join(" · ") + " (연 " + won(nt.applied * 12) + " 비과세)";
  }

  /* ---------------- 결과 카드 도구 ---------------- */
  function toolsBlock() {
    if (isDemo) {
      return '<div class="result-tools">' +
        '<span class="demo-badge">예시 조건으로 계산 중</span>' +
        '<span class="demo-text">아래 숫자는 예시입니다. 한 칸이라도 고치면 이 배지가 사라집니다.</span>' +
        '<button type="button" class="btn-tool is-primary" data-act="clear">내 조건 입력하기</button>' +
        "</div>";
    }
    return '<div class="result-tools">' +
      '<button type="button" class="btn-tool" data-act="clear">모두 지우기</button>' +
      '<button type="button" class="btn-tool" data-act="demo">예시 불러오기</button>' +
      "</div>";
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
    var grossSub = b.input.severanceIncluded ? "퇴직금 포함 연봉÷13" : "비과세 포함";
    var rows = [];
    rows.push(cmpRow("세전 월급", a.monthly.gross, b.monthly.gross, { sub: grossSub }));
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
    var nt = p.input.nonTaxable;
    var rows = [];
    rows.push(["총급여(연)", won(p.annual.gross), p.input.severanceIncluded ? "퇴직금 포함 · 월 " + won(m.gross) + " × 13" : "월 " + won(m.gross) + " × 12"]);
    if (nt && nt.applied) {
      rows.push(["비과세", "−" + won(nt.applied * 12), "월 " + won(nt.applied) +
        (nt.converted ? " · 한도 초과 " + won(nt.converted) + "은 과세 전환" : "")]);
    }
    rows.push(["과세급여", won(p.annual.taxable), ""]);
    rows.push(["근로소득공제", "−" + won(t.earnedDeduction), ""]);
    rows.push(["근로소득금액", won(t.earnedIncome), ""]);
    rows.push(["기본공제", "−" + won(t.basicDeduction), "본인 포함 " + t.basicCount + "명 × 150만원"]);
    rows.push(["국민연금 보험료 공제", "−" + won(t.pensionDeduction), ""]);
    if (t.specialDeductionUsed) {
      rows.push(["건강·장기요양·고용보험료 공제", "−" + won(t.appliedHealthDeduction),
        "표준세액공제(13만원)보다 유리"]);
    }
    rows.push(["과세표준", won(t.taxableBase), "한계세율 " + pct(t.margin, 0)]);
    rows.push(["산출세액", won(t.calculatedTax), ""]);
    if (t.earnedCredit) rows.push(["근로소득세액공제", "−" + won(t.earnedCredit), "세액공제"]);
    if (t.childCredit) rows.push(["자녀세액공제", "−" + won(t.childCredit), "세액공제 · 대상 " + (p.input.creditChildren || 0) + "명"]);
    if (!t.specialDeductionUsed) {
      rows.push(["표준세액공제", "−" + won(t.standardCredit),
        "세액공제 · 보험료 소득공제 " + won(t.healthDeduction) + "를 포기하고 적용"]);
    }
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
      toolsBlock() +
      '<p class="result-big">' + won(b.monthly.net) + "</p>" +
      '<p class="result-sub">세전 월 ' + won(b.monthly.gross) + " · 공제율 " + pct(b.effectiveRate) +
        (b.input.severanceIncluded ? " · 퇴직금 포함 연봉÷13" : "") + "</p>" +
      '<p class="result-note">2026년 ' + won(a.monthly.net) + "보다 <b class=\"" + clsOf(d.monthlyNet) + "\">" +
        signedWon(d.monthlyNet) + "</b> (연 " + signedWon(d.annualNet) + ")</p>" +
      '<p class="result-note">' + nonTaxSummary(c.p) + "</p>" +
      banner +
      '<div class="section-label">항목별 비교 <span>월 기준</span></div>' +
      compareTable(c) +
      mwBanner +
      taxDetail(b, "2027년") +
      taxDetail(a, "2026년") +
      '<p class="small-note">월 소득세는 연말정산 기준 세액을 12로 나눈 예상치입니다. 2027년 국민연금 기준소득월액 상한은 6,590,000원(2027년 6월분까지 확정)으로 계산했고, ' +
      "7월분부터의 상한은 아직 고시 전이라 같은 금액을 가정했습니다. 고용보험은 현행 0.9% 기준이며, " +
      "개정안(근로자 1.0%)을 켜면 반영됩니다.</p>" +
      "</div>";
  }

  /* ---------------- 결과: 이직 비교 ---------------- */
  function compLabel(total, incentive) {
    if (incentive > 0) return "연봉 " + manwon(total - incentive) + " + 인센티브 " + manwon(incentive);
    return "연봉 " + manwon(total);
  }

  function offerRows(o) {
    var c = o.current, f = o.offer;
    var rows = [];
    rows.push(cmpRow("세전 월급", c.monthly.gross, f.monthly.gross, { sub: "인센티브 포함 월 환산" }));
    rows.push(cmpRow("4대보험", c.monthly.insurance, f.monthly.insurance, { sub: "근로자 부담" }));
    rows.push(cmpRow("소득세", c.monthly.incomeTax, f.monthly.incomeTax, {}));
    rows.push(cmpRow("지방소득세", c.monthly.localTax, f.monthly.localTax, {}));
    rows.push(cmpRow("월 실수령액", c.monthly.net, f.monthly.net, { sum: true }));
    rows.push(cmpRow("연 실수령액", c.annual.net, f.annual.net, { sum: true, sub: "12개월 합계" }));
    rows.push(cmpRow("퇴직금 1년분", o.severance.current, o.severance.offer, {
      sub: "세전 적립액" + (o.included.current || o.included.offer ? " (포함 연봉은 ÷13)" : " (÷12)")
    }));
    rows.push(cmpRow("총보상", o.totalComp.current, o.totalComp.offer, {
      sub: "퇴직금 포함 기준" + (o.included.current !== o.included.offer ? " · 포함/별도 차이 반영" : "")
    }));

    return '<div class="cmp-table is-offer">' +
      '<div class="cmp-head"><div class="cmp-label">항목</div>' +
      '<div class="cmp-cell">현 직장</div><div class="cmp-cell">이직 제안</div><div class="cmp-cell">차이</div></div>' +
      rows.join("") + "</div>";
  }

  function offerCard(name, p, total, incentive, included, best) {
    return '<div class="offer-card' + (best ? " is-best" : "") + '">' +
      '<span class="oc-name">' + esc(name) + (best ? ' <span class="oc-badge">유리</span>' : "") + "</span>" +
      '<span class="oc-net">' + won(p.monthly.net) + "</span>" +
      '<span class="oc-meta">세전 월 ' + won(p.monthly.gross) + " · " + compLabel(total, incentive) +
      " · 퇴직금 " + (included ? "포함" : "별도") + "</span></div>";
  }

  function renderOffer(o) {
    var d = o.diff;
    var headline = d.monthlyNet >= 0 ? "+" + won(d.monthlyNet) : "−" + won(-d.monthlyNet);
    var banner;
    if (d.monthlyNet !== 0 || d.totalComp !== 0) {
      banner = '<div class="diff-banner' + (d.monthlyNet < 0 ? " zero" : "") + '">' +
        "세전 총보상은 <strong>" + signedPct(d.nominalRaise) + "</strong>(" + signedWon(d.totalComp) + ") 늘지만, " +
        "세후로는 <strong>" + signedPct(d.realRaise) + "</strong>(" + signedWon(d.annualNet) + ") 늘어납니다. " +
        "세금·4대보험을 빼면 인상분의 " + pct(d.totalComp > 0 ? d.annualNet / d.totalComp : 0, 0) +
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

    var ntNote = "";
    var cv = (o.current.input.nonTaxable.converted || 0) + (o.offer.input.nonTaxable.converted || 0);
    if (cv > 0) {
      ntNote = '<p class="small-note">비과세로 입력한 금액 중 항목별 한도를 넘는 금액은 과세로 전환해 계산했습니다. 두 조건 합계 ' +
        won(cv) + "입니다.</p>";
    }

    var better = d.monthlyNet > 0;

    return '<div class="result-card">' +
      '<div class="result-head"><h2>이직 세후 월 차액</h2><span class="stamp">2027년 요율 기준</span></div>' +
      toolsBlock() +
      '<p class="result-big ' + clsOf(d.monthlyNet) + '">' + headline + "</p>" +
      '<p class="result-sub">실질 인상률 ' + signedPct(d.realRaise) + " (세전 총보상 " + signedPct(d.nominalRaise) + ")</p>" +
      '<p class="result-note">현 직장 월 ' + won(o.current.monthly.net) + " → 이직 후 월 " +
        won(o.offer.monthly.net) + " · 연 " + signedWon(d.annualNet) + "</p>" +
      banner +
      '<div class="section-label">조건 비교 <span>월 기준</span></div>' +
      offerRows(o) +
      '<div class="offer-cards">' +
      offerCard("현 직장", o.current, o.currentTotal, o.currentIncentive, o.included.current, !better && d.monthlyNet !== 0) +
      offerCard("이직 제안", o.offer, o.offerTotal, o.offerIncentive, o.included.offer, better) +
      "</div>" +
      '<div class="plan"><h3>이직 판단에서 놓치기 쉬운 것</h3><ul>' +
      "<li>퇴직금은 총보상의 약 1/12입니다. 제안이 <b>퇴직금 포함 연봉</b>이면 위 입력에서 ‘퇴직금 포함’을 체크해야 월 실수령이 정확해집니다. " +
        "포함/별도는 총보상 기준으로 비교하세요.</li>" +
      "<li>연봉이 국민연금 기준소득월액 상한(월 659만원)을 넘으면 국민연금은 더 오르지 않습니다. 고연봉일수록 세후 인상률이 세전보다 높게 나옵니다.</li>" +
      "<li>인센티브·성과급은 확정 급여가 아닙니다. 지급 조건과 최근 3년 지급률을 확인하고, 기본급 기준으로도 비교해 보세요.</li>" +
      "<li>비과세(식대 월 20만원 등)가 줄면 세전 연봉이 같아도 실수령액이 줄어듭니다.</li>" +
      "</ul></div>" +
      taxDetail(o.offer, "이직 제안") +
      taxDetail(o.current, "현 직장") +
      incentiveNote +
      ntNote +
      '<p class="small-note">퇴직금 1년분은 근속 1년 기준의 세전 적립액입니다. 퇴직소득세와 근속기간은 반영하지 않았습니다. ' +
      "월 소득세는 연말정산 기준을 12로 나눈 예상치입니다.</p>" +
      "</div>";
  }

  function renderEmpty(which) {
    return '<div class="result-card">' +
      '<div class="result-head"><h2>' + (which === "compare" ? "2027년 월 실수령액" : "이직 세후 월 차액") +
      '</h2><span class="stamp">2027년 1월 시행 기준</span></div>' +
      toolsBlock() +
      '<div class="empty-state">' +
      "<strong>연봉을 입력하면 결과가 나타납니다</strong>" +
      "<p>" + (which === "compare"
        ? "1단계 ‘연봉’에 세전 연봉(만원)을 넣어 주세요."
        : "현 직장과 이직 제안의 연봉을 넣어 주세요.") + "</p>" +
      "</div></div>";
  }

  /* ---------------- 미니바 ---------------- */
  function updateMini(text, value) {
    if (!$("miniBar")) return;
    $("miniLabel").textContent = text;
    $("miniValue").textContent = value;
  }

  /* ---------------- 렌더 ---------------- */
  var timer = null;
  var lastResultsHTML = null;
  function paint(html) {
    if (html === lastResultsHTML) return;
    lastResultsHTML = html;
    $("results").innerHTML = html;
  }
  function render() {
    try {
      if (mode === "compare") {
        var input = readCompare();
        var c = SalCalc.compareYears(input);
        var empty = input.annualSalary <= 0;
        paint(empty ? renderEmpty("compare") : renderCompare(c));
        $("ntSummaryA").innerHTML = empty ? "식대·자가운전보조금·보육수당은 항목별 한도가 있고, 기타 비과세는 한도를 급여 담당자에게 확인하세요." : nonTaxSummary(c.p);
        updateMini(empty ? "연봉을 입력하면 결과가 나옵니다" : "2027 월 실수령", empty ? "—" : won(c.y2027.monthly.net));
      } else {
        var ins = readOffer();
        var o = SalCalc.compareOffer(ins);
        var emptyO = ins.current.annualSalary <= 0 && ins.offer.annualSalary <= 0;
        paint(emptyO ? renderEmpty("offer") : renderOffer(o));
        $("ntSummary").innerHTML = emptyO ? "비과세가 달라지면 세전 연봉이 같아도 실수령이 달라집니다." : nonTaxSummary(o.offer);
        updateMini(emptyO ? "연봉을 입력하면 결과가 나옵니다" : "세후 월 차액", emptyO ? "—" : signedWon(o.diff.monthlyNet));
      }
    } catch (e) {
      console.error(e);
      paint('<div class="result-card"><p>입력값을 확인해 주세요.</p></div>');
      updateMini("계산 오류", "-");
    }
    updateGuards();
  }
  function scheduleRender() {
    clearTimeout(timer);
    timer = setTimeout(render, 90);
  }

  /* ---------------- 모드 ---------------- */
  function setMode(next) {
    var wasDemo = isDemo;
    mode = next;
    var isCompare = next === "compare";
    $("tabCompare").classList.toggle("is-active", isCompare);
    $("tabCompare").setAttribute("aria-selected", String(isCompare));
    $("tabOffer").classList.toggle("is-active", !isCompare);
    $("tabOffer").setAttribute("aria-selected", String(!isCompare));
    $("formCompare").hidden = !isCompare;
    $("formOffer").hidden = isCompare;
    if (wasDemo) applyDemo(next);
    else render();
  }

  /* ---------------- 초기값·초기화 ---------------- */
  var DEMO_COMPARE = {
    salaryInput: "5,000",
    ntMealA: "200,000", ntCarA: "0", ntChildA: "0", ntOtherA: "0", preschoolA: "0",
    dependentsA: "2", childrenA: "1", creditChildrenA: "1"
  };
  var DEMO_OFFER = {
    curSalary: "5,000", curIncentive: "0",
    offSalary: "6,000", offIncentive: "500",
    ntMeal: "200,000", ntCar: "0", ntChild: "0", ntOther: "0", preschoolB: "0",
    dependentsB: "2", childrenB: "1", creditChildrenB: "1"
  };
  var ALL_FIELDS = [
    "salaryInput", "ntMealA", "ntCarA", "ntChildA", "ntOtherA", "preschoolA",
    "dependentsA", "childrenA", "creditChildrenA",
    "curSalary", "curIncentive", "offSalary", "offIncentive",
    "ntMeal", "ntCar", "ntChild", "ntOther", "preschoolB",
    "dependentsB", "childrenB", "creditChildrenB"
  ];

  function clearFields() {
    ALL_FIELDS.forEach(function (id) {
      var el = $(id);
      if (el) el.value = "0";
    });
    ["sevIncludedA", "eiReformA", "curSevIncluded", "offSevIncluded", "eiReformB"].forEach(function (id) {
      if ($(id)) $(id).checked = false;
    });
  }

  function applyDemo(nextMode) {
    var m = nextMode || mode;
    applying = true;
    clearFields();
    var src = m === "compare" ? DEMO_COMPARE : DEMO_OFFER;
    Object.keys(src).forEach(function (id) {
      if ($(id)) $(id).value = src[id];
    });
    applying = false;
    isDemo = true;
    render();
  }

  function clearAll() {
    applying = true;
    clearFields();
    applying = false;
    isDemo = false;
    render();
    var first = mode === "compare" ? $("salaryInput") : $("curSalary");
    if (first) {
      try { first.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) { first.scrollIntoView(); }
      first.focus({ preventScroll: true });
    }
  }

  /* ---------------- 이벤트 ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    setupGuards();
    if ($("miniBar")) $("miniBar").hidden = false;
    $("tabCompare").addEventListener("click", function () { setMode("compare"); });
    $("tabOffer").addEventListener("click", function () { setMode("offer"); });

    ["formCompare", "formOffer"].forEach(function (id) {
      var form = $(id);
      form.addEventListener("input", function () {
        if (!applying) isDemo = false;
        scheduleRender();
      });
      form.addEventListener("change", function () {
        if (!applying) isDemo = false;
        scheduleRender();
      });
      form.addEventListener("focusout", function (e) {
        if (e.target.matches('input[type="text"]')) fmtInput(e.target);
      });
    });

    var reset = function () { clearAll(); };
    var demo = function () { applyDemo(); };
    if ($("resetBtn")) $("resetBtn").addEventListener("click", reset);
    if ($("resetBtn2")) $("resetBtn2").addEventListener("click", reset);
    if ($("demoBtn")) $("demoBtn").addEventListener("click", demo);
    if ($("demoBtn2")) $("demoBtn2").addEventListener("click", demo);

    $("miniJump").addEventListener("click", function () {
      $("results").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    $("results").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      if (btn.getAttribute("data-act") === "clear") clearAll();
      else applyDemo();
    });

    /* 단위 가드 환산: 포커스 아웃 재렌더로 click이 사라질 수 있어 mousedown도 받습니다. */
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

    applyDemo("compare");
  });
})();
