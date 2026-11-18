// TEMPORAL (S10 · PR #17): resume los JSON de Lighthouse del workflow diag-lighthouse. Se borra antes del merge.
const fs = require("node:fs");
const path = require("node:path");

const dir = process.argv[2];
const short = (u) => String(u).replace(/^.*\/_next\//, "").replace("http://127.0.0.1:3600", "");
for (const f of fs.readdirSync(dir).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  if (j.runtimeError) {
    console.log(`\n### ${f}: ERROR ${j.runtimeError.code}`);
    continue;
  }
  const a = j.audits;
  const script = a["resource-summary"].details.items.find((i) => i.resourceType === "script");
  console.log(
    `\n### ${f}: TBT ${Math.round(a["total-blocking-time"].numericValue)} ms · TTI ${Math.round(a["interactive"].numericValue)} · script ${(script.transferSize / 1024).toFixed(1)} KB · benchmarkIndex ${j.environment.benchmarkIndex}`,
  );
  console.log(
    "main-thread:",
    a["mainthread-work-breakdown"].details.items.map((i) => `${i.groupLabel} ${Math.round(i.duration)}`).join(" · "),
  );
  for (const i of a["bootup-time"].details.items.slice(0, 6))
    console.log(`  bootup ${Math.round(i.total)} ms (script ${Math.round(i.scripting)}, parse ${Math.round(i.scriptParseCompile)}) ${short(i.url)}`);
  const lt = a["long-tasks"]?.details?.items ?? [];
  for (const i of lt.slice(0, 10)) console.log(`  long ${Math.round(i.duration)} ms @ ${Math.round(i.startTime)} ${short(i.url)}`);
}
