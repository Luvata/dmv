(() => {
  'use strict';

  const DATA = window.DMV_DATA;
  if (!DATA) throw new Error('Không tìm thấy data.js');

  const STORAGE_KEY = 'dmv_ca_vi_progress_v1';
  const main = document.getElementById('main');
  const nav = document.getElementById('mainNav');
  const topbarTitle = document.getElementById('topbarTitle');
  const dueNavCount = document.getElementById('dueNavCount');
  const profilePercent = document.getElementById('profilePercent');
  const sidebar = document.getElementById('sidebar');
  const mobileMenu = document.getElementById('mobileMenu');
  const searchOverlay = document.getElementById('searchOverlay');
  const globalSearchInput = document.getElementById('globalSearchInput');
  const globalSearchResults = document.getElementById('globalSearchResults');
  const importProgressInput = document.getElementById('importProgressInput');

  const viewState = {
    chapterTab: 'facts',
    chapterSearch: '',
    practiceDefaults: null,
    practiceSession: null,
    examSession: null,
    examTimer: null,
    examResults: null,
  };

  let progress = loadProgress();

  function defaultProgress() {
    return {
      version: 1,
      createdAt: Date.now(),
      lastActiveDate: null,
      streak: 0,
      questions: {},
      factBookmarks: [],
      exams: [],
      totals: { answers: 0, correct: 0, practiceSessions: 0 },
      settings: { lastPracticeCount: 20, lastExamLength: 36 },
    };
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProgress();
      const saved = JSON.parse(raw);
      const base = defaultProgress();
      return {
        ...base,
        ...saved,
        questions: saved.questions || {},
        factBookmarks: Array.isArray(saved.factBookmarks) ? saved.factBookmarks : [],
        exams: Array.isArray(saved.exams) ? saved.exams : [],
        totals: { ...base.totals, ...(saved.totals || {}) },
        settings: { ...base.settings, ...(saved.settings || {}) },
      };
    } catch (error) {
      console.warn('Không thể đọc tiến độ đã lưu', error);
      return defaultProgress();
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      refreshHeaderStats();
    } catch (error) {
      toast('Không thể lưu tiến độ trên trình duyệt này.');
    }
  }

  function touchStudyDay() {
    const today = new Date().toISOString().slice(0, 10);
    if (progress.lastActiveDate === today) return;
    if (!progress.lastActiveDate) {
      progress.streak = 1;
    } else {
      const prev = new Date(progress.lastActiveDate + 'T00:00:00');
      const now = new Date(today + 'T00:00:00');
      const days = Math.round((now - prev) / 86400000);
      progress.streak = days === 1 ? (progress.streak || 0) + 1 : 1;
    }
    progress.lastActiveDate = today;
  }

  function qProgress(id) {
    if (!progress.questions[id]) {
      progress.questions[id] = {
        seen: 0,
        correct: 0,
        wrong: 0,
        lastCorrect: null,
        starred: false,
        repetitions: 0,
        interval: 0,
        ease: 2.5,
        due: 0,
        lapses: 0,
        lastReviewed: 0,
        lastRating: null,
      };
    }
    return progress.questions[id];
  }

  function recordAnswer(id, isCorrect, source = 'practice') {
    touchStudyDay();
    const p = qProgress(id);
    p.seen += 1;
    if (isCorrect) p.correct += 1;
    else p.wrong += 1;
    p.lastCorrect = Boolean(isCorrect);
    p.lastAnswered = Date.now();
    p.lastSource = source;
    progress.totals.answers += 1;
    if (isCorrect) progress.totals.correct += 1;
    saveProgress();
  }

  function scheduleQuestion(id, rating) {
    const p = qProgress(id);
    const now = Date.now();
    const day = 86400000;
    p.ease = Number.isFinite(p.ease) ? p.ease : 2.5;
    p.interval = Number.isFinite(p.interval) ? p.interval : 0;
    p.repetitions = Number.isFinite(p.repetitions) ? p.repetitions : 0;

    if (rating === 0) {
      p.repetitions = 0;
      p.interval = 10 / (24 * 60);
      p.ease = Math.max(1.3, p.ease - 0.2);
      p.lapses = (p.lapses || 0) + 1;
    } else if (rating === 1) {
      p.repetitions = Math.max(1, p.repetitions);
      p.interval = Math.max(1, Math.round((p.interval || 1) * 1.15));
      p.ease = Math.max(1.3, p.ease - 0.15);
    } else if (rating === 2) {
      p.repetitions += 1;
      if (p.repetitions === 1) p.interval = 1;
      else if (p.repetitions === 2) p.interval = 3;
      else p.interval = Math.max(4, Math.round((p.interval || 3) * p.ease));
    } else {
      p.repetitions += 1;
      p.ease = Math.min(3.2, p.ease + 0.12);
      if (p.repetitions === 1) p.interval = 3;
      else if (p.repetitions === 2) p.interval = 7;
      else p.interval = Math.max(8, Math.round((p.interval || 5) * p.ease * 1.3));
    }

    p.lastRating = rating;
    p.lastReviewed = now;
    p.due = now + p.interval * day;
    saveProgress();
  }

  function isDue(q) {
    const p = progress.questions[q.id];
    return Boolean(p && p.seen > 0 && (!p.due || p.due <= Date.now()));
  }

  function isMastered(q) {
    const p = progress.questions[q.id];
    return Boolean(p && p.seen > 0 && p.repetitions >= 3 && p.lastCorrect === true);
  }

  function overallStats() {
    const total = DATA.questions.length;
    let seen = 0, mastered = 0, due = 0, correct = 0, answered = 0;
    DATA.questions.forEach(q => {
      const p = progress.questions[q.id];
      if (!p) return;
      if (p.seen > 0) seen += 1;
      if (isMastered(q)) mastered += 1;
      if (isDue(q)) due += 1;
      correct += p.correct || 0;
      answered += p.seen || 0;
    });
    return {
      total, seen, mastered, due,
      coverage: total ? Math.round(seen / total * 100) : 0,
      mastery: total ? Math.round(mastered / total * 100) : 0,
      accuracy: answered ? Math.round(correct / answered * 100) : 0,
      answered,
    };
  }

  function chapterStats(chapterId) {
    const qs = DATA.questions.filter(q => q.chapter === Number(chapterId));
    let seen = 0, mastered = 0, due = 0, correct = 0, answered = 0, wrong = 0;
    qs.forEach(q => {
      const p = progress.questions[q.id];
      if (!p) return;
      if (p.seen > 0) seen += 1;
      if (isMastered(q)) mastered += 1;
      if (isDue(q)) due += 1;
      correct += p.correct || 0;
      wrong += p.wrong || 0;
      answered += p.seen || 0;
    });
    return {
      total: qs.length, seen, mastered, due, wrong, answered,
      coverage: qs.length ? Math.round(seen / qs.length * 100) : 0,
      mastery: qs.length ? Math.round(mastered / qs.length * 100) : 0,
      accuracy: answered ? Math.round(correct / answered * 100) : 0,
    };
  }

  function refreshHeaderStats() {
    const stats = overallStats();
    dueNavCount.textContent = stats.due;
    profilePercent.textContent = stats.coverage + '%';
  }

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalizeText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }

  function shuffle(array, random = Math.random) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function seededRandom(seed) {
    let t = Number(seed) || 1;
    return () => {
      t += 0x6D2B79F5;
      let r = t;
      r = Math.imul(r ^ r >>> 15, r | 1);
      r ^= r + Math.imul(r ^ r >>> 7, r | 61);
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }

  function weightedSample(pool, count, seed) {
    const random = seededRandom(seed);
    const weights = DATA.exam.weights;
    return pool
      .map(q => {
        const w = Number(weights[String(q.chapter)] || 1);
        const u = Math.max(random(), 0.000001);
        return { q, key: -Math.log(u) / w };
      })
      .sort((a, b) => a.key - b.key)
      .slice(0, Math.min(count, pool.length))
      .map(x => x.q);
  }

  function formatDate(timestamp) {
    if (!timestamp) return 'Chưa có';
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(timestamp));
  }

  function formatDue(timestamp) {
    if (!timestamp) return 'Chưa lên lịch';
    const delta = timestamp - Date.now();
    if (delta <= 0) return 'Đến hạn';
    const minutes = Math.round(delta / 60000);
    if (minutes < 60) return `Sau ${minutes} phút`;
    const hours = Math.round(delta / 3600000);
    if (hours < 24) return `Sau ${hours} giờ`;
    const days = Math.round(delta / 86400000);
    return `Sau ${days} ngày`;
  }

  function toast(message) {
    const region = document.getElementById('toastRegion');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    region.appendChild(el);
    window.setTimeout(() => el.remove(), 2800);
  }

  function setRoute(route) {
    const value = route.startsWith('#') ? route.slice(1) : route;
    if (location.hash.slice(1) === value) {
      renderRoute();
    } else {
      location.hash = value;
    }
    sidebar.classList.remove('open');
    mobileMenu.setAttribute('aria-expanded', 'false');
  }

  function routeParts() {
    const raw = location.hash.replace(/^#/, '') || 'dashboard';
    return raw.split('/').filter(Boolean);
  }

  function routeTitle(parts) {
    const base = parts[0];
    if (base === 'dashboard') return 'Tổng quan';
    if (base === 'chapters') return 'Học theo chương';
    if (base === 'chapter') {
      const ch = DATA.chapters.find(c => c.id === Number(parts[1]));
      return ch ? `Phần ${ch.id}: ${ch.title}` : 'Học theo chương';
    }
    if (base === 'practice') return 'Luyện tập';
    if (base === 'review') return 'Ôn đến hạn';
    if (base === 'exam') return 'Thi mô phỏng';
    if (base === 'stats') return 'Tiến độ';
    if (base === 'sources') return 'Nguồn và hiệu chỉnh';
    return 'Ôn thi DMV California';
  }

  function activeNavRoute(parts) {
    if (parts[0] === 'chapter') return 'chapters';
    return parts[0];
  }

  function updateNav(parts) {
    const active = activeNavRoute(parts);
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.route === active));
    topbarTitle.textContent = routeTitle(parts);
    document.title = `${routeTitle(parts)} | Ôn thi DMV California`;
  }

  function renderRoute() {
    stopExamTimer();
    const parts = routeParts();
    updateNav(parts);
    window.scrollTo({ top: 0, behavior: 'instant' });
    const route = parts[0];
    if (route === 'dashboard') renderDashboard();
    else if (route === 'chapters') renderChapters();
    else if (route === 'chapter') renderChapter(Number(parts[1]));
    else if (route === 'practice') renderPractice();
    else if (route === 'review') renderReview();
    else if (route === 'exam') renderExam();
    else if (route === 'stats') renderStats();
    else if (route === 'sources') renderSources();
    else setRoute('dashboard');
    refreshHeaderStats();
    main.focus({ preventScroll: true });
  }

  function renderDashboard() {
    const stats = overallStats();
    const weakest = DATA.chapters
      .map(c => ({ c, s: chapterStats(c.id) }))
      .filter(x => x.c.id !== 14)
      .sort((a, b) => (a.s.accuracy || 0) - (b.s.accuracy || 0) || a.s.seen - b.s.seen)[0];
    const recentExams = progress.exams.slice(-3).reverse();
    const suggested = weakest ? weakest.c : DATA.chapters[5];

    main.innerHTML = `
      <section class="hero">
        <div>
          <p class="eyebrow">Bộ học offline, đối chiếu nguồn DMV</p>
          <h1>Học hết sổ tay, nhớ đúng luật, vào thi không bị bất ngờ.</h1>
          <p class="lead">${DATA.meta.factCount} thẻ kiến thức trọng tâm, ${DATA.meta.questionCount} câu hỏi viết mới, toàn văn theo từng trang, thi mô phỏng và lịch ôn lặp lại ngắt quãng.</p>
          <div class="hero-actions">
            <button class="primary-button" data-route="practice">Bắt đầu luyện tập</button>
            <button class="secondary-button" data-route="exam">Làm đề mô phỏng</button>
          </div>
        </div>
        <div class="hero-side">
          <div class="hero-metric"><strong>${stats.coverage}%</strong><span>độ phủ câu hỏi</span></div>
          <div class="hero-metric"><strong>${stats.due}</strong><span>câu đến hạn ôn</span></div>
          <div class="hero-metric"><strong>${progress.streak || 0}</strong><span>ngày học liên tiếp</span></div>
        </div>
      </section>

      <section class="metric-grid" aria-label="Tóm tắt tiến độ">
        ${metricCard('Đã gặp', `${stats.seen}/${stats.total}`, 'Mục tiêu là gặp toàn bộ ngân hàng ít nhất một lần.')}
        ${metricCard('Độ chính xác', `${stats.accuracy}%`, `${stats.answered} lượt trả lời đã lưu.`)}
        ${metricCard('Đã nắm vững', `${stats.mastered}`, 'Câu được nhớ tốt qua nhiều lần ôn.')}
        ${metricCard('Điểm thi gần nhất', recentExams[0] ? `${recentExams[0].percent}%` : 'Chưa thi', recentExams[0] ? formatDate(recentExams[0].date) : 'Làm một đề để tạo mốc ban đầu.')}
      </section>

      <section class="section two-column">
        <div class="panel">
          <div class="section-head">
            <div><p class="eyebrow">Lộ trình hôm nay</p><h2>Việc nên làm tiếp theo</h2></div>
          </div>
          ${stats.due > 0 ? `
            <div class="notice warning">
              <h3>${stats.due} câu đã đến hạn</h3>
              <p>Ôn các câu này trước để củng cố đúng thời điểm.</p>
              <button class="secondary-button" data-route="review">Ôn đến hạn</button>
            </div>` : `
            <div class="notice success">
              <h3>Không có câu quá hạn</h3>
              <p>Tiếp tục mở rộng độ phủ bằng một phiên câu chưa gặp.</p>
              <button class="secondary-button" data-action="practice-unseen">Luyện câu chưa gặp</button>
            </div>`}
          <div class="divider"></div>
          <div class="chapter-card" data-route="chapter/${suggested.id}" data-chapter="${suggested.id}">
            <div class="chapter-card-top"><div class="chapter-number">${String(suggested.id).padStart(2,'0')}</div><span class="tag">Gợi ý</span></div>
            <h3>${esc(suggested.title)}</h3>
            <p>${esc(suggested.subtitle)}</p>
            <div class="progress-track"><div class="progress-fill" style="width:${chapterStats(suggested.id).coverage}%"></div></div>
            <div class="progress-meta"><span>Độ phủ ${chapterStats(suggested.id).coverage}%</span><span>Chính xác ${chapterStats(suggested.id).accuracy}%</span></div>
          </div>
        </div>
        <div class="panel">
          <p class="eyebrow">Ba điểm cần khóa</p>
          <h2>Hiệu chỉnh quan trọng</h2>
          <ul class="list-clean">
            ${DATA.meta.corrections.map(x => `<li>${esc(x)}</li>`).join('')}
          </ul>
          <div class="inline-actions" style="margin-top:16px">
            <button class="ghost-button" data-route="sources">Xem nguồn đối chiếu</button>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <div><p class="eyebrow">15 phần học</p><h2>Tiến độ theo chương</h2><p>Ưu tiên Phần 6, 7, 8 và 9 vì chứa nhiều luật và tình huống.</p></div>
          <button class="ghost-button" data-route="chapters">Xem tất cả</button>
        </div>
        <div class="chapter-grid">
          ${DATA.chapters.slice(0, 6).map(chapterCard).join('')}
        </div>
      </section>

      ${recentExams.length ? `
      <section class="section panel">
        <div class="section-head"><div><p class="eyebrow">Lịch sử gần đây</p><h2>Đề mô phỏng</h2></div><button class="ghost-button" data-route="stats">Xem tiến độ</button></div>
        <div class="history-list">${recentExams.map(examHistoryRow).join('')}</div>
      </section>` : ''}
    `;
  }

  function metricCard(label, value, note) {
    return `<div class="metric-card"><span class="metric-label">${esc(label)}</span><strong>${esc(value)}</strong><div class="metric-note">${esc(note)}</div></div>`;
  }

  function chapterCard(ch) {
    const s = chapterStats(ch.id);
    return `
      <article class="chapter-card" data-route="chapter/${ch.id}" data-chapter="${ch.id}" tabindex="0" role="button" aria-label="Mở Phần ${ch.id}">
        <div class="chapter-card-top">
          <div class="chapter-number">${String(ch.id).padStart(2, '0')}</div>
          ${ch.id === 15 ? '<span class="tag update">2026</span>' : `<span class="tag">Trang ${esc(ch.pageRange)}</span>`}
        </div>
        <h3>${esc(ch.title)}</h3>
        <p>${esc(ch.subtitle)}</p>
        <div class="progress-track"><div class="progress-fill" style="width:${s.coverage}%"></div></div>
        <div class="progress-meta"><span>${ch.facts.length} facts</span><span>${s.seen}/${s.total} câu đã gặp</span></div>
      </article>`;
  }

  function renderChapters() {
    const stats = overallStats();
    main.innerHTML = `
      <section class="section-head">
        <div><p class="eyebrow">Học theo chương</p><h1>Đi từ nền tảng đến tình huống thi</h1><p class="lead">Mỗi phần có facts trọng tâm, toàn văn đã bóc tách theo trang, hình chính thức và câu hỏi riêng.</p></div>
      </section>
      <section class="metric-grid">
        ${metricCard('Tổng facts trọng tâm', DATA.meta.factCount, 'Kèm toàn văn nguồn theo từng trang.')}
        ${metricCard('Tổng câu hỏi', DATA.meta.questionCount, 'Ba lựa chọn, một đáp án đúng.')}
        ${metricCard('Đã gặp', `${stats.seen}/${stats.total}`, 'Tiến độ được lưu ngay trên thiết bị.')}
        ${metricCard('Đến hạn hôm nay', stats.due, 'Do hệ thống lặp lại ngắt quãng tính toán.')}
      </section>
      <section class="section">
        <div class="chapter-grid">${DATA.chapters.map(chapterCard).join('')}</div>
      </section>`;
  }

  function renderChapter(id) {
    const ch = DATA.chapters.find(c => c.id === id);
    if (!ch) return setRoute('chapters');
    const s = chapterStats(id);
    const tabs = [
      ['facts', `Facts trọng tâm (${ch.facts.length})`],
      ['source', 'Toàn văn theo trang'],
      ['questions', `Câu hỏi (${ch.questionCount})`],
      ['images', `Hình (${ch.images.length})`],
    ];
    if (!tabs.some(t => t[0] === viewState.chapterTab)) viewState.chapterTab = 'facts';

    main.innerHTML = `
      <button class="ghost-button" data-route="chapters" style="margin-bottom:16px">Quay lại danh sách chương</button>
      <section class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Phần ${id} · ${id === 15 ? 'Nguồn web DMV' : `Trang ${ch.pageRange}`}</p>
            <h1>${esc(ch.title)}</h1>
            <p class="lead">${esc(ch.subtitle)}</p>
          </div>
          <div class="inline-actions">
            <button class="primary-button" data-action="practice-chapter" data-chapter="${id}">Luyện phần này</button>
            <button class="ghost-button" data-action="exam-chapter" data-chapter="${id}">Đề riêng phần</button>
          </div>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${s.coverage}%"></div></div>
        <div class="progress-meta"><span>Độ phủ ${s.coverage}%</span><span>Chính xác ${s.accuracy}%</span><span>${s.due} câu đến hạn</span></div>
      </section>

      ${id === 8 ? `<div class="notice warning section"><h3>Hiệu chỉnh bản dịch</h3><p>Khoảng cách theo sau xe mô tô trong điều kiện tốt là ít nhất <strong>3 giây</strong>. Một dòng trong PDF tiếng Việt ghi 4 giây; bộ học dùng bản tiếng Anh chính thức làm nguồn kiểm soát.</p></div>` : ''}
      ${id === 15 ? `<div class="notice info section"><h3>Cập nhật sau bản PDF tháng 6 năm 2025</h3><p>Phần này giữ các thay đổi có liên quan trực tiếp đến kiến thức lái xe tính đến ngày ${esc(DATA.meta.verifiedDate)}.</p></div>` : ''}

      <section class="section panel">
        <div class="tabs" role="tablist">
          ${tabs.map(([key,label]) => `<button class="tab-button ${viewState.chapterTab === key ? 'active' : ''}" data-action="chapter-tab" data-tab="${key}" role="tab" aria-selected="${viewState.chapterTab === key}">${esc(label)}</button>`).join('')}
        </div>
        <div id="chapterTabContent" style="margin-top:20px">${renderChapterTab(ch)}</div>
      </section>`;
  }

  function renderChapterTab(ch) {
    if (viewState.chapterTab === 'source') return renderSourcePages(ch);
    if (viewState.chapterTab === 'questions') return renderChapterQuestions(ch);
    if (viewState.chapterTab === 'images') return renderChapterImages(ch);
    return renderChapterFacts(ch);
  }

  function renderChapterFacts(ch) {
    const needle = normalizeText(viewState.chapterSearch);
    const facts = needle ? ch.facts.filter(f => normalizeText(`${f.text} ${f.tags.join(' ')}`).includes(needle)) : ch.facts;
    return `
      <div class="toolbar">
        <label class="search-inline"><span class="sr-only">Tìm trong facts</span><input class="input" id="chapterFactSearch" value="${esc(viewState.chapterSearch)}" placeholder="Tìm trong phần này"></label>
        <span class="muted small">${facts.length}/${ch.facts.length} facts</span>
      </div>
      <div class="notice info" style="margin-bottom:14px"><strong>Cách dùng:</strong> Học facts trọng tâm trước, sau đó mở tab Toàn văn để kiểm tra mọi chi tiết của nguồn.</div>
      <div class="fact-list" id="factList">
        ${facts.length ? facts.map(factCard).join('') : '<div class="empty-state"><h3>Không thấy kết quả</h3><p>Thử từ khóa khác.</p></div>'}
      </div>`;
  }

  function factCard(f) {
    const bookmarked = progress.factBookmarks.includes(f.id);
    return `
      <article class="fact-card" data-fact-id="${f.id}">
        <div class="fact-card-head">
          <p>${esc(f.text)}</p>
          <div class="fact-actions"><button class="mini-button ${bookmarked ? 'active' : ''}" data-action="bookmark-fact" data-fact="${f.id}">${bookmarked ? 'Đã lưu' : 'Lưu'}</button></div>
        </div>
        ${f.note ? `<div class="notice warning" style="margin-top:12px;padding:10px 12px"><span class="small">${esc(f.note)}</span></div>` : ''}
        <div class="fact-meta">
          <span>Trang ${esc(f.page)}</span>
          ${f.priority >= 3 ? '<span class="tag priority">Khả năng thi cao</span>' : ''}
          ${f.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}
        </div>
      </article>`;
  }

  function renderSourcePages(ch) {
    return `
      <div class="notice warning" style="margin-bottom:14px"><strong>Toàn văn nguồn:</strong> Phần này giữ nội dung đã trích từ từng trang để bạn kiểm tra chi tiết. Bản tiếng Anh chính thức của DMV kiểm soát khi có khác biệt dịch thuật.</div>
      ${ch.sourcePages.map((p, i) => `
        <details class="source-page" ${i === 0 ? 'open' : ''}>
          <summary><span>${p.printedPage === 'DMV 2026' ? 'Nguồn cập nhật DMV năm 2026' : `Trang sổ tay ${esc(p.printedPage)}`}</span><span class="muted small">${p.pdfPage ? `Trang PDF ${p.pdfPage}` : ''}</span></summary>
          <div class="source-text">${esc(p.text)}</div>
        </details>`).join('')}`;
  }

  function renderChapterQuestions(ch) {
    const qs = DATA.questions.filter(q => q.chapter === ch.id);
    return `
      <div class="section-head"><div><h2>${qs.length} câu trong phần này</h2><p>Danh sách chỉ hiện câu hỏi và trạng thái. Đáp án được giữ kín cho đến khi luyện.</p></div><button class="primary-button" data-action="practice-chapter" data-chapter="${ch.id}">Bắt đầu</button></div>
      <div class="fact-list">
        ${qs.map((q, i) => {
          const p = progress.questions[q.id];
          const state = !p ? 'Chưa gặp' : isMastered(q) ? 'Đã nắm vững' : isDue(q) ? 'Đến hạn' : `Đã làm ${p.seen} lần`;
          return `<div class="fact-card"><div class="fact-card-head"><p><strong>${i + 1}.</strong> ${esc(q.prompt)}</p><span class="tag">${esc(state)}</span></div><div class="fact-meta"><span>Trang ${esc(q.page)}</span>${q.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>`;
        }).join('')}
      </div>`;
  }

  function renderChapterImages(ch) {
    if (!ch.images.length) return `<div class="empty-state"><h3>Phần này không cần hình riêng</h3><p>Các biển báo và sơ đồ quan trọng tập trung ở Phần 6 và Phần 7.</p></div>`;
    return `<div class="image-grid">${ch.images.map(img => `<figure class="figure-card"><img src="${esc(img.src)}" alt="${esc(img.alt)}" loading="lazy"><figcaption>${esc(img.caption)}</figcaption></figure>`).join('')}</div>`;
  }

  function renderPractice() {
    if (viewState.practiceSession) return renderPracticeQuestion();
    renderPracticeSetup(false);
  }

  function renderReview() {
    const due = DATA.questions.filter(isDue);
    if (viewState.practiceSession && viewState.practiceSession.type === 'review') return renderPracticeQuestion();
    main.innerHTML = `
      <section class="section-head"><div><p class="eyebrow">Lặp lại ngắt quãng</p><h1>Ôn đúng câu, đúng thời điểm</h1><p class="lead">Câu trả lời “Quên” quay lại sớm. Câu “Dễ” được giãn lịch lâu hơn.</p></div></section>
      <section class="panel">
        ${due.length ? `
          <div class="two-column">
            <div><p class="eyebrow">Hàng đợi hôm nay</p><h2>${due.length} câu đến hạn</h2><p class="muted">Ưu tiên câu từng sai và câu có khoảng lặp ngắn.</p><button class="primary-button" data-action="start-review">Bắt đầu ôn ${Math.min(due.length, 40)} câu</button></div>
            <div>${metricCard('Câu quá hạn', due.length, 'Lịch được lưu trong trình duyệt.')}</div>
          </div>` : `
          <div class="empty-state"><h3>Không có câu đến hạn</h3><p>Bạn có thể luyện câu chưa gặp để mở rộng bộ nhớ.</p><button class="primary-button" data-action="practice-unseen">Luyện câu chưa gặp</button></div>`}
      </section>
      <section class="section panel">
        <h2>Cơ chế lịch ôn</h2>
        <div class="three-column" style="margin-top:14px">
          <div class="notice danger"><h3>Quên</h3><p>Quay lại sau khoảng 10 phút.</p></div>
          <div class="notice warning"><h3>Khó</h3><p>Khoảng lặp ngắn, tăng chậm.</p></div>
          <div class="notice success"><h3>Đúng hoặc Dễ</h3><p>Khoảng lặp tăng từ ngày sang tuần.</p></div>
        </div>
      </section>`;
  }

  function renderPracticeSetup(reviewOnly) {
    const defaults = viewState.practiceDefaults || {};
    const selected = new Set(defaults.chapters || DATA.chapters.map(c => c.id));
    const mode = defaults.mode || (reviewOnly ? 'due' : 'mixed');
    const count = defaults.count || progress.settings.lastPracticeCount || 20;
    main.innerHTML = `
      <section class="section-head">
        <div><p class="eyebrow">Luyện tập có giải thích</p><h1>Chọn đúng phần bạn cần cày</h1><p class="lead">Mỗi câu hiện đáp án ngay, giải thích, trang nguồn và nút tự đánh giá để lên lịch ôn.</p></div>
      </section>
      <section class="setup-layout">
        <div class="setup-card">
          <div class="form-group">
            <label>Loại câu hỏi</label>
            <div class="option-grid">
              ${practiceModeOption('mixed','Thông minh','Ưu tiên đến hạn, từng sai và chưa gặp',mode)}
              ${practiceModeOption('due','Đến hạn','Chỉ câu đã đến lịch ôn',mode)}
              ${practiceModeOption('unseen','Chưa gặp','Mở rộng độ phủ ngân hàng',mode)}
              ${practiceModeOption('wrong','Từng sai','Tập trung các điểm yếu',mode)}
              ${practiceModeOption('random','Ngẫu nhiên','Lấy đều từ phần đã chọn',mode)}
              ${practiceModeOption('starred','Đã đánh dấu','Chỉ câu bạn đã gắn sao',mode)}
            </div>
          </div>
          <div class="form-group">
            <label for="practiceCount">Số câu</label>
            <select id="practiceCount">
              ${[10,20,40,80,261].map(n => `<option value="${n}" ${Number(count) === n ? 'selected' : ''}>${n === 261 ? 'Tất cả câu phù hợp' : `${n} câu`}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <div class="form-label">Chọn chương</div>
            <div class="select-actions"><button class="mini-button" data-action="select-all-chapters">Chọn tất cả</button><button class="mini-button" data-action="clear-all-chapters">Bỏ tất cả</button><button class="mini-button" data-action="select-core-chapters">Chọn Phần 6 đến 10</button></div>
            <div class="checkbox-list" id="practiceChapterList">
              ${DATA.chapters.map(ch => `<label class="check-row"><input type="checkbox" name="practiceChapter" value="${ch.id}" ${selected.has(ch.id) ? 'checked' : ''}><span><strong>Phần ${ch.id}: ${esc(ch.title)}</strong><small>${ch.questionCount} câu · ${ch.facts.length} facts</small></span></label>`).join('')}
            </div>
          </div>
          <button class="primary-button" data-action="start-practice">Tạo phiên luyện</button>
        </div>
        <aside class="setup-card">
          <p class="eyebrow">Cách làm hiệu quả</p>
          <h3>Đọc giải thích kể cả khi trả lời đúng</h3>
          <p class="muted small">Sau mỗi câu, chọn Quên, Khó, Đúng hoặc Dễ dựa trên mức độ nhớ thật. Đừng chọn Dễ chỉ vì vừa nhìn thấy đáp án.</p>
          <div class="notice info"><strong>Điểm đạt DMV:</strong> 80%. Trong luyện tập, hãy nhắm ít nhất 90% ở Phần 6 đến 10 để có dư địa an toàn.</div>
        </aside>
      </section>`;
  }

  function practiceModeOption(value, title, description, selected) {
    return `<div class="option-card"><input id="mode-${value}" type="radio" name="practiceMode" value="${value}" ${selected === value ? 'checked' : ''}><label for="mode-${value}"><strong>${esc(title)}</strong><small class="muted" style="display:block;margin-top:3px">${esc(description)}</small></label></div>`;
  }

  function collectPracticeConfig() {
    const chapters = Array.from(document.querySelectorAll('input[name="practiceChapter"]:checked')).map(x => Number(x.value));
    const mode = document.querySelector('input[name="practiceMode"]:checked')?.value || 'mixed';
    const count = Number(document.getElementById('practiceCount')?.value || 20);
    return { chapters, mode, count };
  }

  function startPractice(config, type = 'practice') {
    let pool = DATA.questions.filter(q => config.chapters.includes(q.chapter));
    if (config.mode === 'due') pool = pool.filter(isDue);
    else if (config.mode === 'unseen') pool = pool.filter(q => !progress.questions[q.id]?.seen);
    else if (config.mode === 'wrong') pool = pool.filter(q => (progress.questions[q.id]?.wrong || 0) > 0);
    else if (config.mode === 'starred') pool = pool.filter(q => progress.questions[q.id]?.starred);
    else if (config.mode === 'mixed') {
      pool = pool.slice().sort((a, b) => {
        const pa = progress.questions[a.id];
        const pb = progress.questions[b.id];
        const score = (q, p) => (isDue(q) ? 0 : p?.lastCorrect === false ? 1 : !p?.seen ? 2 : 3) + Math.random() * .2;
        return score(a, pa) - score(b, pb);
      });
    } else pool = shuffle(pool);

    if (config.mode !== 'mixed') pool = shuffle(pool);
    const count = Math.min(config.count, pool.length);
    if (!count) {
      toast('Không có câu phù hợp với bộ lọc này.');
      return;
    }
    progress.settings.lastPracticeCount = config.count;
    progress.totals.practiceSessions += 1;
    saveProgress();
    viewState.practiceSession = {
      type,
      ids: pool.slice(0, count).map(q => q.id),
      index: 0,
      results: [],
      answered: false,
      selected: null,
      ratingApplied: false,
      startedAt: Date.now(),
    };
    viewState.practiceDefaults = null;
    if (type === 'review') setRoute('review');
    else setRoute('practice');
  }

  function renderPracticeQuestion() {
    const session = viewState.practiceSession;
    if (!session || session.index >= session.ids.length) return renderPracticeSummary();
    const q = DATA.questions.find(x => x.id === session.ids[session.index]);
    const ch = DATA.chapters.find(c => c.id === q.chapter);
    const p = qProgress(q.id);
    const answered = session.answered;
    const selected = session.selected;
    const isCorrect = answered && selected === q.answer;

    main.innerHTML = `
      <div class="quiz-shell">
        <div class="quiz-top">
          <button class="ghost-button" data-action="quit-practice">Thoát</button>
          <div class="quiz-progress">
            <div class="progress-track"><div class="progress-fill" style="width:${Math.round((session.index + (answered ? 1 : 0)) / session.ids.length * 100)}%"></div></div>
            <div class="progress-meta"><span>Câu ${session.index + 1}/${session.ids.length}</span><span>${session.results.filter(x => x.correct).length} đúng</span></div>
          </div>
          <button class="ghost-button ${p.starred ? 'active' : ''}" data-action="star-question" data-question="${q.id}">${p.starred ? 'Đã đánh dấu' : 'Đánh dấu'}</button>
        </div>
        <article class="quiz-card">
          <div class="question-meta"><span class="tag">Phần ${q.chapter}</span><span>${esc(ch.title)}</span><span>Trang ${esc(q.page)}</span>${isDue(q) ? '<span class="tag priority">Đến hạn</span>' : ''}</div>
          ${q.image ? `<img class="question-image" src="${esc(q.image)}" alt="Hình dùng cho câu hỏi">` : ''}
          <h2 class="question-title">${esc(q.prompt)}</h2>
          <div class="choice-list">
            ${q.choices.map((choice, idx) => {
              let cls = '';
              if (answered && idx === q.answer) cls = 'correct';
              else if (answered && idx === selected && idx !== q.answer) cls = 'incorrect';
              return `<button class="choice-button ${cls}" data-action="answer-practice" data-index="${idx}" ${answered ? 'disabled' : ''}><span class="choice-letter">${'ABC'[idx]}</span><span>${esc(choice)}</span></button>`;
            }).join('')}
          </div>
          ${answered ? `
            <div class="feedback-box ${isCorrect ? 'correct' : 'incorrect'}">
              <h3>${isCorrect ? 'Chính xác' : 'Chưa đúng'}</h3>
              <p>${esc(q.explanation)}</p>
              <p class="source-line">Nguồn: ${q.sourceType === 'dmv_web' ? 'DMV web hiện hành' : q.sourceType === 'handbook_correction' ? 'Đối chiếu bản tiếng Anh chính thức' : 'Sổ tay DMV'}, ${q.page === 'DMV 2026' ? 'cập nhật 2026' : `trang ${esc(q.page)}`}.</p>
            </div>
            <div class="rating-box">
              <p>Bạn nhớ câu này ở mức nào?</p>
              <div class="rating-row">
                ${ratingButton(0, 'Quên', '10 phút', session.ratingApplied)}
                ${ratingButton(1, 'Khó', '1 ngày', session.ratingApplied)}
                ${ratingButton(2, 'Đúng', '1 đến 3 ngày', session.ratingApplied)}
                ${ratingButton(3, 'Dễ', '3 đến 7 ngày', session.ratingApplied)}
              </div>
            </div>` : ''}
          <div class="quiz-footer">
            <span class="muted small">${p.seen ? `Đã làm ${p.seen} lần · Lịch hiện tại: ${formatDue(p.due)}` : 'Câu chưa từng gặp'}</span>
            ${answered ? `<button class="primary-button" data-action="next-practice">${session.index + 1 === session.ids.length ? 'Xem kết quả' : 'Câu tiếp theo'}</button>` : '<span class="muted small">Chọn một đáp án</span>'}
          </div>
        </article>
      </div>`;
  }

  function ratingButton(value, label, hint, disabled) {
    return `<button class="rating-button" data-action="rate-question" data-rating="${value}" ${disabled ? 'disabled' : ''}>${esc(label)}<small style="display:block;font-weight:500;margin-top:2px">${esc(hint)}</small></button>`;
  }

  function answerPractice(index) {
    const session = viewState.practiceSession;
    if (!session || session.answered) return;
    const q = DATA.questions.find(x => x.id === session.ids[session.index]);
    session.selected = Number(index);
    session.answered = true;
    const correct = session.selected === q.answer;
    session.results.push({ id: q.id, selected: session.selected, correct });
    recordAnswer(q.id, correct, session.type);
    renderPracticeQuestion();
  }

  function rateCurrentQuestion(rating) {
    const session = viewState.practiceSession;
    if (!session || !session.answered || session.ratingApplied) return;
    const q = DATA.questions.find(x => x.id === session.ids[session.index]);
    scheduleQuestion(q.id, Number(rating));
    session.ratingApplied = true;
    renderPracticeQuestion();
  }

  function nextPractice() {
    const session = viewState.practiceSession;
    if (!session || !session.answered) return;
    if (!session.ratingApplied) {
      const result = session.results[session.results.length - 1];
      const q = DATA.questions.find(x => x.id === session.ids[session.index]);
      scheduleQuestion(q.id, result.correct ? 2 : 0);
    }
    session.index += 1;
    session.answered = false;
    session.selected = null;
    session.ratingApplied = false;
    if (session.index >= session.ids.length) renderPracticeSummary();
    else renderPracticeQuestion();
  }

  function renderPracticeSummary() {
    const session = viewState.practiceSession;
    if (!session) return renderPracticeSetup(false);
    const total = session.results.length;
    const correct = session.results.filter(x => x.correct).length;
    const percent = total ? Math.round(correct / total * 100) : 0;
    const wrongIds = session.results.filter(x => !x.correct).map(x => x.id);
    main.innerHTML = `
      <section class="result-hero ${percent >= 80 ? 'pass' : 'fail'}">
        <p class="eyebrow">Hoàn tất phiên ${session.type === 'review' ? 'ôn đến hạn' : 'luyện tập'}</p>
        <div class="result-score">${percent}%</div>
        <h1>${percent >= 90 ? 'Rất chắc' : percent >= 80 ? 'Đạt mốc 80%' : 'Cần ôn lại điểm yếu'}</h1>
        <p>${correct}/${total} câu đúng. Lịch ôn mới đã được lưu cho từng câu.</p>
        <div class="inline-actions" style="justify-content:center;margin-top:20px">
          ${wrongIds.length ? '<button class="secondary-button" data-action="retry-wrong-session">Làm lại câu sai</button>' : ''}
          <button class="primary-button" data-action="new-practice">Tạo phiên mới</button>
          <button class="ghost-button" data-route="dashboard">Về tổng quan</button>
        </div>
      </section>
      ${wrongIds.length ? `<section class="section panel"><p class="eyebrow">Cần xem lại</p><h2>${wrongIds.length} câu sai</h2><div class="fact-list" style="margin-top:14px">${wrongIds.map(id => {
        const q = DATA.questions.find(x => x.id === id);
        return `<div class="fact-card"><p>${esc(q.prompt)}</p><div class="fact-meta"><span>Phần ${q.chapter}</span><span>Trang ${esc(q.page)}</span></div></div>`;
      }).join('')}</div></section>` : ''}`;
    session.summaryWrongIds = wrongIds;
  }

  function renderExam() {
    if (viewState.examResults) return renderExamResults();
    if (viewState.examSession) return renderExamQuestion();
    renderExamSetup();
  }

  function renderExamSetup() {
    const defaultLength = progress.settings.lastExamLength || DATA.exam.defaultLength;
    main.innerHTML = `
      <section class="section-head"><div><p class="eyebrow">Thi mô phỏng</p><h1>Ba lựa chọn, một đáp án, không hiện lời giải giữa chừng</h1><p class="lead">Đề được lấy có trọng số từ toàn bộ ngân hàng, ưu tiên luật giao thông và lái xe an toàn. Mốc đạt là 80%.</p></div></section>
      <div class="notice warning"><strong>Lưu ý:</strong> Đây là đề mô phỏng viết mới từ nguồn DMV công khai, không phải đề thật bị rò rỉ. Số câu thực tế có thể thay đổi theo hồ sơ và hình thức thi.</div>
      <section class="setup-layout section">
        <div class="setup-card">
          <div class="form-group"><label>Độ dài đề</label><div class="option-grid">
            ${DATA.exam.lengthOptions.map(n => `<div class="option-card"><input id="exam-len-${n}" type="radio" name="examLength" value="${n}" ${Number(defaultLength) === n ? 'checked' : ''}><label for="exam-len-${n}"><strong>${n} câu</strong><small class="muted" style="display:block">Cần ${Math.ceil(n * .8)} câu đúng để đạt 80%</small></label></div>`).join('')}
          </div></div>
          <div class="form-group"><label for="examPreset">Bộ đề</label><select id="examPreset"><option value="random">Ngẫu nhiên mới</option>${Array.from({length:DATA.exam.presetCount},(_,i)=>`<option value="${i+1}">Đề cố định ${i+1}</option>`).join('')}</select></div>
          <div class="form-group"><div class="form-label">Phạm vi chương</div><div class="select-actions"><button class="mini-button" data-action="select-all-exam-chapters">Chọn tất cả</button><button class="mini-button" data-action="select-core-exam-chapters">Phần 6 đến 10</button></div><div class="checkbox-list" id="examChapterList">${DATA.chapters.map(ch => `<label class="check-row"><input type="checkbox" name="examChapter" value="${ch.id}" checked><span><strong>Phần ${ch.id}: ${esc(ch.title)}</strong><small>${ch.questionCount} câu</small></span></label>`).join('')}</div></div>
          <button class="primary-button" data-action="start-exam">Bắt đầu đề thi</button>
        </div>
        <aside class="setup-card">
          <p class="eyebrow">Quy tắc phiên thi</p>
          <ul class="list-clean small">
            <li>Không hiện đáp án cho đến khi nộp bài.</li>
            <li>Có thể đánh dấu câu để quay lại.</li>
            <li>Đồng hồ chỉ đo thời gian đã dùng, không ép giới hạn.</li>
            <li>Kết quả tự đưa câu sai vào lịch ôn.</li>
          </ul>
          <div class="notice info" style="margin-top:15px">${esc(DATA.exam.note)}</div>
        </aside>
      </section>`;
  }

  function startExam() {
    const chapters = Array.from(document.querySelectorAll('input[name="examChapter"]:checked')).map(x => Number(x.value));
    const length = Number(document.querySelector('input[name="examLength"]:checked')?.value || 36);
    const preset = document.getElementById('examPreset')?.value || 'random';
    if (!chapters.length) return toast('Hãy chọn ít nhất một chương.');
    const pool = DATA.questions.filter(q => chapters.includes(q.chapter));
    if (!pool.length) return toast('Không có câu trong phạm vi đã chọn.');
    const seed = preset === 'random' ? Date.now() : 202600 + Number(preset);
    const questions = weightedSample(pool, length, seed);
    progress.settings.lastExamLength = length;
    saveProgress();
    viewState.examSession = {
      ids: questions.map(q => q.id),
      index: 0,
      answers: {},
      flags: {},
      startedAt: Date.now(),
      preset,
      seed,
      chapters,
    };
    viewState.examResults = null;
    renderExamQuestion();
  }

  function renderExamQuestion() {
    const session = viewState.examSession;
    if (!session) return renderExamSetup();
    const q = DATA.questions.find(x => x.id === session.ids[session.index]);
    const ch = DATA.chapters.find(c => c.id === q.chapter);
    const selected = session.answers[q.id];
    main.innerHTML = `
      <section class="exam-layout">
        <div>
          <div class="quiz-top">
            <button class="ghost-button" data-action="quit-exam">Thoát đề</button>
            <div class="quiz-progress"><div class="progress-track"><div class="progress-fill" style="width:${Object.keys(session.answers).length / session.ids.length * 100}%"></div></div><div class="progress-meta"><span>Câu ${session.index + 1}/${session.ids.length}</span><span>${Object.keys(session.answers).length} đã trả lời</span></div></div>
            <button class="ghost-button flag-button ${session.flags[q.id] ? 'active' : ''}" data-action="toggle-flag">${session.flags[q.id] ? 'Đã đánh dấu' : 'Đánh dấu'}</button>
          </div>
          <article class="quiz-card">
            <div class="question-meta"><span class="tag">Phần ${q.chapter}</span><span>${esc(ch.title)}</span></div>
            ${q.image ? `<img class="question-image" src="${esc(q.image)}" alt="Hình dùng cho câu hỏi">` : ''}
            <h2 class="question-title">${esc(q.prompt)}</h2>
            <div class="choice-list">${q.choices.map((choice,idx)=>`<button class="choice-button ${selected === idx ? 'selected' : ''}" data-action="answer-exam" data-index="${idx}"><span class="choice-letter">${'ABC'[idx]}</span><span>${esc(choice)}</span></button>`).join('')}</div>
            <div class="quiz-footer">
              <button class="ghost-button" data-action="exam-prev" ${session.index === 0 ? 'disabled' : ''}>Câu trước</button>
              <button class="primary-button" data-action="exam-next">${session.index === session.ids.length - 1 ? 'Xem lại và nộp' : 'Câu tiếp theo'}</button>
            </div>
          </article>
        </div>
        <aside class="setup-card exam-side">
          <p class="eyebrow">Thời gian đã dùng</p><div class="exam-clock" id="examClock">00:00</div>
          <div class="progress-meta"><span>${Object.keys(session.answers).length}/${session.ids.length} đã trả lời</span><span>${Object.values(session.flags).filter(Boolean).length} đánh dấu</span></div>
          <div class="exam-palette">${session.ids.map((id,i)=>`<button class="palette-button ${session.answers[id] !== undefined ? 'answered' : ''} ${session.flags[id] ? 'flagged' : ''} ${i === session.index ? 'current' : ''}" data-action="exam-jump" data-index="${i}">${i+1}</button>`).join('')}</div>
          <button class="primary-button" style="width:100%;margin-top:16px" data-action="submit-exam">Nộp bài</button>
        </aside>
      </section>`;
    startExamTimer();
  }

  function startExamTimer() {
    stopExamTimer();
    const update = () => {
      const el = document.getElementById('examClock');
      if (!el || !viewState.examSession) return;
      const seconds = Math.floor((Date.now() - viewState.examSession.startedAt) / 1000);
      const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
      const ss = String(seconds % 60).padStart(2, '0');
      el.textContent = `${mm}:${ss}`;
    };
    update();
    viewState.examTimer = window.setInterval(update, 1000);
  }

  function stopExamTimer() {
    if (viewState.examTimer) window.clearInterval(viewState.examTimer);
    viewState.examTimer = null;
  }

  function submitExam() {
    const session = viewState.examSession;
    if (!session) return;
    const unanswered = session.ids.length - Object.keys(session.answers).length;
    if (unanswered && !window.confirm(`Bạn còn ${unanswered} câu chưa trả lời. Vẫn nộp bài?`)) return;
    stopExamTimer();
    const details = session.ids.map(id => {
      const q = DATA.questions.find(x => x.id === id);
      const selected = session.answers[id];
      return { id, selected, correct: selected === q.answer };
    });
    const correct = details.filter(x => x.correct).length;
    const percent = Math.round(correct / details.length * 100);
    const duration = Math.round((Date.now() - session.startedAt) / 1000);
    details.forEach(item => {
      recordAnswer(item.id, item.correct, 'exam');
      scheduleQuestion(item.id, item.correct ? 2 : 0);
    });
    const record = {
      date: Date.now(), length: details.length, correct, percent, duration,
      preset: session.preset, chapters: session.chapters,
    };
    progress.exams.push(record);
    progress.exams = progress.exams.slice(-100);
    saveProgress();
    viewState.examResults = { ...record, details };
    viewState.examSession = null;
    renderExamResults();
  }

  function renderExamResults() {
    const result = viewState.examResults;
    if (!result) return renderExamSetup();
    const pass = result.percent >= DATA.exam.passPercent;
    const wrong = result.details.filter(x => !x.correct);
    main.innerHTML = `
      <section class="result-hero ${pass ? 'pass' : 'fail'}">
        <p class="eyebrow">Kết quả đề mô phỏng</p>
        <div class="result-score">${result.percent}%</div>
        <h1>${pass ? 'Đạt mốc 80%' : 'Chưa đạt mốc 80%'}</h1>
        <p>${result.correct}/${result.length} câu đúng, thời gian ${Math.floor(result.duration/60)} phút ${result.duration%60} giây. ${pass ? 'Hãy tiếp tục đẩy các chương yếu lên trên 90%.' : 'Ôn lại câu sai rồi làm đề khác.'}</p>
        <div class="inline-actions" style="justify-content:center;margin-top:20px"><button class="primary-button" data-action="new-exam">Làm đề khác</button>${wrong.length ? '<button class="secondary-button" data-action="practice-exam-wrong">Luyện câu sai</button>' : ''}<button class="ghost-button" data-route="stats">Xem tiến độ</button></div>
      </section>
      <section class="metric-grid">
        ${metricCard('Đúng', result.correct, `${result.length - result.correct} câu sai hoặc bỏ trống.`)}
        ${metricCard('Mốc đạt', `${Math.ceil(result.length*.8)}/${result.length}`, 'DMV công bố điểm đạt 80%.')}
        ${metricCard('Thời gian', `${Math.floor(result.duration/60)}:${String(result.duration%60).padStart(2,'0')}`, 'Không có đồng hồ đếm ngược trong mô phỏng này.')}
        ${metricCard('Câu cần ôn', wrong.length, 'Đã tự đưa vào lịch ôn sớm.')}
      </section>
      <section class="section panel">
        <div class="section-head"><div><p class="eyebrow">Xem lại toàn bộ</p><h2>Đáp án và giải thích</h2></div></div>
        ${result.details.map((item,i) => {
          const q = DATA.questions.find(x => x.id === item.id);
          const selectedText = item.selected === undefined ? 'Bỏ trống' : q.choices[item.selected];
          return `<article class="review-item"><h4>${i+1}. ${esc(q.prompt)}</h4><div class="answer-line ${item.correct ? 'good' : 'bad'}">Bạn chọn: ${esc(selectedText)}</div>${!item.correct ? `<div class="answer-line good">Đáp án đúng: ${esc(q.choices[q.answer])}</div>` : ''}<p class="small muted" style="margin:10px 0 0">${esc(q.explanation)} · Nguồn: ${q.page === 'DMV 2026' ? 'DMV 2026' : `trang ${esc(q.page)}`}.</p></article>`;
        }).join('')}
      </section>`;
    result.wrongIds = wrong.map(x => x.id);
  }

  function renderStats() {
    const s = overallStats();
    const rows = DATA.chapters.map(ch => ({ ch, s: chapterStats(ch.id) }));
    main.innerHTML = `
      <section class="section-head"><div><p class="eyebrow">Tiến độ được lưu trên thiết bị</p><h1>Biết rõ phần nào đã chắc, phần nào còn hổng</h1><p class="lead">Dữ liệu không rời khỏi trình duyệt trừ khi bạn tự xuất tệp sao lưu.</p></div></section>
      <section class="metric-grid">
        ${metricCard('Độ phủ', `${s.coverage}%`, `${s.seen}/${s.total} câu đã gặp.`)}
        ${metricCard('Độ chính xác', `${s.accuracy}%`, `${s.answered} lượt trả lời.`)}
        ${metricCard('Nắm vững', `${s.mastered}`, 'Đúng qua nhiều vòng lặp lại.')}
        ${metricCard('Chuỗi học', `${progress.streak || 0} ngày`, progress.lastActiveDate ? `Lần gần nhất ${progress.lastActiveDate}` : 'Chưa có phiên học.')}
      </section>
      <section class="section panel">
        <div class="section-head"><div><p class="eyebrow">Theo chương</p><h2>Độ phủ và chính xác</h2></div></div>
        <div style="overflow-x:auto"><table class="stat-table"><thead><tr><th>Chương</th><th>Đã gặp</th><th>Chính xác</th><th>Nắm vững</th><th>Đến hạn</th><th></th></tr></thead><tbody>${rows.map(({ch,s})=>`<tr><td><strong>Phần ${ch.id}</strong><br><span class="muted">${esc(ch.title)}</span></td><td><div class="mastery-bar"><div class="progress-track"><div class="progress-fill" style="width:${s.coverage}%"></div></div><span class="small muted">${s.seen}/${s.total}</span></div></td><td>${s.accuracy}%</td><td>${s.mastered}</td><td>${s.due}</td><td><button class="mini-button" data-route="chapter/${ch.id}">Mở</button></td></tr>`).join('')}</tbody></table></div>
      </section>
      <section class="section two-column">
        <div class="panel"><div class="section-head"><div><p class="eyebrow">Lịch sử đề</p><h2>${progress.exams.length} lần thi</h2></div></div>${progress.exams.length ? `<div class="history-list">${progress.exams.slice().reverse().slice(0,12).map(examHistoryRow).join('')}</div>` : '<div class="empty-state"><p>Chưa có đề mô phỏng.</p><button class="primary-button" data-route="exam">Làm đề đầu tiên</button></div>'}</div>
        <div class="panel"><p class="eyebrow">Sao lưu và quản lý</p><h2>Dữ liệu học tập</h2><p class="muted">Xuất tệp JSON để chuyển sang thiết bị khác hoặc giữ bản sao.</p><div class="inline-actions"><button class="secondary-button" data-action="export-progress">Xuất tiến độ</button><button class="ghost-button" data-action="import-progress">Nhập tiến độ</button><button class="danger-button" data-action="reset-progress">Xóa toàn bộ</button></div><div class="notice warning" style="margin-top:16px"><strong>Không đồng bộ đám mây:</strong> Xóa dữ liệu trình duyệt sẽ xóa tiến độ nếu chưa xuất bản sao.</div></div>
      </section>`;
  }

  function examHistoryRow(exam) {
    return `<div class="history-row"><div><strong>${exam.preset === 'random' ? 'Đề ngẫu nhiên' : `Đề cố định ${exam.preset}`}</strong><div class="muted small">${formatDate(exam.date)} · ${exam.length} câu</div></div><strong>${exam.percent}%</strong><span class="tag ${exam.percent >= 80 ? 'update' : 'priority'}">${exam.percent >= 80 ? 'Đạt' : 'Chưa đạt'}</span></div>`;
  }

  function renderSources() {
    main.innerHTML = `
      <section class="section-head"><div><p class="eyebrow">Tính chính xác và nguồn</p><h1>Biết rõ câu nào đến từ đâu</h1><p class="lead">Bộ học được khóa theo bản sổ tay tiếng Việt 6/2025, đối chiếu bản tiếng Anh chính thức và cập nhật luật DMV năm 2026.</p></div></section>
      <div class="notice warning"><strong>Nguyên tắc kiểm soát:</strong> Khi bản dịch và bản tiếng Anh khác nhau, bản tiếng Anh chính thức của DMV được dùng làm nguồn đúng về pháp lý.</div>
      <section class="section two-column">
        <div class="panel"><p class="eyebrow">Hiệu chỉnh đã áp dụng</p><h2>Điểm dễ học sai</h2><ul class="list-clean">${DATA.meta.corrections.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="panel"><p class="eyebrow">Phương pháp</p><h2>Cách ngân hàng được tạo</h2><ul class="list-clean small"><li>Trích toàn văn từng trang từ PDF DMV.</li><li>Tách ${DATA.meta.factCount} facts trọng tâm có dẫn trang.</li><li>Viết mới ${DATA.meta.questionCount} câu, mỗi câu ba lựa chọn và một đáp án.</li><li>Không sử dụng đề bị đánh cắp hoặc rò rỉ.</li><li>Đối chiếu các mốc thay đổi với trang DMV hiện hành đến ${esc(DATA.meta.verifiedDate)}.</li></ul></div>
      </section>
      <section class="section panel"><div class="section-head"><div><p class="eyebrow">Tài liệu</p><h2>Nguồn chính thức</h2></div></div>
        <div class="source-card"><h3>Bản PDF tiếng Việt dùng trong bộ học</h3><p>${esc(DATA.meta.handbookEdition)}, ${DATA.meta.handbookPages} trang.</p><div class="source-links"><a class="primary-button" href="assets/so-tay-dmv-california-tieng-viet-2025.pdf" target="_blank" rel="noopener">Mở bản PDF offline</a><a class="ghost-button" href="${esc(DATA.sources[0].url)}" target="_blank" rel="noopener">Mở trên DMV</a></div></div>
        ${DATA.sources.slice(1).map(src=>`<div class="source-card"><h3>${esc(src.name)}</h3><p>${src.type === 'web' ? 'Trang web chính thức của California DMV.' : 'Tài liệu PDF chính thức.'}</p><a class="ghost-button" href="${esc(src.url)}" target="_blank" rel="noopener">Mở nguồn</a></div>`).join('')}
      </section>
      <section class="section panel"><p class="eyebrow">Giấy phép và giới hạn</p><h2>Ghi nguồn</h2><p>${esc(DATA.meta.license)}</p><p class="muted">${esc(DATA.meta.disclaimer)}</p></section>`;
  }

  function toggleQuestionStar(id) {
    const p = qProgress(id);
    p.starred = !p.starred;
    saveProgress();
    if (viewState.practiceSession) renderPracticeQuestion();
  }

  function toggleFactBookmark(id) {
    const i = progress.factBookmarks.indexOf(id);
    if (i >= 0) progress.factBookmarks.splice(i, 1);
    else progress.factBookmarks.push(id);
    saveProgress();
    const parts = routeParts();
    if (parts[0] === 'chapter') renderChapter(Number(parts[1]));
  }

  function openSearch() {
    searchOverlay.hidden = false;
    globalSearchInput.value = '';
    globalSearchResults.innerHTML = '<div class="empty-state"><p>Nhập ít nhất hai ký tự để tìm.</p></div>';
    window.setTimeout(() => globalSearchInput.focus(), 30);
  }

  function closeSearch() {
    searchOverlay.hidden = true;
  }

  function performGlobalSearch(query) {
    const needle = normalizeText(query.trim());
    if (needle.length < 2) {
      globalSearchResults.innerHTML = '<div class="empty-state"><p>Nhập ít nhất hai ký tự để tìm.</p></div>';
      return;
    }
    const results = [];
    DATA.chapters.forEach(ch => ch.facts.forEach(f => {
      if (normalizeText(`${f.text} ${f.tags.join(' ')}`).includes(needle)) results.push({ type:'Fact', chapter:ch, text:f.text, meta:`Trang ${f.page}` });
    }));
    DATA.questions.forEach(q => {
      if (normalizeText(`${q.prompt} ${q.choices.join(' ')} ${q.tags.join(' ')}`).includes(needle)) {
        const ch = DATA.chapters.find(c => c.id === q.chapter);
        results.push({ type:'Câu hỏi', chapter:ch, text:q.prompt, meta:`Trang ${q.page}` });
      }
    });
    const shown = results.slice(0, 60);
    globalSearchResults.innerHTML = shown.length ? shown.map(r => `<button class="search-result" data-route="chapter/${r.chapter.id}"><small>${r.type} · Phần ${r.chapter.id} · ${esc(r.meta)}</small><strong>${esc(r.text)}</strong></button>`).join('') : '<div class="empty-state"><h3>Không thấy kết quả</h3><p>Thử từ khóa ngắn hơn hoặc bỏ dấu.</p></div>';
  }

  function exportProgress() {
    const payload = { app:'dmv-ca-vi-study', exportedAt:new Date().toISOString(), progress };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dmv-ca-vn-progress-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Đã xuất tệp tiến độ.');
  }

  function importProgressFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = parsed.progress || parsed;
        if (!incoming || typeof incoming !== 'object' || !incoming.questions) throw new Error('Sai định dạng');
        progress = { ...defaultProgress(), ...incoming, questions: incoming.questions || {}, factBookmarks: incoming.factBookmarks || [], exams: incoming.exams || [] };
        saveProgress();
        toast('Đã nhập tiến độ.');
        renderStats();
      } catch (error) {
        toast('Tệp không hợp lệ hoặc bị hỏng.');
      } finally {
        importProgressInput.value = '';
      }
    };
    reader.readAsText(file);
  }

  function resetProgress() {
    if (!window.confirm('Xóa toàn bộ tiến độ, lịch ôn và lịch sử đề trên thiết bị này?')) return;
    progress = defaultProgress();
    saveProgress();
    viewState.practiceSession = null;
    viewState.examSession = null;
    viewState.examResults = null;
    toast('Đã xóa toàn bộ tiến độ.');
    renderStats();
  }

  function handleAction(actionEl) {
    const action = actionEl.dataset.action;
    if (!action) return;

    if (action === 'chapter-tab') {
      viewState.chapterTab = actionEl.dataset.tab;
      const parts = routeParts();
      renderChapter(Number(parts[1]));
    } else if (action === 'bookmark-fact') toggleFactBookmark(actionEl.dataset.fact);
    else if (action === 'practice-chapter') {
      const ch = Number(actionEl.dataset.chapter);
      viewState.practiceDefaults = { chapters:[ch], mode:'mixed', count:40 };
      viewState.practiceSession = null;
      setRoute('practice');
    } else if (action === 'exam-chapter') {
      const ch = Number(actionEl.dataset.chapter);
      viewState.examSession = null;
      viewState.examResults = null;
      setRoute('exam');
      window.setTimeout(() => {
        document.querySelectorAll('input[name="examChapter"]').forEach(x => x.checked = Number(x.value) === ch);
      }, 0);
    } else if (action === 'practice-unseen') {
      viewState.practiceDefaults = { chapters:DATA.chapters.map(c=>c.id), mode:'unseen', count:40 };
      viewState.practiceSession = null;
      setRoute('practice');
    } else if (action === 'select-all-chapters') document.querySelectorAll('input[name="practiceChapter"]').forEach(x=>x.checked=true);
    else if (action === 'clear-all-chapters') document.querySelectorAll('input[name="practiceChapter"]').forEach(x=>x.checked=false);
    else if (action === 'select-core-chapters') document.querySelectorAll('input[name="practiceChapter"]').forEach(x=>x.checked=Number(x.value)>=6&&Number(x.value)<=10);
    else if (action === 'start-practice') {
      const config = collectPracticeConfig();
      if (!config.chapters.length) return toast('Hãy chọn ít nhất một chương.');
      startPractice(config, 'practice');
    } else if (action === 'start-review') {
      startPractice({ chapters:DATA.chapters.map(c=>c.id), mode:'due', count:40 }, 'review');
    } else if (action === 'answer-practice') answerPractice(Number(actionEl.dataset.index));
    else if (action === 'rate-question') rateCurrentQuestion(Number(actionEl.dataset.rating));
    else if (action === 'next-practice') nextPractice();
    else if (action === 'star-question') toggleQuestionStar(actionEl.dataset.question);
    else if (action === 'quit-practice') {
      if (window.confirm('Thoát phiên hiện tại? Tiến độ các câu đã làm vẫn được giữ.')) {
        viewState.practiceSession = null;
        setRoute('dashboard');
      }
    } else if (action === 'new-practice') {
      viewState.practiceSession = null;
      setRoute('practice');
    } else if (action === 'retry-wrong-session') {
      const ids = viewState.practiceSession?.summaryWrongIds || [];
      viewState.practiceSession = { type:'practice', ids:shuffle(ids), index:0, results:[], answered:false, selected:null, ratingApplied:false, startedAt:Date.now() };
      renderPracticeQuestion();
    } else if (action === 'select-all-exam-chapters') document.querySelectorAll('input[name="examChapter"]').forEach(x=>x.checked=true);
    else if (action === 'select-core-exam-chapters') document.querySelectorAll('input[name="examChapter"]').forEach(x=>x.checked=Number(x.value)>=6&&Number(x.value)<=10);
    else if (action === 'start-exam') startExam();
    else if (action === 'answer-exam') {
      const s = viewState.examSession; if (!s) return;
      const id = s.ids[s.index]; s.answers[id] = Number(actionEl.dataset.index); renderExamQuestion();
    } else if (action === 'exam-prev') {
      viewState.examSession.index = Math.max(0, viewState.examSession.index - 1); renderExamQuestion();
    } else if (action === 'exam-next') {
      const s = viewState.examSession;
      if (s.index < s.ids.length - 1) { s.index += 1; renderExamQuestion(); }
      else submitExam();
    } else if (action === 'exam-jump') {
      viewState.examSession.index = Number(actionEl.dataset.index); renderExamQuestion();
    } else if (action === 'toggle-flag') {
      const s=viewState.examSession; const id=s.ids[s.index]; s.flags[id]=!s.flags[id]; renderExamQuestion();
    } else if (action === 'submit-exam') submitExam();
    else if (action === 'quit-exam') {
      if (window.confirm('Thoát đề hiện tại? Các câu chưa nộp sẽ không được lưu.')) { viewState.examSession=null; setRoute('dashboard'); }
    } else if (action === 'new-exam') { viewState.examResults=null; renderExamSetup(); }
    else if (action === 'practice-exam-wrong') {
      const ids = viewState.examResults?.wrongIds || [];
      viewState.examResults = null;
      viewState.practiceSession = { type:'practice', ids:shuffle(ids), index:0, results:[], answered:false, selected:null, ratingApplied:false, startedAt:Date.now() };
      setRoute('practice');
    } else if (action === 'export-progress') exportProgress();
    else if (action === 'import-progress') importProgressInput.click();
    else if (action === 'reset-progress') resetProgress();
  }

  document.addEventListener('click', event => {
    const routeEl = event.target.closest('[data-route]');
    if (routeEl) {
      event.preventDefault();
      setRoute(routeEl.dataset.route);
      if (!searchOverlay.hidden) closeSearch();
      return;
    }
    const actionEl = event.target.closest('[data-action]');
    if (actionEl) {
      event.preventDefault();
      handleAction(actionEl);
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === '/' && searchOverlay.hidden && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
      event.preventDefault(); openSearch();
    }
    if (event.key === 'Escape') {
      if (!searchOverlay.hidden) closeSearch();
      else if (sidebar.classList.contains('open')) sidebar.classList.remove('open');
    }
    if (event.target.matches('.chapter-card') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); setRoute(event.target.dataset.route);
    }
    if (viewState.practiceSession && !viewState.practiceSession.answered && ['1','2','3'].includes(event.key)) answerPractice(Number(event.key)-1);
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'chapterFactSearch') {
      viewState.chapterSearch = event.target.value;
      const parts = routeParts();
      const ch = DATA.chapters.find(c => c.id === Number(parts[1]));
      const container = document.getElementById('factList');
      if (ch && container) {
        const needle = normalizeText(viewState.chapterSearch);
        const facts = needle ? ch.facts.filter(f => normalizeText(`${f.text} ${f.tags.join(' ')}`).includes(needle)) : ch.facts;
        container.innerHTML = facts.length ? facts.map(factCard).join('') : '<div class="empty-state"><h3>Không thấy kết quả</h3><p>Thử từ khóa khác.</p></div>';
      }
    }
    if (event.target === globalSearchInput) performGlobalSearch(event.target.value);
  });

  mobileMenu.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    mobileMenu.setAttribute('aria-expanded', String(open));
  });
  document.getElementById('globalSearchButton').addEventListener('click', openSearch);
  document.getElementById('closeSearch').addEventListener('click', closeSearch);
  searchOverlay.addEventListener('click', event => { if (event.target === searchOverlay) closeSearch(); });
  importProgressInput.addEventListener('change', () => importProgressFile(importProgressInput.files[0]));
  window.addEventListener('hashchange', renderRoute);

  refreshHeaderStats();
  if (!location.hash) location.hash = 'dashboard';
  else renderRoute();
})();
