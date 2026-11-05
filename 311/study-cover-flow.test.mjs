/** 节点自测：过一遍→错题→复习轮 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const code = readFileSync(new URL("./study-list.js", import.meta.url), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(code, sandbox);
const Q = sandbox.window.StudyListQueue;

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const bank = Array.from({ length: 8 }, (_, i) => ({ id: `q${i}` }));
const state = {
  attempted: new Set(["q0", "q1"]),
  wrong: new Set(["q0"]),
  shuffleKey: "",
  shuffleOrder: [],
  coverPhase: "unanswered",
  reviewMastered: new Set(),
};

const phase = Q.resolveCoverPhase({
  mode: "random-cover",
  manualWrong: false,
  manualPending: false,
  pendingCount: 6,
  wrongCount: 1,
  savedPhase: "unanswered",
});
assert.equal(phase, "unanswered");

const filtered = bank.filter(q => !Q.shouldExcludeQuestion({
  phase: "unanswered",
  attempted: id => state.attempted.has(id),
  wrong: id => state.wrong.has(id),
  mastered: id => state.reviewMastered.has(id),
  q,
}));
assert.equal(filtered.length, 6);

const built1 = Q.buildFromFiltered({
  filtered,
  mode: "random-cover",
  reset: true,
  listKey: "scope",
  state,
  shuffle,
  phase: "unanswered",
});
const order = built1.shuffleOrder.slice();

state.attempted.add("q2");
const filtered2 = bank.filter(q => !Q.shouldExcludeQuestion({
  phase: "unanswered",
  attempted: id => state.attempted.has(id),
  wrong: id => state.wrong.has(id),
  mastered: id => state.reviewMastered.has(id),
  q,
}));
state.shuffleKey = built1.shuffleKey;
state.shuffleOrder = order;
const built2 = Q.buildFromFiltered({
  filtered: filtered2,
  mode: "random-cover",
  reset: false,
  listKey: "scope",
  state,
  shuffle,
  phase: "unanswered",
});
assert.deepEqual(built2.shuffleOrder, order);

const reviewPhase = Q.resolveCoverPhase({
  mode: "random-cover",
  manualWrong: false,
  manualPending: false,
  pendingCount: 0,
  savedPhase: "unanswered",
});
assert.equal(reviewPhase, "review");

state.reviewMastered.add("q2");
state.reviewMastered.add("q3");
const reviewFiltered = bank.filter(q => !Q.shouldExcludeQuestion({
  phase: "review",
  attempted: () => false,
  wrong: () => false,
  mastered: id => state.reviewMastered.has(id),
  q,
}));
assert.equal(reviewFiltered.length, 6);

const picked = Q.pickRandomFromPool(reviewFiltered, () => 0.99);
assert.equal(picked.id, reviewFiltered[reviewFiltered.length - 1].id);

const wrongFiltered = bank.filter(q => !Q.shouldExcludeQuestion({
  phase: "wrong",
  attempted: id => state.attempted.has(id),
  wrong: id => state.wrong.has(id),
  mastered: id => state.reviewMastered.has(id),
  q,
}));
const wrongBuilt = Q.buildFromFiltered({
  filtered: wrongFiltered,
  mode: "random-cover",
  reset: true,
  listKey: "wrong-scope",
  state: { ...state, attempted: new Set(bank.map(q => q.id)) },
  shuffle,
  phase: "wrong",
});
assert.equal(wrongBuilt.questions.length, 1);

const plain = value => JSON.parse(JSON.stringify(value));

const roundOne = Q.createInitialRound({
  scopeIds: ["a", "b", "c", "d"],
  attempted: [],
  wrong: [],
  correct: [],
});
assert.equal(roundOne.round, 1);
assert.deepEqual(plain(Q.roundRemainingIds(roundOne)), ["a", "b", "c", "d"]);

let round = Q.recordRoundAnswer(roundOne, "a", false);
round = Q.recordRoundAnswer(round, "b", true);
round = Q.recordRoundAnswer(round, "c", false);
round = Q.recordRoundAnswer(round, "d", true);
assert.deepEqual(plain(Q.roundRemainingIds(round)), []);
assert.deepEqual(plain(round.wrong), ["a", "c"]);

const roundTwo = Q.advanceRound(round, ids => ids.slice().sort());
assert.equal(roundTwo.round, 2);
assert.equal(roundTwo.done, false);
assert.deepEqual(plain(roundTwo.set), ["a", "c"]);
assert.deepEqual(plain(roundTwo.answered), []);
assert.equal(roundTwo.set.includes("a"), true);
assert.equal(roundTwo.set.includes("b"), false);

let roundTwoDone = Q.recordRoundAnswer(roundTwo, "a", false);
roundTwoDone = Q.recordRoundAnswer(roundTwoDone, "c", true);
const roundThree = Q.advanceRound(roundTwoDone, ids => ids);
assert.equal(roundThree.round, 3);
assert.deepEqual(plain(roundThree.set), ["a"]);

const finished = Q.advanceRound(Q.recordRoundAnswer(roundThree, "a", true), ids => ids);
assert.equal(finished.done, true);
assert.deepEqual(plain(finished.set), []);
assert.deepEqual(plain(Q.advanceRound(finished, ids => ids)), plain(finished));

const corrected = Q.recordRoundAnswer(
  { round: 1, set: ["a", "b"], answered: ["b"], wrong: ["a", "b"], done: false },
  "a",
  true,
);
assert.deepEqual(plain(corrected.wrong), ["b"]);

const midPass = Q.createInitialRound({
  scopeIds: ["a", "b", "c"],
  attempted: ["a"],
  wrong: ["a"],
  correct: [],
});
assert.equal(midPass.round, 1);
assert.deepEqual(plain(Q.roundRemainingIds(midPass)), ["b", "c"]);
assert.deepEqual(plain(midPass.wrong), ["a"]);

const afterPass = Q.createInitialRound({
  scopeIds: ["a", "b", "c"],
  attempted: ["a", "b", "c"],
  wrong: ["b"],
  correct: ["a", "c"],
});
assert.equal(afterPass.round, 2);
assert.deepEqual(plain(afterPass.set), ["b"]);

const allCorrect = Q.createInitialRound({
  scopeIds: ["a"],
  attempted: ["a"],
  wrong: [],
  correct: ["a"],
});
assert.equal(allCorrect.done, true);

const restored = Q.normalizeRoundRecord({ round: 3, set: ["a", "b"], answered: ["a"], wrong: ["a"], done: false });
assert.equal(restored.round, 3);
assert.deepEqual(plain(Q.roundRemainingIds(restored)), ["b"]);
assert.deepEqual(plain(Q.roundRemainingIds(restored, new Set(["b"]))), ["b"]);
assert.deepEqual(plain(Q.roundRemainingIds({ ...restored, answered: ["a", "b"] }, new Set(["b"]))), []);

const stored = Q.sanitizeRounds({
  "全部\u0001全部": { round: 2, set: ["x", "x"], answered: [], wrong: [], done: false },
  bad: null,
});
assert.equal(stored["全部\u0001全部"].round, 2);
assert.deepEqual(plain(stored["全部\u0001全部"].set), ["x"]);
assert.equal(stored.bad, undefined);

const eduHtml = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const mixedHtml = readFileSync(new URL("./politics/mixed/index.html", import.meta.url), "utf8");
const eduApp = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const politicsApp = readFileSync(new URL("./politics/app.js", import.meta.url), "utf8");

function modeValues(html) {
  const block = html.split('id="mode-select"')[1].split("</select>")[0];
  return [...block.matchAll(/value="([^"]+)"/g)].map(match => match[1]);
}

assert.deepEqual(modeValues(eduHtml), ["random-cover"]);
assert.deepEqual(modeValues(mixedHtml), ["random-cover"]);
assert.equal(eduHtml.includes("roundOnly: true"), true);
assert.equal(mixedHtml.includes("roundOnly: true"), true);
assert.equal(eduHtml.includes("完全随机"), false);
assert.equal(mixedHtml.includes("完全随机"), false);
assert.equal(mixedHtml.includes("按题库顺序"), false);
for (const src of [eduApp, politicsApp]) {
  assert.equal(src.includes("advanceRound(rec, shuffle)"), false);
  assert.equal(src.includes("shuffle(scopeQuestionIds())"), false);
  assert.equal(src.includes("roundsByScope"), true);
  assert.equal(src.includes("Q.advanceRound(rec)"), true);
}

console.log("study-cover-flow.test.mjs OK");
