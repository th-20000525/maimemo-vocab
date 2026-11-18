#!/usr/bin/env node
/**
 * Retag 史纲 / 新思想 / 毛中特 / 思修 knowledge points.
 * Do NOT modify 马原 categories, subjectLabels, or IDs.
 */
import fs from "fs";

const PATH = "311/politics/wrong/questions.js";
const raw = fs.readFileSync(PATH, "utf8");
const bank = JSON.parse(
  raw.replace(/^window\.QUESTION_BANK\s*=\s*/, "").replace(/;\s*$/, "")
);

const mayuanBefore = bank
  .filter((q) => q.subjectLabel === "马原" || String(q.id).startsWith("ma-yuan") || String(q.id).startsWith("uploaded-wrong-my"))
  .map((q) => ({ id: q.id, category: q.category, subjectLabel: q.subjectLabel }));

/** id -> { category, subjectLabel? } */
const retags = {
  // —— 史纲：修正错标 ——
  "history-outline-033": { category: "近代中国的开端与反侵略斗争" },
  "history-outline-035": { category: "近代中国的开端与反侵略斗争" },
  "history-outline-036": { category: "近代中国的开端与反侵略斗争" },
  "history-outline-038": { category: "近代中国的开端与反侵略斗争" },
  "history-outline-103": { category: "近代中国的开端与反侵略斗争" },
  "history-outline-116": { category: "全民族抗战与抗日战争胜利" },
  "history-outline-122": { category: "社会主义革命、建设与探索" },
  "history-outline-140": { category: "解放战争与新中国成立" },
  "history-outline-153": { category: "近代中国的开端与反侵略斗争" },
  "history-outline-155": { category: "近代中国的开端与反侵略斗争" },
  "history-outline-157": { category: "近代中国的开端与反侵略斗争" },
  "history-outline-181": { category: "解放战争与新中国成立" },
  "history-outline-190": { category: "社会主义革命、建设与探索" },
  "history-outline-200": { category: "全民族抗战与抗日战争胜利" },
  "history-outline-202": { category: "近代中国的开端与反侵略斗争" },
  "history-outline-214": { category: "新文化运动、五四运动与中国共产党创建" },
  "history-outline-220": { category: "新文化运动、五四运动与中国共产党创建" },
  "history-outline-221": { category: "新文化运动、五四运动与中国共产党创建" },
  "history-outline-223": { category: "新文化运动、五四运动与中国共产党创建" },
  "history-outline-234": { category: "全民族抗战与抗日战争胜利" },
  "history-outline-235": { category: "全民族抗战与抗日战争胜利" },

  // —— 史纲：未细分 ——
  "uploaded-wrong-sg-001": { category: "解放战争与新中国成立" },
  "uploaded-wrong-sg-002": { category: "解放战争与新中国成立" },
  "uploaded-wrong-sg-003": { category: "新文化运动、五四运动与中国共产党创建" },
  "uploaded-wrong-sg-004": { category: "新文化运动、五四运动与中国共产党创建" },
  "uploaded-wrong-sg-005": { category: "国民革命与土地革命战争" },
  "uploaded-wrong-sg-006": { category: "新文化运动、五四运动与中国共产党创建" },
  "uploaded-wrong-sg-007": { category: "解放战争与新中国成立" },
  "uploaded-wrong-sg-008": { category: "国民革命与土地革命战争" },
  "uploaded-wrong-sg-009": { category: "新时代与民族复兴" },
  "uploaded-wrong-sg-010": { category: "全民族抗战与抗日战争胜利" },
  "uploaded-wrong-sg-011": { category: "全民族抗战与抗日战争胜利" },
  "uploaded-wrong-sg-012": { category: "社会主义革命、建设与探索" },
  "uploaded-wrong-sg-013": { category: "全民族抗战与抗日战争胜利" },
  "uploaded-wrong-sg-014": { category: "社会主义革命、建设与探索" },
  "uploaded-wrong-sg-015": { category: "国民革命与土地革命战争" },
  "uploaded-wrong-sg-016": { category: "社会主义革命、建设与探索" },
  "uploaded-wrong-sg-017": { category: "全民族抗战与抗日战争胜利" },
  "uploaded-wrong-sg-018": { category: "解放战争与新中国成立" },
  "uploaded-wrong-sg-019": { category: "中国精神与爱国主义", subjectLabel: "思修" },
  "uploaded-wrong-sg-020": { category: "近代中国的开端与反侵略斗争" },
  "uploaded-wrong-sg-021": { category: "近代中国的开端与反侵略斗争" },
  "uploaded-wrong-sg-022": { category: "新文化运动、五四运动与中国共产党创建" },
  "uploaded-wrong-sg-023": { category: "新文化运动、五四运动与中国共产党创建" },
  "uploaded-wrong-sg-024": { category: "新文化运动、五四运动与中国共产党创建" },
  "uploaded-wrong-sg-025": { category: "国民革命与土地革命战争" },
  "uploaded-wrong-sg-026": { category: "全民族抗战与抗日战争胜利" },
  "uploaded-wrong-sg-027": { category: "全民族抗战与抗日战争胜利" },
  "uploaded-wrong-sg-028": { category: "全民族抗战与抗日战争胜利" },
  "uploaded-wrong-sg-029": { category: "社会主义革命、建设与探索" },
  "uploaded-wrong-sg-030": { category: "解放战争与新中国成立" },
  "uploaded-wrong-sg-031": { category: "洋务运动、维新变法与辛亥革命" },
  "uploaded-wrong-sg-032": { category: "新时代与民族复兴" },
  "uploaded-wrong-sg-033": { category: "全民族抗战与抗日战争胜利" },
  "uploaded-wrong-sg-034": { category: "近代中国的开端与反侵略斗争" },
  "uploaded-wrong-sg-035": { category: "全民族抗战与抗日战争胜利" },

  // —— 新思想：修正错标 ——
  "xin-thought-011": { category: "思想理论与「两个结合」" },
  "xin-thought-025": { category: "中国式现代化与民族复兴" },
  "xin-thought-063": { category: "高质量发展与经济建设" },
  "xin-thought-070": { category: "高质量发展与经济建设" },

  // —— 新思想：未细分 ——
  "uploaded-wrong-xs-001": { category: "中国特色大国外交" },
  "uploaded-wrong-xs-002": { category: "党的领导与自我革命" },
  "uploaded-wrong-xs-003": { category: "生态文明与绿色发展" },
  "uploaded-wrong-xs-004": { category: "中国特色大国外交" },
  "uploaded-wrong-xs-005": { category: "高质量发展与经济建设" },
  "uploaded-wrong-xs-006": { category: "社会主义改造理论", subjectLabel: "毛中特" },
  "uploaded-wrong-xs-007": { category: "中国式现代化与民族复兴" },
  "uploaded-wrong-xs-008": { category: "中国特色大国外交" },
  "uploaded-wrong-xs-009": { category: "高质量发展与经济建设" },
  "uploaded-wrong-xs-010": { category: "中国特色大国外交" },
  "uploaded-wrong-xs-011": { category: "改革开放与发展动力" },
  "uploaded-wrong-xs-012": { category: "民主政治与全面依法治国" },
  "uploaded-wrong-xs-013": { category: "理想信念", subjectLabel: "思修" },
  "uploaded-wrong-xs-014": { category: "思想理论与「两个结合」" },
  "uploaded-wrong-xs-015": { category: "中国特色大国外交" },
  "uploaded-wrong-xs-016": { category: "民主政治与全面依法治国" },
  "uploaded-wrong-xs-017": { category: "中国特色大国外交" }, // stem 命运共同体；正确项偏唯物史观 → 残留说明
  "uploaded-wrong-xs-018": { category: "高质量发展与经济建设" },
  "uploaded-wrong-xs-019": { category: "党的领导与自我革命" },
  "uploaded-wrong-xs-020": { category: "中国特色大国外交" },
  "uploaded-wrong-xs-021": { category: "高质量发展与经济建设" },
  "uploaded-wrong-xs-022": { category: "高质量发展与经济建设" },
  "uploaded-wrong-xs-023": { category: "改革开放与发展动力" },
  "uploaded-wrong-xs-024": { category: "中国特色大国外交" },
  "uploaded-wrong-xs-025": { category: "思想道德与法律关系", subjectLabel: "思修" },
  "uploaded-wrong-xs-026": { category: "思想理论与「两个结合」" },
  "uploaded-wrong-xs-027": { category: "高质量发展与经济建设" },
  "uploaded-wrong-xs-028": { category: "民生保障与共同富裕" },
  "uploaded-wrong-xs-029": { category: "改革开放与发展动力" },
  "uploaded-wrong-xs-030": { category: "党的领导与自我革命" },
  "uploaded-wrong-xs-031": { category: "民生保障与共同富裕" },
  "uploaded-wrong-xs-032": { category: "民主政治与全面依法治国" },
  "uploaded-wrong-xs-033": { category: "民主政治与全面依法治国" },
  "uploaded-wrong-xs-034": { category: "思想理论与「两个结合」" },
  "uploaded-wrong-xs-035": { category: "思想理论与「两个结合」" },
  "uploaded-wrong-xs-036": { category: "民生保障与共同富裕" },
  "uploaded-wrong-xs-037": { category: "改革开放与发展动力" },
  "uploaded-wrong-xs-038": { category: "改革开放与发展动力" },
  "uploaded-wrong-xs-039": { category: "高质量发展与经济建设" },
  "uploaded-wrong-xs-040": { category: "高质量发展与经济建设" },
  "uploaded-wrong-xs-041": { category: "高质量发展与经济建设" },
  "uploaded-wrong-xs-042": { category: "改革开放与发展动力" },
  "uploaded-wrong-xs-043": { category: "民主政治与全面依法治国" },
  "uploaded-wrong-xs-044": { category: "国家安全、国防与祖国统一" },
  "uploaded-wrong-xs-045": { category: "国家安全、国防与祖国统一" },
  "uploaded-wrong-xs-046": { category: "文化建设与文化自信" }, // 《复兴文库》；正确项偏历史观
  "uploaded-wrong-xs-047": { category: "思想理论与「两个结合」" }, // 历史规律；正确项偏唯物史观
  "uploaded-wrong-xs-048": { category: "中国式现代化与民族复兴" }, // 阶梯式递进；正确项偏辩证法
  "uploaded-wrong-xs-049": { category: "高质量发展与经济建设" },
  "uploaded-wrong-xs-050": { category: "党的领导与自我革命" },
  "uploaded-wrong-xs-051": { category: "中国特色大国外交" },
  "uploaded-wrong-xs-052": { category: "中国式现代化与民族复兴" },
  "uploaded-wrong-xs-053": { category: "中国特色大国外交" },
  "uploaded-wrong-xs-054": { category: "中国特色大国外交" },
  "uploaded-wrong-xs-055": { category: "高质量发展与经济建设" },
  "uploaded-wrong-xs-056": { category: "中国特色大国外交" },
  "uploaded-wrong-xs-057": { category: "民生保障与共同富裕" },
  "uploaded-wrong-xs-058": { category: "高质量发展与经济建设" },
  "uploaded-wrong-xs-059": { category: "民主政治与全面依法治国" },
  "uploaded-wrong-xs-060": { category: "文化建设与文化自信" },
  "uploaded-wrong-xs-061": { category: "中国特色大国外交" },
  "uploaded-wrong-xs-062": { category: "中国式现代化与民族复兴" },
  "uploaded-wrong-xs-063": { category: "民生保障与共同富裕" },
  "uploaded-wrong-xs-064": { category: "中国特色大国外交" },
  "uploaded-wrong-xs-065": { category: "思想理论与「两个结合」" },
  "uploaded-wrong-xs-066": { category: "中国式现代化与民族复兴" },
  "uploaded-wrong-xs-067": { category: "中国特色大国外交" },

  // —— 毛中特：未细分 ——
  "uploaded-wrong-mz-001": { category: "社会主义建设道路初步探索" },
  "uploaded-wrong-mz-002": { category: "社会主义改造理论" },
  "uploaded-wrong-mz-003": { category: "邓小平理论" },
  "uploaded-wrong-mz-004": { category: "邓小平理论" },
  "uploaded-wrong-mz-005": { category: "邓小平理论" },
  "uploaded-wrong-mz-006": { category: "社会主义建设道路初步探索" },
  "uploaded-wrong-mz-007": { category: "邓小平理论" },
  "uploaded-wrong-mz-008": { category: "邓小平理论" },
  "uploaded-wrong-mz-009": { category: "邓小平理论" },
  "uploaded-wrong-mz-010": { category: "科学发展观" },
  "uploaded-wrong-mz-011": { category: "毛泽东思想的形成与活的灵魂" },
  "uploaded-wrong-mz-012": { category: "社会主义改造理论" },
  "uploaded-wrong-mz-013": { category: "「三个代表」重要思想" },
  "uploaded-wrong-mz-014": { category: "科学发展观" },
  "uploaded-wrong-mz-015": { category: "邓小平理论" },
  "uploaded-wrong-mz-016": { category: "邓小平理论" },
  "uploaded-wrong-mz-017": { category: "新民主主义革命理论" },
  "uploaded-wrong-mz-018": { category: "新民主主义革命理论" },
  "uploaded-wrong-mz-019": { category: "新民主主义革命理论" },
  "uploaded-wrong-mz-020": { category: "社会主义建设道路初步探索" },
  "uploaded-wrong-mz-021": { category: "「三个代表」重要思想" },

  // —— 思修：修正错标 ——
  "sixiuyang-021": { category: "道德规范与修养" },

  // —— 思修：未细分 ——
  "uploaded-wrong-sx-001": { category: "道德规范与修养" },
  "uploaded-wrong-sx-002": { category: "中国精神与爱国主义" },
  "uploaded-wrong-sx-003": { category: "法治思想与法律基础" },
  "uploaded-wrong-sx-004": { category: "法治思想与法律基础" },
  "uploaded-wrong-sx-005": { category: "法治思想与法律基础" },
  "uploaded-wrong-sx-006": { category: "道德规范与修养" },
  "uploaded-wrong-sx-007": { category: "道德规范与修养" },
  "uploaded-wrong-sx-008": { category: "社会主义核心价值观" },
  "uploaded-wrong-sx-009": { category: "法治思想与法律基础" },
  "uploaded-wrong-sx-010": { category: "道德规范与修养" },
  "uploaded-wrong-sx-011": { category: "道德规范与修养" },
  "uploaded-wrong-sx-012": { category: "法治思想与法律基础" },
  "uploaded-wrong-sx-013": { category: "法治思想与法律基础" },
  "uploaded-wrong-sx-014": { category: "中国精神与爱国主义" },
  "uploaded-wrong-sx-015": { category: "道德规范与修养" },
  "uploaded-wrong-sx-016": { category: "道德规范与修养" },
  "uploaded-wrong-sx-017": { category: "道德规范与修养" },
  "uploaded-wrong-sx-018": { category: "道德规范与修养" },
  "uploaded-wrong-sx-019": { category: "道德规范与修养" },
  "uploaded-wrong-sx-020": { category: "法治思想与法律基础" },
  "uploaded-wrong-sx-021": { category: "中国精神与爱国主义" },
  "uploaded-wrong-sx-022": { category: "思想道德与法律关系" },
  "uploaded-wrong-sx-023": { category: "法治思想与法律基础" },
  "uploaded-wrong-sx-024": { category: "道德规范与修养" },
  "uploaded-wrong-sx-025": { category: "法治思想与法律基础" },
  "uploaded-wrong-sx-026": { category: "法治思想与法律基础" },
  "uploaded-wrong-sx-027": { category: "道德规范与修养" },
  "uploaded-wrong-sx-028": { category: "法治思想与法律基础" },
};

