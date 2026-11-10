/** 311 / 政治刷题共用：随机队列、过一遍→错题→复习轮；311 错题可配置固定题池+手动删除 */
(() => {
  function applyShuffleOrder(filtered, orderedIds) {
    const map = new Map(filtered.map(q => [q.id, q]));
    const used = new Set();
    const out = [];
    for (const id of orderedIds || []) {
      if (!map.has(id) || used.has(id)) continue;
      out.push(map.get(id));
      used.add(id);
    }
    for (const q of filtered) {
      if (!used.has(q.id)) out.push(q);
    }
    return out;
  }

  function shuffleQuestions(list, mode, isAttempted, shuffle, phase) {
    if (mode === "random") return shuffle(list);
    if (mode === "random-cover") {
      if (phase === "unanswered") return shuffle(list.filter(q => !isAttempted(q.id)));
      return shuffle(list);
    }
    return list;
  }

  /**
   * random-cover：unanswered → review（第一轮结束后直接进复习池；侧边栏「只练错题」仍走 wrong）。
   */
  function resolveCoverPhase({ mode, manualWrong, manualPending, pendingCount, savedPhase }) {
    if (mode !== "random-cover") return null;
    if (manualPending) return "unanswered";
    if (manualWrong) return "wrong";
    if (pendingCount > 0) return "unanswered";
    if (savedPhase === "review" || savedPhase === "wrong") return "review";
    return "review";
  }

  function shouldExcludeQuestion({ phase, attempted, wrong, mastered, q }) {
    if (phase === "unanswered") return attempted(q.id);
    if (phase === "wrong") return !wrong(q.id);
    if (phase === "review") return mastered(q.id);
    return false;
  }

  function pickRandomFromPool(pool, random = Math.random) {
    if (!pool.length) return null;
    return pool[Math.floor(random() * pool.length)];
  }

  function restoreListIndex(questions, state, mode) {
    let idx = questions.findIndex(q => q.id === state.lastQuestionId);
    if (idx < 0 && Number.isFinite(state.listIndex)) idx = state.listIndex;
    if (idx < 0 || idx >= questions.length) idx = 0;
    const current = questions[idx];
    const inReview = mode === "random-cover" && state.coverPhase === "review";
    if (!inReview && (mode === "random-cover" || mode === "random") && current && state.attempted.has(current.id)) {
      const firstPending = questions.findIndex(q => !state.attempted.has(q.id));
      if (firstPending >= 0) idx = firstPending;
    }
    return idx;
  }

  function buildFromFiltered({ filtered, mode, reset, listKey, state, shuffle, phase }) {
    const isRandom = mode === "random" || mode === "random-cover";
    const isAttempted = id => state.attempted.has(id);
    let questions;
    let shuffleKey = state.shuffleKey || "";
    let shuffleOrder = state.shuffleOrder || [];
    const canReuse = isRandom && !reset && shuffleKey === listKey && shuffleOrder.length;
    if (canReuse) {
      questions = applyShuffleOrder(filtered, shuffleOrder);
    } else {
      questions = shuffleQuestions(filtered, mode, isAttempted, shuffle, phase);
      if (isRandom) {
        shuffleKey = listKey;
        shuffleOrder = questions.map(q => q.id);
      } else {
        shuffleKey = "";
        shuffleOrder = [];
      }
    }
    return { questions, shuffleKey, shuffleOrder };
  }

  function queuePayloadSlice(state, listIndex, extra = {}) {
    return {
      shuffleKey: state.shuffleKey || "",
      shuffleOrder: state.shuffleOrder || [],
      listIndex: Number.isFinite(listIndex) ? listIndex : (state.listIndex || 0),
      coverPhase: state.coverPhase || "unanswered",
      reviewMastered: [...(state.reviewMastered || [])],
      wrongCounts: { ...(state.wrongCounts || {}) },
      ...extra,
    };
  }

  function applyQueuePayload(state, data) {
    if (typeof data.shuffleKey === "string") state.shuffleKey = data.shuffleKey;
    if (Array.isArray(data.shuffleOrder)) state.shuffleOrder = data.shuffleOrder;
    if (Number.isFinite(data.listIndex)) state.listIndex = data.listIndex;
    if (data.coverPhase === "wrong" || data.coverPhase === "unanswered" || data.coverPhase === "review") {
      state.coverPhase = data.coverPhase;
    }
    if (Array.isArray(data.reviewMastered)) state.reviewMastered = new Set(data.reviewMastered);
    if (data.wrongCounts && typeof data.wrongCounts === "object") state.wrongCounts = { ...data.wrongCounts };
  }

  function clearQueue(state) {
    state.shuffleKey = "";
    state.shuffleOrder = [];
    state.listIndex = 0;
  }

  function uniqueIds(ids) {
    const out = [];
    const seen = new Set();
    if (!Array.isArray(ids)) return out;
    for (const id of ids) {
      if (typeof id !== "string" || !id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }

  /** 311 按轮复习：一轮做完才进入下一轮，下一轮只含上一轮答错的题。 */
  function normalizeRoundRecord(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const round = Number.isFinite(raw.round) && raw.round >= 1 ? Math.floor(raw.round) : 1;
    return {
      round,
      set: uniqueIds(raw.set),
      answered: uniqueIds(raw.answered),
      wrong: uniqueIds(raw.wrong),
      done: raw.done === true,
      shuffled: raw.shuffled === true,
    };
  }

  function sanitizeRounds(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof key !== "string" || !key) continue;
      const rec = normalizeRoundRecord(value);
      if (rec) out[key] = rec;
    }
    return out;
  }

  /**
   * 没有存过轮次时：还有未答题就停在第 1 轮；第 1 轮已全部作答则进入第 2 轮。
   * 默认：第 2 轮只用错题本（答对剔除）。keepSet 时：下一轮仍用当前整池，不因答对缩小。
   */
  function createInitialRound({ scopeIds, attempted, wrong, correct, keepSet }) {
    const ids = uniqueIds(scopeIds);
    if (!ids.length) return { round: 1, set: [], answered: [], wrong: [], done: false };
    const attemptedSet = new Set(attempted || []);
    const wrongSet = new Set(wrong || []);
    const correctSet = new Set(correct || []);
    const pending = ids.filter(id => !attemptedSet.has(id));
    if (pending.length) {
      return {
        round: 1,
        set: ids,
        answered: ids.filter(id => attemptedSet.has(id)),
        wrong: ids.filter(id => attemptedSet.has(id) && wrongSet.has(id) && !correctSet.has(id)),
        done: false,
      };
    }
    if (keepSet) {
      return { round: 2, set: ids, answered: [], wrong: [], done: false };
    }
    const misses = ids.filter(id => wrongSet.has(id) && !correctSet.has(id));
    if (!misses.length) return { round: 2, set: [], answered: [], wrong: [], done: true };
    return { round: 2, set: misses, answered: [], wrong: [], done: false };
  }

  function roundRemainingIds(record, knownIds) {
    const answered = new Set(record?.answered || []);
    const known = knownIds ? new Set(knownIds) : null;
    return (record?.set || []).filter(id => !answered.has(id) && (!known || known.has(id)));
  }

  function recordRoundAnswer(record, id, isCorrect) {
    const current = normalizeRoundRecord(record) || { round: 1, set: [], answered: [], wrong: [], done: false };
    const answered = uniqueIds([...current.answered, id]);
    const wrong = new Set(current.wrong);
    if (isCorrect) wrong.delete(id);
    else if (typeof id === "string" && id) wrong.add(id);
    return { round: current.round, set: current.set, answered, wrong: [...wrong], done: false, shuffled: current.shuffled === true };
  }

  function advanceRound(record, shuffle, options = {}) {
    const keepSet = options && options.keepSet === true;
    const current = normalizeRoundRecord(record) || { round: 1, set: [], answered: [], wrong: [], done: false };
    if (current.done) return current;
    const nextIds = keepSet ? uniqueIds(current.set) : uniqueIds(current.wrong);
    if (!nextIds.length) return { round: current.round, set: [], answered: [], wrong: [], done: true, shuffled: current.shuffled === true };
    const order = typeof shuffle === "function" ? uniqueIds(shuffle(nextIds.slice())) : nextIds;
    return { round: current.round + 1, set: order, answered: [], wrong: [], done: false, shuffled: typeof shuffle === "function" };
  }

  window.StudyListQueue = {
    applyShuffleOrder,
    shuffleQuestions,
    resolveCoverPhase,
    shouldExcludeQuestion,
    pickRandomFromPool,
    restoreListIndex,
    buildFromFiltered,
    queuePayloadSlice,
    applyQueuePayload,
    clearQueue,
    normalizeRoundRecord,
    sanitizeRounds,
    createInitialRound,
    roundRemainingIds,
    recordRoundAnswer,
    advanceRound,
  };
})();
