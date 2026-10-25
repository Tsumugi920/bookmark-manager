'use strict';

/* ===================== 常量与示例数据 ===================== */

const STORAGE_KEY = 'bookmark-manager:bookmarks:v1';

const FAVICON_COLORS = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

const SAMPLE_BOOKMARKS = [
  { title: 'GitHub', url: 'https://github.com', category: '开发工具', notes: '全球最大的代码托管与协作平台' },
  { title: 'MDN Web Docs', url: 'https://developer.mozilla.org', category: '开发工具', notes: 'Web 前端技术权威文档' },
  { title: 'Stack Overflow', url: 'https://stackoverflow.com', category: '开发工具', notes: '程序员技术问答社区' },
  { title: '知乎', url: 'https://www.zhihu.com', category: '学习资料', notes: '中文互联网高质量问答社区' },
  { title: 'Bilibili', url: 'https://www.bilibili.com', category: '娱乐休闲', notes: '视频弹幕网站，有大量技术教程' },
  { title: 'Figma', url: 'https://www.figma.com', category: '设计创意', notes: '在线协作式界面设计工具' },
  { title: 'Hacker News', url: 'https://news.ycombinator.com', category: '科技资讯', notes: '科技圈与创业社区新闻' },
  { title: 'Wikipedia', url: 'https://www.wikipedia.org', category: '学习资料', notes: '多语言自由内容百科全书' },
];

/* ===================== 状态 ===================== */

let bookmarks = [];
const filter = { keyword: '', category: '' };

const els = {};
['headerStats', 'searchInput', 'categoryFilter', 'addBtn', 'exportBtn', 'importBtn', 'importFile',
  'bookmarkGrid', 'emptyState', 'emptyText', 'emptyAddBtn', 'formOverlay', 'formModalTitle',
  'formCloseBtn', 'bookmarkForm', 'fieldId', 'fieldTitle', 'fieldUrl', 'fieldCategory',
  'categoryOptions', 'fieldNotes', 'formError', 'formCancelBtn', 'confirmOverlay',
  'confirmMessage', 'confirmCancelBtn', 'confirmOkBtn', 'toast',
].forEach((id) => { els[id] = document.getElementById(id); });

/* ===================== 工具函数 ===================== */

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function normalizeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s) ? s : 'https://' + s;
}

function isValidUrl(url) {
  if (!url || /\s/.test(url)) return false;
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol === 'http:' || u.protocol === 'https:') {
    const h = u.hostname;
    if (!h) return false;
    return h === 'localhost'
      || h.includes(':')                       // IPv6 字面量
      || /^\d{1,3}(\.\d{1,3}){3}$/.test(h)     // IPv4
      || /^[^.]+(\.[^.]+)+$/.test(h);          // 普通域名，至少形如 example.com，允许多级子域
  }
  return true;
}

function domainOf(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function uid() {
  return 'bm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/* ===================== 数据读写 ===================== */

// 返回 null 表示首次访问（从未存过），用于区分「清空所有书签」
function loadBookmarks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((b) => b && typeof b.title === 'string' && typeof b.url === 'string');
  } catch (err) {
    console.error('读取本地书签数据失败：', err);
    return [];
  }
}

function saveBookmarks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

/* ===================== 渲染 ===================== */

