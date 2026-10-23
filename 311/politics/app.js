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
        mode: ["random", "random-cover", "order"].includes(saved.mode) ? saved.mode : (appConfig.defaultMode || "order"),
        shuffleKey: saved.shuffleKey || "",
        shuffleOrder: Array.isArray(saved.shuffleOrder) ? saved.shuffleOrder : [],
        listIndex: Number.isFinite(saved.listIndex) ? saved.listIndex : 0,
        syncCode: defaultSyncCode
      };
    } catch {
      return { attempted: new Set(), correct: new Set(), wrong: new Set(), choices: {}, submitted: new Set(), lastCategory: "全部题目", lastQuestionId: "", mode: appConfig.defaultMode || "order", shuffleKey: "", shuffleOrder: [], listIndex: 0, syncCode: defaultSyncCode };
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

  function listScopeKey(needle) {
    return [currentCategory, mode, wrongOnly, pendingOnly, needle].join("\u0001");
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

  function prepareRandomCoverPhase(needle) {
    if (mode !== "random-cover" || pendingOnly) return;
    if (pendingCountInScope(needle) === 0 && wrongCountInScope(needle) > 0) wrongOnly = true;
  }

  function buildList(reset = true) {
    const needle = query.trim().toLowerCase();
    prepareRandomCoverPhase(needle);
    const filtered = bank.filter(q => {
      if (!matchesScopeBase(q, needle)) return false;
      if (wrongOnly && !state.wrong.has(q.id)) return false;
      if (pendingOnly && state.attempted.has(q.id)) return false;
      if (mode === "random-cover" && !wrongOnly && !pendingOnly && state.attempted.has(q.id)) return false;
      return true;
    });
    const built = Q.buildFromFiltered({
      filtered, mode, reset, listKey: listScopeKey(needle), state, shuffle,
    });
    questions = built.questions;
    state.shuffleKey = built.shuffleKey;
    state.shuffleOrder = built.shuffleOrder;
    if (reset) currentIndex = 0;
    else currentIndex = Math.min(currentIndex, Math.max(0, questions.length - 1));
    if (restorePosition) {
      currentIndex = Q.restoreListIndex(questions, state, mode);
      restorePosition = false;
    }
    if (mode === "random-cover" && !wrongOnly && !pendingOnly && !questions.length && wrongCountInScope(needle) > 0) {
      wrongOnly = true;
      Q.clearQueue(state);
      showToast("未答题已全部过完，开始刷错题");
      return buildList(true);
    }
    render();
    saveState();
  }

  function render() {
    const host = $("question-view");
    if (!questions.length) {
      const isWrong = wrongOnly;
      const isPending = pendingOnly;
      const coverDone = mode === "random-cover" && !pendingOnly && pendingCountInScope(query.trim().toLowerCase()) === 0;
      host.innerHTML = `<div class="empty-state"><span class="empty-symbol">${isWrong || coverDone ? "◇" : isPending ? "✓" : "✳"}</span><h2>${isWrong ? "错题本还是空的" : isPending || coverDone ? "这一范围已经练完了" : "没有找到这道题"}</h2><p>${isWrong ? "答错的题会自动加入错题本，你也可以在答案揭晓后手动收藏。" : isPending || coverDone ? (coverDone && !state.wrong.size ? "当前范围题目都已作答且没有错题，可以换范围或切换出题模式。" : "错题会自动进入下一轮；若侧边「只练错题」未亮，刷新一下或点一次出题顺序。") : "试试更短的关键词，或切换到其他题库继续练习。"}</p></div>`;
      return;
    }
    const q = questions[currentIndex];
    const selected = String(state.choices[q.id] || "");
    const answerLetters = String(q.answer || "").split("").sort();
    const normalizedAnswer = answerLetters.join("");
    const submitted = state.submitted.has(q.id);
    const correct = state.correct.has(q.id);
    const percent = ((currentIndex + 1) / questions.length) * 100;
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
      <p class="answer-text">${escapeHtml(q.analysis || "这道题暂无解析。")}</p>
    </div>` : "";
    host.innerHTML = `<div class="question-topline">
        <div class="badges"><span class="category-badge">${escapeHtml(label)}</span>${q.subjectLabel ? `<span class="paper-badge subject-badge">${escapeHtml(q.subjectLabel)}</span>` : ""}<span class="paper-badge">${q.type === "multiple" ? "多选题" : "单选题"}</span></div>
        <div class="question-count"><strong>${currentIndex + 1}</strong> / ${questions.length}</div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
      <div class="question-content">
        <p class="question-meta">第 ${q.number} 题 <span>·</span> ${q.type === "multiple" ? "请选择所有正确选项" : "请选择一个最合适的答案"}</p>
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
          <button id="next-btn" class="btn ${submitted ? "btn-primary" : ""}" type="button" ${currentIndex === questions.length - 1 ? "disabled" : ""}>下一题 →</button>
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
    state.attempted.add(q.id);
    state.submitted.add(q.id);
    if (isCorrect) {
      state.correct.add(q.id);
      state.wrong.delete(q.id);
    } else {
      state.correct.delete(q.id);
      state.wrong.add(q.id);
    }
    saveState();
    queueAutoUpload();
    if (mode === "random-cover" && !wrongOnly && !pendingOnly) buildList(false);
    else render();
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
    buildList(false);
  }

  function go(delta) {
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
    if (mode === "random-cover") wrongOnly = false;
    buildList();
  });
  searchInput.addEventListener("input", () => { query = searchInput.value; buildList(); });
  $("wrong-filter").addEventListener("click", () => { wrongOnly = !wrongOnly; if (wrongOnly) pendingOnly = false; buildList(); updateStats(); });
  $("pending-filter").addEventListener("click", () => { pendingOnly = !pendingOnly; if (pendingOnly) wrongOnly = false; buildList(); updateStats(); });
  $("reset-progress").addEventListener("click", () => {
    if (!confirm("要清空这台设备上的全部答题记录和错题本吗？")) return;
    state.attempted.clear(); state.correct.clear(); state.wrong.clear(); state.submitted.clear(); state.choices = {};
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
      app: appId, version: 2, attempted: [...state.attempted], correct: [...state.correct],
      wrong: [...state.wrong], choices: state.choices, submitted: [...state.submitted],
      lastCategory: state.lastCategory, lastQuestionId: state.lastQuestionId, mode: state.mode,
      ...Q.queuePayloadSlice(state, currentIndex),
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
      state.mode = ["random", "random-cover", "order"].includes(data.mode) ? data.mode : "order";
      Q.applyQueuePayload(state, data);
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

  populateCategories();
  categorySelect.value = currentCategory;
  modeSelect.value = mode;
  updateStats();
  buildList(false);
  if (state.syncCode.length >= 4) downloadProgress({ automatic: true });
})();


