"""월급·이직 계산기와 개인정보처리방침을 브라우저에서 검증합니다.
실행:
  LD_LIBRARY_PATH=/workspace/.cache/atlibs PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright \
    python3 salary/test/browser_check.py
"""
import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

SITE = Path(__file__).resolve().parents[2]          # work/namoons.github.io
SHOTS = SITE.parent / "yearend-calc" / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)

errors = []
checks = []


def ok(name, cond, detail=""):
    checks.append((name, bool(cond), detail))
    if not cond:
        errors.append(f"{name}: {detail}")


def watch(page, label):
    page.on("console", lambda m: errors.append(f"[{label}] console.{m.type}: {m.text}")
            if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"[{label}] pageerror: {e}"))


def overflow(page):
    return page.evaluate("""() => ({
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
        over: Array.from(document.querySelectorAll('body *'))
          .filter(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.right > window.innerWidth + 1.5;
          })
          .slice(0, 5)
          .map(el => el.tagName + '.' + (el.className && el.className.toString().slice(0, 40)))
    })""")


def check_links(page, label):
    hrefs = page.evaluate("""() => Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.getAttribute('href'))""")
    bad = []
    page_path = Path(page.url.replace("file://", ""))
    for h in hrefs:
        if not h or h.startswith("#") or h.startswith("http") or h.startswith("mailto:"):
            continue
        p = (page_path.parent / h.split("#")[0]).resolve()
        if h.endswith("/"):
            p = p / "index.html"
        if not p.exists():
            bad.append(h)
    ok(f"{label} 내부 링크", not bad, f"없는 대상: {bad}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---------- 1. 엔진 자체 검증 ----------
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        watch(page, "selftest")
        page.goto((SITE / "salary" / "test" / "selftest.html").as_uri())
        page.wait_for_function("window.__TEST_RESULTS !== undefined", timeout=15000)
        res = page.evaluate("window.__TEST_RESULTS")
        ok("엔진 자체 검증 전부 통과", res["failed"] == 0,
           f"{res['passed']}/{res['total']} 통과, 실패 {res['failed']}건")
        page.screenshot(path=str(SHOTS / "salary-selftest.png"), full_page=True)
        page.close()

        # ---------- 2. 데스크톱: 메인(연말정산) ----------
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        watch(page, "index-desktop")
        page.goto((SITE / "index.html").as_uri())
        page.wait_for_selector("#results .result-card", timeout=15000)
        page.evaluate("() => document.fonts.ready.then(() => true)")
        page.wait_for_timeout(300)
        ov = overflow(page)
        ok("메인 데스크톱 가로 넘침 없음", ov["sw"] <= ov["iw"] + 1 and not ov["over"], str(ov))
        nav = page.evaluate("""() => Array.from(document.querySelectorAll('.calc-switch .calc-tab'))
            .map(a => ({text: a.textContent.trim(), href: a.getAttribute('href'),
                        active: a.classList.contains('is-active'), current: a.getAttribute('aria-current'),
                        visible: a.offsetParent !== null}))""")
        ok("메인 상단 계산기 탭 2개 노출", len(nav) == 2 and all(n["visible"] for n in nav), str(nav))
        ok("메인 상단 탭 이름·순서", [n["text"] for n in nav] == ["연말정산", "월급·이직 비교"], str(nav))
        ok("메인 연말정산 탭 활성", bool(nav) and nav[0]["active"] and nav[0]["current"] == "page"
           and not nav[1]["active"], str(nav))
        foot = page.inner_text(".site-foot")
        ok("메인 푸터 한 줄 개인정보 안내", "브라우저 안에서만" in foot and "개인정보처리방침" in foot, foot[:160])
        ok("메인에 긴 개인정보·쿠키 섹션 없음", "개인정보와 쿠키" not in page.inner_text("body"))
        ok("메인 푸터 오류 제보 링크",
           page.evaluate("""() => Array.from(document.querySelectorAll('.site-foot a'))
             .some(a => a.href.includes('docs.google.com/forms/d/e/1FAIpQLSdM2LkD_MTW02ze4NGLR78Rl7Qn0htY8W3W7yBpHonKxBE9bA/viewform'))"""))
        page.screenshot(path=str(SHOTS / "index-desktop.png"), full_page=True)
        check_links(page, "메인")
        page.close()

        # ---------- 3. 데스크톱: 월급 계산기 ----------
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        watch(page, "salary-desktop")
        page.goto((SITE / "salary" / "index.html").as_uri())
        page.wait_for_selector("#results .result-card", timeout=15000)
        page.evaluate("() => document.fonts.ready.then(() => true)")
        page.wait_for_timeout(300)
        ok("프리텐다드 폰트 로드", page.evaluate("() => document.fonts.check('600 16px \"Pretendard Variable\"')"))
        big = page.inner_text("#results .result-big")
        ok("2027 월 실수령 렌더", re.match(r"^\d{1,3}(,\d{3})+원$", big.strip()), big)
        table = page.inner_text("#results .cmp-table")
        ok("2026·2027 비교표 렌더", all(k in table for k in ("2026년", "2027년", "국민연금", "장기요양", "월 실수령액")))
        ov = overflow(page)
        ok("월급 데스크톱 가로 넘침 없음", ov["sw"] <= ov["iw"] + 1 and not ov["over"], str(ov))
        stabs = page.evaluate("""() => Array.from(document.querySelectorAll('.calc-switch .calc-tab'))
            .map(a => ({text: a.textContent.trim(), href: a.getAttribute('href'),
                        active: a.classList.contains('is-active'), current: a.getAttribute('aria-current')}))""")
        ok("월급 탭 활성", len(stabs) == 2 and stabs[1]["active"] and stabs[1]["current"] == "page"
           and not stabs[0]["active"], str(stabs))
        ok("월급 → 연말정산 탭 링크", bool(stabs) and stabs[0]["href"] == "../", str(stabs))
        page.screenshot(path=str(SHOTS / "salary-desktop.png"), full_page=True)

        # 입력 변경 → 결과 재계산
        page.fill("#salaryInput", "8,000")
        page.wait_for_timeout(350)
        big2 = page.inner_text("#results .result-big")
        ok("연봉 변경 시 결과 갱신", big2.strip() != big.strip(), f"{big} → {big2}")

        # 이직 모드
        page.click("#tabOffer")
        page.wait_for_timeout(300)
        ok("이직 폼 표시", page.is_visible("#formOffer") and not page.is_visible("#formCompare"))
        offer_text = page.inner_text("#results")
        ok("이직 결과 렌더", all(k in offer_text for k in ("이직 세후 월 차액", "실질 인상률", "퇴직금 1년분", "현 직장", "이직 제안")))
        ov = overflow(page)
        ok("이직 결과 가로 넘침 없음", ov["sw"] <= ov["iw"] + 1 and not ov["over"], str(ov))
        page.screenshot(path=str(SHOTS / "salary-offer-desktop.png"), full_page=True)
        check_links(page, "월급")
        page.close()

        # ---------- 4. 모바일: 메인 + 월급 + 개인정보 ----------
        for name, rel, wait_sel in [
            ("메인", "index.html", "#results .result-card"),
            ("월급", "salary/index.html", "#results .result-card"),
            ("개인정보", "privacy/index.html", "h1"),
        ]:
            page = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
            watch(page, f"{name}-mobile")
            page.goto((SITE / rel).as_uri())
            page.wait_for_selector(wait_sel, timeout=15000)
            page.evaluate("() => document.fonts.ready.then(() => true)")
            page.wait_for_timeout(350)
            ov = overflow(page)
            ok(f"{name} 모바일 가로 넘침 없음", ov["sw"] <= ov["iw"] + 1 and not ov["over"], str(ov))
            visible_nav = page.evaluate("""() => Array.from(document.querySelectorAll('.calc-switch .calc-tab'))
                .filter(a => a.offsetParent !== null).map(a => ({text: a.textContent.trim(),
                  h: Math.round(a.getBoundingClientRect().height),
                  top: Math.round(a.getBoundingClientRect().top)}))""")
            ok(f"{name} 모바일 계산기 탭 2개 노출", len(visible_nav) == 2, str(visible_nav))
            ok(f"{name} 모바일 두 탭 같은 줄·같은 높이",
               len(visible_nav) == 2 and len({t["h"] for t in visible_nav}) == 1
               and len({t["top"] for t in visible_nav}) == 1, str(visible_nav))
            if name == "월급":
                ok("월급 모바일 미니바 표시", page.is_visible("#miniBar"))
                page.screenshot(path=str(SHOTS / "salary-mobile.png"), full_page=True)
                page.screenshot(path=str(SHOTS / "salary-mobile-top.png"))
            if name == "개인정보":
                ok("개인정보 페이지 제목", "개인정보처리방침" in page.inner_text("h1"))
                page.screenshot(path=str(SHOTS / "privacy-mobile.png"), full_page=True)
            page.close()

        # ---------- 5. 개인정보 데스크톱 ----------
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        watch(page, "privacy-desktop")
        page.goto((SITE / "privacy" / "index.html").as_uri())
        page.wait_for_selector("#policy", timeout=15000)
        page.evaluate("() => document.fonts.ready.then(() => true)")
        page.wait_for_timeout(300)
        body = page.inner_text("body")
        ok("개인정보 방침 10개 조항", all(f"{i}." in body for i in range(1, 11)))
        ok("개인정보 방침 쿠키 안내", "쿠키" in body and "AdSense" in body)
        ok("개인정보 방침 이메일 미노출", "mailto:" not in page.content() and "@gmail" not in body)
        ov = overflow(page)
        ok("개인정보 데스크톱 가로 넘침 없음", ov["sw"] <= ov["iw"] + 1 and not ov["over"], str(ov))
        page.screenshot(path=str(SHOTS / "privacy-desktop.png"), full_page=True)
        check_links(page, "개인정보")
        page.close()

        # ---------- 6. 브랜드(명세)·파비콘·예시 값 ----------
        for key, rel in [("메인", "index.html"), ("월급", "salary/index.html"), ("개인정보", "privacy/index.html")]:
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            watch(page, f"brand-{key}")
            page.goto((SITE / rel).as_uri())
            page.wait_for_timeout(300)
            brand = page.inner_text(".brand").strip()
            title = page.title()
            site = page.get_attribute('meta[property="og:site_name"]', "content")
            icon = page.evaluate("() => document.querySelector('link[rel=icon]').href")
            ok(f"{key} 브랜드 명세", brand == "명세" and "명세" in page.inner_text(".site-foot"), brand)
            ok(f"{key} 제목·og:site_name", "명세" in title and site == "명세", f"{title} / {site}")
            ok(f"{key} 파비콘 명세 문서 마크", ("%231d4ed8" in icon or "#1d4ed8" in icon)
               and "rect" in icon and "path" in icon, icon[:90])
            ok(f"{key} 로고 SVG 마크", page.evaluate("""() => {
                const svg = document.querySelector('.brand-mark svg');
                return !!svg && svg.querySelectorAll('rect').length >= 2 && svg.querySelectorAll('path').length === 3;
            }"""))
            page.close()

        page = browser.new_page(viewport={"width": 1280, "height": 900})
        watch(page, "demo")
        page.goto((SITE / "index.html").as_uri())
        page.wait_for_selector("#results .result-card", timeout=15000)
        page.wait_for_timeout(300)
        initial = page.inner_text("#results .result-big")
        page.fill("#hCardCredit", "3,000")
        page.fill("#hGross", "8,000")
        page.wait_for_timeout(300)
        page.click("#demoBtn")
        page.wait_for_timeout(400)
        cards = [page.input_value("#" + i) for i in
                 ["hCardCredit", "hCardCheck", "wCardCredit", "wCardCheck", "wCardTraditional", "wCardTransit"]]
        ok("예시 값 카드 금액 정상(만원)", cards == ["1,800", "600", "1,200", "500", "40", "60"], str(cards))
        ok("예시 값 총급여 6,000만원", page.input_value("#hGross").strip() == "6,000", page.input_value("#hGross"))
        ok("예시 값 결과 초기와 동일", page.inner_text("#results .result-big") == initial,
           f"{page.inner_text('#results .result-big')} vs {initial}")
        page.close()

        browser.close()

    # ---------- 6. 정적 검사 ----------
    for rel in ["index.html", "salary/index.html", "privacy/index.html"]:
        html = (SITE / rel).read_text(encoding="utf-8")
        ok(f"{rel} canonical", "myeongse.kr" in html and 'rel="canonical"' in html)
        ld = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        for i, block in enumerate(ld):
            try:
                json.loads(block)
            except Exception as e:  # noqa: BLE001
                errors.append(f"{rel} JSON-LD {i} 파싱 실패: {e}")
        ok(f"{rel} JSON-LD 파싱", all(True for _ in ld))

    sm = (SITE / "sitemap.xml").read_text(encoding="utf-8")
    ok("sitemap에 /salary/", "https://myeongse.kr/salary/" in sm)
    ok("sitemap에 /privacy/", "https://myeongse.kr/privacy/" in sm)

    passed = sum(1 for _, c, _ in checks if c)
    print(f"\n{passed}/{len(checks)} checks passed")
    for name, c, detail in checks:
        print(("PASS " if c else "FAIL ") + name + ("" if c else f"  -> {detail}"))
    if errors:
        print("\n--- console/page/parse errors ---")
        for e in errors:
            print(e)
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