const stats = { changed: 0, bySubject: {}, missing: [], skippedMayuan: 0 };
const four = new Set(["史纲", "新思想", "毛中特", "思修"]);

for (const q of bank) {
  const patch = retags[q.id];
  if (!patch) continue;
  if (q.subjectLabel === "马原" || String(q.id).startsWith("uploaded-wrong-my") || String(q.id).startsWith("ma-yuan")) {
    stats.skippedMayuan++;
    continue;
  }
  const beforeSub = q.subjectLabel;
  const beforeCat = q.category;
  if (patch.subjectLabel) q.subjectLabel = patch.subjectLabel;
  if (patch.category) q.category = patch.category;
  if (beforeCat !== q.category || beforeSub !== q.subjectLabel) {
    stats.changed++;
    const key = `${beforeSub}→${q.subjectLabel}|${beforeCat}→${q.category}`;
    stats.bySubject[beforeSub] = (stats.bySubject[beforeSub] || 0) + 1;
  }
}

// Ensure every mapped id exists
for (const id of Object.keys(retags)) {
  if (!bank.some((q) => q.id === id)) stats.missing.push(id);
}

// 马原 unchanged check
const mayuanAfter = bank
  .filter((q) => q.subjectLabel === "马原" || String(q.id).startsWith("ma-yuan") || String(q.id).startsWith("uploaded-wrong-my"))
  .map((q) => ({ id: q.id, category: q.category, subjectLabel: q.subjectLabel }));

