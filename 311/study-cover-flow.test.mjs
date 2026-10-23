/** 节点自测：过一遍→错题 队列不丢序、提交后不移题 */
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
});
const order = built1.shuffleOrder.slice();

// 模拟「下一题」：再多做一道，队列复用顺序
state.attempted.add("q2");
const filtered2 = bank.filter(q => !Q.shouldExcludeQuestion({
  phase: "unanswered",
  attempted: id => state.attempted.has(id),
  wrong: id => state.wrong.has(id),
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
});
assert.deepEqual(built2.shuffleOrder, order);
assert.equal(built2.questions[0].id, order.find(id => !state.attempted.has(id)));
console.log("study-cover-flow.test.mjs OK");
