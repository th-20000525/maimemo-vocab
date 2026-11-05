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
  let currentCategory = categories.includes(state.lastCategory) ? state.lastCategory : "全部题目";
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
        wrongCounts: saved.wrongCounts && typeof saved.wrongCounts === "object" ? saved.wrongCounts : {},
        roundsByScope: saved.roundsByScope && typeof saved.roundsByScope === "object" ? saved.roundsByScope : {},
        syncCode: defaultSyncCode
      };
    } catch {
      return { attempted: new Set(), correct: new Set(), wrong: new Set(), choices: {}, submitted: new Set(), lastCategory: "全部题目", lastQuestionId: "", mode: resolveMode(appConfig.defaultMode), shuffleKey: "", shuffleOrder: [], listIndex: 0, coverPhase: "unanswered", reviewMastered: new Set(), wrongCounts: {}, roundsByScope: {}, syncCode: defaultSyncCode };
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
      wrongCounts: state.wrongCounts,
      roundsByScope: state.roundsByScope || {},
      syncCode: $("sync-code")?.value.trim() || state.syncCode
    }));
    updateStats();
  }

  function updateStats() {
    $("stat-done").textContent = state.attempted.size;
    $("stat-accuracy").textContent = state.attempted.size ? `${Math.round(state.correct.size / state.attempted.size * 100)}%` : "—";
    $("stat-wrong").textContent = state.wrong.size;
    $("wrong-count").textContent = state.wrong.size;
    $("wrong-filter").classList.toggle("active", wrongOnly);
    $("pending-filter").classList.toggle("active", pendingOnly);
    const currentScope = bank.filter(matchesCategory);
    $("pending-count").textContent = currentScope.filter(q => !state.attempted.has(q.id)).length;
  }

  function matchesCategory(q) {
    if (currentCategory === "全部题目") return true;
    if (currentCategory.startsWith("subject:")) return q.subjectLabel === currentCategory.slice(8);
    return q.category === currentCategory;
  }

  function populateCategories() {
    const counts = Object.fromEntries(categories.map(c => [c, bank.filter(q => q.category === c).length]));
    let html = `<option value="全部题目">${subjectOrder.length ? "五科全部" : "全部题目"} · ${bank.length}</option>`;
    if (subjectOrder.length) {
      html += subjectOrder.map(s => {
        const n = bank.filter(q => q.subjectLabel === s).length;
        return `<option value="subject:${escapeHtml(s)}">${escapeHtml(s)} · ${n}</option>`;
      }).join("");
    }
    html += categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)} · ${counts[c]}</option>`).join("");
    categorySelect.innerHTML = html;
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
    return currentCategory;
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
        scopeIds: scopeQuestionIds(),
        attempted: [...state.attempted],
        wrong: [...state.wrong],
        correct: [...state.correct],
      });
      if (!rec.done && rec.round > 1) {
        clearRoundAnswers(rec.set);
        enteredRound = rec.round;
      }
      state.roundsByScope[key] = rec;
    }
    const known = new Set(scopeQuestionIds());
    if (!rec.done && rec.set.length > 0 && Q.roundRemainingIds(rec, known).length === 0) {
      const next = Q.advanceRound(rec);
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
      if (wrongOnly && !state.wrong.has(q.id)) return false;
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
    if (enteredRound) showToast(`进入第 ${enteredRound} 轮：只练上一轮答错的 ${rec.set.length} 题`);
    render();
    saveState();
  }

  function restartRoundCycle() {
    const ids = scopeQuestionIds();
    ids.forEach(id => { delete state.wrongCounts[id]; });
    clearRoundAnswers(ids);
    state.roundsByScope[scopeKey()] = { round: 1, set: ids, answered: [], wrong: [], done: false };
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
    const scope = bank.filter(q => matchesScopeBase(q, needle));
    const troubled = scope
      .map(q => ({ q, misses: state.wrongCounts[q.id] || 0 }))
      .filter(x => x.misses > 0)
      .sort((a, b) => b.misses - a.misses || (a.q.number || 0) - (b.q.number || 0));
    const listHtml = troubled.length
      ? `<ul class="miss-list">${troubled.map(({ q, misses }) =>
        `<li class="miss-row"><span class="miss-count">错 ${misses} 次</span><span class="miss-stem">${escapeHtml(q.stem)}</span></li>`).join("")}</ul>`
      : `<p class="report-empty">这一轮每题都一次答对，没有反复错的题。</p>`;
    return `<div class="empty-state review-report">
      <span class="empty-symbol">✓</span>
      <h2>本范围各轮已完成</h2>
      <p class="report-summary">共 ${scope.length} 题。第 1 轮过后，每一轮只出现上一轮答错的题；最后一轮没有答错。${troubled.length ? `下面 ${troubled.length} 道题曾答错，按错次从高到低排列，建议重点回看。` : ""}</p>
      ${listHtml}
      <button id="review-restart-btn" class="btn btn-primary" type="button">从第 1 轮再来</button>
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
    const q = questions[currentIndex];
    const selected = String(state.choices[q.id] || "");
    const answerLetters = String(q.answer || "").split("").sort();
    const normalizedAnswer = answerLetters.join("");
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
    const label = q.subjectLabel
      ? (currentCategory === "全部题目" || currentCategory.startsWith("subject:") ? `${q.subjectLabel} · ${q.category}` : q.category)
      : (currentCategory === "全部题目" ? q.category : currentCategory);
    const optionsHtml = letters.map(letter => {
      let classes = "option";
      const isSelected = selected.includes(letter);
      if (isSelected) classes += " selected";
      if (submitted && answerLetters.includes(letter)) classes += " correct";
      if (submitted && isSelected && !answerLetters.includes(letter)) classes += " incorrect";
      return `<button class="${classes}" type="button" data-choice="${letter}" ${submitted ? "disabled" : ""}>
        <span class="option-key">${letter}</span><span class="option-text">${escapeHtml(q.options[letter] || "")}</span></button>`;
    }).join("");
    const answerBox = submitted ? `<div class="answer-box">
      <p class="answer-result ${correct ? "good" : "bad"}">${correct ? "回答正确" : `正确答案：${answerLetters.join("、")}`} · ${correct ? "记得很好，继续保持。" : "看看解析，下一次就能答对。"}</p>
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
        <p class="question-meta">第 ${q.number} 题 <span>·</span> ${inRound
          ? (roundRec.round <= 1 ? "第 1 轮 · 这一范围每题做一次" : `第 ${roundRec.round} 轮 · 只练上一轮答错的题`)
          : inReview
          ? `复习轮 · 随机抽取${reviewMisses ? ` · 本题已错 ${reviewMisses} 次` : ""}`
          : q.type === "multiple" ? "请选择所有正确选项" : "请选择一个最合适的答案"}</p>
        <h2 class="question-stem">${escapeHtml(q.stem)}</h2>
        <div class="options">${optionsHtml}</div>
      </div>
      <div class="controls">
        <div class="control-left">
          <button id="prev-btn" class="btn btn-ghost" type="button" ${currentIndex === 0 ? "disabled" : ""}>← 上一题</button>
          <button id="save-btn" class="btn btn-save ${state.wrong.has(q.id) ? "saved" : ""}" type="button">${state.wrong.has(q.id) ? "◇ 已在错题本" : "◇ 加入错题本"}</button>
        </div>
        <div class="control-right">
          <button id="submit-btn" class="btn btn-primary" type="button" ${submitted || !selected ? "disabled" : ""}>确认答案</button>
          <button id="next-btn" class="btn ${submitted ? "btn-primary" : ""}" type="button" ${nextDisabled ? "disabled" : ""}>${inRound ? "下一题 →" : inReview ? "随机下一题 →" : "下一题 →"}</button>
        </div>
      </div>${answerBox}`;
    host.querySelectorAll("[data-choice]").forEach(button => button.addEventListener("click", () => {
      if (q.type === "multiple") {
        const chosen = new Set(String(state.choices[q.id] || "").split("").filter(Boolean));
        if (chosen.has(button.dataset.choice)) chosen.delete(button.dataset.choice);
        else chosen.add(button.dataset.choice);
        state.choices[q.id] = [...chosen].sort().join("");
      } else {
        state.choices[q.id] = button.dataset.choice;
      }
      saveState();
      queueAutoUpload();
      render();
    }));
    $("prev-btn").addEventListener("click", () => go(-1));
    $("next-btn").addEventListener("click", () => go(1));
    $("save-btn").addEventListener("click", toggleWrong);
    const submitButton = $("submit-btn");
    if (submitButton) submitButton.addEventListener("click", submitAnswer);
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

  function renderAnalysis(value) {
    return String(value).split(/(\{\{[^{}]+\}\})/g).map(part => {
      const marked = part.match(/^\{\{([^{}]+)\}\}$/);
      if (!marked) return escapeHtml(part);
      return `<span class="trap">${escapeHtml(marked[1])}</span>`;
    }).join("").replace(/\n/g, "<br>");
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1700);
  }

  categorySelect.addEventListener("change", () => { currentCategory = categorySelect.value; buildList(); });
  modeSelect.addEventListener("change", () => {
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
  searchInput.addEventListener("input", () => { query = searchInput.value; buildList(); });
  $("wrong-filter").addEventListener("click", () => { wrongOnly = !wrongOnly; if (wrongOnly) pendingOnly = false; buildList(); updateStats(); });
  $("pending-filter").addEventListener("click", () => { pendingOnly = !pendingOnly; if (pendingOnly) wrongOnly = false; buildList(); updateStats(); });
  $("reset-progress").addEventListener("click", () => {
    if (!confirm("要清空这台设备上的全部答题记录和错题本吗？")) return;
    state.attempted.clear(); state.correct.clear(); state.wrong.clear(); state.submitted.clear(); state.choices = {};
    state.coverPhase = "unanswered";
    state.reviewMastered = new Set();
    state.wrongCounts = {};
    state.roundsByScope = {};
    Q.clearQueue(state);
    saveState(); buildList(); queueAutoUpload(); showToast("学习记录已清空");
  });
  function syncCode() {
    const code = $("sync-code").value.trim();
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

  function setSyncStatus(message) { $("sync-status").textContent = message || ""; }

  function queueAutoUpload() {
    clearTimeout(autoUploadTimer);
    autoUploadTimer = setTimeout(() => uploadProgress({ automatic: true }), 700);
  }

  async function uploadProgress({ automatic = false } = {}) {
    const code = syncCode();
    if (!code) return;
    setSyncStatus("正在上传…");
    const payload = {
      app: appId, version: 3, attempted: [...state.attempted], correct: [...state.correct],
      wrong: [...state.wrong], choices: state.choices, submitted: [...state.submitted],
      lastCategory: state.lastCategory, lastQuestionId: state.lastQuestionId, mode: state.mode,
      ...Q.queuePayloadSlice(state, currentIndex),
      roundsByScope: state.roundsByScope || {},
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
      if (categories.includes(data.lastCategory)) state.lastCategory = data.lastCategory;
      if (data.lastQuestionId) state.lastQuestionId = data.lastQuestionId;
      state.mode = resolveMode(data.mode);
      Q.applyQueuePayload(state, data);
      if (Array.isArray(data.reviewMastered)) state.reviewMastered = new Set(data.reviewMastered);
      if (data.wrongCounts && typeof data.wrongCounts === "object") Object.assign(state.wrongCounts, data.wrongCounts);
      if (data.roundsByScope && typeof data.roundsByScope === "object" && !Array.isArray(data.roundsByScope)) {
        const incoming = Q.sanitizeRounds(data.roundsByScope);
        if (Object.keys(incoming).length || !automatic) state.roundsByScope = incoming;
      }
      currentCategory = categories.includes(state.lastCategory) ? state.lastCategory : "全部题目";
      mode = state.mode;
      categorySelect.value = currentCategory;
      modeSelect.value = mode;
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

  $("sync-code").value = state.syncCode;
  $("sync-code").addEventListener("change", () => {
    saveState();
    if ($("sync-code").value.trim().length >= 4) downloadProgress({ automatic: true });
  });
  $("sync-upload").addEventListener("click", uploadProgress);
  $("sync-download").addEventListener("click", downloadProgress);

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
    categorySelect.value = currentCategory;
    modeSelect.value = mode;
    updateStats();
    if (state.syncCode.length >= 4) await downloadProgress({ automatic: true });
    else buildList(false);
  }
  boot();
})();


