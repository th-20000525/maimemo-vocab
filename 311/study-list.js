/** 311 / 政治刷题共用：随机队列、过一遍→错题→复习轮（错题反复出现） */
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
      if (phase === "review") return shuffle(list);
      return shuffle(list.filter(q => !isAttempted(q.id)));
    }
    return list;
  }

  /**
   * random-cover 三阶段：
   * unanswered — 仅未答；wrong — 仅错题本；review — 全科随机第二轮起，错题会重新入队。
   */
  function resolveCoverPhase({ mode, manualWrong, manualPending, pendingCount, wrongCount, savedPhase }) {
    if (mode !== "random-cover") return null;
    if (manualPending) return "unanswered";
    if (manualWrong) return "wrong";
    if (pendingCount > 0) return "unanswered";
    if (wrongCount > 0) return "wrong";
    if (savedPhase === "review") return "review";
    return "review";
  }

  function shouldExcludeQuestion({ phase, attempted, wrong, q }) {
    if (phase === "unanswered") return attempted(q.id);
    if (phase === "wrong") return !wrong(q.id);
    return false;
  }

  /** 复习轮答错：几题后再出现同一题（已在后面排队则不再插入） */
  function scheduleRepeat(state, questionId, listIndex, gap = 4) {
    const order = [...(state.shuffleOrder || [])];
    if (!order.length) return;
    const head = order.slice(0, listIndex + 1);
    const tail = order.slice(listIndex + 1);
    if (tail.includes(questionId)) return;
    const insertAt = Math.min(gap, tail.length);
    const newTail = [...tail.slice(0, insertAt), questionId, ...tail.slice(insertAt)];
    state.shuffleOrder = [...head, ...newTail];
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
  }

  function clearQueue(state) {
    state.shuffleKey = "";
    state.shuffleOrder = [];
    state.listIndex = 0;
  }

  window.StudyListQueue = {
    applyShuffleOrder,
    shuffleQuestions,
    resolveCoverPhase,
    shouldExcludeQuestion,
    scheduleRepeat,
    restoreListIndex,
    buildFromFiltered,
    queuePayloadSlice,
    applyQueuePayload,
    clearQueue,
  };
})();
