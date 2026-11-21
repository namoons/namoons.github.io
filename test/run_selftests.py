"""calc.js 계열 엔진과 자체 검증 스크립트를 quickjs로 실행하는 러너."""
import json
import sys
import pathlib

import quickjs

ROOT = pathlib.Path(__file__).resolve().parents[1]

STUB = """
var window = globalThis;
var __el = { innerHTML: '', textContent: '', style: {} };
var document = {
  getElementById: function () { return __el; },
  addEventListener: function () {},
  querySelectorAll: function () { return []; },
  querySelector: function () { return null; },
  createElement: function () { return { className: '', innerHTML: '', querySelector: function(){return null;}, appendChild: function(){} }; },
  body: { classList: { toggle: function(){} } }
};
"""


def run(calc_rel, test_rel):
    ctx = quickjs.Context()
    ctx.eval(STUB)
    ctx.eval((ROOT / calc_rel).read_text(encoding="utf-8"))
    ctx.eval((ROOT / test_rel).read_text(encoding="utf-8"))
    res = ctx.get("__TEST_RESULTS")
    data = json.loads(res.json()) if hasattr(res, "json") else json.loads(str(res))
    return data


if __name__ == "__main__":
    pairs = [
        ("calc.js", "test/selftest.js"),
        ("salary/calc.js", "salary/test/selftest.js"),
        ("health/calc.js", "health/test/selftest.js"),
    ]
    total_fail = 0
    for calc, test in pairs:
        d = run(calc, test)
        print(f"\n=== {calc} :: {test} ===")
        print(f"통과 {d['passed']} / {d['total']} · 실패 {d['failed']}")
        for r in d["rows"]:
            if not (r.get("ok") if "ok" in r else r.get("pass")):
                total_fail += 1
                print(f"  FAIL #{r['name']} | 기대 {r['expected']} | 계산 {r['actual']} | {r['note']}")
    sys.exit(1 if total_fail else 0)
