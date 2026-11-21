/*!
 * 연말정산 계산기 UI (2026년 귀속)
 * 계산은 calc.js(YECalc)에서만 하고, 이 파일은 입력을 읽어 결과를 그립니다.
 */
(function () {
  "use strict";

  var nf = new Intl.NumberFormat("ko-KR");
  var $ = function (id) { return document.getElementById(id); };

  var mode = "couple";
  var isDemo = true;        // 첫 진입은 예시 데이터 상태
  var applying = false;     // 예시·초기화로 값을 넣는 중에는 '사용자 수정'으로 보지 않음

  /* ---------------- 입력 도우미 ---------------- */
  function digits(v) {
    return String(v == null ? "" : v).replace(/[^\d]/g, "");
  }
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

  function childRow(birthYear, school, disabled) {
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
      '<label class="child-dis"><input type="checkbox" class="child-handicap"' + (disabled ? " checked" : "") +
      ' aria-label="자녀 장애인 여부"> 장애</label>' +
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
      var dis = row.querySelector(".child-handicap");
      return {
        birthYear: by ? Number(by) : 2016,
        school: row.querySelector(".child-school").value,
        disabled: !!(dis && dis.checked)
      };
    });
  }

  function readState() {
    var single = mode === "single";
    return {
      mode: mode,
      husband: {
        gross: manOf("hGross"),
        prepaid: numOf("hPrepaid"),
        pension: manOf("hPensionSaving"),
        irp: manOf("hIrp"),
        insurance: manOf("hInsurance"),
        sme: (($("smeH") && $("smeH").value) || "none"),
        card: {
          credit: manOf("hCardCredit"),
          check: manOf("hCardCheck"),
          traditional: manOf("hCardTraditional"),
          transit: manOf("hCardTransit"),
          culture: manOf("hCardCulture")
        }
      },
      wife: {
        gross: single ? 0 : manOf("wGross"),
        prepaid: single ? 0 : numOf("wPrepaid"),
        pension: single ? 0 : manOf("wPensionSaving"),
        irp: single ? 0 : manOf("wIrp"),
        insurance: single ? 0 : manOf("wInsurance"),
        woman: !single && !!($("womanW") && $("womanW").checked),
        sme: single ? "none" : (($("smeW") && $("smeW").value) || "none"),
        card: {
          credit: single ? 0 : manOf("wCardCredit"),
          check: single ? 0 : manOf("wCardCheck"),
          traditional: single ? 0 : manOf("wCardTraditional"),
          transit: single ? 0 : manOf("wCardTransit"),
          culture: single ? 0 : manOf("wCardCulture")
        }
      },
      children: readChildren(),
      parents: {
        count: numOf("pCount"),
        seniors: numOf("pSenior"),
        disabled: numOf("pDisabled")
      },
      childCard: manOf("childCard"),
      dependentCard: {
        credit: single ? manOf("depCardCredit") : 0,
        check: single ? manOf("depCardCheck") : 0,
        /* 전통시장·대중교통은 공제율(40%)과 추가공제 한도가 같아 한 칸으로 받습니다 */
        traditional: single ? manOf("depCardTraditional") : 0,
        transit: 0
      },
      medical: { general: manOf("medGeneral"), unlimited: manOf("medUnlimited") },
      postpartum: manOf("postpartum"),
      births: numOf("births") || 1,
      education: { school: manOf("eduSchool"), college: manOf("eduCollege") },
      donation: manOf("donation"),
      rentH: manOf("rent"),
      rentW: single ? 0 : manOf("rentW"),
      rentEligible: $("rentEligible").checked,
      housing: {
        owner: (($("houseTarget") && $("houseTarget").value) === "w" && !single) ? 1 : 0,
        savings: manOf("housingSavings"),
        rentLoan: manOf("rentLoan"),
        mortgageInterest: manOf("mortgageInterest"),
        mortgageType: ($("mortgageType") && $("mortgageType").value) || "none",
        eligible: !!($("housingEligible") && $("housingEligible").checked)
      },
      womanDeduction: single && !!($("womanSingle") && $("womanSingle").checked),
      spouseDependent: single && $("spouseDependent").checked,
      singleParent: single && $("singleParent").checked,
      autoInsurance: $("autoInsurance").checked
    };
  }

  /* ---------------- 단위 가드 ---------------- */
  /* 만원 칸에 원 단위 금액을 넣는 사고를 막습니다. */
  var BIG_MAN = 100000;          // 10억원 이상이면 단위 확인 경고
  var MAN_FIELDS = [
    "hGross", "wGross",
    "hCardCredit", "hCardCheck", "hCardTraditional", "hCardTransit", "hCardCulture",
    "wCardCredit", "wCardCheck", "wCardTraditional", "wCardTransit", "wCardCulture",
    "childCard", "depCardCredit", "depCardCheck", "depCardTraditional",
    "hPensionSaving", "hIrp", "wPensionSaving", "wIrp", "hInsurance", "wInsurance",
    "medUnlimited", "medGeneral", "eduSchool", "eduCollege", "donation", "rent", "rentW",
    "postpartum", "housingSavings", "rentLoan", "mortgageInterest"
  ];
  var WON_FIELDS = ["hPrepaid", "wPrepaid"];
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
    if (html) {
      w.innerHTML = html;
      w.hidden = false;
    } else {
      w.hidden = true;
      w.innerHTML = "";
    }
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

    var grossWon = manOf("hGross") + (mode === "single" ? 0 : manOf("wGross"));
    WON_FIELDS.forEach(function (id) {
      var v = numOf(id);
      if (v > 0 && v < 5000) {
        setWarn(id, "원 단위 칸입니다. " + nf.format(v) + "원은 너무 작습니다. " +
          nf.format(v * 10000) + "원을 의도한 것은 아닌지 확인해 주세요.");
      } else if (grossWon > 0 && v > grossWon) {
        setWarn(id, "기납부세액이 총급여(" + won(grossWon) + ")보다 큽니다. 단위를 확인해 주세요.");
      } else {
        setWarn(id, "");
      }
    });
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

  function childCreditOf(kids) {
    var n = kids.filter(function (k) { return (2026 - k.birthYear) <= 20 && k.birthYear <= 2016; }).length;
    return n === 0 ? 0 : (n === 1 ? 250000 : (n === 2 ? 550000 : 550000 + (n - 2) * 400000));
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
      var credit = childCreditOf(kids);
      var disabledKids = kids.filter(function (k) { return k.disabled; }).length;
      items.push("자녀 " + kids.length + "명(" + years + "생) → <b>" + (who === 0 ? H : W) + "</b> · 기본공제 " +
        manwon(kids.length * 1500000) +
        (disabledKids ? " + 장애인 추가공제 " + manwon(disabledKids * 2000000) : "") +
        (credit ? " + 자녀세액공제 " + manwon(credit) : " (자녀세액공제 대상 아님)"));
    });

    if (h.parents.count > 0) {
      items.push("부모님 등 직계존속 " + h.parents.count + "명 → <b>" + (a.parentOwner === 0 ? H : W) + "</b> · 기본공제 " +
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

    if (h.rentH > 0 && !h.rentEligible) {
      items.push("월세 " + manwon(h.rentH) + "을 입력했지만 <b>무주택 세대주 요건</b>을 체크하지 않아 세액공제에서 제외했습니다.");
    } else if (h.rentH > 0) {
      items.push("남편 월세 " + manwon(h.rentH) + " → <b>" + H + "</b> · 총급여 " +
        (h.husband.gross <= 55000000 ? "5,500만원 이하 17%" : "15%") + " 구간");
    }
    if (h.rentW > 0 && !h.rentEligible) {
      items.push("아내 월세 " + manwon(h.rentW) + "도 무주택 세대주·세대원 요건을 체크해야 공제됩니다.");
    } else if (h.rentW > 0) {
      items.push("아내 월세 " + manwon(h.rentW) + " → <b>" + W + "</b> · 총급여 " +
        (h.wife.gross <= 55000000 ? "5,500만원 이하 17%" : "15%") + " 구간 (각자 1,000만원 한도)");
    }

    if (h.postpartum > 0) {
      items.push("산후조리원비 " + manwon(h.postpartum) + "을 의료비에 포함했습니다 (출산 " + h.births +
        "회 · 1회당 200만원 한도, 일반 의료비 700만원과 별도)");
    }

    if (h.housing.eligible && out.optimal) {
      var hp = out.optimal.husband.housing;
      var hpW = out.optimal.wife && out.optimal.wife.housing;
      var usedHousing = (hp && hp.total > 0) ? hp : (hpW || hp || { total: 0 });
      if (usedHousing.total > 0) {
        var parts = [];
        if (usedHousing.savings) parts.push("청약저축 " + manwon(usedHousing.savings));
        if (usedHousing.rentLoan) parts.push("전세대출 " + manwon(usedHousing.rentLoan));
        if (usedHousing.mortgage) parts.push("주담대 이자 " + manwon(usedHousing.mortgage));
        items.push("주택자금 소득공제 " + manwon(usedHousing.total) + " → <b>" +
          (h.housing.owner === 0 ? H : W) + "</b> · " + parts.join(" + "));
      }
    } else if (h.housing.savings + h.housing.rentLoan + h.housing.mortgageInterest > 0) {
      items.push("주택자금 금액을 입력했지만 <b>세대주 요건</b>을 체크하지 않아 소득공제에서 제외했습니다.");
    }

    [0, 1].forEach(function (who) {
      var per = who === 0 ? out.optimal.husband : out.optimal.wife;
      if (!per) return;
      if (per.personal.woman) {
        items.push((who === 0 ? H : W) + " 부녀자 공제 <b>" + manwon(per.personal.woman) +
          "</b> (종합소득 3,000만원 이하·배우자 또는 부양가족 있음)");
      }
      if (per.smeExemption > 0) {
        items.push((who === 0 ? H : W) + " 중소기업 취업자 소득세 감면 <b>" + manwon(per.smeExemption) +
          "</b> (산출세액의 " + (per.input.sme === "youth" ? "90%" : "70%") + ", 연 200만원 한도)");
      }
      var conv = per.card.cultureConverted || 0;
      if (conv > 0) {
        items.push((who === 0 ? H : W) + " 문화체육 사용액 " + manwon(conv) +
          "은 총급여 7,000만원 초과로 <b>신용카드 15%</b>로 계산했습니다.");
      }
    });

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
      if (!p) return;
      var overPension = (p.input.pensionPaid + p.input.irpPaid) - p.bases.pension.total;
      if (overPension > 0) {
        items.push((i === 0 ? H : W) + "의 연금저축·IRP 납입액 중 <b>" + manwon(overPension) +
          "</b>은 한도(연금저축 600만·합산 900만원)를 넘어 공제되지 않았습니다.");
      }
      if (!p.standardCreditApplied) return;
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
      (p.personal.senior ? " + 경로우대 " + won(p.personal.senior) : "") +
      (p.personal.disabled ? " + 장애인 " + won(p.personal.disabled) + "(자녀 " + p.personal.disabledChildren + "명 포함)" : "") +
      (p.personal.woman ? " + 부녀자 " + won(p.personal.woman) : "")]);
    if (p.pensionDeduction) rows.push(["국민연금 보험료", "-" + won(p.pensionDeduction), ""]);
    if (p.healthDeduction) rows.push(["건강·장기요양·고용보험료", "-" + won(p.healthDeduction), ""]);
    if (p.cardDeductionApplied || p.cardFamily) {
      var cardSub = "25% 문턱 " + manwon(p.card.threshold) + " · 기본한도 " + manwon(p.card.baseLimit);
      if (p.cardFamily) {
        cardSub = "배우자·부양가족 " + manwon(p.cardFamily) + " 합산 · " + cardSub;
      }
      rows.push(["신용카드 등 소득공제", "-" + won(p.cardDeductionApplied), cardSub]);
    }
    if (p.housingApplied) {
      var hs = p.housing;
      var hParts = [];
      if (hs.savings) hParts.push("청약 " + manwon(hs.savings));
      if (hs.rentLoan) hParts.push("전세대출 " + manwon(hs.rentLoan));
      if (hs.mortgage) hParts.push("주담대 " + manwon(hs.mortgage));
      rows.push(["주택자금 소득공제", "-" + won(p.housingApplied), hParts.join(" · ")]);
    }
    rows.push(["과세표준", won(p.taxableBase), "한계세율 " + pct(p.marginalRate)]);
    rows.push(["산출세액", won(p.calculatedTax), ""]);
    if (p.smeExemption) rows.push(["중소기업 취업자 소득세 감면", "-" + won(p.smeExemption),
      "산출세액의 " + pct(p.input.sme === "youth" ? 0.9 : 0.7) + " (연 200만원 한도)"]);
    if (c.earnedIncome) rows.push(["근로소득세액공제", "-" + won(c.earnedIncome), ""]);
    if (c.child) rows.push(["자녀세액공제", "-" + won(c.child), ""]);
    if (c.pension) rows.push(["연금계좌 세액공제", "-" + won(c.pension),
      "연금저축 " + manwon(p.bases.pension.savings) + " + IRP·DC " + manwon(p.bases.pension.irp) +
      " × " + pct(p.bases.pensionRate)]);
    if (c.insurance) rows.push(["보장성보험 세액공제", "-" + won(c.insurance), ""]);
    if (c.medical) rows.push(["의료비 세액공제", "-" + won(c.medical), "공제대상 " + manwon(p.bases.medical) + " (문턱 " + manwon(p.bases.medicalThreshold) + ")" +
      (p.bases.postpartum ? " · 산후조리원 " + manwon(p.bases.postpartum) + " 포함" : "")]);
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
      toolsBlock() +
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
      "소기업·소상공인 공제부금, 우리사주, 외국납부세액, 혼인·출산·입양 세액공제, 난임시술비·미숙아 우대공제율은 반영하지 않았습니다.</p>" +
      "</div>";
  }

  function renderSingle(out) {
    var p = out.scenario.husband;
    var line = refundLine(out.scenario.total);
    return '<div class="result-card">' +
      '<div class="result-head"><h2>계산 결과</h2><span class="stamp">2026년 귀속</span></div>' +
      toolsBlock() +
      '<p class="result-big ' + line.cls + '">' + line.big + "</p>" +
      '<p class="result-sub">' + line.sub + "</p>" +
      '<p class="result-note">' + line.note + "</p>" +
      '<div class="plan" style="margin-top:14px"><h3>적용된 공제</h3><ul>' +
      singlePlan(out).map(function (t) { return "<li>" + t + "</li>"; }).join("") +
      "</ul></div>" +
      breakdownTable(p, "본인") +
      '<p class="small-note">결과는 소득세 기준이며, 결정세액의 10%인 지방소득세가 함께 정산됩니다. ' +
      "소기업·소상공인 공제부금, 우리사주, 외국납부세액, 혼인·출산·입양 세액공제, 난임시술비·미숙아 우대공제율은 반영하지 않았습니다.</p>" +
      "</div>";
  }

  function singlePlan(out) {
    var p = out.scenario.husband;
    var h = out.household;
    var items = [];
    items.push("근로소득공제 " + manwon(p.earnedDeduction) + " 자동 적용");
    items.push("인적공제 " + manwon(p.personal.total) + " (기본공제 " + p.personal.basicCount + "명" +
      (p.personal.disabledChildren ? " · 자녀 장애인 추가공제 " + manwon(p.personal.disabledChildren * 2000000) : "") + ")");
    if (p.cardFamily) items.push("배우자·부양가족 카드 사용액 " + manwon(p.cardFamily) + "을 본인 카드와 합산 (합계 " +
      manwon(p.card.total) + ", 문턱 " + manwon(p.card.threshold) + ")");
    if (p.card.deduction) items.push("신용카드 등 소득공제 " + manwon(p.cardDeductionApplied));
    if (p.credits.child) items.push("자녀세액공제 " + manwon(p.credits.child));
    if (p.credits.pension) items.push("연금계좌 세액공제 " + manwon(p.credits.pension) + " (연금저축 " +
      manwon(p.bases.pension.savings) + " + IRP·DC " + manwon(p.bases.pension.irp) + ")");
    var overPension = (p.input.pensionPaid + p.input.irpPaid) - p.bases.pension.total;
    if (overPension > 0) items.push("연금저축·IRP 납입액 중 " + manwon(overPension) + "은 한도(연금저축 600만·합산 900만원) 초과로 공제되지 않음");
    if (p.credits.medical) items.push("의료비 세액공제 " + manwon(p.credits.medical));
    if (p.credits.education) items.push("교육비 세액공제 " + manwon(p.credits.education));
    if (h.rentH > 0 && !h.rentEligible) {
      items.push("월세 " + manwon(h.rentH) + "은 무주택 세대주 요건을 체크하지 않아 공제에서 제외");
    } else if (p.credits.rent) {
      items.push("월세 세액공제 " + manwon(p.credits.rent) + " (월세 " + manwon(p.bases.rent) + " × " + pct(p.bases.rentRate) + ")");
    }
    if (p.housingApplied) items.push("주택자금 소득공제 " + manwon(p.housingApplied));
    if (h.postpartum > 0) items.push("산후조리원비 " + manwon(h.postpartum) + "을 의료비에 포함 (출산 1회당 200만원 한도)");
    if (p.personal.woman) items.push("부녀자 공제 " + manwon(p.personal.woman));
    if (p.smeExemption) items.push("중소기업 취업자 소득세 감면 " + manwon(p.smeExemption) + " (연 200만원 한도)");
    if (p.card.cultureConverted) items.push("문화체육 사용액 " + manwon(p.card.cultureConverted) + "은 총급여 7,000만원 초과로 신용카드 15% 적용");
    if (p.credits.standard) items.push("표준세액공제 13만원 적용 (특별세액공제보다 유리)");
    return items;
  }

  function renderEmpty() {
    return '<div class="result-card">' +
      '<div class="result-head"><h2>계산 결과</h2><span class="stamp">2026년 귀속</span></div>' +
      toolsBlock() +
      '<div class="empty-state">' +
      "<strong>총급여를 입력하면 예상 환급액이 나타납니다</strong>" +
      "<p>1단계 ‘소득과 기납부세액’에 총급여(만원)를 넣어 주세요. 원천징수영수증의 ‘총급여’ 칸 숫자입니다.</p>" +
      "</div></div>";
  }

  /* ---------------- 미니바 ---------------- */
  function updateMini(out, empty) {
    var bar = $("miniBar");
    var label = $("miniLabel");
    var value = $("miniValue");
    if (!bar || !label || !value) return;
    if (empty) {
      label.textContent = "총급여를 입력하면 결과가 나옵니다";
      value.textContent = "—";
      value.style.color = "#16202e";
      return;
    }
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
  var lastResultsHTML = null;
  function paint(html) {
    if (html === lastResultsHTML) return;
    lastResultsHTML = html;
    $("results").innerHTML = html;
  }
  function render() {
    var out;
    try {
      var state = readState();
      out = YECalc.run(state);
      var totalGross = state.husband.gross + (state.mode === "single" ? 0 : state.wife.gross);
      var empty = totalGross <= 0;
      paint(empty ? renderEmpty() : (out.single ? renderSingle(out) : renderCouple(out)));
      updateMini(out, empty);
    } catch (e) {
      console.error(e);
      paint('<div class="result-card"><p>입력값을 확인해 주세요.</p></div>');
      updateMini(null, true);
    }
    updateGuards();
  }
  function scheduleRender() {
    clearTimeout(timer);
    timer = setTimeout(render, 90);
  }

  /* ---------------- 모드 전환 ---------------- */
  function setMode(next) {
    var wasDemo = isDemo;
    mode = next;
    var couple = next === "couple";
    $("tabSingle").classList.toggle("is-active", !couple);
    $("tabSingle").setAttribute("aria-selected", String(!couple));
    $("tabCouple").classList.toggle("is-active", couple);
    $("tabCouple").setAttribute("aria-selected", String(couple));
    ["wifeCol", "wifeCardCol", "wifePensionCol", "wifeTaxCol"].forEach(function (id) {
      var el = $(id);
      if (el) el.hidden = !couple;
    });
    $("singleExtras").hidden = couple;
    document.body.classList.toggle("single-mode", !couple);
    $("hName").textContent = couple ? "남편" : "본인";
    if ($("hCardName")) $("hCardName").textContent = couple ? "남편" : "본인";
    if ($("hPensionName")) $("hPensionName").textContent = couple ? "남편" : "본인";
    if ($("hTaxName")) $("hTaxName").textContent = couple ? "남편" : "본인";
    if ($("houseTarget")) {
      var optW = $("houseTarget").querySelector('option[value="w"]');
      if (optW) optW.hidden = !couple;
    }
    Array.prototype.forEach.call(document.querySelectorAll(".mode-single-only"), function (el) {
      el.hidden = couple;
    });
    Array.prototype.forEach.call(document.querySelectorAll(".mode-couple-only"), function (el) {
      el.hidden = !couple;
    });
    /* 예시 상태에서 모드를 바꾸면 그 모드에 맞는 예시로 다시 채웁니다.
       (맞벌이 예시의 자녀·카드 값이 1인 모드에 남지 않도록) */
    if (wasDemo) applyDemo(next);
    else render();
  }

  /* ---------------- 예시 값·초기화 ---------------- */
  /* 카드·의료비·교육비·연금·월세는 만원, 총급여는 만원, 기납부세액은 원 단위 */
  var DEMO_COUPLE = {
    hGross: "6,000", hPrepaid: "2,400,000", wGross: "4,000", wPrepaid: "900,000",
    hCardCredit: "1,800", hCardCheck: "600", hCardTraditional: "60", hCardTransit: "80", hCardCulture: "0",
    wCardCredit: "1,200", wCardCheck: "500", wCardTraditional: "40", wCardTransit: "60", wCardCulture: "0",
    childCard: "120",
    hPensionSaving: "300", hIrp: "0", hInsurance: "72",
    wPensionSaving: "0", wIrp: "0", wInsurance: "60",
    medUnlimited: "100", medGeneral: "200", eduSchool: "600", eduCollege: "0", donation: "0",
    rent: "0", rentW: "0", postpartum: "0", births: "1",
    housingSavings: "0", rentLoan: "0", mortgageInterest: "0",
    pCount: "0", pSenior: "0", pDisabled: "0",
    __children: [{ birthYear: 2012, school: "school" }, { birthYear: 2015, school: "school" }]
  };
  var DEMO_SINGLE = {
    hGross: "4,500", hPrepaid: "1,800,000",
    hCardCredit: "1,200", hCardCheck: "400", hCardTraditional: "40", hCardTransit: "50", hCardCulture: "0",
    childCard: "0",
    hPensionSaving: "200", hIrp: "0", hInsurance: "60",
    medUnlimited: "50", medGeneral: "0", eduSchool: "0", eduCollege: "0", donation: "0",
    rent: "0", rentW: "0", postpartum: "0", births: "1",
    housingSavings: "0", rentLoan: "0", mortgageInterest: "0",
    pCount: "0", pSenior: "0", pDisabled: "0",
    __children: []
  };

  function allInputIds() {
    return MAN_FIELDS.concat(WON_FIELDS).concat(["pCount", "pSenior", "pDisabled", "births"]);
  }

  function resetExtras() {
    $("autoInsurance").checked = true;
    $("spouseDependent").checked = false;
    $("singleParent").checked = false;
    if ($("rentEligible")) $("rentEligible").checked = false;
    if ($("housingEligible")) $("housingEligible").checked = false;
    if ($("womanW")) $("womanW").checked = false;
    if ($("womanSingle")) $("womanSingle").checked = false;
    if ($("smeH")) $("smeH").value = "none";
    if ($("smeW")) $("smeW").value = "none";
    if ($("houseTarget")) $("houseTarget").value = "h";
    if ($("mortgageType")) $("mortgageType").value = "none";
  }

  function applyDemo(nextMode) {
    var src = (nextMode || mode) === "single" ? DEMO_SINGLE : DEMO_COUPLE;
    applying = true;
    allInputIds().forEach(function (id) {
      var el = $(id);
      if (el) el.value = "0";
    });
    Object.keys(src).forEach(function (id) {
      if (id.charAt(0) === "_") return;
      if ($(id)) $(id).value = src[id];
    });
    resetExtras();
    var box = $("children");
    box.innerHTML = "";
    (src.__children || []).forEach(function (c) {
      box.appendChild(childRow(c.birthYear, c.school, c.disabled));
    });
    applying = false;
    isDemo = true;
    render();
  }

  function clearAll(focus) {
    applying = true;
    allInputIds().forEach(function (id) {
      var el = $(id);
      if (el) el.value = "0";
    });
    $("births").value = "1";
    resetExtras();
    $("children").innerHTML = "";
    applying = false;
    isDemo = false;
    render();
    if (focus !== false) {
      var g = $("hGross");
      if (g) {
        try { g.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) { g.scrollIntoView(); }
        g.focus({ preventScroll: true });
      }
    }
  }

  /* ---------------- 이벤트 ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    setupGuards();
    if ($("miniBar")) $("miniBar").hidden = false;

    $("tabSingle").addEventListener("click", function () { setMode("single"); });
    $("tabCouple").addEventListener("click", function () { setMode("couple"); });

    $("addChild").addEventListener("click", function () {
      var rows = document.querySelectorAll("#children .child-row").length;
      if (rows >= 6) return;
      $("children").appendChild(childRow(2016, "school"));
      isDemo = false;
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
      isDemo = false;
      render();
    });

    $("formArea").addEventListener("input", function (e) {
      if (e.target.matches(".child-birth")) {
        var d = digits(e.target.value);
        if (d && d.length > 4) e.target.value = d.slice(0, 4);
      }
      if (!applying) isDemo = false;
      scheduleRender();
    });
    $("formArea").addEventListener("change", function (e) {
      if (!applying) isDemo = false;
      scheduleRender();
    });
    $("formArea").addEventListener("focusout", function (e) {
      if (e.target.matches("input[type=text]") && !e.target.classList.contains("child-birth")) {
        fmtInput(e.target);
      }
      if (e.target.matches(".child-birth")) {
        var d = digits(e.target.value);
        if (d) e.target.value = d;
      }
    });

    $("resetBtn").addEventListener("click", function () { clearAll(true); });
    $("demoBtn").addEventListener("click", function () { applyDemo(); });
    $("miniJump").addEventListener("click", function () {
      $("results").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    /* 결과 카드 안의 버튼(모두 지우기 · 예시 불러오기 · 내 값 입력하기) */
    $("results").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      if (act === "clear") clearAll(true);
      else if (act === "demo") applyDemo();
    });

    /* 단위 가드의 원→만원 자동 환산
       (포커스 아웃으로 경고가 다시 그려져 click이 사라질 수 있어 mousedown도 받습니다.
        data-from과 현재 값이 같을 때만 동작하므로 두 번 실행되지 않습니다.) */
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

    applyDemo("couple");
  });
})();
