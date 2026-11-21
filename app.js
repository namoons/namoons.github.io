/*!
 * 연말정산 계산기 UI (2026년 귀속)
 * 계산은 calc.js(YECalc)에서만 하고, 이 파일은 입력을 읽어 결과를 그립니다.
 */
(function () {
  "use strict";

  var nf = new Intl.NumberFormat("ko-KR");
  var $ = function (id) { return document.getElementById(id); };

  var mode = "couple";
  var childrenInitialized = false;

  /* ---------------- 입력 도우미 ---------------- */
  function digits(v) {
    return String(v == null ? "" : v).replace(/[^\d]/g, "");
  }
  function numOf(id) {
    var d = digits($(id).value);
    return d ? Number(d) : 0;
  }
  function manOf(id) { return numOf(id) * 10000; }
  function fmtInput(el, suffix) {
    var d = digits(el.value);
    el.value = d ? nf.format(Number(d)) + (suffix || "") : "";
  }
  function won(v) {
    var n = Math.round(Number(v) || 0);
    return (n > 0 ? "" : "") + nf.format(n) + "원";
  }
  function signedWon(v) {
    var n = Math.round(Number(v) || 0);
    if (n === 0) return "0원";
    return (n > 0 ? "+" : "−") + nf.format(Math.abs(n)) + "원";
  }
  function manwon(v) {
    var n = Math.round(Number(v) || 0);
    if (Math.abs(n) >= 100000000) {
      var eok = Math.floor(n / 100000000);
      var rest = Math.round((n % 100000000) / 10000);
      return eok + "억" + (rest ? " " + nf.format(rest) + "만" : "") + "원";
    }
    var m = Math.round(n / 10000);
    return nf.format(m) + "만원";
  }
  function pct(v) { return Math.round((v || 0) * 100) + "%"; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------- 자녀 행 ---------------- */
  var SCHOOL_LABEL = {
    preschool: "미취학·취학전",
    school: "초·중·고",
    college: "대학생",
    none: "해당 없음"
  };

  function childRow(birthYear, school) {
    var wrap = document.createElement("div");
    wrap.className = "child-row";
    wrap.innerHTML =
      '<label class="field"><span class="field-label">출생연도</span>' +
      '<span class="input-wrap"><input class="child-birth" type="text" inputmode="numeric" value="' +
      (birthYear || 2012) + '" aria-label="자녀 출생연도"><span class="unit">년</span></span></label>' +
      '<label class="field"><span class="field-label">학령</span>' +
      '<select class="child-school" aria-label="자녀 학령">' +
      Object.keys(SCHOOL_LABEL).map(function (k) {
        return '<option value="' + k + '"' + (k === (school || "school") ? " selected" : "") + ">" + SCHOOL_LABEL[k] + "</option>";
      }).join("") +
      "</select></label>" +
      '<button type="button" class="btn-remove" aria-label="자녀 삭제">×</button>';
    return wrap;
  }

  function renderChildren() {
    var box = $("children");
    if (!box) return;
    if (!box.children.length) {
      box.appendChild(childRow(2012, "school"));
      box.appendChild(childRow(2015, "school"));
    }
  }

  /* ---------------- 상태 읽기 ---------------- */
  function readChildren() {
    return Array.prototype.map.call(document.querySelectorAll("#children .child-row"), function (row) {
      var by = digits(row.querySelector(".child-birth").value);
      return {
        birthYear: by ? Number(by) : 2016,
        school: row.querySelector(".child-school").value
      };
    });
  }

  function readState() {
    var children = readChildren();
    return {
      mode: mode,
      husband: {
        gross: manOf("hGross"),
        prepaid: numOf("hPrepaid"),
        pension: manOf("hPension"),
        insurance: manOf("hInsurance"),
        card: {
          credit: manOf("hCardCredit"),
          check: manOf("hCardCheck"),
          traditional: manOf("hCardTraditional"),
          transit: manOf("hCardTransit"),
          culture: manOf("hCardCulture")
        }
      },
      wife: {
        gross: mode === "single" ? 0 : manOf("wGross"),
        prepaid: mode === "single" ? 0 : numOf("wPrepaid"),
        pension: mode === "single" ? 0 : manOf("wPension"),
        insurance: mode === "single" ? 0 : manOf("wInsurance"),
        card: {
          credit: mode === "single" ? 0 : manOf("wCardCredit"),
          check: mode === "single" ? 0 : manOf("wCardCheck"),
          traditional: mode === "single" ? 0 : manOf("wCardTraditional"),
          transit: mode === "single" ? 0 : manOf("wCardTransit"),
          culture: mode === "single" ? 0 : manOf("wCardCulture")
        }
      },
      children: children,
      parents: {
        count: numOf("pCount"),
        seniors: numOf("pSenior"),
        disabled: numOf("pDisabled")
      },
      childCard: manOf("childCard"),
      medical: { general: manOf("medGeneral"), unlimited: manOf("medUnlimited") },
      education: { school: manOf("eduSchool"), college: manOf("eduCollege") },
      donation: manOf("donation"),
      rent: manOf("rent"),
      spouseDependent: mode === "single" && $("spouseDependent").checked,
      singleParent: mode === "single" && $("singleParent").checked,
      autoInsurance: $("autoInsurance").checked
    };
  }

  /* ---------------- 결과 그리기 ---------------- */
  function refundLine(total) {
    if (total.prepaid <= 0) {
      return {
        cls: "",
        big: won(total.determinedTax),
        sub: "예상 결정세액 합계",
        note: "기납부세액을 입력하면 환급액 또는 추가 납부액을 계산해 드립니다."
      };
    }
    var r = total.refund;
    return {
      cls: r > 0 ? "pos" : (r < 0 ? "neg" : ""),
      big: r >= 0 ? "+" + won(r) : "−" + won(-r),
      sub: r >= 0 ? "환급 예상 (소득세)" : "추가 납부 예상 (소득세)",
      note: "결정세액 합계 " + won(total.determinedTax) +
        " · 지방소득세 포함 " + (r >= 0 ? "+" : "−") + won(Math.abs(Math.round(r * 1.1)))
    };
  }

  function scenarioCard(name, sc, isBest) {
    var line = refundLine(sc.total);
    var valCls = line.cls === "pos" ? "pos" : (line.cls === "neg" ? "neg" : "");
    var meta = "<span>남편 <b>" + signedWon(sc.husband.refund) + "</b></span>";
    if (sc.wife) meta += "<span>아내 <b>" + signedWon(sc.wife.refund) + "</b></span>";
    meta += "<span>결정세액 <b>" + won(sc.total.determinedTax) + "</b></span>";
    if (sc.total.prepaid <= 0) meta = "<span>결정세액 <b>" + won(sc.total.determinedTax) + "</b></span>";
    return '<div class="scenario' + (isBest ? " is-best" : "") + '">' +
      '<div class="scenario-top"><span class="scenario-name">' + esc(name) + "</span>" +
      (isBest ? '<span class="badge-best">추천</span>' : "") + "</div>" +
      '<div class="scenario-value ' + valCls + '">' + line.big + "</div>" +
      '<div class="scenario-meta">' + meta + "</div></div>";
  }

  function buildPlan(out) {
    var h = out.household, a = out.optimal.alloc;
    var items = [];
    var H = "남편", W = "아내";
    var childGroups = [[], []];
    a.childOwner.forEach(function (o, i) {
      var c = h.children[i];
      if (c) childGroups[o].push(c);
    });

    [0, 1].forEach(function (who) {
      var kids = childGroups[who];
      if (!kids.length) return;
      var years = kids.map(function (k) { return k.birthYear + "년"; }).join("·");
      var creditCount = kids.filter(function (k) { return (2026 - k.birthYear) <= 20 && k.birthYear <= 2016; }).length;
      var credit = creditCount === 0 ? 0 : (creditCount === 1 ? 250000 : (creditCount === 2 ? 550000 : 550000 + (creditCount - 2) * 400000));
      items.push("자녀 " + kids.length + "명(" + years + "생) → <b>" + (who === 0 ? H : W) + "</b> · 기본공제 " +
        manwon(kids.length * 1500000) + (credit ? " + 자녀세액공제 " + manwon(credit) : " (자녀세액공제 대상 아님)"));
    });

    if (h.parents.count > 0) {
      items.push("부모님 등 부양가족 " + h.parents.count + "명 → <b>" + (a.parentOwner === 0 ? H : W) + "</b> · 기본공제 " +
        manwon(h.parents.count * 1500000) +
        (h.parents.seniors ? " + 경로우대 " + manwon(h.parents.seniors * 1000000) : "") +
        (h.parents.disabled ? " + 장애인 " + manwon(h.parents.disabled * 2000000) : ""));
    }

    var medTotal = h.medical.general + h.medical.unlimited;
    if (medTotal > 0) {
      var shareH = Math.round(a.medicalShareH * 100);
      var target = shareH >= 50 ? H : W;
      var share = shareH >= 50 ? shareH : 100 - shareH;
      var hThresh = h.husband.gross * 0.03, wThresh = h.wife.gross * 0.03;
      items.push("의료비 " + manwon(medTotal) + " 중 " + share + "% → <b>" + target + "</b> · 3% 문턱 " +
        manwon(target === H ? hThresh : wThresh) +
        " (다른 쪽 " + manwon(target === H ? wThresh : hThresh) + ")");
    }

    if (h.rent > 0) {
      var renter = a.rentOwner === 0 ? H : W;
      items.push("월세 " + manwon(h.rent) + " → <b>" + renter + "</b> · 총급여 " +
        ((a.rentOwner === 0 ? h.husband.gross : h.wife.gross) <= 55000000 ? "5,500만원 이하 17%" : "15%") + " 구간");
    }

    if (h.donation > 0) {
      items.push("기부금 " + manwon(h.donation) + " → <b>" + (a.donationOwner === 0 ? H : W) + "</b>");
    }

    if (h.childCard > 0 && h.children.length > 0) {
      var cardTarget = childGroups[0].length >= childGroups[1].length ? H : W;
      items.push("자녀 명의 카드 " + manwon(h.childCard) + " → <b>" + cardTarget + "</b> 쪽 사용액에 합산");
    }

    if (h.education.school + h.education.college > 0) {
      items.push("교육비는 자녀를 기본공제로 올린 쪽 몫으로 계산됩니다 (1명당 초·중·고 300만원, 대학 900만원 한도)");
    }

    items.push("카드·연금저축은 각자 명의 그대로 계산합니다 (맞벌이는 서로 합산 불가)");

    [out.optimal.husband, out.optimal.wife].forEach(function (p, i) {
      if (!p || !p.standardCreditApplied) return;
      items.push((i === 0 ? H : W) + "는 특별세액공제 합계가 13만원보다 적어 <b>표준세액공제 13만원</b>을 적용했습니다. " +
        "대신 건강·고용보험료 소득공제(" + manwon(p.healthDeductionIfSpecial) + ")를 포기한 결과입니다.");
    });

    // 남는 세액공제 안내
    [out.optimal.husband, out.optimal.wife].forEach(function (p, i) {
      if (!p) return;
      var unused = p.credits.total - p.credits.used;
      if (unused > 0) {
        items.push((i === 0 ? H : W) + "는 산출세액이 작아 세액공제 " + manwon(unused) +
          "이 반영되지 않았습니다. 이만큼은 다른 쪽에 배분하는 편이 낫습니다.");
      }
    });

    return items;
  }

  function breakdownTable(p, label) {
    var c = p.credits;
    var rows = [];
    rows.push(["근로소득공제", "-" + won(p.earnedDeduction), "총급여 " + won(p.gross) + " 기준"]);
    rows.push(["근로소득금액", won(p.earnedIncome), ""]);
    rows.push(["인적공제", "-" + won(p.personal.total), "기본공제 " + p.personal.basicCount + "명(본인 포함)" +
      (p.personal.senior ? " + 경로우대" : "") + (p.personal.disabled ? " + 장애인" : "")]);
    if (p.pensionDeduction) rows.push(["국민연금 보험료", "-" + won(p.pensionDeduction), ""]);
    if (p.healthDeduction) rows.push(["건강·장기요양·고용보험료", "-" + won(p.healthDeduction), ""]);
    if (p.cardDeductionApplied) {
      rows.push(["신용카드 등 소득공제", "-" + won(p.cardDeductionApplied),
        "25% 문턱 " + manwon(p.card.threshold) + " · 기본한도 " + manwon(p.card.baseLimit)]);
    }
    rows.push(["과세표준", won(p.taxableBase), "한계세율 " + pct(p.marginalRate)]);
    rows.push(["산출세액", won(p.calculatedTax), ""]);
    if (c.earnedIncome) rows.push(["근로소득세액공제", "-" + won(c.earnedIncome), ""]);
    if (c.child) rows.push(["자녀세액공제", "-" + won(c.child), ""]);
    if (c.pension) rows.push(["연금계좌 세액공제", "-" + won(c.pension), ""]);
    if (c.insurance) rows.push(["보장성보험 세액공제", "-" + won(c.insurance), ""]);
    if (c.medical) rows.push(["의료비 세액공제", "-" + won(c.medical), "공제대상 " + manwon(p.bases.medical) + " (문턱 " + manwon(p.bases.medicalThreshold) + ")"]);
    if (c.education) rows.push(["교육비 세액공제", "-" + won(c.education), "공제대상 " + manwon(p.bases.education)]);
    if (c.donation) rows.push(["기부금 세액공제", "-" + won(c.donation), ""]);
    if (c.rent) rows.push(["월세 세액공제", "-" + won(c.rent), "월세 " + manwon(p.bases.rent) + " × " + pct(p.bases.rentRate)]);
    if (c.standard) rows.push(["표준세액공제", "-" + won(c.standard), "건강·고용보험료 소득공제 " + manwon(p.healthDeductionIfSpecial) + " 포기하고 적용"]);
    rows.push(["결정세액", won(p.determinedTax), p.standardCreditApplied ? "표준세액공제 적용" : ""]);
    if (p.prepaid) {
      rows.push(["기납부세액", won(p.prepaid), ""]);
      rows.push([p.refund >= 0 ? "환급 예상" : "추가 납부", signedWon(p.refund), "지방소득세 포함 " + signedWon(Math.round(p.refund * 1.1)), "sum"]);
    }

    return '<details class="person-detail">' +
      "<summary><span>" + esc(label) + " 상세 계산</span><span>결정세액 " + won(p.determinedTax) + "</span></summary>" +
      '<div class="breakdown">' +
      rows.map(function (r) {
        var isSum = r[3] === "sum";
        var neg = String(r[1]).charAt(0) === "−";
        return '<div class="bk-row' + (isSum ? " sum" : "") + '">' +
          '<div class="bk-label">' + r[0] +
          (r[2] && r[2] !== "sum" ? '<span class="sub">' + esc(r[2]) + "</span>" : "") +
          '</div><div class="bk-value' + (isSum && neg ? " neg" : "") + '">' + r[1] + "</div></div>";
      }).join("") +
      "</div></details>";
  }

  function renderCouple(out) {
    var opt = out.optimal;
    var line = refundLine(opt.total);
    var diff = opt.total.refund - out.bestSingle.total.refund;
    var banner;

    if (opt.total.prepaid <= 0) {
      var gap = out.bestSingle.total.determinedTax - opt.total.determinedTax;
      banner = gap > 0
        ? '<div class="diff-banner">배분만 바꿔도 결정세액이 <strong>' + won(gap) + "</strong> 줄어듭니다. 아래 ‘최적 분할’이 그 배분입니다.</div>"
        : '<div class="diff-banner zero">두 사람의 세율 구간이 비슷해 배분에 따른 세금 차이가 거의 없습니다.</div>';
    } else if (diff > 0) {
      banner = '<div class="diff-banner">같은 소득·지출이라도 배분에 따라 <strong>' + won(diff) +
        "</strong> 더 돌려받습니다. ‘최적 분할’이 가장 유리한 조합입니다.</div>";
    } else {
      banner = '<div class="diff-banner zero">한쪽에 몰아주는 것과 최적 분할의 결과가 같습니다. 두 사람의 세율 구간과 문턱이 비슷하기 때문입니다.</div>';
    }

    return '<div class="result-card">' +
      '<div class="result-head"><h2>계산 결과</h2><span class="stamp">2026년 귀속 · 최적 분할</span></div>' +
      '<p class="result-big ' + line.cls + '">' + line.big + "</p>" +
      '<p class="result-sub">' + line.sub + "</p>" +
      '<p class="result-note">' + line.note + "</p>" +
      '<div class="scenario-list">' +
      scenarioCard("남편에게 몰아주기", out.husbandAll, false) +
      scenarioCard("아내에게 몰아주기", out.wifeAll, false) +
      scenarioCard("최적 분할", opt, true) +
      "</div>" +
      banner +
      '<div class="plan"><h3>최적 분할은 이렇게 나뉩니다</h3><ul><li>' +
      buildPlan(out).join("</li><li>") + "</li></ul></div>" +
      breakdownTable(opt.husband, "남편") +
      breakdownTable(opt.wife, "아내") +
      '<p class="small-note">결과는 소득세 기준이며, 결정세액의 10%인 지방소득세가 함께 정산됩니다. ' +
      "입력하지 않은 공제(주택자금·청약저축 등)는 반영되지 않았습니다.</p>" +
      "</div>";
  }

  function renderSingle(out) {
    var p = out.scenario.husband;
    var line = refundLine(out.scenario.total);
    return '<div class="result-card">' +
      '<div class="result-head"><h2>계산 결과</h2><span class="stamp">2026년 귀속</span></div>' +
      '<p class="result-big ' + line.cls + '">' + line.big + "</p>" +
      '<p class="result-sub">' + line.sub + "</p>" +
      '<p class="result-note">' + line.note + "</p>" +
      '<div class="plan" style="margin-top:14px"><h3>적용된 공제</h3><ul>' +
      singlePlan(out).map(function (t) { return "<li>" + t + "</li>"; }).join("") +
      "</ul></div>" +
      breakdownTable(p, "본인") +
      '<p class="small-note">결과는 소득세 기준이며, 결정세액의 10%인 지방소득세가 함께 정산됩니다.</p>' +
      "</div>";
  }

  function singlePlan(out) {
    var p = out.scenario.husband;
    var items = [];
    items.push("근로소득공제 " + manwon(p.earnedDeduction) + " 자동 적용");
    items.push("인적공제 " + manwon(p.personal.total) + " (기본공제 " + p.personal.basicCount + "명)");
    if (p.card.deduction) items.push("신용카드 등 소득공제 " + manwon(p.cardDeductionApplied));
    if (p.credits.child) items.push("자녀세액공제 " + manwon(p.credits.child));
    if (p.credits.pension) items.push("연금계좌 세액공제 " + manwon(p.credits.pension));
    if (p.credits.medical) items.push("의료비 세액공제 " + manwon(p.credits.medical));
    if (p.credits.education) items.push("교육비 세액공제 " + manwon(p.credits.education));
    if (p.credits.rent) items.push("월세 세액공제 " + manwon(p.credits.rent));
    if (p.credits.standard) items.push("표준세액공제 13만원 적용 (특별세액공제보다 유리)");
    return items;
  }

  /* ---------------- 미니바 ---------------- */
  function updateMini(out) {
    var bar = $("miniBar");
    var label = $("miniLabel");
    var value = $("miniValue");
    if (!bar) return;
    if (out.single) {
      var line = refundLine(out.scenario.total);
      label.textContent = line.sub;
      value.textContent = line.big;
      value.style.color = line.cls === "pos" ? "#0b7a53" : (line.cls === "neg" ? "#b42318" : "#16202e");
    } else {
      var l2 = refundLine(out.optimal.total);
      label.textContent = "최적 분할 · " + l2.sub;
      value.textContent = l2.big;
      value.style.color = l2.cls === "pos" ? "#0b7a53" : (l2.cls === "neg" ? "#b42318" : "#16202e");
    }
  }

  /* ---------------- 렌더 ---------------- */
  var timer = null;
  function render() {
    var out;
    try {
      out = YECalc.run(readState());
    } catch (e) {
      console.error(e);
      $("results").innerHTML = '<div class="result-card"><p>입력값을 확인해 주세요.</p></div>';
      return;
    }
    $("results").innerHTML = out.single ? renderSingle(out) : renderCouple(out);
    updateMini(out);
  }
  function scheduleRender() {
    clearTimeout(timer);
    timer = setTimeout(render, 90);
  }

  /* ---------------- 모드 전환 ---------------- */
  function setMode(next) {
    mode = next;
    var couple = next === "couple";
    $("tabSingle").classList.toggle("is-active", !couple);
    $("tabSingle").setAttribute("aria-selected", String(!couple));
    $("tabCouple").classList.toggle("is-active", couple);
    $("tabCouple").setAttribute("aria-selected", String(couple));
    ["wifeCol", "wifeCardCol", "wifePensionCol"].forEach(function (id) {
      var el = $(id);
      if (el) el.hidden = !couple;
    });
    $("singleExtras").hidden = couple;
    document.body.classList.toggle("single-mode", !couple);
    $("hName").textContent = couple ? "남편" : "본인";
    render();
  }

  /* ---------------- 초기값 ---------------- */
  var DEMO = {
    hGross: "6,000", hPrepaid: "2,400,000", wGross: "4,000", wPrepaid: "900,000",
    hCardCredit: "18,000", hCardCheck: "6,000", hCardTraditional: "600", hCardTransit: "800", hCardCulture: "0",
    wCardCredit: "12,000", wCardCheck: "5,000", wCardTraditional: "400", wCardTransit: "600", wCardCulture: "0",
    childCard: "120", hPension: "300", hInsurance: "72", wPension: "0", wInsurance: "60",
    medUnlimited: "100", medGeneral: "200", eduSchool: "600", eduCollege: "0", donation: "0", rent: "0",
    pCount: "0", pSenior: "0", pDisabled: "0"
  };

  function applyDemo() {
    Object.keys(DEMO).forEach(function (id) { $(id).value = DEMO[id]; });
    $("autoInsurance").checked = true;
    $("spouseDependent").checked = false;
    $("singleParent").checked = false;
    var box = $("children");
    box.innerHTML = "";
    box.appendChild(childRow(2012, "school"));
    box.appendChild(childRow(2015, "school"));
    render();
  }

  function clearAll() {
    ["hGross", "hPrepaid", "wGross", "wPrepaid", "hCardCredit", "hCardCheck", "hCardTraditional",
      "hCardTransit", "hCardCulture", "wCardCredit", "wCardCheck", "wCardTraditional", "wCardTransit",
      "wCardCulture", "childCard", "hPension", "hInsurance", "wPension", "wInsurance",
      "medUnlimited", "medGeneral", "eduSchool", "eduCollege", "donation", "rent",
      "pCount", "pSenior", "pDisabled"].forEach(function (id) { $(id).value = "0"; });
    $("children").innerHTML = "";
    render();
  }

  /* ---------------- 이벤트 ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    renderChildren();
    childrenInitialized = true;
    $("miniBar").hidden = false;

    $("tabSingle").addEventListener("click", function () { setMode("single"); });
    $("tabCouple").addEventListener("click", function () { setMode("couple"); });

    $("addChild").addEventListener("click", function () {
      var rows = document.querySelectorAll("#children .child-row").length;
      if (rows >= 6) return;
      $("children").appendChild(childRow(2016, "school"));
      render();
    });

    $("children").addEventListener("click", function (e) {
      var btn = e.target.closest(".btn-remove");
      if (!btn) return;
      var rows = document.querySelectorAll("#children .child-row");
      if (rows.length <= 1) {
        btn.closest(".child-row").querySelector(".child-birth").value = "";
      } else {
        btn.closest(".child-row").remove();
      }
      render();
    });

    $("formArea").addEventListener("input", function (e) {
      if (e.target.matches(".child-birth")) {
        var d = digits(e.target.value);
        if (d && d.length > 4) e.target.value = d.slice(0, 4);
      }
      scheduleRender();
    });
    $("formArea").addEventListener("change", scheduleRender);
    $("formArea").addEventListener("focusout", function (e) {
      if (e.target.matches("input[type=text]") && !e.target.classList.contains("child-birth")) {
        fmtInput(e.target, e.target.id === "hPrepaid" || e.target.id === "wPrepaid" ? "" : "");
      }
      if (e.target.matches(".child-birth")) {
        var d = digits(e.target.value);
        if (d) e.target.value = d;
      }
    });

    $("resetBtn").addEventListener("click", clearAll);
    $("demoBtn").addEventListener("click", applyDemo);
    $("miniJump").addEventListener("click", function () {
      $("results").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    render();
  });

  // 스크립트가 DOM 뒤에 있어 바로 실행되는 경우를 위한 안전장치
  if (document.readyState !== "loading" && !childrenInitialized) {
    renderChildren();
    render();
  }
})();
