(() => {
  const bank = window.QUESTION_BANK || [];
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
  const examPaper = appConfig.examPaper === true;
  const categories = [...new Set(bank.map(q => q.category))].sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    if (aIndex >= 0 || bIndex >= 0) return (aIndex < 0 ? Infinity : aIndex) - (bIndex < 0 ? Infinity : bIndex);
    return a.localeCompare(b, "zh-CN");
  });
  const defaultSyncCode = "1234";

  function resolveMode(value) {
    if (appConfig.roundOnly) return "random-cover";
    return ["random", "random-cover", "order"].includes(value) ? value : (appConfig.defaultMode || "order");
  }

  const state = loadState();
  const defaultCategory = appConfig.defaultCategory
    || (categories.includes("预测卷一") ? "预测卷一" : (categories[0] || "全部题目"));
  const paperOnly = appConfig.paperOnly === true;
  function resolveCategory(value) {
    if (singlePool) return "全部题目";
    if (paperOnly && value === "全部题目") return defaultCategory;
    if (categories.includes(value)) return value;
    if (!paperOnly && value === "全部题目") return "全部题目";
    return defaultCategory;
  }
  let currentCategory = resolveCategory(state.lastCategory);
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
        gradedPapers: saved.gradedPapers && typeof saved.gradedPapers === "object" ? saved.gradedPapers : {},
        markedOpen: new Set(saved.markedOpen || []),
        syncCode: defaultSyncCode
      };
    } catch {
      return { attempted: new Set(), correct: new Set(), wrong: new Set(), choices: {}, submitted: new Set(), lastCategory: "全部题目", lastQuestionId: "", mode: resolveMode(appConfig.defaultMode), shuffleKey: "", shuffleOrder: [], listIndex: 0, coverPhase: "unanswered", reviewMastered: new Set(), removed: new Set(), wrongCounts: {}, roundsByScope: {}, gradedPapers: {}, markedOpen: new Set(), syncCode: defaultSyncCode };
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
      gradedPapers: state.gradedPapers || {},
      markedOpen: [...(state.markedOpen || [])],
      syncCode: $("sync-code")?.value.trim() || state.syncCode
    }));
    updateStats();
  }

  function isPaperGraded(scope = currentCategory) {
    return !!(examPaper && state.gradedPapers && state.gradedPapers[scope]);
  }

  function paperScopeQuestions() {
    return bank.filter(q => matchesCategory(q));
  }

  function isObjectiveQuestion(q) {
    return !!q && !isOpenQuestion(q);
  }

  function hasExamAnswer(q) {
    if (!q) return false;
    if (isOpenQuestion(q)) return state.markedOpen.has(q.id) || !!state.choices[q.id];
    return !!state.choices[q.id];
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function updateStats() {
    const currentScope = bank.filter(matchesCategory);
    if (examPaper) {
      const objective = currentScope.filter(isObjectiveQuestion);
      const answered = currentScope.filter(hasExamAnswer).length;
      const graded = isPaperGraded();
      const wrongInScope = objective.filter(q => state.wrong.has(q.id)).length;
      const correctObj = objective.filter(q => state.correct.has(q.id)).length;
      setText("stat-done", String(answered));
      setText("stat-accuracy", graded && objective.length
        ? `${Math.round(correctObj / objective.length * 100)}%`
        : "—");
      setText("stat-wrong", graded ? String(wrongInScope) : String(Math.max(0, currentScope.length - answered)));
      setText("stat-wrong-label", graded ? "客观错题" : "未答题数");
      setText("wrong-count", String(wrongInScope));
      setText("bank-total", String(currentScope.length));
      const gradeBtn = $("grade-paper-btn");
      if (gradeBtn) {
        gradeBtn.hidden = graded;
        gradeBtn.disabled = answered === 0;
        gradeBtn.textContent = answered >= currentScope.length ? "交卷核对" : `交卷核对（已答 ${answered}/${currentScope.length}）`;
      }
      const wrongFilter = $("wrong-filter");
      if (wrongFilter) {
        wrongFilter.disabled = !graded;
        wrongFilter.classList.toggle("active", wrongOnly);
        wrongFilter.title = graded ? "" : "先交卷核对后才能只看错题";
      }
      $("pending-filter")?.classList.toggle("active", pendingOnly);
      setText("pending-count", currentScope.filter(q => !hasExamAnswer(q)).length);
      return;
    }
    const attemptedInScope = currentScope.filter(q => state.attempted.has(q.id));
    const correctInScope = attemptedInScope.filter(q => state.correct.has(q.id));
    setText("stat-done", paperOnly || !singlePool ? attemptedInScope.length : state.attempted.size);
    setText("stat-accuracy", attemptedInScope.length
      ? `${Math.round(correctInScope.length / attemptedInScope.length * 100)}%`
      : (state.attempted.size ? `${Math.round(state.correct.size / state.attempted.size * 100)}%` : "—"));
    const poolLeft = keepRoundPool ? currentScope.length : state.wrong.size;
    setText("stat-wrong", poolLeft);
    setText("wrong-count", state.wrong.size);
    setText("bank-total", keepRoundPool ? String(currentScope.length) : String(bank.length));
    $("wrong-filter")?.classList.toggle("active", wrongOnly);
    $("pending-filter")?.classList.toggle("active", pendingOnly);
    setText("pending-count", currentScope.filter(q => !state.attempted.has(q.id)).length);
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
    if (singlePool) {
      categorySelect.innerHTML = `<option value="全部题目">全部题目 · ${bank.length}</option>`;
      categorySelect.hidden = true;
      const field = document.querySelector('label[for="category-select"]');
      if (field) field.hidden = true;
      return;
    }
    const counts = Object.fromEntries(categories.map(c => [c, bank.filter(q => q.category === c).length]));
    let html = "";
    if (!paperOnly) {
      html += `<option value="全部题目">${subjectOrder.length ? "五科全部" : "全部题目"} · ${bank.length}</option>`;
    }
    if (subjectOrder.length) {
      html += subjectOrder.map(s => {
        const n = bank.filter(q => q.subjectLabel === s).length;
        return `<option value="subject:${escapeHtml(s)}">${escapeHtml(s)} · ${n}</option>`;
      }).join("");
    }
    html += categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)} · ${counts[c]}</option>`).join("");
    categorySelect.innerHTML = html;
    categorySelect.hidden = false;
    const field = document.querySelector('label[for="category-select"]');
    if (field) field.hidden = false;
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
    if (needle && !`${q.stem} ${Object.values(q.options || {}).join(" ")} ${q.analysis || ""}`.toLowerCase().includes(needle)) return false;
    return true;
  }

  function isOpenQuestion(q) {
    return !!q && (q.type === "open" || q.type === "essay" || q.type === "short");
  }

  function optionLettersFor(q) {
    if (isOpenQuestion(q)) return [];
    const keys = Object.keys(q.options || {}).filter(letter => letters.includes(letter));
    return keys.length ? keys.sort() : letters;
  }

  function typeBadge(q) {
    if (q.kind) return q.kind === "单选" ? "单选题" : `${q.kind}题`;
    if (isOpenQuestion(q)) return "主观题";
    return q.type === "multiple" ? "多选题" : "单选题";
  }

  function pendingCountInScope(needle) {
    return bank.filter(q => matchesScopeBase(q, needle) && !state.attempted.has(q.id)).length;
  }

  function wrongCountInScope(needle) {
    return bank.filter(q => matchesScopeBase(q, needle) && state.wrong.has(q.id)).length;
  }

  function clearAttemptUiForScope(needle) {
    bank.forEach(q => {
      if (!matchesScopeBase(q, needle)) return;
      state.submitted.delete(q.id);
      delete state.choices[q.id];
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
    if (appConfig.roundOnly) return mode === "random-cover";
    return mode === "random-cover" && !wrongOnly && !pendingOnly;
  }

  function scopeQuestionIds() {
    return bank.filter(q => matchesScopeBase(q, "")).map(q => q.id);
  }

  function clearRoundAnswers(ids) {
    ids.forEach(id => {
      state.submitted.delete(id);
      delete state.choices[id];
    });
  }

  function buildRoundSession(focusQuestionId) {
    const needle = query.trim().toLowerCase();
    const key = scopeKey();
    let rec = state.roundsByScope[key];
    let enteredRound = 0;
    if (!rec) {
      rec = Q.createInitialRound({
        scopeIds: shuffle(scopeQuestionIds()),
        attempted: [...state.attempted],
        wrong: [...state.wrong],
        correct: [...state.correct],
        keepSet: keepRoundPool,
      });
      if (!rec.done) rec = { ...rec, set: shuffle(rec.set), shuffled: true };
      else rec = { ...rec, shuffled: true };
      if (!rec.done && rec.round > 1) {
        clearRoundAnswers(rec.set);
        enteredRound = rec.round;
      }
      state.roundsByScope[key] = rec;
    } else if (!rec.done && !rec.shuffled) {
      rec = { ...rec, set: shuffle(rec.set), shuffled: true };
      state.roundsByScope[key] = rec;
      restorePosition = false;
    }
    const known = new Set(scopeQuestionIds());
    if (rec && !rec.done) {
      const pruned = uniqueRoundIds((rec.set || []).filter(id => known.has(id)));
      if (pruned.length !== (rec.set || []).length) {
        rec = {
          ...rec,
          set: pruned,
          answered: uniqueRoundIds((rec.answered || []).filter(id => known.has(id))),
          wrong: uniqueRoundIds((rec.wrong || []).filter(id => known.has(id))),
          done: pruned.length === 0,
        };
        state.roundsByScope[key] = rec;
      }
    }
    if (!rec.done && rec.set.length > 0 && Q.roundRemainingIds(rec, known).length === 0) {
      const next = Q.advanceRound(rec, shuffle, { keepSet: keepRoundPool });
      next.set = next.set.filter(id => known.has(id));
      if (!next.done && next.set.length === 0) next.done = true;
      if (!next.done) clearRoundAnswers(next.set);
      state.roundsByScope[key] = next;
      rec = next;
      if (!rec.done) enteredRound = rec.round;
    }
    state.coverPhase = !rec.done && rec.round <= 1 ? "unanswered" : "review";
    const byId = new Map(bank.map(q => [q.id, q]));
    const remaining = rec.done ? [] : Q.roundRemainingIds(rec, known);
    questions = remaining.map(id => byId.get(id)).filter(q => {
      if (!q || !matchesScopeBase(q, needle)) return false;
      if (!keepRoundPool && wrongOnly && !state.wrong.has(q.id)) return false;
      return true;
    });
    if (focusQuestionId) {
      const idx = questions.findIndex(q => q.id === focusQuestionId);
      currentIndex = idx >= 0 ? idx : 0;
    } else if (enteredRound) {
      currentIndex = 0;
      restorePosition = false;
    } else if (restorePosition) {
      const idx = questions.findIndex(q => q.id === state.lastQuestionId);
      currentIndex = idx >= 0 ? idx : 0;
      restorePosition = false;
    } else {
      currentIndex = Math.min(currentIndex, Math.max(0, questions.length - 1));
    }
    if (enteredRound) {
      showToast(keepRoundPool
        ? `进入第 ${enteredRound} 轮：固定题池 ${rec.set.length} 题，已重新打乱`
        : `进入第 ${enteredRound} 轮：只练上一轮答错的 ${rec.set.length} 题`);
    }
    render();
    saveState();
  }

  function uniqueRoundIds(ids) {
    return Q.normalizeRoundRecord({ round: 1, set: ids, answered: [], wrong: [], done: false }).set;
  }

  function restartRoundCycle() {
    const ids = shuffle(scopeQuestionIds());
    ids.forEach(id => { delete state.wrongCounts[id]; });
    clearRoundAnswers(ids);
    state.roundsByScope[scopeKey()] = { round: 1, set: ids, answered: [], wrong: [], done: false, shuffled: true };
    state.coverPhase = "unanswered";
    restorePosition = false;
    buildRoundSession();
    showToast("从第 1 轮重新开始");
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
      if (needle && !`${q.stem} ${Object.values(q.options || {}).join(" ")} ${q.analysis || ""}`.toLowerCase().includes(needle)) return false;
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
      ? `原题库 ${reportScope.length} 题，题池还剩 ${poolLeft} 题（已手动删除 ${state.removed.size}）。每一轮固定随机过一遍，答对不剔除；点「我会了」才会删掉。${troubled.length ? `下面 ${troubled.length} 道题曾答错，可按错次回看。` : ""}`
      : `共 ${reportScope.length} 题。第 1 轮过后，每一轮只出现上一轮答错的题；最后一轮没有答错。${troubled.length ? `下面 ${troubled.length} 道题曾答错，按错次从高到低排列，建议重点回看。` : ""}`;
    return `<div class="empty-state review-report">
      <span class="empty-symbol">✓</span>
      <h2>${keepRoundPool ? (poolLeft ? "本轮已刷完" : "题池已清空") : "本范围各轮已完成"}</h2>
      <p class="report-summary">${summary}</p>
      ${listHtml}
      <button id="review-restart-btn" class="btn btn-primary" type="button">${keepRoundPool ? "用当前题池从第 1 轮再来" : "从第 1 轮再来"}</button>
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
          if (restart) restart.addEventListener("click", restartRoundCycle);
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
    if (examPaper && state._showGradeReport) {
      host.innerHTML = renderExamGradeReport();
      wireExamReportButtons();
      return;
    }
    const q = questions[currentIndex];
    const openQ = isOpenQuestion(q);
    const selected = String(state.choices[q.id] || "");
    const answerLetters = String(q.answer || "").split("").filter(Boolean).sort();
    const graded = isPaperGraded();
    const submitted = examPaper ? graded : state.submitted.has(q.id);
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
    const nextDisabled = examPaper
      ? currentIndex === questions.length - 1
      : (!submitted || (!(inRound || inReview) && currentIndex === questions.length - 1));
    const label = q.subjectLabel
      ? (currentCategory === "全部题目" || currentCategory.startsWith("subject:") ? `${q.subjectLabel} · ${q.category}` : q.category)
      : (currentCategory === "全部题目" ? q.category : currentCategory);
    const optionLetters = optionLettersFor(q);
    const optionsLocked = examPaper ? graded : submitted;
    const optionsHtml = openQ ? "" : optionLetters.map(letter => {
      let classes = "option";
      const isSelected = selected.includes(letter);
      if (isSelected) classes += " selected";
      if (optionsLocked && answerLetters.includes(letter)) classes += " correct";
      if (optionsLocked && isSelected && !answerLetters.includes(letter)) classes += " incorrect";
      const why = optionsLocked && !answerLetters.includes(letter) ? optionWhy(q.analysis, letter) : "";
      return `<button class="${classes}" type="button" data-choice="${letter}" ${optionsLocked ? "disabled" : ""}>
        <span class="option-key">${letter}</span><span class="option-main"><span class="option-text">${escapeHtml(q.options[letter] || "")}</span>${why ? `<span class="option-why">${escapeHtml(why)}</span>` : ""}</span></button>`;
    }).join("");
    const showAnswerBox = examPaper ? graded : submitted;
    const answerResult = openQ
      ? (showAnswerBox ? `<p class="answer-result good">参考骨架已展开 · 对照钩子自己复述一遍。</p>` : "")
      : (showAnswerBox ? `<p class="answer-result ${correct ? "good" : "bad"}">${correct ? "回答正确" : `正确答案：${answerLetters.join("、")}`} · ${correct ? "记得很好，继续保持。" : "看看解析，下一次就能答对。"}</p>` : "");
    const answerBox = showAnswerBox ? `<div class="answer-box">
      ${answerResult}
      <p class="answer-text">${renderAnalysis(q.analysis || "这道题暂无解析。")}</p>
    </div>` : "";
    const metaHint = examPaper
      ? (graded
        ? (openQ ? "交卷后回看骨架" : (correct ? "本卷已核对 · 回答正确" : "本卷已核对 · 对照解析"))
        : (openQ ? "先自己想骨架，点「已想过」记下，整卷交卷后再看解析" : "先选题，整卷答完再交卷核对"))
      : inRound
      ? (keepRoundPool
        ? (mode === "order" ? `第 ${roundRec.round} 轮 · 固定题池按顺序过一遍` : `第 ${roundRec.round} 轮 · 固定题池随机过一遍`)
        : (roundRec.round <= 1 ? "第 1 轮 · 打乱后每题做一次" : `第 ${roundRec.round} 轮 · 上一轮错题，重新打乱`))
      : inReview
      ? `复习轮 · 随机抽取${reviewMisses ? ` · 本题已错 ${reviewMisses} 次` : ""}`
      : openQ
      ? "先自己想骨架，再点看解析"
      : q.type === "multiple"
      ? "请选择所有正确选项"
      : (q.kind === "辨析" ? "判断正确或错误" : "请选择一个最合适的答案");
    let submitEnabled, submitLabel, showSubmit;
    if (examPaper) {
      if (graded) {
        showSubmit = false;
        submitEnabled = false;
        submitLabel = "";
      } else if (openQ) {
        showSubmit = true;
        const marked = hasExamAnswer(q);
        submitEnabled = !marked;
        submitLabel = marked ? "已想过" : "已想过";
        // when marked, disable button but keep label
        submitEnabled = true; // allow toggle remake - actually just mark
        submitLabel = marked ? "已想过 ✓" : "标记已想过";
      } else {
        showSubmit = false;
        submitEnabled = false;
        submitLabel = "";
      }
    } else {
      showSubmit = true;
      submitEnabled = openQ ? !submitted : (!submitted && !!selected);
      submitLabel = openQ ? (submitted ? "已看解析" : "看解析") : "确认答案";
    }
    const onLast = currentIndex === questions.length - 1;
    const nextLabel = examPaper
      ? (onLast ? (graded ? "已是最后一题" : "最后一题 · 去交卷") : "下一题 →")
      : (inRound ? "下一题 →" : inReview ? "随机下一题 →" : "下一题 →");
    const leftExtra = examPaper
      ? (graded
        ? `<button id="exam-report-btn" class="btn btn-ghost" type="button">本卷成绩单</button>`
        : `<button id="grade-inline-btn" class="btn btn-master" type="button">交卷核对</button>`)
      : (keepRoundPool
        ? `<button id="master-btn" class="btn btn-master" type="button">我会了 · 删除</button>`
        : `<button id="save-btn" class="btn btn-save ${state.wrong.has(q.id) ? "saved" : ""}" type="button">${state.wrong.has(q.id) ? "◇ 已在错题本" : "◇ 加入错题本"}</button>`);
    host.innerHTML = `<div class="question-topline">
        <div class="badges"><span class="category-badge">${escapeHtml(label)}</span>${q.subjectLabel ? `<span class="paper-badge subject-badge">${escapeHtml(q.subjectLabel)}</span>` : ""}<span class="paper-badge">${escapeHtml(typeBadge(q))}</span>${examPaper && !graded ? `<span class="paper-badge">答题中</span>` : ""}${examPaper && graded ? `<span class="paper-badge">已核对</span>` : ""}</div>
        <div class="question-count">${inRound
          ? `<strong>第 ${roundRec.round} 轮</strong> · 已答 ${roundRec.answered.length} / ${roundRec.set.length}`
          : inReview
          ? `<strong>错题剩余 ${reviewPoolInScope(needle).length}</strong> · 已掌握 ${masteredInScope}/${scopeTotal}`
          : `<strong>${currentIndex + 1}</strong> / ${questions.length}`}</div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
      <div class="question-content">
        <p class="question-meta">第 ${q.number} 题 <span>·</span> ${metaHint}</p>
        <h2 class="question-stem">${escapeHtml(q.stem).replace(/\n/g, "<br>")}</h2>
        ${optionsHtml ? `<div class="options">${optionsHtml}</div>` : (openQ && !showAnswerBox ? `<p class="open-hint">${examPaper ? "主观题先自己过骨架，点「标记已想过」；整卷交卷后才展开解析。" : "主观题不设选项：先在脑子里过一遍骨架，再点「看解析」对照。"}</p>` : "")}
      </div>
      <div class="controls">
        <div class="control-left">
          <button id="prev-btn" class="btn btn-ghost" type="button" ${currentIndex === 0 ? "disabled" : ""}>← 上一题</button>
          ${leftExtra}
        </div>
        <div class="control-right">
          ${showSubmit ? `<button id="submit-btn" class="btn btn-primary" type="button" ${submitEnabled ? "" : "disabled"}>${submitLabel}</button>` : ""}
          <button id="next-btn" class="btn ${(examPaper ? (selected || hasExamAnswer(q)) : submitted) ? "btn-primary" : ""}" type="button" ${nextDisabled ? "disabled" : ""}>${nextLabel}</button>
        </div>
      </div>${answerBox}`;
    host.querySelectorAll("[data-choice]").forEach(button => button.addEventListener("click", () => {
      if (examPaper && graded) return;
      if (q.type === "multiple") {
        const chosen = new Set(String(state.choices[q.id] || "").split("").filter(Boolean));
        if (chosen.has(button.dataset.choice)) chosen.delete(button.dataset.choice);
        else chosen.add(button.dataset.choice);
        state.choices[q.id] = [...chosen].sort().join("");
      } else {
        state.choices[q.id] = button.dataset.choice;
      }
      if (examPaper) state.attempted.add(q.id);
      saveState();
      queueAutoUpload();
      render();
    }));
    $("prev-btn").addEventListener("click", () => go(-1));
    $("next-btn").addEventListener("click", () => {
      if (examPaper && onLast && !graded) {
        gradeCurrentPaper();
        return;
      }
      go(1);
    });
    if (examPaper) {
      $("grade-inline-btn")?.addEventListener("click", gradeCurrentPaper);
      $("exam-report-btn")?.addEventListener("click", () => {
        state._showGradeReport = true;
        render();
      });
    } else if (keepRoundPool) {
      $("master-btn")?.addEventListener("click", markMasteredAndRemove);
    } else {
      $("save-btn")?.addEventListener("click", toggleWrong);
    }
    const submitButton = $("submit-btn");
    if (submitButton) {
      submitButton.addEventListener("click", () => {
        if (examPaper && openQ && !graded) {
          state.markedOpen.add(q.id);
          state.choices[q.id] = state.choices[q.id] || "想";
          state.attempted.add(q.id);
          saveState();
          queueAutoUpload();
          showToast("已记下 · 交卷后可看骨架");
          render();
          return;
        }
        submitAnswer();
      });
    }
  }

  function renderExamGradeReport() {
    const scope = paperScopeQuestions();
    const objective = scope.filter(isObjectiveQuestion);
    const openQs = scope.filter(isOpenQuestion);
    const correctN = objective.filter(q => state.correct.has(q.id)).length;
    const wrongList = objective.filter(q => state.wrong.has(q.id));
    const blankN = objective.filter(q => !state.choices[q.id]).length;
    const listHtml = wrongList.length
      ? `<ul class="miss-list">${wrongList.map(q => {
          const yours = state.choices[q.id] || "未选";
          return `<li class="miss-row"><span class="miss-count">你的 ${escapeHtml(yours)}</span><span class="miss-stem">${escapeHtml(q.stem)}</span></li>`;
        }).join("")}</ul>`
      : `<p class="report-empty">客观题全对，没有错题。</p>`;
    return `<div class="empty-state review-report">
      <span class="empty-symbol">✓</span>
      <h2>${escapeHtml(currentCategory)} · 核对完成</h2>
      <p class="report-summary">客观题（单选＋辨析）<strong>${correctN}</strong> / ${objective.length} 正确${blankN ? `，其中未作答 ${blankN} 题记为错` : ""}。主观题 ${openQs.length} 道不计入正确率，交卷后可回看骨架。下面列出客观错题，可点「只看错题」逐题过。</p>
      ${listHtml}
      <div class="exam-report-actions">
        <button id="exam-wrong-only-btn" class="btn btn-primary" type="button" ${wrongList.length ? "" : "disabled"}>只看错题（${wrongList.length}）</button>
        <button id="exam-all-btn" class="btn" type="button">回看全部题目</button>
        <button id="exam-retake-btn" class="btn btn-ghost" type="button">重新开考本卷</button>
      </div>
    </div>`;
  }

  function wireExamReportButtons() {
    $("exam-wrong-only-btn")?.addEventListener("click", () => {
      state._showGradeReport = false;
      wrongOnly = true;
      restorePosition = false;
      buildList(true);
      updateStats();
      showToast("只看本卷错题");
    });
    $("exam-all-btn")?.addEventListener("click", () => {
      state._showGradeReport = false;
      wrongOnly = false;
      restorePosition = false;
      buildList(true);
      updateStats();
    });
    $("exam-retake-btn")?.addEventListener("click", retakeCurrentPaper);
  }

  function gradeCurrentPaper() {
    const scope = paperScopeQuestions();
    const answered = scope.filter(hasExamAnswer).length;
    if (!answered) {
      showToast("先答几道再交卷");
      return;
    }
    if (answered < scope.length) {
      if (!confirm(`还有 ${scope.length - answered} 题未作答，未选的客观题将记为错误。确定交卷核对吗？`)) return;
    }
    scope.forEach(q => {
      state.attempted.add(q.id);
      state.submitted.add(q.id);
      if (isOpenQuestion(q)) {
        state.markedOpen.add(q.id);
        state.choices[q.id] = state.choices[q.id] || "想";
        state.correct.add(q.id);
        state.wrong.delete(q.id);
        return;
      }
      const chosen = String(state.choices[q.id] || "");
      const ok = !!chosen && chosen.split("").sort().join("") === String(q.answer || "").split("").filter(Boolean).sort().join("");
      if (ok) {
        state.correct.add(q.id);
        state.wrong.delete(q.id);
      } else {
        state.correct.delete(q.id);
        state.wrong.add(q.id);
        state.wrongCounts[q.id] = (state.wrongCounts[q.id] || 0) + 1;
      }
    });
    state.gradedPapers[currentCategory] = true;
    state._showGradeReport = true;
    wrongOnly = false;
    saveState();
    queueAutoUpload();
    render();
    updateStats();
    showToast("本卷已核对");
  }

  function retakeCurrentPaper() {
    if (!confirm(`确定清空「${currentCategory}」的作答并重新开考吗？`)) return;
    const scope = paperScopeQuestions();
    scope.forEach(q => {
      state.attempted.delete(q.id);
      state.submitted.delete(q.id);
      state.correct.delete(q.id);
      state.wrong.delete(q.id);
      state.markedOpen.delete(q.id);
      delete state.choices[q.id];
      delete state.wrongCounts[q.id];
    });
    delete state.gradedPapers[currentCategory];
    state._showGradeReport = false;
    wrongOnly = false;
    restorePosition = false;
    state.listIndex = 0;
    saveState();
    buildList(true);
    queueAutoUpload();
    showToast("已重新开考");
  }

  function markMasteredAndRemove() {
    if (!keepRoundPool) return;
    const q = questions[currentIndex];
    if (!q) return;
    const nextFocusId = questions[currentIndex + 1]?.id || questions[currentIndex - 1]?.id || "";
    state.removed.add(q.id);
    state.wrong.delete(q.id);
    state.reviewMastered.add(q.id);
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
    showToast(`已删除 · 题池还剩 ${activeBank().length} 题`);
    restorePosition = false;
    if (isRoundCover()) buildRoundSession(nextFocusId || undefined);
    else buildList(true, nextFocusId || undefined);
    queueAutoUpload();
  }

  function submitAnswer() {
    const q = questions[currentIndex];
    if (!q) return;
    const openQ = isOpenQuestion(q);
    if (!openQ && !state.choices[q.id]) return;
    if (openQ) state.choices[q.id] = state.choices[q.id] || "看";
    const isCorrect = openQ
      ? true
      : String(state.choices[q.id]).split("").sort().join("") === String(q.answer || "").split("").filter(Boolean).sort().join("");
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

  function go(delta) {
    if (isRoundCover()) {
      if (delta > 0) {
        const cur = questions[currentIndex];
        if (!cur || !state.submitted.has(cur.id)) return;
        const nextId = questions[currentIndex + 1]?.id;
        if (nextId) {
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

  categorySelect?.addEventListener("change", () => {
    currentCategory = resolveCategory(categorySelect.value);
    const stillHere = bank.some(q => q.id === state.lastQuestionId && matchesCategory(q));
    restorePosition = stillHere;
    if (!stillHere) state.listIndex = 0;
    wrongOnly = false;
    pendingOnly = false;
    state._showGradeReport = false;
    buildList(true);
    updateStats();
  });
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
  $("wrong-filter")?.addEventListener("click", () => {
    if (examPaper && !isPaperGraded()) {
      showToast("先交卷核对，再看错题");
      return;
    }
    wrongOnly = !wrongOnly;
    if (wrongOnly) pendingOnly = false;
    state._showGradeReport = false;
    buildList();
    updateStats();
  });
  $("pending-filter")?.addEventListener("click", () => { pendingOnly = !pendingOnly; if (pendingOnly) wrongOnly = false; buildList(); updateStats(); });
  $("grade-paper-btn")?.addEventListener("click", () => {
    if (!examPaper) return;
    gradeCurrentPaper();
  });
  $("reset-progress")?.addEventListener("click", () => {
    if (!confirm(examPaper ? "要清空各套卷的作答与核对记录吗？" : (keepRoundPool ? "要清空这台设备上的答题记录，并恢复已删除的题目吗？" : "要清空这台设备上的全部答题记录和错题本吗？"))) return;
    state.attempted.clear(); state.correct.clear(); state.wrong.clear(); state.submitted.clear(); state.choices = {};
    state.coverPhase = "unanswered";
    state.reviewMastered = new Set();
    state.removed = new Set();
    state.wrongCounts = {};
    state.roundsByScope = {};
    state.gradedPapers = {};
    state.markedOpen = new Set();
    state._showGradeReport = false;
    wrongOnly = false;
    Q.clearQueue(state);
    saveState(); buildList(); queueAutoUpload(); showToast("学习记录已清空");
  });
  function syncCode() {
    const code = ($("sync-code")?.value || state.syncCode).trim();
    if (code.length < 4) {
      alert("请设置至少 4 位的同步码；电脑和手机需要使用同一个同步码。");
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
    const code = syncCode();
    if (!code) return;
    setSyncStatus("正在上传…");
    const payload = {
      app: appId, version: 4, attempted: [...state.attempted], correct: [...state.correct],
      wrong: [...state.wrong], choices: state.choices, submitted: [...state.submitted],
      lastCategory: state.lastCategory, lastQuestionId: state.lastQuestionId, mode: state.mode,
      ...Q.queuePayloadSlice(state, currentIndex),
      roundsByScope: state.roundsByScope || {},
      removed: [...state.removed],
      gradedPapers: state.gradedPapers || {},
      markedOpen: [...(state.markedOpen || [])],
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
    const code = automatic ? (state.syncCode.length >= 4 ? syncNamespace + state.syncCode : "") : syncCode();
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
        else buildList(false);
        return;
      }
      data.attempted?.forEach(id => state.attempted.add(id));
      data.correct?.forEach(id => state.correct.add(id));
      data.wrong?.forEach(id => state.wrong.add(id));
      data.submitted?.forEach(id => state.submitted.add(id));
      Object.assign(state.choices, data.choices || {});
      for (const id of state.correct) state.wrong.delete(id);
      if (!singlePool && categories.includes(data.lastCategory)) state.lastCategory = data.lastCategory;
      if (data.lastQuestionId) state.lastQuestionId = data.lastQuestionId;
      state.mode = resolveMode(data.mode);
      Q.applyQueuePayload(state, data);
      if (Array.isArray(data.reviewMastered)) state.reviewMastered = new Set(data.reviewMastered);
      if (Array.isArray(data.removed)) {
        if (!automatic) state.removed = new Set(data.removed);
        else data.removed.forEach(id => state.removed.add(id));
      }
      if (data.wrongCounts && typeof data.wrongCounts === "object") Object.assign(state.wrongCounts, data.wrongCounts);
      if (data.roundsByScope && typeof data.roundsByScope === "object" && !Array.isArray(data.roundsByScope)) {
        const incoming = Q.sanitizeRounds(data.roundsByScope);
        if (Object.keys(incoming).length || !automatic) state.roundsByScope = incoming;
      }
      if (data.gradedPapers && typeof data.gradedPapers === "object") {
        state.gradedPapers = automatic
          ? { ...(state.gradedPapers || {}), ...data.gradedPapers }
          : { ...data.gradedPapers };
      }
      if (Array.isArray(data.markedOpen)) {
        if (!automatic) state.markedOpen = new Set(data.markedOpen);
        else data.markedOpen.forEach(id => state.markedOpen.add(id));
      }
      currentCategory = resolveCategory(state.lastCategory);
      mode = state.mode;
      if (categorySelect) categorySelect.value = currentCategory;
      if (modeSelect) modeSelect.value = mode;
      restorePosition = true;
      buildList(false);
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
      saveState();
      if (syncCodeInput.value.trim().length >= 4) downloadProgress({ automatic: true });
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