function getCategories() {
  return [...new Set(bookmarks.map((b) => b.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'zh'));
}

function visibleBookmarks() {
  const kw = filter.keyword.trim().toLowerCase();
  return bookmarks.filter((b) => {
    if (filter.category && b.category !== filter.category) return false;
    if (!kw) return true;
    return [b.title, b.url, b.category, b.notes]
      .some((v) => (v || '').toLowerCase().includes(kw));
  });
}

function renderHeaderStats() {
  const cats = getCategories().length;
  els.headerStats.textContent = `共 ${bookmarks.length} 条书签 · ${cats} 个分类`;
}

function renderCategoryFilter() {
  const counts = {};
  bookmarks.forEach((b) => {
    if (b.category) counts[b.category] = (counts[b.category] || 0) + 1;
  });
  if (filter.category && !counts[filter.category]) filter.category = '';
  let html = `<option value="">全部分类 (${bookmarks.length})</option>`;
  for (const c of getCategories()) {
    const selected = c === filter.category ? ' selected' : '';
    html += `<option value="${escapeHtml(c)}"${selected}>${escapeHtml(c)} (${counts[c]})</option>`;
  }
  els.categoryFilter.innerHTML = html;
}

function cardHtml(b) {
  const host = domainOf(b.url).replace(/^www\./, '');
  const letter = (host[0] || '?').toUpperCase();
  const color = FAVICON_COLORS[hashString(host) % FAVICON_COLORS.length];
  const displayUrl = b.url.replace(/^[a-zA-Z]+:\/\//, '').replace(/\/$/, '');
  const badge = b.category ? `<span class="badge">${escapeHtml(b.category)}</span>` : '';
  const notes = b.notes
    ? `<p class="card-notes" title="${escapeHtml(b.notes)}">${escapeHtml(b.notes)}</p>` : '';
  return `
    <article class="bookmark-card" data-id="${escapeHtml(b.id)}">
      <div class="card-top">
        <span class="favicon" style="background:${color}" aria-hidden="true">${escapeHtml(letter)}</span>
        <a class="card-title" href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer"
           title="打开 ${escapeHtml(b.title)}">${escapeHtml(b.title)}</a>
        ${badge}
      </div>
      <a class="card-url" href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayUrl)}</a>
      ${notes}
      <div class="card-actions">
        <button type="button" class="btn" data-action="edit">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16.9 3.7a2.2 2.2 0 0 1 3.1 0l.3.3a2.2 2.2 0 0 1 0 3.1L9.6 17.8l-4.5 1.1a.6.6 0 0 1-.7-.7l1.1-4.5L16.9 3.7z"/></svg>
          编辑
        </button>
        <button type="button" class="btn danger" data-action="delete">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          删除
        </button>
      </div>
    </article>`;
}

function renderGrid() {
  const list = visibleBookmarks();
  els.bookmarkGrid.innerHTML = list.map(cardHtml).join('');
  if (!bookmarks.length) {
    els.emptyState.hidden = false;
    els.emptyText.textContent = '还没有任何书签，点击下方按钮添加一个吧。';
    els.emptyAddBtn.hidden = false;
  } else if (!list.length) {
    els.emptyState.hidden = false;
    els.emptyText.textContent = '没有符合条件的结果，试试更换关键词或分类。';
    els.emptyAddBtn.hidden = true;
  } else {
    els.emptyState.hidden = true;
  }
}

function renderAll() {
  renderHeaderStats();
  renderCategoryFilter();
  renderGrid();
}

/* ===================== 提示条 ===================== */

let toastTimer = null;

function showToast(message, type = 'info') {
  els.toast.textContent = message;
  els.toast.className = 'toast' + (type === 'warn' ? ' warn' : '');
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 2400);
}

/* ===================== 确认弹窗 ===================== */

let confirmResolve = null;

function confirmDialog(message) {
  els.confirmMessage.textContent = message;
  els.confirmOverlay.hidden = false;
  els.confirmOkBtn.focus();
  return new Promise((resolve) => { confirmResolve = resolve; });
}

function settleConfirm(result) {
  els.confirmOverlay.hidden = true;
  if (confirmResolve) {
    confirmResolve(result);
    confirmResolve = null;
  }
}

/* ===================== 添加 / 编辑表单 ===================== */

function openFormModal(bookmark) {
  els.bookmarkForm.reset();
  els.formError.hidden = true;
  els.formModalTitle.textContent = bookmark ? '编辑书签' : '添加书签';
  els.fieldId.value = bookmark ? bookmark.id : '';
  els.fieldTitle.value = bookmark ? bookmark.title : '';
  els.fieldUrl.value = bookmark ? bookmark.url : '';
  els.fieldCategory.value = bookmark ? (bookmark.category || '') : '';
  els.fieldNotes.value = bookmark ? (bookmark.notes || '') : '';
  els.categoryOptions.innerHTML = getCategories()
    .map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');
  els.formOverlay.hidden = false;
  els.fieldTitle.focus();
}

function closeFormModal() {
  els.formOverlay.hidden = true;
}

function showFormError(message) {
  els.formError.textContent = message;
  els.formError.hidden = false;
}

function submitForm(event) {
  event.preventDefault();
  const id = els.fieldId.value;
  const title = els.fieldTitle.value.trim();
  const url = normalizeUrl(els.fieldUrl.value);
  const category = els.fieldCategory.value.trim();
  const notes = els.fieldNotes.value.trim();

  if (!title) return showFormError('请填写标题。');
  if (!url || !isValidUrl(url)) return showFormError('请填写有效的网址，例如 https://example.com。');
  const dup = bookmarks.find((b) => b.url.toLowerCase() === url.toLowerCase() && b.id !== id);
  if (dup) return showFormError(`该网址已存在：「${dup.title}」，请勿重复添加。`);

  if (id) {
    const target = bookmarks.find((b) => b.id === id);
    if (target) Object.assign(target, { title, url, category, notes });
    showToast('已保存修改');
  } else {
    bookmarks.unshift({ id: uid(), title, url, category, notes, createdAt: Date.now() });
    showToast('已添加书签');
  }
  saveBookmarks();
  closeFormModal();
  renderAll();
}

/* ===================== 删除 ===================== */

async function deleteBookmark(bookmark) {
  const ok = await confirmDialog(`确定删除「${bookmark.title}」吗？此操作不可恢复。`);
  if (!ok) return;
  bookmarks = bookmarks.filter((b) => b.id !== bookmark.id);
  saveBookmarks();
  renderAll();
  showToast('已删除书签');
}

/* ===================== 导入 / 导出 ===================== */

function exportJson() {
  if (!bookmarks.length) {
    showToast('当前没有书签可导出', 'warn');
    return;
  }
  const payload = {
    app: 'bookmark-manager',
    version: 1,
    exportedAt: new Date().toISOString(),
    bookmarks,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = URL.createObjectURL(blob);
  a.download = `bookmarks-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast(`已导出 ${bookmarks.length} 条书签`);
}

function cleanImportItem(item) {
  if (!item || typeof item !== 'object') return null;
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  const url = normalizeUrl(item.url);
  if (!title || !isValidUrl(url)) return null;
  return {
    title: title.slice(0, 100),
    url,
    category: typeof item.category === 'string' ? item.category.trim().slice(0, 30) : '',
    notes: typeof item.notes === 'string' ? item.notes.trim().slice(0, 300) : '',
  };
}

async function importJsonFile(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const list = Array.isArray(parsed)
      ? parsed
      : (parsed && Array.isArray(parsed.bookmarks) ? parsed.bookmarks : null);
    if (!list) throw new Error('文件结构不正确，需要书签数组或含 bookmarks 字段的对象');

    const cleaned = list.map(cleanImportItem).filter(Boolean);
    if (!cleaned.length) {
      showToast('文件中没有有效的书签', 'warn');
      return;
    }
    const existUrls = new Set(bookmarks.map((b) => b.url.toLowerCase()));
    const fresh = cleaned.filter((b) => !existUrls.has(b.url.toLowerCase()));
    const skipped = cleaned.length - fresh.length;

    const ok = await confirmDialog(
      `解析到 ${cleaned.length} 条书签：新增 ${fresh.length} 条，跳过重复 ${skipped} 条。是否导入？`
    );
    if (!ok) return;

    fresh.forEach((b) => bookmarks.unshift({ ...b, id: uid(), createdAt: Date.now() }));
    saveBookmarks();
    renderAll();
    showToast(`导入完成，新增 ${fresh.length} 条书签`);
  } catch (err) {
    console.error('导入失败：', err);
    showToast('导入失败：' + err.message, 'warn');
  }
}

/* ===================== 事件绑定与初始化 ===================== */

function bindEvents() {
  els.searchInput.addEventListener('input', () => {
    filter.keyword = els.searchInput.value;
    renderGrid();
  });

  els.categoryFilter.addEventListener('change', () => {
    filter.category = els.categoryFilter.value;
    renderGrid();
  });

  els.addBtn.addEventListener('click', () => openFormModal(null));
  els.emptyAddBtn.addEventListener('click', () => openFormModal(null));

  els.exportBtn.addEventListener('click', exportJson);
  els.importBtn.addEventListener('click', () => els.importFile.click());
  els.importFile.addEventListener('change', () => {
    const file = els.importFile.files && els.importFile.files[0];
    if (file) importJsonFile(file);
    els.importFile.value = '';
  });

  els.bookmarkGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const card = btn.closest('.bookmark-card');
    const bookmark = bookmarks.find((b) => b.id === card.dataset.id);
    if (!bookmark) return;
    if (btn.dataset.action === 'edit') openFormModal(bookmark);
    else deleteBookmark(bookmark);
  });

  els.bookmarkForm.addEventListener('submit', submitForm);
  els.formCancelBtn.addEventListener('click', closeFormModal);
  els.formCloseBtn.addEventListener('click', closeFormModal);
  els.formOverlay.addEventListener('click', (e) => {
    if (e.target === els.formOverlay) closeFormModal();
  });

  els.confirmCancelBtn.addEventListener('click', () => settleConfirm(false));
  els.confirmOkBtn.addEventListener('click', () => settleConfirm(true));
  els.confirmOverlay.addEventListener('click', (e) => {
    if (e.target === els.confirmOverlay) settleConfirm(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!els.formOverlay.hidden) closeFormModal();
    else if (!els.confirmOverlay.hidden) settleConfirm(false);
  });
}

function init() {
  const stored = loadBookmarks();
  if (stored === null) {
    const now = Date.now();
    bookmarks = SAMPLE_BOOKMARKS.map((b, i) => ({
      ...b,
      id: uid(),
      createdAt: now - i * 86400000,
    }));
    saveBookmarks();
  } else {
    bookmarks = stored;
  }
  bindEvents();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
