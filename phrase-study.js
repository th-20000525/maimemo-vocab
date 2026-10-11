/** 作文短语三段 — 嵌入 index.html 使用 */
(function () {
  const STORAGE_KEY = "phrase_memo_v2";
  const PHRASE_LIST_VERSION = 2;
  const PHRASES = [
    { id: 1, section: 1, en: "adopt different ways to keep fit", zh: "采取不同方式养生/保持健康" },
    { id: 2, section: 1, en: "pursue healthy lifestyles", zh: "追求健康的生活方式" },
    { id: 3, section: 1, en: "the figure is growing", zh: "该数字持续上升" },
    { id: 4, section: 1, en: "self-driving taxi", zh: "无人驾驶出租车" },
    { id: 5, section: 1, en: "illustrate the changes in …", zh: "描述……方面的变化" },
    { id: 6, section: 1, en: "annual order volume", zh: "年订单量" },
    { id: 7, section: 1, en: "autonomous taxis", zh: "自动驾驶出租车" },
    { id: 8, section: 1, en: "stood at + 数字", zh: "（数据）达到（静态数值）" },
    { id: 9, section: 1, en: "kept soaring", zh: "持续激增（图表高分词，描述数据暴涨）" },
    { id: 10, section: 1, en: "stands below a balance scale", zh: "站在天平下方" },
    { id: 11, section: 1, en: "looking confused", zh: "面露困惑" },
    { id: 12, section: 1, en: "on one side of the scale", zh: "在天平一端" },
    { id: 13, section: 1, en: "a pile of books", zh: "一堆书" },
    { id: 14, section: 1, en: "on the other (side)", zh: "在另一端" },
    { id: 15, section: 1, en: "pulls the scale down", zh: "把天平压下去" },
    { id: 16, section: 2, en: "light health preservation", zh: "轻养生（本篇主题词）" },
    { id: 17, section: 2, en: "Several factors can account for the trend.", zh: "几个因素可以解释这一趋势" },
    { id: 18, section: 2, en: "heavy workloads", zh: "繁重的工作负担" },
    { id: 19, section: 2, en: "irregular daily routines", zh: "不规律的日常作息" },
    { id: 20, section: 2, en: "render sb aware of …", zh: "使某人意识到……（高分动词搭配）" },
    { id: 21, section: 2, en: "potential health hazards", zh: "潜在的健康隐患" },
    { id: 22, section: 2, en: "a wide array of", zh: "各式各样的、大量的" },
    { id: 23, section: 2, en: "enable sb to do sth", zh: "使某人能够做某事" },
    { id: 24, section: 2, en: "busy office workers", zh: "忙碌的上班族" },
    { id: 25, section: 2, en: "take simple health measures", zh: "采取简易的养生方式" },
    { id: 26, section: 2, en: "fall into a paradox", zh: "陷入一种矛盾（思辨加分短语）" },
    { id: 27, section: 2, en: "stay up late", zh: "熬夜" },
    { id: 28, section: 2, en: "overwork", zh: "过度工作，超负荷工作" },
    { id: 29, section: 2, en: "count on sth to do sth", zh: "指望某物去做……" },
    { id: 30, section: 2, en: "health supplements", zh: "养生保健品" },
    { id: 31, section: 2, en: "offset physical losses", zh: "弥补身体损耗" },
    { id: 32, section: 2, en: "transform our lifestyle", zh: "改变我们的生活方式" },
    { id: 33, section: 2, en: "technological advances", zh: "技术进步" },
    { id: 34, section: 2, en: "alter this pattern", zh: "改变这种模式" },
    { id: 35, section: 2, en: "cut down avoidable traffic risks", zh: "减少可避免的交通风险" },
    { id: 36, section: 2, en: "attach great importance to …", zh: "高度重视……" },
    { id: 37, section: 2, en: "improve life quality", zh: "提升生活质量" },
    { id: 38, section: 2, en: "be burdened with heavy workloads", zh: "背负繁重的工作压力" },
    { id: 39, section: 2, en: "relieve their stress", zh: "缓解压力" },
    { id: 40, section: 2, en: "save physical energy", zh: "节省体力" },
    { id: 41, section: 2, en: "conveys what lifestyle teenagers should choose", zh: "传达青少年应当选择何种生活方式" },
    { id: 42, section: 2, en: "in their life journey", zh: "在人生旅途上" },
    { id: 43, section: 2, en: "It is inevitable that …", zh: "……是不可避免的" },
    { id: 44, section: 2, en: "face a dilemma", zh: "面临两难抉择" },
    { id: 45, section: 2, en: "indulge in temporary entertainment", zh: "沉溺于短暂的娱乐" },
    { id: 46, section: 2, en: "keep studying persistently", zh: "坚持学习" },
    { id: 47, section: 2, en: "weigh the consequences", zh: "权衡后果" },
    { id: 48, section: 2, en: "be responsible for our own life", zh: "对自己的人生负责" },
    { id: 49, section: 2, en: "resist transient temptation", zh: "抵制短暂的诱惑" },
    { id: 50, section: 2, en: "lose precious opportunities for self-growth", zh: "失去宝贵的自我成长机会" },
    { id: 51, section: 2, en: "attach great importance to self-improvement", zh: "高度重视自我提升" },
    { id: 52, section: 2, en: "stick to their goals", zh: "坚守目标" },
    { id: 53, section: 2, en: "equip sb. with knowledge and inner motivation", zh: "赋予某人知识与内在动力" },
    { id: 54, section: 2, en: "perseverance lays a solid foundation for…", zh: "毅力为……打下坚实基础" },
    { id: 55, section: 2, en: "cope with future challenges", zh: "应对未来的挑战" },
    { id: 56, section: 3, en: "cultivate wholesome lifestyles", zh: "培养健康的生活方式" },
    { id: 57, section: 3, en: "rather than", zh: "而不是" },
    { id: 58, section: 3, en: "superficial remedies", zh: "表面的补救手段（高分思辨短语）" },
    { id: 59, section: 3, en: "fully appreciate the benefits", zh: "充分认识 / 享受益处" },
    { id: 60, section: 3, en: "technological progress", zh: "科技进步" },
    { id: 61, section: 3, en: "take initiatives to do sth", zh: "主动采取行动做某事" },
    { id: 62, section: 3, en: "regulate this emerging industry", zh: "规范这一新兴行业" },
    { id: 63, section: 3, en: "enrich our knowledge", zh: "丰富知识" },
    { id: 64, section: 3, en: "translate this awareness into practical actions", zh: "将这种认知转化为实际行动" },
    { id: 65, section: 3, en: "rather than", zh: "而不是" },
    { id: 66, section: 3, en: "indulge in mindless entertainment on mobile phones", zh: "沉迷手机上无意义的娱乐" },
  ];
  const SECTION_NAMES = { 1: "第一段", 2: "第二段", 3: "第三段" };

  let knownIds = [];
  let reviewSchedule = {};
  let currentSection = 1;
  let queue = [];
  let queueIndex = 0;
  let sessionTotal = 0;
  let revealed = false;
  let bound = false;

  const $ = (id) => document.getElementById(id);

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function addDays(dateKey, days) {
    const [y, mo, da] = dateKey.split("-").map(Number);
    const t = new Date(y, mo - 1, da + days);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }

  function escapeHtml(s) {
    return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  function phraseById(id) {
    return PHRASES.find((p) => p.id === id);
  }

  function isAvailable(id) {
    if (knownIds.includes(id)) return false;
    const due = reviewSchedule[id];
    if (!due) return true;
    return due <= todayKey();
  }

  function loadStore() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (data.phraseListVersion !== PHRASE_LIST_VERSION) {
        knownIds = [];
        reviewSchedule = {};
        currentSection = 1;
        return;
      }
      if (Array.isArray(data.knownIds)) knownIds = data.knownIds.map(Number);
      if (data.reviewSchedule) reviewSchedule = data.reviewSchedule;
      if (data.currentSection) currentSection = data.currentSection;
    } catch (e) {}
  }

  function saveStore() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        phraseListVersion: PHRASE_LIST_VERSION,
        knownIds,
        reviewSchedule,
        currentSection,
      })
    );
  }

  function sectionPhraseIds(section) {
    return PHRASES.filter((p) => p.section === section && isAvailable(p.id)).map((p) => p.id);
  }

  function rebuildQueue() {
    const due = Object.keys(reviewSchedule)
      .map(Number)
      .filter(
        (id) =>
          PHRASES.some((p) => p.section === currentSection && p.id === id) &&
          isAvailable(id) &&
          reviewSchedule[id] <= todayKey()
      )
      .sort((a, b) => a - b);
    const rest = sectionPhraseIds(currentSection).filter((id) => !due.includes(id));
    queue = due.concat(rest);
    queueIndex = 0;
    sessionTotal = queue.length;
    revealed = false;
  }

  function updatePhraseStats() {
    const total = PHRASES.filter((p) => p.section === currentSection).length;
    const known = PHRASES.filter((p) => p.section === currentSection && knownIds.includes(p.id)).length;
    const el = $("phraseStats");
    if (el) {
      el.innerHTML = `${SECTION_NAMES[currentSection]} · 已会 <b>${known}</b>/${total} · 待背 <b>${queue.length}</b>`;
    }
  }

  function renderList() {
    const title = $("phListTitle");
    if (title) title.textContent = SECTION_NAMES[currentSection] + "短语列表";
    const list = $("phPhraseList");
    if (!list) return;
    list.innerHTML = PHRASES.filter((p) => p.section === currentSection)
      .map((p, i) => {
        const cls = knownIds.includes(p.id) ? "phrase-row known" : "phrase-row";
        return `<div class="${cls}" data-id="${p.id}"><div class="idx">${i + 1}</div><div><div class="en">${escapeHtml(p.en)}</div><div class="zh">${escapeHtml(p.zh)}</div></div></div>`;
      })
      .join("");
  }

  function showDone() {
    $("phFlash").style.display = "none";
    $("phActions").classList.remove("show");
    $("phDone").style.display = "block";
    $("phCardProgress").textContent = "完成";
    $("phProgressFill").style.width = "100%";
  }

  function renderCard() {
    $("phDone").style.display = "none";
    $("phFlash").style.display = "block";
    $("phActions").classList.remove("show");
    $("phFlash").classList.remove("open");
    revealed = false;

    if (!queue.length) {
      showDone();
      updatePhraseStats();
      renderList();
      return;
    }

    if (queueIndex >= queue.length) queueIndex = 0;
    const p = phraseById(queue[queueIndex]);
    if (!p) {
      queue.splice(queueIndex, 1);
      renderCard();
      return;
    }

    const done = sessionTotal - queue.length;
    $("phCardProgress").textContent = `${done + 1} / ${sessionTotal}`;
    $("phProgressFill").style.width =
      (sessionTotal ? Math.round((done / sessionTotal) * 100) : 0) + "%";
    $("phSectionTag").textContent = SECTION_NAMES[currentSection];
    $("phCardEn").textContent = p.en;
    $("phCardZh").textContent = p.zh;
    updatePhraseStats();
    renderList();
  }

  function onReveal() {
    if (!queue.length || revealed) return;
    revealed = true;
    $("phFlash").classList.add("open");
    $("phActions").classList.add("show");
  }

  function onAnswer(act) {
    if (!queue.length) return;
    if (!revealed) {
      onReveal();
      return;
    }
    const id = queue[queueIndex];
    if (act === "know") {
      if (!knownIds.includes(id)) knownIds.push(id);
      delete reviewSchedule[id];
      queue.splice(queueIndex, 1);
    } else if (act === "forgot") {
      reviewSchedule[id] = addDays(todayKey(), 1);
      queue.splice(queueIndex, 1);
    } else {
      delete reviewSchedule[id];
      const picked = queue.splice(queueIndex, 1)[0];
      if (picked != null) queue.push(picked);
    }
    saveStore();
    revealed = false;
    if (!queue.length) {
      showDone();
      updatePhraseStats();
      renderList();
      return;
    }
    if (queueIndex >= queue.length) queueIndex = 0;
    renderCard();
  }

  function setSection(section) {
    currentSection = section;
    document.querySelectorAll("#phSectionTabs button").forEach((btn) => {
      btn.classList.toggle("active", +btn.dataset.section === section);
    });
    rebuildQueue();
    renderCard();
    saveStore();
  }

  function bindEvents() {
    if (bound) return;
    bound = true;
    $("phFlash").addEventListener("click", () => onReveal());
    $("phActions").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (btn) onAnswer(btn.getAttribute("data-act"));
    });
    $("phSectionTabs").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-section]");
      if (btn) setSection(+btn.dataset.section);
    });
    $("btnPhReload").addEventListener("click", () => {
      rebuildQueue();
      renderCard();
    });
    $("btnPhResetSection").addEventListener("click", () => {
      if (!confirm(`清空${SECTION_NAMES[currentSection]}的已会记录？`)) return;
      const ids = new Set(PHRASES.filter((p) => p.section === currentSection).map((p) => p.id));
      knownIds = knownIds.filter((id) => !ids.has(id));
      for (const id of ids) delete reviewSchedule[id];
      saveStore();
      rebuildQueue();
      renderCard();
    });
    $("phPhraseList").addEventListener("click", (e) => {
      const row = e.target.closest(".phrase-row");
      if (!row) return;
      const id = +row.dataset.id;
      const idx = queue.indexOf(id);
      if (idx >= 0) queueIndex = idx;
      else {
        if (!isAvailable(id)) return;
        queue.unshift(id);
        queueIndex = 0;
        sessionTotal = queue.length;
      }
      renderCard();
    });
  }

  function onShow() {
    loadStore();
    document.querySelectorAll("#phSectionTabs button").forEach((btn) => {
      btn.classList.toggle("active", +btn.dataset.section === currentSection);
    });
    rebuildQueue();
    renderCard();
  }

  function handleKeydown(e) {
    if (e.target.matches("input, textarea")) return false;
    if (e.code === "Space") {
      e.preventDefault();
      onReveal();
      return true;
    }
    if (e.key === "1") {
      onAnswer("forgot");
      return true;
    }
    if (e.key === "2") {
      onAnswer("vague");
      return true;
    }
    if (e.key === "3") {
      onAnswer("know");
      return true;
    }
    return false;
  }

  function init() {
    loadStore();
    bindEvents();
  }

  window.PhraseStudy = { init, onShow, handleKeydown };
})();
