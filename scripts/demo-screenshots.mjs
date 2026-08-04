/**
 * Regenerates the README screenshots in docs/screenshots/.
 *
 * The app has no demo mode, and the maintainer's real measurements are not
 * something to publish — so this script seeds a FICTIONAL dataset into the
 * e2e account, captures every screen (light + dark), then deletes the seeded
 * sessions again. Nothing real is ever photographed.
 *
 * Prerequisites:
 *   1. `npm run dev` running on :3000
 *   2. E2E_EMAIL / E2E_PASSWORD set in .env.local
 *   3. a fresh storageState:
 *      E2E_BASE_URL=http://localhost:3000 npx playwright test --project=setup
 *
 * Run:  node scripts/demo-screenshots.mjs
 * Set KEEP_DEMO=1 to leave the seeded sessions in place (debugging only —
 * they overwrite the account's profile with the demo persona either way).
 */
import { chromium, devices, request as pwRequest } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs/screenshots");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const STORAGE = path.join(ROOT, "tests/e2e/.auth/user.json");
fs.mkdirSync(OUT, { recursive: true });

const fr = (n, d = 1) => n.toFixed(d).replace(".", ",");

// 100% fictional dataset: written to the e2e account, deleted at the end.
const START = "2026-02-15";
const SESSIONS = [
  { d: "2026-02-15", w: 88.6, waist: 96, chest: 104, hips: 102, sh: 118, thigh: 61, calf: 39, bi: 33, fat: 26.4, mus: 38.1 },
  { d: "2026-03-01", w: 87.4, waist: 95, chest: 104, hips: 101, sh: 118, thigh: 61, calf: 39, bi: 33.5, fat: 25.8, mus: 38.4 },
  { d: "2026-03-15", w: 86.5, waist: 94, chest: 103, hips: 100, sh: 118, thigh: 60, calf: 39, bi: 34, fat: 25.1, mus: 38.9 },
  { d: "2026-04-01", w: 85.2, waist: 92, chest: 103, hips: 100, sh: 119, thigh: 60, calf: 39, bi: 34, fat: 24.3, mus: 39.4 },
  { d: "2026-04-15", w: 84.4, waist: 91, chest: 102, hips: 99, sh: 119, thigh: 60, calf: 39.5, bi: 34.5, fat: 23.7, mus: 39.8 },
  { d: "2026-05-01", w: 83.1, waist: 90, chest: 102, hips: 98, sh: 119, thigh: 59, calf: 39.5, bi: 34.5, fat: 22.9, mus: 40.2 },
  { d: "2026-05-17", w: 82.3, waist: 89, chest: 101, hips: 98, sh: 120, thigh: 59, calf: 39.5, bi: 35, fat: 22.2, mus: 40.6 },
  { d: "2026-06-01", w: 81.4, waist: 88, chest: 101, hips: 97, sh: 120, thigh: 59, calf: 40, bi: 35, fat: 21.6, mus: 41 },
  { d: "2026-06-15", w: 80.9, waist: 87, chest: 101, hips: 97, sh: 120, thigh: 58.5, calf: 40, bi: 35.5, fat: 21.1, mus: 41.3 },
  { d: "2026-07-01", w: 80.2, waist: 86, chest: 100, hips: 96, sh: 121, thigh: 58.5, calf: 40, bi: 35.5, fat: 20.4, mus: 41.7 },
  { d: "2026-07-18", w: 79.6, waist: 85, chest: 100, hips: 96, sh: 121, thigh: 58, calf: 40, bi: 36, fat: 19.9, mus: 42 },
  { d: "2026-08-02", w: 79.1, waist: 84, chest: 100, hips: 95, sh: 121, thigh: 58, calf: 40, bi: 36, fat: 19.4, mus: 42.3 },
];

const api = await pwRequest.newContext({ baseURL: BASE, storageState: STORAGE });

const profileRes = await api.put("/api/profile", {
  data: {
    heightCm: "178",
    targetWeightKg: "75",
    sex: "male",
    transformationStartedOn: START,
  },
});
console.log("profile", profileRes.status());

const created = [];
for (const s of SESSIONS) {
  const res = await api.post("/api/sessions", {
    data: {
      measuredOn: s.d,
      weight_kg: fr(s.w),
      waist_cm: fr(s.waist, s.waist % 1 ? 1 : 0),
      chest_cm: String(s.chest),
      hips_cm: String(s.hips),
      shoulders_cm: String(s.sh),
      thigh_cm: fr(s.thigh, s.thigh % 1 ? 1 : 0),
      calf_cm: fr(s.calf, s.calf % 1 ? 1 : 0),
      biceps_cm: fr(s.bi, s.bi % 1 ? 1 : 0),
      body_fat_pct: fr(s.fat),
      muscle_pct: fr(s.mus),
    },
  });
  if (res.status() !== 201) console.log("FAIL", s.d, res.status(), await res.text());
  else created.push((await res.json()).id);
}
console.log("created", created.length, "sessions");

const ANONYMISE = `
(() => {
  const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (it.nextNode()) nodes.push(it.currentNode);
  for (const n of nodes) {
    if (n.nodeValue && n.nodeValue.includes('@'))
      n.nodeValue = n.nodeValue.replace(/[\\w.+-]+@[\\w.-]+\\.\\w+/g, 'demo@morpho.app');
  }
})();
`;

const PAGES = [
  { slug: "accueil", url: "/" },
  { slug: "graphes", url: "/graphes" },
  { slug: "historique", url: "/historique" },
  { slug: "saisie", url: "/saisie" },
  { slug: "profil", url: "/profil" },
];

const browser = await chromium.launch();
try {
  for (const scheme of ["light", "dark"]) {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      storageState: STORAGE,
      colorScheme: scheme,
      locale: "fr-FR",
    });
    const page = await context.newPage();
    for (const { slug, url } of PAGES) {
      await page.goto(BASE + url, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      await page.evaluate(ANONYMISE);
      const file = path.join(OUT, `${slug}${scheme === "dark" ? "-dark" : ""}.png`);
      await page.screenshot({ path: file });
      console.log("wrote", file);
    }
    await context.close();
  }

  const anon = await browser.newContext({
    ...devices["iPhone 13"],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    locale: "fr-FR",
  });
  const anonPage = await anon.newPage();
  await anonPage.goto(BASE + "/auth/sign-in", { waitUntil: "networkidle" });
  await anonPage.waitForTimeout(1000);
  await anonPage.screenshot({ path: path.join(OUT, "connexion.png") });
  console.log("wrote connexion.png");
  await anon.close();
} finally {
  await browser.close();
  if (!process.env.KEEP_DEMO) {
    for (const id of created) {
      const res = await api.delete(`/api/sessions/${id}`);
      if (res.status() >= 300) console.log("delete failed", id, res.status());
    }
    console.log("deleted", created.length, "demo sessions");
  } else {
    console.log("KEEP_DEMO set — demo sessions left:", created.join(","));
  }
  await api.dispose();
}
