(() => {
  // 兼容误写成 push([..]) 的批次脚本：把嵌套数组摊平，避免 166 题变成 2 个无效元素
  const bank = (window.QUESTION_BANK || []).flatMap(q => (Array.isArray(q) ? q : [q])).filter(q => q && typeof q === "object" && q.id);
  const QUESTION_BANK_REVISION = "politics-docx-batches-20261122";
  const importedDocSourceDocs = new Set([
    "政治错题解析（通俗版）",
    "考研政治错题解析（通俗区分版·第二批75题）",
  ]);
  const importedDocIds = new Set(bank.filter(q => (
    importedDocSourceDocs.has(q.sourceDocument)
    || /^politics-docx-batch[12]-/.test(String(q.id || ""))
  )).map(q => q.id));
  if (!window.StudyListQueue) {
    const showBootError = () => {
      const host = document.getElementById("question-view");
      if (host) {
        host.innerHTML = "<div class=\"empty-state\"><h2>刷题脚本加载失败</h2><p>请 Ctrl+F5 强刷本页。若仍空白，请检查网络后重试。</p></div>";
      }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showBootError);
    else showBootError();
    return;
  }
  const appConfig = window.STUDY_APP_CONFIG || {};
  const storageKey = appConfig.storageKey || "311-study-progress-v1";
  const appId = appConfig.appId || "311-study";
  const syncNamespace = appConfig.syncNamespace || "311:";
  const SB_URL = "https://drtkvfcjbwvqpgolkwur.supabase.co";
  const SB_KEY = "sb_publishable_GFoECb3NXu0jHUUP3krFjQ_JgLLeUxH";
  const letters = ["A", "B", "C", "D"];
  const categoryOrder = appConfig.categoryOrder || [];
  const subjectOrder = appConfig.subjectOrder || [];
  const singlePool = appConfig.singlePool === true;
  const keepRoundPool = appConfig.keepRoundPool === true;
  // 从第 N 轮起：答对后点「下一题」自动剔除。0=关闭（仅「我会了」删除）
  const autoRemoveCorrectFromRound = Math.max(0, Number(appConfig.autoRemoveCorrectFromRound) || 0);
  const orderRound = appConfig.orderRound === true;
  const lockPoolFromProgress = appConfig.lockPoolFromProgress === true;
  const shuffleOptions = appConfig.shuffleOptions === true;
  const categories = [...new Set(bank.map(q => q.category))].sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    if (aIndex >= 0 || bIndex >= 0) return (aIndex < 0 ? Infinity : aIndex) - (bIndex < 0 ? Infinity : bIndex);
    return a.localeCompare(b, "zh-CN");
  });
  const defaultSyncCode = "1234";

  function resolveMode(value) {
    if (appConfig.roundOnly) return orderRound ? "order" : "random-cover";
    return ["random", "random-cover", "order"].includes(value) ? value : (appConfig.defaultMode || "order");
  }

  function isValidCategory(value) {
    if (!value || value === "全部题目") return true;
    if (value.startsWith("subject:")) return subjectOrder.includes(value.slice(8));
    return categories.includes(value);
  }

  const state = loadState();
  let currentCategory = singlePool ? "全部题目" : (isValidCategory(state.lastCategory) ? state.lastCategory : "全部题目");
  let wrongOnly = false;
  let pendingOnly = false;
  let query = "";
  let mode = state.mode;
  let questions = [];
  let currentIndex = 0;
  let restorePosition = true;
  let toastTimer;
  let autoUploadTimer;

  const $ = id => document.getElementById(id);
  const categorySelect = $("category-select");
  const modeSelect = $("mode-select");
  const searchInput = $("search-input");

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return {
        attempted: new Set(saved.attempted || []),
        correct: new Set(saved.correct || []),
        wrong: new Set(saved.wrong || []),
        choices: saved.choices || {},
        submitted: new Set(saved.submitted || []),
        lastCategory: saved.lastCategory || "全部题目",
        lastQuestionId: saved.lastQuestionId || "",
        mode: resolveMode(saved.mode),
        shuffleKey: saved.shuffleKey || "",
        shuffleOrder: Array.isArray(saved.shuffleOrder) ? saved.shuffleOrder : [],
        listIndex: Number.isFinite(saved.listIndex) ? saved.listIndex : 0,
        coverPhase: saved.coverPhase === "wrong" ? "wrong" : saved.coverPhase === "review" ? "review" : "unanswered",
        reviewMastered: new Set(saved.reviewMastered || []),
        removed: new Set(saved.removed || []),
        wrongCounts: saved.wrongCounts && typeof saved.wrongCounts === "object" ? saved.wrongCounts : {},
        roundsByScope: saved.roundsByScope && typeof saved.roundsByScope === "object" ? saved.roundsByScope : {},
        poolLocked: saved.poolLocked === true,
        questionBankRevision: saved.questionBankRevision || "",
        optionOrders: saved.optionOrders && typeof saved.optionOrders === "object" && !Array.isArray(saved.optionOrders)
          ? saved.optionOrders
          : {},
        syncCode: (typeof saved.syncCode === "string" && saved.syncCode.trim().length >= 4)
          ? saved.syncCode.trim()
          : defaultSyncCode
      };
    } catch {
      return { attempted: new Set(), correct: new Set(), wrong: new Set(), choices: {}, submitted: new Set(), lastCategory: "全部题目", lastQuestionId: "", mode: resolveMode(appConfig.defaultMode), shuffleKey: "", shuffleOrder: [], listIndex: 0, coverPhase: "unanswered", reviewMastered: new Set(), removed: new Set(), wrongCounts: {}, roundsByScope: {}, poolLocked: false, questionBankRevision: "", optionOrders: {}, syncCode: defaultSyncCode };
    }
  }

  function saveState() {
    const current = questions[currentIndex];
    state.lastCategory = currentCategory;
    state.mode = mode;
    if (current) state.lastQuestionId = current.id;
    localStorage.setItem(storageKey, JSON.stringify({
      attempted: [...state.attempted], correct: [...state.correct], wrong: [...state.wrong],
      choices: state.choices, submitted: [...state.submitted], lastCategory: state.lastCategory,
      lastQuestionId: state.lastQuestionId, mode: state.mode,
      shuffleKey: state.shuffleKey || "", shuffleOrder: state.shuffleOrder || [], listIndex: currentIndex,
      coverPhase: state.coverPhase || "unanswered",
      reviewMastered: [...state.reviewMastered],
      removed: [...state.removed],
      wrongCounts: state.wrongCounts,
      roundsByScope: state.roundsByScope || {},
      poolLocked: state.poolLocked === true,
      questionBankRevision: state.questionBankRevision || "",
      optionOrders: state.optionOrders || {},
      syncCode: $("sync-code") ? $("sync-code").value.trim() : state.syncCode
    }));
    updateStats();
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function updateStats() {
    const rec = isRoundCover() ? state.roundsByScope[scopeKey()] : null;
    if (rec && !rec.done) {
      const answered = rec.answered || [];
      const correctInRound = answered.filter(id => state.correct.has(id)).length;
      setText("stat-done", answered.length);
      setText("stat-accuracy", answered.length ? `${Math.round(correctInRound / answered.length * 100)}%` : "—");
    } else {
      setText("stat-done", state.attempted.size);
      setText("stat-accuracy", state.attempted.size ? `${Math.round(state.correct.size / state.attempted.size * 100)}%` : "—");
    }
    const currentScope = bank.filter(matchesCategory);
    const poolLeft = keepRoundPool ? currentScope.length : state.wrong.size;
    setText("stat-wrong", poolLeft);
    setText("wrong-count", state.wrong.size);
    setText("bank-total", keepRoundPool ? String(currentScope.length) : String(bank.length));
    $("wrong-filter")?.classList.toggle("active", wrongOnly);
    $("pending-filter")?.classList.toggle("active", pendingOnly);
    setText("pending-count", currentScope.filter(q => !state.attempted.has(q.id)).length);
    const restartBtn = $("restart-pool");
    if (restartBtn) {
      if (keepRoundPool) {
        restartBtn.hidden = false;
        restartBtn.disabled = currentScope.length === 0;
        restartBtn.textContent = currentScope.length ? `重刷这 ${currentScope.length}` : "重刷本池";
      } else {
        restartBtn.hidden = true;
      }
    }
  }

  function isRemoved(id) {
    return keepRoundPool && state.removed.has(id);
  }

  function activeBank() {
    return keepRoundPool ? bank.filter(q => !state.removed.has(q.id)) : bank;
  }

  function matchesCategory(q) {
    if (isRemoved(q.id)) return false;
    if (singlePool || currentCategory === "全部题目") return true;
    if (currentCategory.startsWith("subject:")) return q.subjectLabel === currentCategory.slice(8);
    return q.category === currentCategory;
  }

  function populateCategories() {
    if (!categorySelect) return;
    const pool = keepRoundPool ? activeBank() : bank;
    if (singlePool) {
      categorySelect.innerHTML = `<option value="全部题目">全部题目 · ${pool.length}</option>`;
      categorySelect.hidden = true;
      const field = document.querySelector('label[for="category-select"]');
      if (field) field.hidden = true;
      return;
    }
    const prev = categorySelect.value || currentCategory;
    const counts = Object.fromEntries(categories.map(c => [c, pool.filter(q => q.category === c).length]));
    const allLabel = subjectOrder.length ? "五科全部" : "全部题目";
    let html = `<option value="全部题目">${escapeHtml(allLabel)} · ${pool.length}</option>`;
    if (subjectOrder.length) {
      html += `<optgroup label="按模块">`;
      html += subjectOrder.map(s => {
        const n = pool.filter(q => q.subjectLabel === s).length;
        return `<option value="subject:${escapeHtml(s)}">${escapeHtml(s)} · ${n}</option>`;
      }).join("");
      html += `</optgroup>`;
      for (const subject of subjectOrder) {
        const subjectCats = categories.filter(c => bank.some(q => q.subjectLabel === subject && q.category === c));
        if (!subjectCats.length) continue;
        html += `<optgroup label="${escapeHtml(subject)} · 知识点">`;
        html += subjectCats.map(c => {
          const short = c.startsWith(`${subject}·`) ? c.slice(subject.length + 1) : c;
          return `<option value="${escapeHtml(c)}">${escapeHtml(short)} · ${counts[c] || 0}</option>`;
        }).join("");
        html += `</optgroup>`;
      }
    } else {
      html += categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)} · ${counts[c] || 0}</option>`).join("");
    }
    categorySelect.innerHTML = html;
    if (isValidCategory(prev)) categorySelect.value = prev;
  }

  const Q = window.StudyListQueue;
  state.roundsByScope = Q.sanitizeRounds(state.roundsByScope);

  function listScopeKey(needle) {
    const phaseKey = mode === "random-cover" ? state.coverPhase : "";
    const masteredKey = phaseKey === "review" ? state.reviewMastered.size : 0;
    return [currentCategory, mode, phaseKey, masteredKey, wrongOnly, pendingOnly, needle].join("\u0001");
  }

  function getCoverPhase(needle) {
    if (mode !== "random-cover") return null;
    return Q.resolveCoverPhase({
      mode,
      manualWrong: wrongOnly,
      manualPending: pendingOnly,
      pendingCount: pendingCountInScope(needle),
      wrongCount: wrongCountInScope(needle),
      savedPhase: state.coverPhase,
    });
  }

  function matchesScopeBase(q, needle) {
    if (!matchesCategory(q)) return false;
    if (needle && !`${q.stem} ${Object.values(q.options).join(" ")}`.toLowerCase().includes(needle)) return false;
    return true;
  }

  function pendingCountInScope(needle) {
    return bank.filter(q => matchesScopeBase(q, needle) && !state.attempted.has(q.id)).length;
  }

  function wrongCountInScope(needle) {
    return bank.filter(q => matchesScopeBase(q, needle) && state.wrong.has(q.id)).length;
  }

  function isValidOptionOrder(order) {
    return Array.isArray(order)
      && order.length === letters.length
      && letters.every(letter => order.includes(letter));
  }

  /** Display slot A–D → original bank letter. Persists for one attempt so mid-answer refresh stays stable. */
  function ensureOptionOrder(q) {
    if (!shuffleOptions || !q) return letters.slice();
    const saved = state.optionOrders[q.id];
    if (isValidOptionOrder(saved)) return saved.slice();
    if (state.submitted.has(q.id)) return letters.slice();
    const order = shuffle(letters.slice());
    state.optionOrders[q.id] = order;
    return order.slice();
  }

  function clearOptionOrder(id) {
    if (!id) return;
    delete state.optionOrders[id];
  }

  function displayLetterForOriginal(order, originalLetter) {
    const idx = order.indexOf(originalLetter);
    return idx >= 0 ? letters[idx] : originalLetter;
  }

  function originalLetterForDisplay(order, displayLetter) {
    const idx = letters.indexOf(displayLetter);
    return idx >= 0 ? (order[idx] || displayLetter) : displayLetter;
  }

  function selectedDisplayLetters(q, order) {
    return String(state.choices[q.id] || "")
      .split("")
      .filter(Boolean)
      .map(original => displayLetterForOriginal(order, original))
      .sort()
      .join("");
  }

  function clearAttemptUiForScope(needle) {
    bank.forEach(q => {
      if (!matchesScopeBase(q, needle)) return;
      state.submitted.delete(q.id);
      delete state.choices[q.id];
      clearOptionOrder(q.id);
    });
  }

  function reviewPoolInScope(needle) {
    return bank.filter(q => matchesScopeBase(q, needle) && !state.reviewMastered.has(q.id));
  }

  function reviewScopeTotal(needle) {
    return bank.filter(q => matchesScopeBase(q, needle)).length;
  }

  function syncReviewPool(needle) {
    bank.forEach(q => {
      if (!matchesScopeBase(q, needle)) return;
      if (state.wrong.has(q.id) || !state.correct.has(q.id)) state.reviewMastered.delete(q.id);
      else state.reviewMastered.add(q.id);
    });
  }

  function scopeKey() {
    return singlePool ? "全部题目" : currentCategory;
  }

  function isRoundCover() {
    if (appConfig.roundOnly) return mode === "random-cover" || mode === "order";
    return mode === "random-cover" && !wrongOnly && !pendingOnly;
  }

  function isOrderRound() {
    return orderRound || mode === "order";
  }

  function scopeQuestionIds() {
    return bank.filter(q => matchesScopeBase(q, "")).map(q => q.id);
  }

  function sortIdsByNumber(ids) {
    const byId = new Map(bank.map(q => [q.id, q]));
    return uniqueRoundIds(ids).slice().sort((a, b) => {
      const qa = byId.get(a);
      const qb = byId.get(b);
      const na = qa && Number.isFinite(qa.number) ? qa.number : Number.POSITIVE_INFINITY;
      const nb = qb && Number.isFinite(qb.number) ? qb.number : Number.POSITIVE_INFINITY;
      if (na !== nb) return na - nb;
      return String(a).localeCompare(String(b));
    });
  }

  function roundOrderIds(ids) {
    return isOrderRound() ? sortIdsByNumber(ids) : shuffle(ids);
  }

  function clearRoundAnswers(ids) {
    ids.forEach(id => {
      state.submitted.delete(id);
      delete state.choices[id];
      clearOptionOrder(id);
    });
  }

  /**
   * 政治错题切到「固定题池、答对不剔除」时：用当前轮 set（并入错题本）锁定题池，
   * 其余原库题目标为已删除；然后从第 1 轮随机重开。
   */
  function lockKeepPoolFromProgress() {
    // 仅政治错题（缩圈后锁定）开启；311 错题本身就是整库固定池，禁止误锁缩小
    if (!keepRoundPool || !lockPoolFromProgress || state.poolLocked) return;
    const bankIds = bank.map(q => q.id);
    const bankSet = new Set(bankIds);
    const key = scopeKey();
    const rec = state.roundsByScope[key];
    const fromRound = uniqueRoundIds((rec?.set || []).filter(id => bankSet.has(id)));
    const fromWrong = uniqueRoundIds([...state.wrong].filter(id => bankSet.has(id)));
    let keepIds = uniqueRoundIds([...fromRound, ...fromWrong]);
    if (!keepIds.length) {
      // 没有可锁定的缩圈结果时，整库作为固定池
      keepIds = bankIds.slice();
    }
    const keepSet = new Set(keepIds);
    const currentActive = bankIds.filter(id => !state.removed.has(id));
    const samePool = keepIds.length === currentActive.length
      && keepIds.every(id => !state.removed.has(id));
    bankIds.forEach(id => {
      if (!keepSet.has(id)) state.removed.add(id);
      else state.removed.delete(id);
    });
    // 题池组成未变（例如同步把 poolLocked 拉成 false）：只补锁标记，绝不清进度
    if (samePool) {
      state.poolLocked = true;
      return;
    }
    const ordered = roundOrderIds(keepIds);
    clearRoundAnswers(ordered);
    state.roundsByScope[key] = {
      round: 1,
      set: ordered,
      answered: [],
      wrong: [],
      done: false,
      shuffled: true,
    };
    state.coverPhase = "unanswered";
    state.poolLocked = true;
    restorePosition = false;
    state.lastQuestionId = "";
    showToast(`已锁定题池 ${ordered.length} 题：答对不剔除，按轮随机刷`);
  }

  /** 刷新后回到上次那题：未答则停原题；已答则仍停在该题（可看解析），再点下一题才继续。 */
  function resolveRoundResumeId(rec, lastId, remainingIds) {
    if (!lastId || typeof lastId !== "string") return remainingIds[0] || "";
    const remaining = new Set(remainingIds || []);
    if (remaining.has(lastId)) return lastId;
    const set = rec?.set || [];
    if (set.includes(lastId)) return lastId;
    return remainingIds[0] || "";
  }

  function questionMatchesScopeKey(q, key) {
    if (!q) return false;
    if (!key || key === "全部题目") return true;
    if (key.startsWith("subject:")) return q.subjectLabel === key.slice(8);
    return q.category === key;
  }

  /**
   * 把 docx 批次题并入当前锁定活跃池：首次吸收时从 removed 剔除；其后只把「未删除」的批次补进各轮 set。
   * revision 已对齐后尊重用户对批次题的「我会了」删除。
   * @returns {boolean} 是否改动了进度（调用方据此决定是否回写云端）
   */
  function migrateDocQuestionsIntoActiveRound() {
    if (!importedDocIds.size) {
      if (state.questionBankRevision !== QUESTION_BANK_REVISION) {
        state.questionBankRevision = QUESTION_BANK_REVISION;
        return true;
      }
      return false;
    }
    let changed = false;
    const firstAbsorb = state.questionBankRevision !== QUESTION_BANK_REVISION;
    if (firstAbsorb) {
      importedDocIds.forEach(id => {
        if (state.removed.has(id)) {
          state.removed.delete(id);
          changed = true;
        }
      });
    }
    const byId = new Map(bank.map(q => [q.id, q]));
    for (const [key, raw] of Object.entries(state.roundsByScope || {})) {
      const rec = Q.normalizeRoundRecord(raw);
      if (!rec || rec.done) continue;
      const additions = [...importedDocIds].filter(id => {
        if (state.removed.has(id)) return false;
        const q = byId.get(id);
        return q && questionMatchesScopeKey(q, key) && !(rec.set || []).includes(id);
      });
      if (!additions.length) continue;
      state.roundsByScope[key] = { ...rec, set: uniqueRoundIds([...(rec.set || []), ...additions]) };
      changed = true;
    }
    if (firstAbsorb) {
      state.questionBankRevision = QUESTION_BANK_REVISION;
      changed = true;
    }
    return changed;
  }

  function buildRoundSession(focusQuestionId) {
    lockKeepPoolFromProgress();
    const needle = query.trim().toLowerCase();
    const key = scopeKey();
    let rec = state.roundsByScope[key];
    let enteredRound = 0;
    if (!rec) {
      rec = Q.createInitialRound({
        scopeIds: roundOrderIds(scopeQuestionIds()),
        attempted: [...state.attempted],
        wrong: [...state.wrong],
        correct: [...state.correct],
        keepSet: keepRoundPool,
      });
      if (!rec.done) rec = { ...rec, set: roundOrderIds(rec.set), shuffled: true };
      else rec = { ...rec, shuffled: true };
      if (!rec.done && rec.round > 1) {
        clearRoundAnswers(rec.set);
        enteredRound = rec.round;
      }
      state.roundsByScope[key] = rec;
    } else if (!rec.done && !rec.shuffled) {
      rec = { ...rec, set: roundOrderIds(rec.set), shuffled: true };
      state.roundsByScope[key] = rec;
      restorePosition = false;
    }
    const known = new Set(scopeQuestionIds());
    if (rec && !rec.done) {
      let pruned = uniqueRoundIds((rec.set || []).filter(id => known.has(id)));
      // 固定题池：题库/未删除题若比当前 set 多，补进本轮，避免只刷到一部分
      if (keepRoundPool) {
        const missing = scopeQuestionIds().filter(id => !pruned.includes(id));
        if (missing.length) pruned = uniqueRoundIds([...pruned, ...missing]);
      }
      if (isOrderRound()) pruned = sortIdsByNumber(pruned);
      // 回填 answered：只用本轮 submitted（换轮时 clearRoundAnswers 会清掉），绝不用 attempted 跨轮回填。
      // 固定题池：仅把「已在 answered，或本轮已有选项的 submitted」算已答，避免云端旧轮 submitted 把整轮标完。
      let answered = uniqueRoundIds((rec.answered || []).filter(id => known.has(id)));
      let wrong = uniqueRoundIds((rec.wrong || []).filter(id => known.has(id) && answered.includes(id)));
      if (keepRoundPool) {
        const answeredSet = new Set(answered);
        const fromSubmitted = pruned.filter(id => (
          state.submitted.has(id) && (answeredSet.has(id) || !!state.choices[id])
        ));
        answered = uniqueRoundIds([...answered, ...fromSubmitted]);
        wrong = uniqueRoundIds([...wrong, ...answered.filter(id => state.wrong.has(id) && !state.correct.has(id))]);
      } else if (rec.round <= 1) {
        const answeredFromRecords = pruned.filter(id => state.submitted.has(id) || !!state.choices[id]);
        answered = uniqueRoundIds([...answered, ...answeredFromRecords]);
        wrong = uniqueRoundIds([...wrong, ...answered.filter(id => state.wrong.has(id) && !state.correct.has(id))]);
      }
      const setChanged = pruned.join("\0") !== (rec.set || []).join("\0");
      const ansChanged = answered.join("\0") !== (rec.answered || []).join("\0");
      const wrongChanged = wrong.join("\0") !== (rec.wrong || []).join("\0");
      if (setChanged || ansChanged || wrongChanged || pruned.length === 0 && !rec.done) {
        rec = {
          ...rec,
          set: pruned,
          answered,
          wrong,
          done: pruned.length === 0,
          shuffled: true,
        };
        state.roundsByScope[key] = rec;
      }
    }
    if (!rec.done && rec.set.length > 0 && Q.roundRemainingIds(rec, known).length === 0) {
      const next = Q.advanceRound(rec, isOrderRound() ? sortIdsByNumber : shuffle, { keepSet: keepRoundPool });
      next.set = (isOrderRound() ? sortIdsByNumber(next.set) : next.set).filter(id => known.has(id));
      if (!next.done && next.set.length === 0) next.done = true;
      if (!next.done) clearRoundAnswers(next.set);
      state.roundsByScope[key] = next;
      rec = next;
      if (!rec.done) enteredRound = rec.round;
    }
    state.coverPhase = !rec.done && rec.round <= 1 ? "unanswered" : "review";
    const byId = new Map(bank.map(q => [q.id, q]));
    const remaining = rec.done ? [] : Q.roundRemainingIds(rec, known);
    const matchesRoundQuestion = q => {
      if (!q || !matchesScopeBase(q, needle)) return false;
      if (!keepRoundPool && wrongOnly && !state.wrong.has(q.id)) return false;
      return true;
    };
    // 固定题池：队列用本轮完整 set，可上一题回看已答解析；缩圈模式仍只排未答题。
    const queueIds = keepRoundPool
      ? (rec.done ? [] : (rec.set || []).filter(id => known.has(id)))
      : remaining;
    questions = queueIds.map(id => byId.get(id)).filter(matchesRoundQuestion);
    const resumeId = (!focusQuestionId && !enteredRound && restorePosition)
      ? resolveRoundResumeId(rec, state.lastQuestionId, keepRoundPool ? queueIds : remaining)
      : "";
    // 非固定池：刷新时若停在已答那题，临时插回队列以便看解析
    if (!keepRoundPool && resumeId && !questions.some(q => q.id === resumeId)) {
      const resumeQ = byId.get(resumeId);
      if (matchesRoundQuestion(resumeQ)) {
        const set = rec.set || [];
        const resumeAt = set.indexOf(resumeId);
        let insertAt = questions.findIndex(q => set.indexOf(q.id) > resumeAt);
        if (insertAt < 0) insertAt = questions.length;
        questions = [...questions.slice(0, insertAt), resumeQ, ...questions.slice(insertAt)];
        if ((rec.answered || []).includes(resumeId)) state.submitted.add(resumeId);
      }
    } else if (keepRoundPool && resumeId && (rec.answered || []).includes(resumeId)) {
      state.submitted.add(resumeId);
    }
    if (focusQuestionId) {
      const idx = questions.findIndex(q => q.id === focusQuestionId);
      currentIndex = idx >= 0 ? idx : 0;
    } else if (enteredRound) {
      currentIndex = 0;
      restorePosition = false;
    } else if (restorePosition) {
      const target = resumeId || state.lastQuestionId;
      const idx = questions.findIndex(q => q.id === target);
      // 固定题池：若上次题已删/不在，落到第一道未答题，而不是总跳到队首已答题
      if (idx >= 0) currentIndex = idx;
      else if (keepRoundPool) {
        const firstPending = questions.findIndex(q => !(rec.answered || []).includes(q.id));
        currentIndex = firstPending >= 0 ? firstPending : 0;
      } else currentIndex = 0;
      restorePosition = false;
    } else {
      currentIndex = Math.min(currentIndex, Math.max(0, questions.length - 1));
    }
    if (enteredRound) {
      showToast(keepRoundPool
        ? (isOrderRound()
          ? `进入第 ${enteredRound} 轮：固定题池 ${rec.set.length} 题，按题号顺序`
          : `进入第 ${enteredRound} 轮：固定题池 ${rec.set.length} 题，已重新打乱`)
        : (isOrderRound()
          ? `进入第 ${enteredRound} 轮：只练上一轮答错的 ${rec.set.length} 题，按题号顺序`
          : `进入第 ${enteredRound} 轮：只练上一轮答错的 ${rec.set.length} 题`));
    }
    render();
    saveState();
  }

  function uniqueRoundIds(ids) {
    return Q.normalizeRoundRecord({ round: 1, set: ids, answered: [], wrong: [], done: false }).set;
  }

  function mergeWrongCounts(local, incoming) {
    const merged = { ...(local || {}) };
    if (!incoming || typeof incoming !== "object") return merged;
    for (const [id, value] of Object.entries(incoming)) {
      const next = Number(value);
      if (!Number.isFinite(next)) continue;
      merged[id] = Math.max(Number(merged[id]) || 0, next);
    }
    return merged;
  }

  /** 自动同步时向前合并轮次，禁止用更旧的云端进度覆盖本地已答。 */
  function mergeRoundsByScope(local, incoming, { replace = false } = {}) {
    if (replace) return { ...incoming };
    const out = { ...(local || {}) };
    for (const [key, incRaw] of Object.entries(incoming || {})) {
      const inc = Q.normalizeRoundRecord(incRaw);
      if (!inc) continue;
      const cur = Q.normalizeRoundRecord(out[key]);
      if (!cur) {
        out[key] = inc;
        continue;
      }
      const incEpoch = Number(inc.restartEpoch) || 0;
      const curEpoch = Number(cur.restartEpoch) || 0;
      // 重刷会抬高 restartEpoch 并回到第 1 轮；epoch 优先于 round，避免旧云端进度把本轮答完状态合回来
      if (incEpoch > curEpoch) {
        out[key] = { ...inc, shuffled: true };
        continue;
      }
      if (incEpoch < curEpoch) continue;
      if (inc.round > cur.round) {
        out[key] = { ...inc, shuffled: true, restartEpoch: curEpoch };
        continue;
      }
      if (inc.round < cur.round) continue;
      const answered = uniqueRoundIds([...(cur.answered || []), ...(inc.answered || [])]);
      const set = uniqueRoundIds([...(cur.set || []), ...(inc.set || [])]);
      const wrong = uniqueRoundIds([...(cur.wrong || []), ...(inc.wrong || [])].filter(id => answered.includes(id)));
      const preferIncSet = (inc.answered || []).length > (cur.answered || []).length;
      out[key] = {
        round: cur.round,
        set: preferIncSet ? uniqueRoundIds([...(inc.set || []), ...(cur.set || [])]) : set,
        answered,
        wrong,
        done: cur.done === true || inc.done === true,
        shuffled: true,
        restartEpoch: curEpoch,
      };
    }
    return out;
  }

  /**
   * 清空当前范围本轮进度并重新打乱；不改 removed（我会了·删除）与 poolLocked。
   * askConfirm：侧栏手动点「重刷」时二次确认。
   */
  function restartRoundCycle({ askConfirm = false } = {}) {
    const ids = roundOrderIds(scopeQuestionIds());
    if (!ids.length) {
      showToast("当前范围没有可刷的题");
      return;
    }
    if (askConfirm) {
      const ok = confirm(keepRoundPool
        ? `清空本轮进度，重新打乱这 ${ids.length} 题？不会删除「我会了」的题，题池仍是这 ${ids.length} 道。`
        : "要从第 1 轮重新开始吗？");
      if (!ok) return;
    }
    const prev = Q.normalizeRoundRecord(state.roundsByScope[scopeKey()]);
    const nextEpoch = (Number(prev?.restartEpoch) || 0) + 1;
    ids.forEach(id => { delete state.wrongCounts[id]; });
    clearRoundAnswers(ids);
    state.roundsByScope[scopeKey()] = {
      round: 1,
      set: ids,
      answered: [],
      wrong: [],
      done: false,
      shuffled: true,
      restartEpoch: nextEpoch,
    };
    state.coverPhase = "unanswered";
    state.lastQuestionId = "";
    restorePosition = false;
    buildRoundSession();
    queueAutoUpload();
    showToast(keepRoundPool
      ? (isOrderRound()
        ? `已重刷这 ${ids.length} 题 · 按题号顺序`
        : `已重刷这 ${ids.length} 题 · 重新打乱`)
      : (isOrderRound() ? "从第 1 轮按题号顺序重新开始" : "从第 1 轮重新开始"));
  }

  function resetReviewSessionForScope(needle) {
    bank.forEach(q => {
      if (!matchesScopeBase(q, needle)) return;
      state.reviewMastered.delete(q.id);
      delete state.wrongCounts[q.id];
    });
    syncReviewPool(needle);
  }

  function advanceReviewRandom(needle) {
    const pool = reviewPoolInScope(needle);
    if (!pool.length) {
      questions = [];
      render();
      saveState();
      queueAutoUpload();
      return;
    }
    const next = Q.pickRandomFromPool(pool);
    questions = pool;
    currentIndex = Math.max(0, questions.findIndex(q => q.id === next.id));
    state.submitted.delete(next.id);
    delete state.choices[next.id];
    clearOptionOrder(next.id);
    state.lastQuestionId = next.id;
    render();
    saveState();
    queueAutoUpload();
  }

  function renderReviewCompleteReport(needle) {
    const reportScope = bank.filter(q => {
      if (keepRoundPool) {
        // 已删题也计入统计范围，因此不能走 matchesCategory（它会过滤 removed）
        if (!(singlePool || currentCategory === "全部题目")) {
          if (currentCategory.startsWith("subject:") ? q.subjectLabel !== currentCategory.slice(8) : q.category !== currentCategory) return false;
        }
      } else if (!matchesCategory(q)) {
        return false;
      }
      if (needle && !`${q.stem} ${Object.values(q.options).join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const poolLeft = keepRoundPool ? activeBank().length : reportScope.length;
    const troubled = reportScope
      .map(q => ({ q, misses: state.wrongCounts[q.id] || 0 }))
      .filter(x => x.misses > 0)
      .sort((a, b) => b.misses - a.misses || (a.q.number || 0) - (b.q.number || 0));
    const listHtml = troubled.length
      ? `<ul class="miss-list">${troubled.map(({ q, misses }) =>
        `<li class="miss-row"><span class="miss-count">错 ${misses} 次</span><span class="miss-stem">${escapeHtml(q.stem)}</span></li>`).join("")}</ul>`
      : `<p class="report-empty">${keepRoundPool ? "没有留下反复错的题。" : "这一轮每题都一次答对，没有反复错的题。"}</p>`;
    const summary = keepRoundPool
      ? (autoRemoveCorrectFromRound > 0
        ? `原题库 ${reportScope.length} 题，题池还剩 ${poolLeft} 题（已剔除 ${state.removed.size}）。第 1 轮整池过一遍；从第 ${autoRemoveCorrectFromRound} 轮起答对点下一题即剔除。${troubled.length ? `下面 ${troubled.length} 道题曾答错，可按错次回看。` : ""}`
        : `原题库 ${reportScope.length} 题，题池还剩 ${poolLeft} 题（已手动删除 ${state.removed.size}）。每一轮固定随机过一遍，答对不剔除；点「我会了」才会删掉。${troubled.length ? `下面 ${troubled.length} 道题曾答错，可按错次回看。` : ""}`)
      : `共 ${reportScope.length} 题。第 1 轮过后，每一轮只出现上一轮答错的题；最后一轮没有答错。${troubled.length ? `下面 ${troubled.length} 道题曾答错，按错次从高到低排列，建议重点回看。` : ""}`;
    return `<div class="empty-state review-report">
      <span class="empty-symbol">✓</span>
      <h2>${keepRoundPool ? (poolLeft ? "本轮已刷完" : "题池已清空") : "本范围各轮已完成"}</h2>
      <p class="report-summary">${summary}</p>
      ${listHtml}
      <button id="review-restart-btn" class="btn btn-primary" type="button">${keepRoundPool ? `重刷这 ${poolLeft || reportScope.filter(q => !state.removed.has(q.id)).length}` : "从第 1 轮再来"}</button>
    </div>`;
  }

  function buildList(reset = true, focusQuestionId, retried = false) {
    if (isRoundCover()) {
      buildRoundSession(focusQuestionId);
      return;
    }
    const needle = query.trim().toLowerCase();
    const previousPhase = state.coverPhase;
    const coverPhase = getCoverPhase(needle);
    if (coverPhase === "unanswered" || coverPhase === "wrong" || coverPhase === "review") state.coverPhase = coverPhase;
    if (coverPhase === "review") {
      wrongOnly = false;
      const entering = previousPhase !== "review";
      if (entering) {
        pendingOnly = false;
        clearAttemptUiForScope(needle);
        Q.clearQueue(state);
        reset = true;
        showToast(`开始刷错题：随机抽取，答对剔除、答错计次（${wrongCountInScope(needle)} 题）`);
      }
      syncReviewPool(needle);
    }
    const filtered = bank.filter(q => {
      if (!matchesScopeBase(q, needle)) return false;
      if (coverPhase) {
        return !Q.shouldExcludeQuestion({
          phase: coverPhase,
          attempted: id => state.attempted.has(id),
          wrong: id => state.wrong.has(id),
          mastered: id => state.reviewMastered.has(id),
          q,
        });
      }
      if (wrongOnly && !state.wrong.has(q.id)) return false;
      if (pendingOnly && state.attempted.has(q.id)) return false;
      return true;
    });
    const built = Q.buildFromFiltered({
      filtered, mode, reset, listKey: listScopeKey(needle), state, shuffle, phase: coverPhase,
    });
    questions = built.questions;
    state.shuffleKey = built.shuffleKey;
    state.shuffleOrder = built.shuffleOrder;
    if (focusQuestionId) {
      const idx = questions.findIndex(q => q.id === focusQuestionId);
      currentIndex = idx >= 0 ? idx : 0;
    } else if (reset) currentIndex = 0;
    else currentIndex = Math.min(currentIndex, Math.max(0, questions.length - 1));
    if (restorePosition && !focusQuestionId) {
      currentIndex = Q.restoreListIndex(questions, state, mode);
      restorePosition = false;
    }
    if (coverPhase === "review" && questions.length && reset && !focusQuestionId) {
      currentIndex = Math.floor(Math.random() * questions.length);
      const cur = questions[currentIndex];
      if (cur) {
        state.submitted.delete(cur.id);
        delete state.choices[cur.id];
        clearOptionOrder(cur.id);
      }
    }
    if (mode === "random-cover" && coverPhase === "unanswered" && !questions.length && pendingCountInScope(needle) === 0) {
      state.coverPhase = "review";
      syncReviewPool(needle);
      clearAttemptUiForScope(needle);
      Q.clearQueue(state);
      showToast(`开始刷错题：随机抽取，答对剔除、答错计次（${wrongCountInScope(needle)} 题）`);
      return buildList(true);
    }
    if (!retried && mode === "random-cover" && coverPhase === "review" && !questions.length && wrongCountInScope(needle) > 0) {
      syncReviewPool(needle);
      Q.clearQueue(state);
      return buildList(true, undefined, true);
    }
    render();
    saveState();
  }

  function render() {
    const host = $("question-view");
    const needle = query.trim().toLowerCase();
    if (!questions.length) {
      if (isRoundCover()) {
        const rec = state.roundsByScope[scopeKey()];
        if (rec?.done) {
          host.innerHTML = renderReviewCompleteReport(needle);
          const restart = $("review-restart-btn");
          if (restart) restart.addEventListener("click", () => restartRoundCycle());
          return;
        }
        if (wrongOnly) {
          host.innerHTML = `<div class="empty-state"><span class="empty-symbol">◇</span><h2>这一轮没有待做的错题</h2><p>答错的题会在本轮全部作答后进入下一轮，不会在这一轮里抽出来重做。</p></div>`;
          return;
        }
        host.innerHTML = `<div class="empty-state"><span class="empty-symbol">✳</span><h2>没有找到这道题</h2><p>试试更短的关键词，或清空搜索继续这一轮。</p></div>`;
        return;
      }
      const phaseNow = getCoverPhase(needle);
      if (phaseNow === "review" && reviewScopeTotal(needle) > 0 && !reviewPoolInScope(needle).length) {
        host.innerHTML = renderReviewCompleteReport(needle);
        const restart = $("review-restart-btn");
        if (restart) restart.addEventListener("click", () => {
          resetReviewSessionForScope(needle);
          clearAttemptUiForScope(needle);
          Q.clearQueue(state);
          buildList(true);
          showToast("已开始新一轮复习");
        });
        return;
      }
      const isWrong = wrongOnly;
      const isPending = pendingOnly;
      const coverDone = mode === "random-cover" && !pendingOnly && !wrongOnly
        && phaseNow === "unanswered" && pendingCountInScope(needle) === 0 && wrongCountInScope(needle) === 0;
      host.innerHTML = `<div class="empty-state"><span class="empty-symbol">${isWrong || coverDone ? "◇" : isPending ? "✓" : "✳"}</span><h2>${isWrong ? "错题本还是空的" : isPending || coverDone ? "这一范围已经练完了" : "没有找到这道题"}</h2><p>${isWrong ? "答错的题会自动加入错题本，你也可以在答案揭晓后手动收藏。" : isPending || coverDone ? (coverDone && !state.wrong.size ? "当前范围题目都已作答且没有错题，将自动进入第二轮随机。" : "错题会自动进入下一轮；若侧边「只练错题」未亮，刷新一下或点一次出题顺序。") : "试试更短的关键词，或切换到其他题库继续练习。"}</p></div>`;
      return;
    }
    const q = questions[currentIndex];
    const optionOrder = ensureOptionOrder(q);
    const selected = selectedDisplayLetters(q, optionOrder);
    const answerLetters = String(q.answer || "").split("").sort();
    const displayAnswerLetters = answerLetters
      .map(original => displayLetterForOriginal(optionOrder, original))
      .sort();
    const submitted = state.submitted.has(q.id);
    const correct = state.correct.has(q.id);
    const coverPhase = getCoverPhase(needle);
    const roundRec = isRoundCover() ? state.roundsByScope[scopeKey()] : null;
    const inRound = !!(roundRec && !roundRec.done);
    const scopeTotal = reviewScopeTotal(needle);
    const masteredInScope = scopeTotal - reviewPoolInScope(needle).length;
    const percent = inRound && roundRec.set.length
      ? (roundRec.answered.length / roundRec.set.length) * 100
      : coverPhase === "review" && scopeTotal
      ? (masteredInScope / scopeTotal) * 100
      : ((currentIndex + 1) / questions.length) * 100;
    const reviewMisses = state.wrongCounts[q.id] || 0;
    const inReview = !inRound && coverPhase === "review";
    const nextDisabled = !submitted || (!(inRound || inReview) && currentIndex === questions.length - 1);
    const label = (() => {
      if (!q.subjectLabel) return currentCategory === "全部题目" ? q.category : currentCategory;
      if (String(q.category).startsWith(`${q.subjectLabel}·`) || String(q.category).startsWith(`${q.subjectLabel} ·`)) {
        return q.category;
      }
      if (currentCategory === "全部题目" || currentCategory.startsWith("subject:")) {
        return `${q.subjectLabel} · ${q.category}`;
      }
      return q.category;
    })();
    const optionsHtml = letters.map((displayLetter, index) => {
      const originalLetter = optionOrder[index] || displayLetter;
      let classes = "option";
      const isSelected = selected.includes(displayLetter);
      if (isSelected) classes += " selected";
      if (submitted && answerLetters.includes(originalLetter)) classes += " correct";
      if (submitted && isSelected && !answerLetters.includes(originalLetter)) classes += " incorrect";
      const why = submitted && !answerLetters.includes(originalLetter) ? optionWhy(q.analysis, originalLetter) : "";
      return `<button class="${classes}" type="button" data-choice="${displayLetter}" ${submitted ? "disabled" : ""}>
        <span class="option-key">${displayLetter}</span><span class="option-main"><span class="option-text">${escapeHtml(q.options[originalLetter] || "")}</span>${why ? `<span class="option-why">${escapeHtml(why)}</span>` : ""}</span></button>`;
    }).join("");
    const answerBox = submitted ? `<div class="answer-box">
      <p class="answer-result ${correct ? "good" : "bad"}">${correct ? "回答正确" : `正确答案：${displayAnswerLetters.join("、")}`} · ${correct ? "记得很好，继续保持。" : "看看解析，下一次就能答对。"}</p>
      <p class="answer-text">${renderAnalysis(q.analysis || "这道题暂无解析。")}</p>
    </div>` : "";
    host.innerHTML = `<div class="question-topline">
        <div class="badges"><span class="category-badge">${escapeHtml(label)}</span>${q.subjectLabel ? `<span class="paper-badge subject-badge">${escapeHtml(q.subjectLabel)}</span>` : ""}<span class="paper-badge">${q.type === "multiple" ? "多选题" : "单选题"}</span></div>
        <div class="question-count">${inRound
          ? `<strong>第 ${roundRec.round} 轮</strong> · 已答 ${roundRec.answered.length} / ${roundRec.set.length}`
          : inReview
          ? `<strong>错题剩余 ${reviewPoolInScope(needle).length}</strong> · 已掌握 ${masteredInScope}/${scopeTotal}`
          : `<strong>${currentIndex + 1}</strong> / ${questions.length}`}</div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
      <div class="question-content">
        <p class="question-meta">${inRound && keepRoundPool
          ? `本轮第 ${currentIndex + 1}/${questions.length} 题 · 题号 ${q.number}`
          : `第 ${q.number} 题`} <span>·</span> ${inRound
          ? (keepRoundPool
            ? (isOrderRound()
              ? `第 ${roundRec.round} 轮 · 固定题池按题号顺序${autoRemoveCorrectFromRound && roundRec.round >= autoRemoveCorrectFromRound ? " · 答对剔除" : ""}`
              : `第 ${roundRec.round} 轮 · 固定题池随机过一遍${autoRemoveCorrectFromRound && roundRec.round >= autoRemoveCorrectFromRound ? " · 答对剔除" : (autoRemoveCorrectFromRound ? " · 答对不剔除" : "")}`)
            : (isOrderRound()
              ? (roundRec.round <= 1 ? "第 1 轮 · 按题号顺序每题做一次" : `第 ${roundRec.round} 轮 · 上一轮错题，按题号顺序`)
              : (roundRec.round <= 1 ? "第 1 轮 · 打乱后每题做一次" : `第 ${roundRec.round} 轮 · 上一轮错题，重新打乱`)))
          : inReview
          ? `复习轮 · 随机抽取${reviewMisses ? ` · 本题已错 ${reviewMisses} 次` : ""}`
          : q.type === "multiple" ? "请选择所有正确选项" : "请选择一个最合适的答案"}</p>
        <h2 class="question-stem">${escapeHtml(q.stem)}</h2>
        <div class="options">${optionsHtml}</div>
      </div>
      <div class="controls">
        <div class="control-left">
          <button id="prev-btn" class="btn btn-ghost" type="button" ${currentIndex === 0 ? "disabled" : ""}>← 上一题</button>
          ${keepRoundPool
            ? `<button id="master-btn" class="btn btn-master" type="button">我会了 · 删除</button>`
            : `<button id="save-btn" class="btn btn-save ${state.wrong.has(q.id) ? "saved" : ""}" type="button">${state.wrong.has(q.id) ? "◇ 已在错题本" : "◇ 加入错题本"}</button>`}
        </div>
        <div class="control-right">
          <button id="submit-btn" class="btn btn-primary" type="button" ${submitted || !selected ? "disabled" : ""}>确认答案</button>
          <button id="next-btn" class="btn ${submitted ? "btn-primary" : ""}" type="button" ${nextDisabled ? "disabled" : ""}>${inRound ? "下一题 →" : inReview ? "随机下一题 →" : "下一题 →"}</button>
        </div>
      </div>${answerBox}`;
    host.querySelectorAll("[data-choice]").forEach(button => button.addEventListener("click", () => {
      const originalChoice = originalLetterForDisplay(optionOrder, button.dataset.choice);
      if (q.type === "multiple") {
        const chosen = new Set(String(state.choices[q.id] || "").split("").filter(Boolean));
        if (chosen.has(originalChoice)) chosen.delete(originalChoice);
        else chosen.add(originalChoice);
        state.choices[q.id] = [...chosen].sort().join("");
      } else {
        state.choices[q.id] = originalChoice;
      }
      saveState();
      queueAutoUpload();
      render();
    }));
    $("prev-btn").addEventListener("click", () => go(-1));
    $("next-btn").addEventListener("click", () => go(1));
    if (keepRoundPool) $("master-btn")?.addEventListener("click", markMasteredAndRemove);
    else $("save-btn")?.addEventListener("click", toggleWrong);
    const submitButton = $("submit-btn");
    if (submitButton) submitButton.addEventListener("click", submitAnswer);
  }

  function markMasteredAndRemove() {
    if (!keepRoundPool) return;
    const q = questions[currentIndex];
    if (!q) return;
    const nextFocusId = questions[currentIndex + 1]?.id || questions[currentIndex - 1]?.id || "";
    state.removed.add(q.id);
    state.wrong.delete(q.id);
    state.reviewMastered.add(q.id);
    state.submitted.delete(q.id);
    delete state.choices[q.id];
    clearOptionOrder(q.id);
    const key = scopeKey();
    const rec = state.roundsByScope[key];
    if (rec && !rec.done) {
      const known = new Set(scopeQuestionIds());
      const nextSet = uniqueRoundIds((rec.set || []).filter(id => id !== q.id && known.has(id)));
      state.roundsByScope[key] = {
        ...rec,
        set: nextSet,
        answered: uniqueRoundIds((rec.answered || []).filter(id => id !== q.id && known.has(id))),
        wrong: uniqueRoundIds((rec.wrong || []).filter(id => id !== q.id && known.has(id))),
        done: nextSet.length === 0,
      };
    }
    const scopedLeft = bank.filter(matchesCategory).length;
    showToast(`已删除 · 当前范围还剩 ${scopedLeft} 题`);
    populateCategories();
    restorePosition = false;
    buildRoundSession(nextFocusId || undefined);
    queueAutoUpload();
  }

  function submitAnswer() {
    const q = questions[currentIndex];
    if (!q || !state.choices[q.id]) return;
    const isCorrect = String(state.choices[q.id]).split("").sort().join("") === String(q.answer).split("").sort().join("");
    if (isRoundCover()) {
      const key = scopeKey();
      const rec = state.roundsByScope[key];
      if (!rec || rec.done) return;
      state.attempted.add(q.id);
      state.submitted.add(q.id);
      state.roundsByScope[key] = Q.recordRoundAnswer(rec, q.id, isCorrect);
      if (isCorrect) {
        state.correct.add(q.id);
        state.wrong.delete(q.id);
        if (keepRoundPool && autoRemoveCorrectFromRound > 0) {
          const roundNow = state.roundsByScope[scopeKey()]?.round || 1;
          if (roundNow >= autoRemoveCorrectFromRound) {
            showToast("答对 · 点「下一题」后本题剔除");
          }
        }
      } else {
        state.wrongCounts[q.id] = (state.wrongCounts[q.id] || 0) + 1;
        state.correct.delete(q.id);
        state.wrong.add(q.id);
      }
      saveState();
      queueAutoUpload();
      render();
      return;
    }
    const coverPhase = getCoverPhase(query.trim().toLowerCase());
    state.attempted.add(q.id);
    state.submitted.add(q.id);
    if (coverPhase === "review") {
      if (isCorrect) {
        state.reviewMastered.add(q.id);
        state.correct.add(q.id);
        state.wrong.delete(q.id);
      } else {
        state.wrongCounts[q.id] = (state.wrongCounts[q.id] || 0) + 1;
        state.reviewMastered.delete(q.id);
        state.correct.delete(q.id);
        state.wrong.add(q.id);
      }
    } else if (isCorrect) {
      state.correct.add(q.id);
      state.wrong.delete(q.id);
    } else {
      state.correct.delete(q.id);
      state.wrong.add(q.id);
    }
    saveState();
    queueAutoUpload();
    render();
  }

  function toggleWrong() {
    const q = questions[currentIndex];
    if (!q) return;
    if (state.wrong.has(q.id)) {
      state.wrong.delete(q.id);
      showToast("已从错题本移除");
    } else {
      state.wrong.add(q.id);
      showToast("已加入错题本");
    }
    saveState();
    queueAutoUpload();
    if (isRoundCover()) render();
    else buildList(false);
  }

  function shouldAutoRemoveOnAdvance(q) {
    if (!keepRoundPool || !autoRemoveCorrectFromRound || !q) return false;
    const rec = state.roundsByScope[scopeKey()];
    if (!rec || rec.done || rec.round < autoRemoveCorrectFromRound) return false;
    return state.submitted.has(q.id) && state.correct.has(q.id) && !state.removed.has(q.id);
  }

  function go(delta) {
    if (isRoundCover()) {
      if (delta > 0) {
        const cur = questions[currentIndex];
        if (!cur || !state.submitted.has(cur.id)) return;
        // 第 N 轮起：答对后点下一题 → 自动剔除（先看解析，再离开题池）
        if (shouldAutoRemoveOnAdvance(cur)) {
          const nextFocusId = questions[currentIndex + 1]?.id || questions[currentIndex - 1]?.id || "";
          state.removed.add(cur.id);
          state.wrong.delete(cur.id);
          state.reviewMastered.add(cur.id);
          state.submitted.delete(cur.id);
          delete state.choices[cur.id];
          clearOptionOrder(cur.id);
          const key = scopeKey();
          const rec = state.roundsByScope[key];
          if (rec && !rec.done) {
            const known = new Set(scopeQuestionIds());
            const nextSet = uniqueRoundIds((rec.set || []).filter(id => id !== cur.id && known.has(id)));
            state.roundsByScope[key] = {
              ...rec,
              set: nextSet,
              answered: uniqueRoundIds((rec.answered || []).filter(id => id !== cur.id && known.has(id))),
              wrong: uniqueRoundIds((rec.wrong || []).filter(id => id !== cur.id && known.has(id))),
              done: nextSet.length === 0,
            };
          }
          const scopedLeft = bank.filter(matchesCategory).length;
          showToast(`答对已剔除 · 题池还剩 ${scopedLeft} 题`);
          populateCategories();
          restorePosition = false;
          buildRoundSession(nextFocusId || undefined);
          queueAutoUpload();
          return;
        }
        const nextId = questions[currentIndex + 1]?.id;
        if (nextId) {
          // 固定题池完整队列内翻页，不必整表重建
          if (keepRoundPool) {
            currentIndex += 1;
            state.lastQuestionId = nextId;
            render();
            saveState();
            queueAutoUpload();
            return;
          }
          buildRoundSession(nextId);
          return;
        }
        const rec = state.roundsByScope[scopeKey()];
        const remaining = Q.roundRemainingIds(rec, new Set(scopeQuestionIds()));
        const visible = new Set(questions.map(q => q.id));
        if (remaining.some(id => !visible.has(id))) {
          showToast("还有题目不在当前筛选里。清空搜索、关掉「只练错题」后会继续这一轮");
          return;
        }
        buildRoundSession();
        return;
      }
      currentIndex = Math.max(0, Math.min(questions.length - 1, currentIndex + delta));
      const cur = questions[currentIndex];
      if (cur) state.lastQuestionId = cur.id;
      render();
      saveState();
      return;
    }
    const needle = query.trim().toLowerCase();
    const coverPhase = getCoverPhase(needle);
    if (delta > 0 && coverPhase === "review") {
      const cur = questions[currentIndex];
      if (cur && state.submitted.has(cur.id)) {
        advanceReviewRandom(needle);
        return;
      }
    }
    if (delta > 0 && coverPhase === "unanswered") {
      const cur = questions[currentIndex];
      if (cur && state.submitted.has(cur.id)) {
        if (pendingCountInScope(needle) === 0) {
          state.coverPhase = "review";
          syncReviewPool(needle);
          clearAttemptUiForScope(needle);
          Q.clearQueue(state);
          showToast(`开始刷错题：随机抽取，答对剔除、答错计次（${wrongCountInScope(needle)} 题）`);
          buildList(true);
          return;
        }
        const nextId = questions[currentIndex + 1]?.id;
        buildList(false, nextId);
        return;
      }
    }
    currentIndex = Math.max(0, Math.min(questions.length - 1, currentIndex + delta));
    render();
    saveState();
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function optionWhy(analysis, letter) {
    const line = String(analysis || "").split("\n").map(item => item.trim()).find(item => item.startsWith(letter + "错在") || item.startsWith(letter + "不选"));
    if (!line) return "";
    return line.replace(new RegExp("^" + letter), "").replace(/\{\{([^{}]+)\}\}/g, "$1").trim();
  }

  function renderAnalysis(value) {
    const kept = String(value || "").split("\n").filter(line => !/^[A-D](错在|不选)/.test(line.trim()));
    const text = (kept.join("\n").trim() || String(value || "")).replace(/\{\{([^{}]+)\}\}/g, "$1");
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1700);
  }

  categorySelect?.addEventListener("change", () => { currentCategory = categorySelect.value; buildList(); });
  modeSelect?.addEventListener("change", () => {
    mode = modeSelect.value;
    if (mode === "random-cover") {
      state.coverPhase = "unanswered";
      state.reviewMastered = new Set();
      state.wrongCounts = {};
      wrongOnly = false;
      pendingOnly = false;
    }
    buildList();
  });
  searchInput?.addEventListener("input", () => { query = searchInput.value; buildList(); });
  $("wrong-filter")?.addEventListener("click", () => { wrongOnly = !wrongOnly; if (wrongOnly) pendingOnly = false; buildList(); updateStats(); });
  $("pending-filter")?.addEventListener("click", () => { pendingOnly = !pendingOnly; if (pendingOnly) wrongOnly = false; buildList(); updateStats(); });
  $("restart-pool")?.addEventListener("click", () => restartRoundCycle({ askConfirm: true }));
  $("reset-progress")?.addEventListener("click", () => {
    if (!confirm(keepRoundPool ? "要清空这台设备上的答题记录，并恢复已删除的题目吗？" : "要清空这台设备上的全部答题记录和错题本吗？")) return;
    state.attempted.clear(); state.correct.clear(); state.wrong.clear(); state.submitted.clear(); state.choices = {};
    state.optionOrders = {};
    state.coverPhase = "unanswered";
    state.reviewMastered = new Set();
    state.removed = new Set();
    state.wrongCounts = {};
    state.roundsByScope = {};
    state.poolLocked = false;
    Q.clearQueue(state);
    saveState(); buildList(); queueAutoUpload(); showToast("学习记录已清空");
  });
  function syncCode({ prompt = true } = {}) {
    const input = $("sync-code");
    const code = String(input ? input.value : state.syncCode || "").trim();
    if (code.length < 4) {
      if (prompt) alert("请设置至少 4 位的同步码；电脑和手机需要使用同一个同步码。");
      return "";
    }
    state.syncCode = code;
    saveState();
    return syncNamespace + code;
  }

  function syncHeaders(extra) {
    return Object.assign({ apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" }, extra || {});
  }

  function setSyncStatus(message) { setText("sync-status", message || ""); }

  function queueAutoUpload() {
    clearTimeout(autoUploadTimer);
    autoUploadTimer = setTimeout(() => uploadProgress({ automatic: true }), 700);
  }

  async function uploadProgress({ automatic = false } = {}) {
    const code = syncCode({ prompt: !automatic });
    if (!code) return;
    setSyncStatus("正在上传…");
    const payload = {
      app: appId, version: 3, questionBankRevision: state.questionBankRevision || "", attempted: [...state.attempted], correct: [...state.correct],
      wrong: [...state.wrong], choices: state.choices, submitted: [...state.submitted],
      lastCategory: state.lastCategory, lastQuestionId: state.lastQuestionId, mode: state.mode,
      ...Q.queuePayloadSlice(state, currentIndex),
      roundsByScope: state.roundsByScope || {},
      removed: [...state.removed],
      poolLocked: state.poolLocked === true,
    };
    try {
      const response = await fetch(`${SB_URL}/rest/v1/vocab_progress?on_conflict=sync_code`, {
        method: "POST", headers: syncHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ sync_code: code, payload, updated_at: new Date().toISOString() })
      });
      if (!response.ok) throw new Error(await response.text() || `HTTP ${response.status}`);
      setSyncStatus(`${automatic ? "已自动上传" : "已上传"} · ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      setSyncStatus("上传失败");
      if (!automatic) alert(`上传失败：${error.message || error}
请确认背单词网站的云端进度表仍可用。`);
    }
  }

  async function downloadProgress({ automatic = false } = {}) {
    const code = syncCode({ prompt: !automatic });
    if (!code) return;
    setSyncStatus("正在拉取…");
    try {
      const url = `${SB_URL}/rest/v1/vocab_progress?sync_code=eq.${encodeURIComponent(code)}&select=payload,updated_at`;
      const response = await fetch(url, { headers: syncHeaders() });
      if (!response.ok) throw new Error(await response.text() || `HTTP ${response.status}`);
      const rows = await response.json();
      const data = rows[0]?.payload;
      if (!data || data.app !== appId) {
        setSyncStatus("云端暂无记录");
        if (!automatic) alert("云端还没有这个同步码的刷题进度，请先在已有记录的设备上上传。");
        else {
          const migrated = migrateDocQuestionsIntoActiveRound();
          buildList(false);
          if (migrated) queueAutoUpload();
        }
        return;
      }
      const incomingRounds = (data.roundsByScope && typeof data.roundsByScope === "object" && !Array.isArray(data.roundsByScope))
        ? Q.sanitizeRounds(data.roundsByScope)
        : {};
      const scope = singlePool ? "全部题目" : (isValidCategory(state.lastCategory) ? state.lastCategory : "全部题目");
      const localRec = Q.normalizeRoundRecord(state.roundsByScope[scope]);
      const remoteRec = Q.normalizeRoundRecord(incomingRounds[scope]);
      const localEpoch = Number(localRec?.restartEpoch) || 0;
      const remoteEpoch = Number(remoteRec?.restartEpoch) || 0;
      const localRoundAhead = !!(keepRoundPool && automatic && localRec && remoteRec && (
        localEpoch > remoteEpoch || (localEpoch === remoteEpoch && localRec.round > remoteRec.round)
      ));
      const remoteRoundAhead = !!(keepRoundPool && remoteRec && (
        !localRec
        || remoteEpoch > localEpoch
        || (remoteEpoch === localEpoch && remoteRec.round > localRec.round)
      ));

      data.attempted?.forEach(id => state.attempted.add(id));
      data.correct?.forEach(id => state.correct.add(id));
      data.wrong?.forEach(id => state.wrong.add(id));
      // 固定题池：本地轮次更新时，不要把云端旧轮的 submitted/choices 合进来，否则会误标整轮已答并跳轮
      if (!localRoundAhead) {
        data.submitted?.forEach(id => state.submitted.add(id));
        Object.assign(state.choices, data.choices || {});
      } else {
        const allow = new Set(localRec.answered || []);
        data.submitted?.forEach(id => { if (allow.has(id)) state.submitted.add(id); });
        if (data.choices && typeof data.choices === "object") {
          for (const [id, value] of Object.entries(data.choices)) {
            if (allow.has(id)) state.choices[id] = value;
          }
        }
      }
      for (const id of state.correct) state.wrong.delete(id);
      if (!singlePool && isValidCategory(data.lastCategory)) state.lastCategory = data.lastCategory;
      if (data.lastQuestionId) state.lastQuestionId = data.lastQuestionId;
      state.mode = resolveMode(data.mode);
      Q.applyQueuePayload(state, data);
      if (Array.isArray(data.reviewMastered)) state.reviewMastered = new Set(data.reviewMastered);
      const remoteHasQuestionBankRevision = data.questionBankRevision === QUESTION_BANK_REVISION;
      // 仅当云端已带 revision 时才采纳其 revision；缺省时留给 migrate 写入，避免旧拉取把本地 revision 抹掉
      if (remoteHasQuestionBankRevision) state.questionBankRevision = QUESTION_BANK_REVISION;
      if (Array.isArray(data.removed)) {
        // 云端尚未吸收批次 revision 时，绝不能把批次 id 写进 removed（否则会再次踢出锁定池）
        const remoteRemoved = remoteHasQuestionBankRevision
          ? data.removed
          : data.removed.filter(id => !importedDocIds.has(id));
        if (!automatic) state.removed = new Set(remoteRemoved);
        else {
          remoteRemoved.forEach(id => state.removed.add(id));
          if (!remoteHasQuestionBankRevision) importedDocIds.forEach(id => state.removed.delete(id));
        }
      }
      if (data.wrongCounts && typeof data.wrongCounts === "object") {
        state.wrongCounts = mergeWrongCounts(state.wrongCounts, data.wrongCounts);
      }
      if (Object.keys(incomingRounds).length || !automatic) {
        state.roundsByScope = mergeRoundsByScope(state.roundsByScope, incomingRounds, { replace: !automatic });
      }
      if (remoteRoundAhead) {
        const nextRec = state.roundsByScope[scope];
        if (nextRec && !nextRec.done) {
          clearRoundAnswers(nextRec.set || []);
          (nextRec.answered || []).forEach(id => {
            state.submitted.add(id);
            if (data.choices && data.choices[id] != null) state.choices[id] = data.choices[id];
          });
        }
      } else if (keepRoundPool && localRec && !localRoundAhead) {
        // 同轮合并后：本轮已答必须能揭晓；未答清掉可能残留的交卷标记
        const cur = state.roundsByScope[scope];
        if (cur && !cur.done) {
          const answered = new Set(cur.answered || []);
          (cur.set || []).forEach(id => {
            if (answered.has(id)) state.submitted.add(id);
            else state.submitted.delete(id);
          });
        }
      }
      if (!automatic) state.poolLocked = data.poolLocked === true;
      else if (data.poolLocked === true) state.poolLocked = true;
      // 无论云端是否已有 revision，都跑一遍修补：防止 replace 轮次 / 旧 removed 把批次踢出池
      const migrated = migrateDocQuestionsIntoActiveRound();
      currentCategory = singlePool ? "全部题目" : (isValidCategory(state.lastCategory) ? state.lastCategory : "全部题目");
      mode = state.mode;
      populateCategories();
      if (categorySelect) categorySelect.value = currentCategory;
      if (modeSelect) modeSelect.value = mode;
      restorePosition = true;
      buildList(false);
      if (migrated || !remoteHasQuestionBankRevision) queueAutoUpload();
      setSyncStatus(`已拉取 · ${new Date().toLocaleTimeString()}`);
      if (!automatic) alert(`云端进度已合并，本机已答 ${state.attempted.size} 题。`);
    } catch (error) {
      setSyncStatus("拉取失败");
      if (!automatic) alert(`拉取失败：${error.message || error}
请稍后再试。`);
    }
  }

  const syncCodeInput = $("sync-code");
  if (syncCodeInput) {
    syncCodeInput.value = state.syncCode;
    syncCodeInput.addEventListener("change", () => {
      state.syncCode = syncCodeInput.value.trim();
      saveState();
      if (state.syncCode.length >= 4) downloadProgress({ automatic: true });
    });
  }
  $("sync-upload")?.addEventListener("click", uploadProgress);
  $("sync-download")?.addEventListener("click", downloadProgress);

  window.addEventListener("keydown", event => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (["1", "2", "3", "4"].includes(event.key)) {
      const button = document.querySelector(`[data-choice="${letters[Number(event.key) - 1]}"]`);
      if (button) button.click();
    } else if (event.key === "Enter") {
      const button = $("submit-btn");
      if (button && !button.disabled) button.click();
    } else if (event.key === "ArrowRight") {
      const button = $("next-btn"); if (button && !button.disabled) button.click();
    } else if (event.key === "ArrowLeft") {
      const button = $("prev-btn"); if (button && !button.disabled) button.click();
    }
  });

  async function boot() {
    populateCategories();
    if (categorySelect) categorySelect.value = currentCategory;
    if (modeSelect) modeSelect.value = mode;
    updateStats();
    if (state.syncCode.length >= 4) await downloadProgress({ automatic: true });
    else buildList(false);
  }
  boot();
})();


