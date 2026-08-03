import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutSource = await readFile(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
const globalStyles = await readFile(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);
const demoPageSource = await readFile(
  new URL("../app/journal/demo/page.tsx", import.meta.url),
  "utf8",
);
const capsulePageSource = await readFile(
  new URL("../components/capsule/capsule-page.tsx", import.meta.url),
  "utf8",
);

function ruleBody(selector, startAt = 0) {
  const ruleStart = globalStyles.indexOf(`${selector} {`, startAt);
  assert.notEqual(ruleStart, -1, `Missing CSS rule: ${selector}`);
  const bodyStart = globalStyles.indexOf("{", ruleStart) + 1;
  const bodyEnd = globalStyles.indexOf("\n}", bodyStart);
  assert.notEqual(bodyEnd, -1, `Unterminated CSS rule: ${selector}`);
  return globalStyles.slice(bodyStart, bodyEnd);
}

test("mobile viewport extends the leather fallback through safe areas", () => {
  assert.match(layoutSource, /themeColor:\s*"#42362f"/);
  assert.match(layoutSource, /viewportFit:\s*"cover"/);
  assert.doesNotMatch(layoutSource, /themeColor:\s*"#eee7d8"/);

  const p8Rule = ruleBody("main.min-h-screen.bg-leather.p-8");
  assert.match(p8Rule, /min-height:\s*100dvh;/);
  assert.match(p8Rule, /padding-bottom:\s*calc\(2rem \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(p8Rule, /padding-left:\s*calc\(2rem \+ env\(safe-area-inset-left\)\);/);
  assert.match(p8Rule, /padding-right:\s*calc\(2rem \+ env\(safe-area-inset-right\)\);/);
  assert.match(p8Rule, /padding-top:\s*calc\(2rem \+ env\(safe-area-inset-top\)\);/);

  const paddedRule = ruleBody("main.min-h-screen.bg-leather.px-3.py-8");
  assert.match(paddedRule, /min-height:\s*100dvh;/);
  assert.match(paddedRule, /padding-bottom:\s*calc\(2rem \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(paddedRule, /padding-left:\s*calc\(0\.75rem \+ env\(safe-area-inset-left\)\);/);
  assert.match(paddedRule, /padding-right:\s*calc\(0\.75rem \+ env\(safe-area-inset-right\)\);/);
  assert.match(paddedRule, /padding-top:\s*calc\(2rem \+ env\(safe-area-inset-top\)\);/);

  const paddedDesktopRule = ruleBody(
    "main.min-h-screen.bg-leather.px-3.py-8",
    globalStyles.indexOf("@media (min-width: 640px)"),
  );
  assert.match(paddedDesktopRule, /padding-bottom:\s*calc\(3rem \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(paddedDesktopRule, /padding-left:\s*calc\(1\.5rem \+ env\(safe-area-inset-left\)\);/);
  assert.match(paddedDesktopRule, /padding-right:\s*calc\(1\.5rem \+ env\(safe-area-inset-right\)\);/);
  assert.match(paddedDesktopRule, /padding-top:\s*calc\(3rem \+ env\(safe-area-inset-top\)\);/);

  const shellRule = ruleBody(".journal-mobile-shell");
  assert.match(shellRule, /padding-inline:\s*calc\(0\.75rem \+ env\(safe-area-inset-left\)\)\s*calc\(0\.75rem \+ env\(safe-area-inset-right\)\);/);
  const shellDesktopRule = ruleBody(
    ".journal-mobile-shell",
    globalStyles.indexOf(".journal-mobile-shell {", globalStyles.indexOf(".journal-mobile-shell {") + 1),
  );
  assert.match(shellDesktopRule, /padding-inline:\s*calc\(1rem \+ env\(safe-area-inset-left\)\)\s*calc\(1rem \+ env\(safe-area-inset-right\)\);/);
});

test("Journal page owns the leather texture behind Safari floating chrome", () => {
  assert.match(
    globalStyles,
    /html:has\(\.journal-mobile-page\),\s*body:has\(\.journal-mobile-page\)\s*\{\s*background:\s*var\(--leather\);\s*\}/,
  );
  const pageRule = ruleBody(".journal-mobile-page");
  assert.match(pageRule, /min-height:\s*100dvh;/);
  assert.match(pageRule, /min-height:\s*100lvh;/);
  assert.match(pageRule, /overflow:\s*visible;/);

  for (const source of [demoPageSource, capsulePageSource]) {
    assert.match(
      source,
      /className="journal-mobile-page journal-themed-background"/,
    );
  }
  assert.match(demoPageSource, /style=\{journalThemeStyle\(defaultJournalTheme\)\}/);
  assert.match(capsulePageSource, /\.\.\.journalThemeStyle\(theme\)/);
  assert.doesNotMatch(
    demoPageSource,
    /<JournalMobileShell[\s\S]*?className="journal-themed-background"/,
  );
  assert.doesNotMatch(
    capsulePageSource,
    /<JournalMobileShell[\s\S]*?className="journal-themed-background"/,
  );
});
