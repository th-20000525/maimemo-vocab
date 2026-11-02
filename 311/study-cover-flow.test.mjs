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
  wrongCount: 3,
  savedPhase: "review",
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

console.log("study-cover-flow.test.mjs OK");
