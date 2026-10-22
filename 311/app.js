(() => {
  const bank = window.QUESTION_BANK || [];
  const appConfig = window.STUDY_APP_CONFIG || {};
  const storageKey = appConfig.storageKey || "311-study-progress-v1";
  const appId = appConfig.appId || "311-study";
  const syncNamespace = appConfig.syncNamespace || "311:";
  const SB_URL = "https://drtkvfcjbwvqpgolkwur.supabase.co";
  const SB_KEY = "sb_publishable_GFoECb3NXu0jHUUP3krFjQ_JgLLeUxH";
  const letters = ["A", "B", "C", "D"];
  const categoryLabels = { "中教错题": "中国教育史", "外教刷题": "外国教育史" };
  const categoryOf = question => categoryLabels[question.category] || question.category;
  const moduleRules = {
    "教育学原理": [
      ["教育学与教育观", /教育学|教育思想|教育理论|教育现象|教育规律|教育概念|教育本质|教育定义|教育价值|教育史|教育家|教育流派|实验教育学|文化教育学|实用主义教育|批判教育|制度教育学|马克思主义教育/],
      ["教育与社会发展", /社会|生产力|经济|政治|文化|人口|现代化|信息化|全球化|社会化|教育与.*(发展|关系)|人力资本|教育先行/],
      ["教育与人的发展", /人的发展|个体发展|身心发展|遗传|环境|成熟|年龄特征|发展规律|可塑性|影响.*(发展|成长)|最近发展区/],
      ["教育目的与培养目标", /教育目的|培养目标|培养人|全面发展|素质教育|德智体|劳动教育|人的全面/],
      ["教育制度与教育公平", /学制|教育制度|义务教育|教育公平|教育机会|教育政策|教育法|教育改革|学校制度|办学|招生|学校教育制度/],
      ["课程与课程改革", /课程|教材|教科书|课程标准|课程计划|课程设计|课程开发|校本课程|隐性课程|综合实践|核心素养/],
      ["教学理论与方法", /教学|课堂|授课|讲授|讨论|练习|教学原则|教学方法|教学过程|教学组织|教学模式|教学评价|备课|作业|班级授课/],
      ["德育与学生指导", /德育|道德教育|品德教育|思想教育|班主任|班集体|班级管理|学生行为|纪律|奖惩|操行/],
      ["教师与学生", /教师|学生|师生|教师资格|教师专业|教师职业|教师劳动|班主任|师生关系/],
      ["教育评价与研究", /教育评价|教育测量|教育研究|调查法|实验法|观察法|访谈法|问卷|行动研究|教育统计|研究方法|效度|信度/]
    ],
    "中国教育史": [
      ["先秦教育与教育思想", /孔子|孟子|荀子|墨子|老子|庄子|韩非|管仲|稷下|学记|礼记|六艺|有教无类|私学|西周|春秋|战国|诸子|鸿儒/],
      ["秦汉至魏晋南北朝", /秦朝|秦代|汉朝|汉代|西汉|东汉|董仲舒|太学|察举|征辟|鸿都门学|魏晋|南北朝|九品|文翁|郡国学/],
      ["隋唐教育与科举", /隋朝|隋代|唐朝|唐代|科举|进士|明经|国子监|六学|二馆|律学|书学|算学|武举/],
      ["宋辽金元教育", /宋代|宋朝|辽代|金代|元代|朱熹|王安石|三舍法|苏湖教法|书院|白鹿洞|岳麓|程朱|理学|经义|义塾/],
      ["明清教育与科举", /明朝|明代|清朝|清代|八股|社学|会馆|考课|科举|乡试|会试|殿试|学政|书院|顾炎武|王夫之|黄宗羲/],
      ["晚清教育改革", /洋务|戊戌|维新|清末|京师大学堂|壬寅学制|癸卯学制|废科举|留学|新政|京师同文馆|广方言馆|中体西用/],
      ["民国教育与教育家", /民国|蔡元培|陶行知|黄炎培|晏阳初|梁漱溟|陈鹤琴|壬子癸丑|壬戌学制|五四|大学院|生活教育|乡村教育|平民教育|南京国民政府|六三三/],
      ["中国共产党领导的教育", /共产党|中国共产党|革命根据地|解放区|抗日根据地|陕甘宁|工农教育|新中国|中华人民共和国|建国初期|识字运动|教育方针|人民教育/]
    ],
    "外国教育史": [
      ["古代东方教育", /古埃及|埃及|古印度|印度|巴比伦|两河流域|波斯|古代东方|婆罗门|佛教教育/],
      ["古希腊与古罗马", /希腊|雅典|斯巴达|柏拉图|亚里士多德|苏格拉底|智者|罗马|昆体良|西塞罗|伊索克拉底/],
      ["中世纪教育", /中世纪|教会学校|修道院|骑士教育|宫廷学校|经院哲学|大学|基督教|阿拉伯教育/],
      ["文艺复兴与宗教改革", /文艺复兴|人文主义|宗教改革|路德|加尔文|伊拉斯谟|维多利诺|拉伯雷|蒙田/],
      ["近代教育思想家", /夸美纽斯|洛克|卢梭|裴斯泰洛齐|赫尔巴特|福禄贝尔|康德|爱尔维修|狄德罗|教育漫话|爱弥儿|大教学论/],
      ["近代欧美教育制度", /英国|法国|德国|美国|俄国|苏联|日本|教育法|教育制度|国民教育|公学|文法学校|实科中学|双轨制|义务教育|初等教育|中等教育|大学|师范教育|洪堡/],
      ["现代教育改革与思潮", /杜威|蒙台梭利|进步教育|新教育|实用主义|要素主义|永恒主义|改造主义|存在主义|结构主义|布鲁纳|赞科夫|苏霍姆林斯基|凯洛夫|巴格莱|拉格|教育改革|明日学校|葛雷制|道尔顿制|文纳特卡|设计教学法|项目教学/]
    ],
    "教育心理学": [
      ["心理发展与发展理论", /皮亚杰|埃里克森|维果茨基|科尔伯格|弗洛伊德|布朗芬布伦纳|发展阶段|最近发展区|认知发展|心理发展|道德发展|依恋|青春期|儿童发展/],
      ["学习理论", /桑代克|巴甫洛夫|斯金纳|班杜拉|苛勒|托尔曼|布鲁纳|奥苏贝尔|加涅|格式塔|行为主义|条件作用|观察学习|强化|建构主义|社会学习|认知学派/],
      ["学习动机与归因", /动机|归因|自我效能|成就目标|成就动机|目标定向|需要层次|学习兴趣|奖励|惩罚|期望价值/],
      ["知识、技能与学习迁移", /知识|技能|学习迁移|迁移|陈述性|程序性|策略性|学习策略|元认知|记忆|遗忘|思维|问题解决|创造力|概念学习|规则学习|动作技能/],
      ["品德与社会性发展", /品德|道德|态度|价值观|亲社会|攻击行为|社会化|道德判断|道德行为/],
      ["个体差异与特殊教育", /智力|能力|人格|气质|性格|个别差异|特殊儿童|学习风格|多元智能|超常|学习困难|心理测验/],
      ["教学心理与课堂管理", /课堂|教学|教师|班级|师生|教学设计|心理健康|心理辅导|心理咨询|评定|测量|考试焦虑|自我调节/]
    ]
  };
  function moduleOf(question) {
    const rules = moduleRules[categoryOf(question)] || [];
    const text = question.stem || "";
    return rules.find(([, pattern]) => pattern.test(text))?.[0] || "综合与其他知识点";
  }
  const subjectOrder = appConfig.subjectOrder || [];
  const categories = [...new Set(bank.map(categoryOf))].sort((a, b) => {
    const aIndex = subjectOrder.indexOf(a);
    const bIndex = subjectOrder.indexOf(b);
    if (aIndex >= 0 || bIndex >= 0) return (aIndex < 0 ? Infinity : aIndex) - (bIndex < 0 ? Infinity : bIndex);
    return a.localeCompare(b, "zh-CN");
  });
  const defaultSyncCode = "1234";
  const state = loadState();
  let currentCategory = categories.includes(state.lastCategory) ? state.lastCategory : "全部题目";
  let currentModule = state.lastModule || "全部模块";
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
  const moduleSelect = $("module-select");
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
        lastCategory: categoryLabels[saved.lastCategory] || saved.lastCategory || "全部题目",
        lastModule: saved.lastModule || "全部模块",
        lastQuestionId: saved.lastQuestionId || "",
        mode: ["random", "random-cover", "order"].includes(saved.mode) ? saved.mode : (appConfig.defaultMode || "order"),
        shuffleKey: saved.shuffleKey || "",
        shuffleOrder: Array.isArray(saved.shuffleOrder) ? saved.shuffleOrder : [],
        listIndex: Number.isFinite(saved.listIndex) ? saved.listIndex : 0,
        syncCode: defaultSyncCode
      };
    } catch {
      return { attempted: new Set(), correct: new Set(), wrong: new Set(), choices: {}, submitted: new Set(), lastCategory: "全部题目", lastModule: "全部模块", lastQuestionId: "", mode: appConfig.defaultMode || "order", shuffleKey: "", shuffleOrder: [], listIndex: 0, syncCode: defaultSyncCode };
    }
  }

  function saveState() {
    const current = questions[currentIndex];
    state.lastCategory = currentCategory;
    state.lastModule = currentModule;
    state.mode = mode;
    if (current) state.lastQuestionId = current.id;
    localStorage.setItem(storageKey, JSON.stringify({
      attempted: [...state.attempted], correct: [...state.correct], wrong: [...state.wrong],
      choices: state.choices, submitted: [...state.submitted], lastCategory: state.lastCategory,
      lastQuestionId: state.lastQuestionId, lastModule: state.lastModule, mode: state.mode,
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
    const pendingEl = $("pending-filter");
    const pendingCountEl = $("pending-count");
    if (pendingEl) pendingEl.classList.toggle("active", pendingOnly);
    if (pendingCountEl) {
      const scope = bank.filter(q => {
        if (currentCategory !== "全部题目" && categoryOf(q) !== currentCategory) return false;
        if (currentModule !== "全部模块" && moduleOf(q) !== currentModule) return false;
        return true;
      });
      pendingCountEl.textContent = scope.filter(q => !state.attempted.has(q.id)).length;
    }
  }

  function populateCategories() {
    const counts = Object.fromEntries(categories.map(c => [c, bank.filter(q => categoryOf(q) === c).length]));
    const allLabel = subjectOrder.length ? "四科全部" : "全部题目";
    categorySelect.innerHTML = `<option value="全部题目">${allLabel} · ${bank.length}</option>` +
      categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)} · ${counts[c]}</option>`).join("");
    populateModules();
  }

  function populateModules() {
    const available = [...new Set(bank.filter(q => currentCategory === "全部题目" || categoryOf(q) === currentCategory).map(moduleOf))];
    const counts = Object.fromEntries(available.map(name => [name, bank.filter(q => (currentCategory === "全部题目" || categoryOf(q) === currentCategory) && moduleOf(q) === name).length]));
    moduleSelect.innerHTML = `<option value="全部模块">全部模块 · ${bank.filter(q => currentCategory === "全部题目" || categoryOf(q) === currentCategory).length}</option>` +
      available.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)} · ${counts[name]}</option>`).join("");
    if (!available.includes(currentModule)) currentModule = "全部模块";
    moduleSelect.value = currentModule;
  }

  const Q = window.StudyListQueue;

  function listScopeKey(needle) {
    return [currentCategory, currentModule, mode, wrongOnly, pendingOnly, needle].join("\u0001");
  }

  function buildList(reset = true) {
    const needle = query.trim().toLowerCase();
    const filtered = bank.filter(q => {
      if (currentCategory !== "全部题目" && categoryOf(q) !== currentCategory) return false;
      if (currentModule !== "全部模块" && moduleOf(q) !== currentModule) return false;
      if (wrongOnly && !state.wrong.has(q.id)) return false;
      if (pendingOnly && state.attempted.has(q.id)) return false;
      if (needle && !`${q.stem} ${Object.values(q.options).join(" ")}`.toLowerCase().includes(needle)) return false;
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
    render();
    saveState();
  }

  function render() {
    const host = $("question-view");
    if (!questions.length) {
      const isWrong = wrongOnly;
      const isPending = pendingOnly;
      host.innerHTML = `<div class="empty-state"><span class="empty-symbol">${isWrong ? "◇" : isPending ? "✓" : "✳"}</span><h2>${isWrong ? "错题本还是空的" : isPending ? "这一范围已经练完了" : "没有找到这道题"}</h2><p>${isWrong ? "答错的题会自动加入错题本，你也可以在答案揭晓后手动收藏。" : isPending ? "当前范围内的题目都已作答，可以换模式或练错题。" : "试试更短的关键词，或切换到其他题库继续练习。"}</p></div>`;
      return;
    }
    const q = questions[currentIndex];
    const selected = String(state.choices[q.id] || "");
    const answerLetters = String(q.answer || "").split("").sort();
    const normalizedAnswer = answerLetters.join("");
    const submitted = state.submitted.has(q.id);
    const correct = state.correct.has(q.id);
    const percent = ((currentIndex + 1) / questions.length) * 100;
    const label = currentCategory === "全部题目" ? categoryOf(q) : currentCategory;
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
        <div class="badges"><span class="category-badge">${escapeHtml(label)}</span><span class="paper-badge">${q.type === "multiple" ? "多选题" : "单选题"}</span></div>
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

  categorySelect.addEventListener("change", () => { currentCategory = categorySelect.value; currentModule = "全部模块"; populateModules(); buildList(); });
  moduleSelect.addEventListener("change", () => { currentModule = moduleSelect.value; buildList(); });
  modeSelect.addEventListener("change", () => { mode = modeSelect.value; buildList(); });
  searchInput.addEventListener("input", () => { query = searchInput.value; buildList(); });
  $("wrong-filter").addEventListener("click", () => { wrongOnly = !wrongOnly; if (wrongOnly) pendingOnly = false; buildList(); updateStats(); });
  const pendingFilter = $("pending-filter");
  if (pendingFilter) {
    pendingFilter.addEventListener("click", () => { pendingOnly = !pendingOnly; if (pendingOnly) wrongOnly = false; buildList(); updateStats(); });
  }
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
      lastCategory: state.lastCategory, lastQuestionId: state.lastQuestionId, lastModule: state.lastModule, mode: state.mode,
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
      const downloadedCategory = categoryLabels[data.lastCategory] || data.lastCategory;
      if (categories.includes(downloadedCategory)) state.lastCategory = downloadedCategory;
      if (data.lastModule) state.lastModule = data.lastModule;
      if (data.lastQuestionId) state.lastQuestionId = data.lastQuestionId;
      state.mode = ["random", "random-cover", "order"].includes(data.mode) ? data.mode : "order";
      Q.applyQueuePayload(state, data);
      currentCategory = categories.includes(state.lastCategory) ? state.lastCategory : "全部题目";
      currentModule = state.lastModule || "全部模块";
      mode = state.mode;
      categorySelect.value = currentCategory;
      populateModules();
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
  populateModules();
  modeSelect.value = mode;
  updateStats();
  buildList(false);
  if (state.syncCode.length >= 4) downloadProgress({ automatic: true });
})();