if (JSON.stringify(mayuanBefore) !== JSON.stringify(mayuanAfter)) {
  console.error("FATAL: 马原 tags/IDs changed");
  process.exit(1);
}

// No ·未细分 left in four subjects (except none expected)
const residualUntagged = bank.filter(
  (q) => four.has(q.subjectLabel) && String(q.category).includes("未细分")
);

const out =
  "window.QUESTION_BANK = " +
  JSON.stringify(bank, null, 2) +
  ";\n";
fs.writeFileSync(PATH, out);

console.log(JSON.stringify({
  changed: stats.changed,
  bySubject: stats.bySubject,
  missing: stats.missing,
  skippedMayuan: stats.skippedMayuan,
  residualUntagged: residualUntagged.map((q) => q.id),
  mayuanCount: mayuanAfter.length,
}, null, 2));

// Print new distributions
const bySub = {};
for (const q of bank) {
  const sub = q.subjectLabel || "?";
  bySub[sub] = bySub[sub] || { total: 0, cats: {} };
  bySub[sub].total++;
  bySub[sub].cats[q.category] = (bySub[sub].cats[q.category] || 0) + 1;
}
for (const sub of ["马原", "史纲", "新思想", "毛中特", "思修"]) {
  const info = bySub[sub];
  console.log(`\n===${sub} (${info.total})===`);
  Object.entries(info.cats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => console.log(`${n}\t${c}`));
}
