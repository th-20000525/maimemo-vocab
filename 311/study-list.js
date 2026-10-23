/** 311 / 政治刷题共用：随机队列顺序、刷新/换机恢复 */
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

  function shuffleQuestions(list, mode, isAttempted, shuffle) {
    if (mode === "random") return shuffle(list);
    if (mode === "random-cover") {
      const pending = list.filter(q => !isAttempted(q.id));
      return shuffle(pending);
    }
    return list;
  }

  function restoreListIndex(questions, state, mode) {
    let idx = questions.findIndex(q => q.id === state.lastQuestionId);
    if (idx < 0 && Number.isFinite(state.listIndex)) idx = state.listIndex;
    if (idx < 0 || idx >= questions.length) idx = 0;
    const current = questions[idx];
    if ((mode === "random-cover" || mode === "random") && current && state.attempted.has(current.id)) {
      const firstPending = questions.findIndex(q => !state.attempted.has(q.id));
      if (firstPending >= 0) idx = firstPending;
    }
    return idx;
  }

  function buildFromFiltered({ filtered, mode, reset, listKey, state, shuffle }) {
    const isRandom = mode === "random" || mode === "random-cover";
    const isAttempted = id => state.attempted.has(id);
    let questions;
    let shuffleKey = state.shuffleKey || "";
    let shuffleOrder = state.shuffleOrder || [];
    const canReuse = isRandom && !reset && shuffleKey === listKey && shuffleOrder.length;
    if (canReuse) {
      questions = applyShuffleOrder(filtered, shuffleOrder);
    } else {
      questions = shuffleQuestions(filtered, mode, isAttempted, shuffle);
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

  function queuePayloadSlice(state, listIndex) {
    return {
      shuffleKey: state.shuffleKey || "",
      shuffleOrder: state.shuffleOrder || [],
      listIndex: Number.isFinite(listIndex) ? listIndex : (state.listIndex || 0),
    };
  }

  function applyQueuePayload(state, data) {
    if (typeof data.shuffleKey === "string") state.shuffleKey = data.shuffleKey;
    if (Array.isArray(data.shuffleOrder)) state.shuffleOrder = data.shuffleOrder;
    if (Number.isFinite(data.listIndex)) state.listIndex = data.listIndex;
  }

  function clearQueue(state) {
    state.shuffleKey = "";
    state.shuffleOrder = [];
    state.listIndex = 0;
  }

  window.StudyListQueue = {
    applyShuffleOrder,
    shuffleQuestions,
    restoreListIndex,
    buildFromFiltered,
    queuePayloadSlice,
    applyQueuePayload,
    clearQueue,
  };
})();
