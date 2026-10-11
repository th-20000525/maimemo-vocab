/** 考研作文短语 · 列表查阅（嵌入 index.html） */
(function () {
  const STORAGE_KEY = "phrase_memo_v3";
  const PHRASE_LIST_VERSION = 3;
  const SENTENCE_SECTION = 5;
  const PHRASES = [
    { id: 1, section: 1, en: 'adopt different ways to keep fit', zh: '采取不同方式养生/保持健康' },
    { id: 2, section: 1, en: 'pursue healthy lifestyles', zh: '追求健康的生活方式' },
    { id: 3, section: 1, en: 'the figure is growing', zh: '该数字持续上升' },
    { id: 4, section: 1, en: 'self-driving taxi', zh: '无人驾驶出租车' },
    { id: 5, section: 1, en: 'illustrate the changes in …', zh: '描述……方面的变化' },
    { id: 6, section: 1, en: 'annual order volume', zh: '年订单量' },
    { id: 7, section: 1, en: 'autonomous taxis', zh: '自动驾驶出租车（与 self-driving taxi 同义）' },
    { id: 8, section: 1, en: 'stood at + 数字', zh: '（数据）达到（静态数值）' },
    { id: 9, section: 1, en: 'kept soaring', zh: '持续激增（图表高分词，描述数据暴涨）' },
    { id: 10, section: 2, en: 'stands below a balance scale', zh: '站在天平下方' },
    { id: 11, section: 2, en: 'looking confused', zh: '面露困惑' },
    { id: 12, section: 2, en: 'on one side of the scale', zh: '在天平一端' },
    { id: 13, section: 2, en: 'a pile of books', zh: '一堆书' },
    { id: 14, section: 2, en: 'on the other (side)', zh: '在另一端' },
    { id: 15, section: 2, en: 'pulls the scale down', zh: '把天平压下去' },
    { id: 16, section: 3, en: 'light health preservation', zh: '轻养生（本篇主题词）' },
    { id: 17, section: 3, en: 'heavy workloads', zh: '繁重的工作负担' },
    { id: 18, section: 3, en: 'irregular daily routines', zh: '不规律的日常作息' },
    { id: 19, section: 3, en: 'potential health hazards', zh: '潜在的健康隐患' },
    { id: 20, section: 3, en: 'busy office workers', zh: '忙碌的上班族' },
    { id: 21, section: 3, en: 'health supplements', zh: '养生保健品' },
    { id: 22, section: 3, en: 'technological advances', zh: '技术进步' },
    { id: 23, section: 3, en: 'technological progress', zh: '科技进步（同义替换）' },
    { id: 24, section: 3, en: 'superficial remedies', zh: '表面的补救手段（高分思辨短语）' },
    { id: 25, section: 3, en: 'render sb aware of …', zh: '使某人意识到……（高分动词搭配）' },
    { id: 26, section: 3, en: 'a wide array of', zh: '各式各样的、大量的' },
    { id: 27, section: 3, en: 'enable sb to do sth', zh: '使某人能够做某事' },
    { id: 28, section: 3, en: 'take simple health measures', zh: '采取简易的养生方式' },
    { id: 29, section: 3, en: 'fall into a paradox', zh: '陷入一种矛盾（思辨加分短语）' },
    { id: 30, section: 3, en: 'stay up late', zh: '熬夜' },
    { id: 31, section: 3, en: 'overwork', zh: '过度工作，超负荷工作' },
    { id: 32, section: 3, en: 'count on sth to do sth', zh: '指望某物去做……' },
    { id: 33, section: 3, en: 'offset physical losses', zh: '弥补身体损耗' },
    { id: 34, section: 3, en: 'transform our lifestyle', zh: '改变我们的生活方式' },
    { id: 35, section: 3, en: 'alter this pattern', zh: '改变这种模式' },
    { id: 36, section: 3, en: 'cut down avoidable traffic risks', zh: '减少可避免的交通风险' },
    { id: 37, section: 3, en: 'attach great importance to …', zh: '高度重视……' },
    { id: 38, section: 3, en: 'improve life quality', zh: '提升生活质量' },
    { id: 39, section: 3, en: 'be burdened with heavy workloads', zh: '背负繁重的工作压力' },
    { id: 40, section: 3, en: 'relieve their stress', zh: '缓解压力' },
    { id: 41, section: 3, en: 'save physical energy', zh: '节省体力' },
    { id: 42, section: 3, en: 'cultivate wholesome lifestyles', zh: '培养健康的生活方式' },
    { id: 43, section: 3, en: 'rather than', zh: '而不是（跨主题万能）' },
    { id: 44, section: 3, en: 'fully appreciate the benefits', zh: '充分认识 / 享受益处' },
    { id: 45, section: 3, en: 'take initiatives to do sth', zh: '主动采取行动做某事' },
    { id: 46, section: 3, en: 'regulate this emerging industry', zh: '规范这一新兴行业' },
    { id: 47, section: 3, en: 'enrich our knowledge', zh: '丰富知识' },
    { id: 48, section: 3, en: 'translate this awareness into practical actions', zh: '将这种认知转化为实际行动' },
    { id: 49, section: 3, en: 'Several factors can account for the trend.', zh: '几个因素可以解释这一趋势', kind: "sentence" },
    { id: 50, section: 4, en: 'in their life journey', zh: '在人生旅途上' },
    { id: 51, section: 4, en: 'a dilemma', zh: '两难抉择' },
    { id: 52, section: 4, en: 'temporary entertainment', zh: '短暂的娱乐' },
    { id: 53, section: 4, en: 'transient temptation', zh: '短暂的诱惑' },
    { id: 54, section: 4, en: 'precious opportunities for self-growth', zh: '宝贵的自我成长机会' },
    { id: 55, section: 4, en: 'self-improvement', zh: '自我提升' },
    { id: 56, section: 4, en: 'knowledge and inner motivation', zh: '知识与内在动力' },
    { id: 57, section: 4, en: 'perseverance', zh: '毅力' },
    { id: 58, section: 4, en: 'future challenges', zh: '未来的挑战' },
    { id: 59, section: 4, en: 'conveys what lifestyle teenagers should choose', zh: '传达青少年应当选择何种生活方式', kind: "sentence" },
    { id: 60, section: 4, en: 'It is inevitable that …', zh: '……是不可避免的', kind: "sentence" },
    { id: 61, section: 4, en: 'face a dilemma', zh: '面临两难抉择' },
    { id: 62, section: 4, en: 'indulge in temporary entertainment', zh: '沉溺于短暂的娱乐' },
    { id: 63, section: 4, en: 'keep studying persistently', zh: '坚持学习' },
    { id: 64, section: 4, en: 'weigh the consequences', zh: '权衡后果' },
    { id: 65, section: 4, en: 'be responsible for our own life', zh: '对自己的人生负责' },
    { id: 66, section: 4, en: 'resist transient temptation', zh: '抵制短暂的诱惑' },
    { id: 67, section: 4, en: 'lose precious opportunities for self-growth', zh: '失去宝贵的自我成长机会' },
    { id: 68, section: 4, en: 'attach great importance to self-improvement', zh: '高度重视自我提升' },
    { id: 69, section: 4, en: 'stick to their goals', zh: '坚守目标' },
    { id: 70, section: 4, en: 'equip sb. with knowledge and inner motivation', zh: '赋予某人知识与内在动力' },
    { id: 71, section: 4, en: 'perseverance lays a solid foundation for…', zh: '毅力为……打下坚实基础', kind: "sentence" },
    { id: 72, section: 4, en: 'cope with future challenges', zh: '应对未来的挑战' },
    { id: 73, section: 4, en: 'indulge in mindless entertainment on mobile phones', zh: '沉迷手机上无意义的娱乐' },
  ];
  const SECTION_NAMES = {
    1: "① 图表描述",
    2: "② 图画描写",
    3: "③ 轻养生",
    4: "④ 人生哲理",
    5: "万能句型",
  };
  const SECTION_KEY = "phrase_section_v1";

  let currentSection = 1;
  let bound = false;

  const $ = (id) => document.getElementById(id);

  function phraseInSection(p, section) {
    if (section === SENTENCE_SECTION) return p.kind === "sentence";
    return p.section === section;
  }

  function phrasesForSection(section) {
    return PHRASES.filter((p) => phraseInSection(p, section));
  }

  function escapeHtml(s) {
    return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  function loadSection() {
    try {
      const n = parseInt(localStorage.getItem(SECTION_KEY), 10);
      if (n >= 1 && n <= 5) currentSection = n;
    } catch (e) {}
  }

  function saveSection() {
    localStorage.setItem(SECTION_KEY, String(currentSection));
  }

  function syncSectionTabLabels() {
    document.querySelectorAll("#phSectionTabs button[data-section]").forEach((btn) => {
      const section = +btn.dataset.section;
      const n = phrasesForSection(section).length;
      btn.textContent = `${SECTION_NAMES[section]}（${n}）`;
    });
  }

  function renderList() {
    const title = $("phListTitle");
    if (title) {
      title.textContent =
        SECTION_NAMES[currentSection] + (currentSection === SENTENCE_SECTION ? " · 完整句" : " · 短语");
    }
    const list = $("phPhraseList");
    if (!list) return;
    list.innerHTML = phrasesForSection(currentSection)
      .map(
        (p, i) =>
          `<div class="phrase-row"><div class="idx">${i + 1}</div><div><div class="en">${escapeHtml(p.en)}</div><div class="zh">${escapeHtml(p.zh)}</div></div></div>`
      )
      .join("");
  }

  function setSection(section) {
    currentSection = section;
    document.querySelectorAll("#phSectionTabs button[data-section]").forEach((btn) => {
      btn.classList.toggle("active", +btn.dataset.section === section);
    });
    saveSection();
    renderList();
  }

  function bindEvents() {
    if (bound) return;
    bound = true;
    $("phSectionTabs").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-section]");
      if (btn) setSection(+btn.dataset.section);
    });
  }

  function onShow() {
    loadSection();
    syncSectionTabLabels();
    document.querySelectorAll("#phSectionTabs button[data-section]").forEach((btn) => {
      btn.classList.toggle("active", +btn.dataset.section === currentSection);
    });
    renderList();
  }

  function init() {
    loadSection();
    bindEvents();
    syncSectionTabLabels();
  }

  function handleKeydown() {
    return false;
  }

  window.PhraseStudy = { init, onShow, handleKeydown };
})();
