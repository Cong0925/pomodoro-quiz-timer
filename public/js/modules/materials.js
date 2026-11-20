/* ============================================================
 * PQ Timer - modules/materials.js
 * 资料管理：文件夹分类、搜索、上传、站内预览、下载、编辑、删除
 * 文件实体存于 data/materials，数据库只保存 /materials/... 相对路径
 * ============================================================ */
(function () {
    'use strict';

    const U = PQ.utils;
    const api = PQ.api;
    const PREVIEW_LIMIT = 2 * 1024 * 1024;
    const MAX_SIZE = 100 * 1024 * 1024;
    const MAX_FILES = 30;
    const VIEW_KEY = 'pq-materials-view';

    const TYPES = {
        pdf: { label: 'PDF', color: '#b42318', bg: '#fef3f2', icon: svg('doc') },
        image: { label: '图片', color: '#026aa2', bg: '#f0f9ff', icon: svg('image') },
        text: { label: '文本', color: '#475467', bg: '#f2f4f7', icon: svg('text') },
        audio: { label: '音频', color: '#b54708', bg: '#fffaeb', icon: svg('audio') },
        video: { label: '视频', color: '#0e7090', bg: '#ecfdff', icon: svg('video') },
        office: { label: 'Office', color: '#175cd3', bg: '#eff8ff', icon: svg('doc') },
        archive: { label: '压缩包', color: '#6941c6', bg: '#f4f3ff', icon: svg('box') },
        other: { label: '文件', color: '#667085', bg: '#f2f4f7', icon: svg('file') }
    };

    const CATEGORIES = {
        knowledge: { label: '知识点资料', short: '知识点', color: '#175cd3', bg: '#eff8ff' },
        paper: { label: '试卷题目', short: '试卷', color: '#b54708', bg: '#fffaeb' },
        answer: { label: '答案解析', short: '解析', color: '#027a48', bg: '#ecfdf3' },
        other: { label: '其他资料', short: '其他', color: '#667085', bg: '#f2f4f7' }
    };

    function svg(name) {
        const paths = {
            doc: '<path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 3v5h5M10 13h6M10 16.5h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
            image: '<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="10" r="1.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m5 18 4.5-5 3.5 3.6 3-3.2 4 4.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
            text: '<path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 3v5h5M10 12h6M10 15h6M10 18h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
            audio: '<path d="M4 14v-4M8 17V7M12 19V5M16 16V8M20 13v-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
            video: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m10 9 5 3-5 3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
            box: '<path d="m4 8 8-4 8 4-8 4zM4 8v8l8 4 8-4v-8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 12v8" fill="none" stroke="currentColor" stroke-width="1.7"/>',
            file: '<path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 3v5h5" fill="none" stroke="currentColor" stroke-width="1.7"/>',
            folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M3 10h18" fill="none" stroke="currentColor" stroke-width="1.7"/>',
            files: '<path d="M4 6a2 2 0 0 1 2-2h3l2 2h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 20h10a2 2 0 0 0 2-2V9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
            view: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" stroke-width="1.7"/>',
            download: '<path d="M12 4v11m0 0-4-4m4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
            edit: '<path d="m4 20 4.5-1 10-10-3.5-3.5-10 10z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m13.5 5 3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.7"/>',
            trash: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10 11v5M14 11v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
        };
        return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || paths.file) + '</svg>';
    }

    const state = {
        folders: [],
        list: [],
        total: 0,
        page: 1,
        limit: 12,
        q: '',
        folder: 'all',
        type: 'all',
        category: 'all',
        categoryCounts: [],
        loading: false,
        initialized: false,
        uploadFiles: [],
        viewMode: readViewMode(),
        editItem: null,
        previewItem: null,
        confirmAction: null,
        searchTimer: null,
        currentFolderName: '全部资料'
    };

    function el(id) { return document.getElementById(id); }
    function readViewMode() {
        try {
            return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
        } catch (e) {
            return 'grid';
        }
    }
    function saveViewMode(mode) {
        try { localStorage.setItem(VIEW_KEY, mode); } catch (e) { /* 忽略存储限制 */ }
    }
    function fileKey(file) {
        return file.name + '|' + file.size + '|' + (file.lastModified || 0);
    }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function typeMeta(t) { return TYPES[t] || TYPES.other; }
    function categoryMeta(c) { return CATEGORIES[c] || CATEGORIES.other; }
    function formatSize(bytes) {
        const n = Number(bytes) || 0;
        if (n <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        let v = n, i = 0;
        while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
        return (v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)) + ' ' + units[i];
    }
    function dateText(s) {
        return s ? String(s).replace('T', ' ').slice(0, 16) : '—';
    }
    function ext(name) {
        const m = /\.([^.]+)$/.exec(name || '');
        return m ? m[1] : '';
    }
    function baseName(name) {
        return String(name || '').replace(/\.[^.]+$/, '');
    }

    /* ---------------- 弹窗控制 ---------------- */
    const MODAL_IDS = {
        upload: 'matUploadModal',
        edit: 'matEditModal',
        folder: 'matFolderModal',
        confirm: 'matConfirmModal',
        preview: 'matPreviewModal'
    };

    function openModal(name) {
        const node = el(MODAL_IDS[name]);
        if (node) node.hidden = false;
        syncBodyLock();
    }

    function closeModal(name) {
        const node = el(MODAL_IDS[name]);
        if (node) node.hidden = true;
        if (name === 'preview') {
            const body = el('matPreviewBody');
            if (body) body.innerHTML = '';   // 停止音视频播放
            state.previewItem = null;
        }
        if (name === 'confirm') state.confirmAction = null;
        syncBodyLock();
    }

    function closeAllModals() {
        Object.keys(MODAL_IDS).forEach(name => {
            const node = el(MODAL_IDS[name]);
            if (node) node.hidden = true;
        });
        const body = el('matPreviewBody');
        if (body) body.innerHTML = '';
        state.previewItem = null;
        state.confirmAction = null;
        syncBodyLock();
    }

    function syncBodyLock() {
        const anyOpen = Object.keys(MODAL_IDS).some(name => {
            const node = el(MODAL_IDS[name]);
            return node && !node.hidden;
        });
        document.body.classList.toggle('mat-modal-open', anyOpen);
    }

    /* ---------------- 数据加载 ---------------- */
    async function loadFolders() {
        try {
            const list = await api.get('/api/materials/folders');
            state.folders = Array.isArray(list) ? list : [];
        } catch (e) {
            U.showToast('加载文件夹失败：' + e.message);
        }
        renderFolders();
        renderFolderOptions();
        updateMeta();
    }

    async function loadCategories() {
        const params = new URLSearchParams();
        if (state.folder !== 'all') params.set('folderId', String(state.folder));
        const qs = params.toString();
        try {
            const list = await api.get('/api/materials/categories' + (qs ? '?' + qs : ''));
            state.categoryCounts = Array.isArray(list) ? list : [];
        } catch (e) {
            state.categoryCounts = [];
        }
        renderCategories();
    }

    async function loadList() {
        state.loading = true;
        renderList();
        const params = new URLSearchParams();
        if (state.q) params.set('q', state.q);
        if (state.folder !== 'all') params.set('folderId', String(state.folder));
        if (state.type !== 'all') params.set('type', state.type);
        if (state.category !== 'all') params.set('category', state.category);
        params.set('page', String(state.page));
        params.set('limit', String(state.limit));
        try {
            const res = await api.get('/api/materials?' + params.toString());
            state.list = Array.isArray(res.list) ? res.list : [];
            state.total = Number(res.total) || 0;
            if (res.totalPages && state.page > res.totalPages) {
                state.page = res.totalPages;
                state.loading = false;
                return loadList();
            }
        } catch (e) {
            state.list = [];
            state.total = 0;
            U.showToast('加载资料失败：' + e.message);
        } finally {
            state.loading = false;
        }
        renderList();
        renderPager();
        updateMeta();
    }

    function currentFolderLabel() {
        if (state.folder === 'all') return '全部资料';
        if (state.folder === 'none') return '未分类';
        const f = state.folders.find(x => Number(x.id) === Number(state.folder));
        return f ? f.name : '资料';
    }

    function updateMeta() {
        state.currentFolderName = currentFolderLabel();
        const meta = el('matMeta');
        if (meta) {
            meta.innerHTML = '当前：<strong>' + esc(state.currentFolderName) + '</strong>' +
                '<span class="mat-meta-dot">·</span>' + state.total + ' 份资料';
        }
    }

    /* ---------------- 渲染 ---------------- */
    function renderFolders() {
        const row = el('matFolderRow');
        if (!row) return;
        let html = '<button type="button" class="mat-folder-chip' + (state.folder === 'all' ? ' active' : '') + '" data-folder="all">' +
            svg('files') + '<span>全部</span></button>';
        state.folders.forEach(f => {
            html += '<button type="button" class="mat-folder-chip' + (Number(state.folder) === Number(f.id) ? ' active' : '') + '" data-folder="' + f.id + '">' +
                svg('folder') + '<span>' + esc(f.name) + '</span><em>' + (Number(f.count) || 0) + '</em></button>';
        });
        html += '<button type="button" class="mat-folder-create" id="matFolderCreateBtn">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 11v5M9.5 13.5h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
            '<span>新建文件夹</span></button>';
        row.innerHTML = html;
        const createBtn = el('matFolderCreateBtn');
        if (createBtn) createBtn.addEventListener('click', openFolderModal);
    }

    function renderCategories() {
        const row = el('matCategoryRow');
        if (!row) return;
        const counts = {};
        state.categoryCounts.forEach(function (c) {
            counts[c.value] = Number(c.count) || 0;
        });
        const allCount = Object.keys(CATEGORIES).reduce(function (sum, key) {
            return sum + (counts[key] || 0);
        }, 0);
        let html = '<span class="mat-category-label">资料分类</span>' +
            '<button type="button" class="mat-category-chip' + (state.category === 'all' ? ' active' : '') + '" data-category="all">' +
            '<span class="mat-cat-dot"></span><span>全部</span><em>' + allCount + '</em></button>';
        Object.keys(CATEGORIES).forEach(function (key) {
            const meta = CATEGORIES[key];
            html += '<button type="button" class="mat-category-chip cat-' + key + (state.category === key ? ' active' : '') + '" data-category="' + key + '">' +
                '<span class="mat-cat-dot"></span><span>' + meta.label + '</span><em>' + (counts[key] || 0) + '</em></button>';
        });
        row.innerHTML = html;
        const uploadSel = el('matUploadCategory');
        if (uploadSel && !uploadSel.options.length) {
            uploadSel.innerHTML = '<option value="auto">自动识别（按文件名判断）</option>' +
                Object.keys(CATEGORIES).map(function (key) {
                    return '<option value="' + key + '">' + CATEGORIES[key].label + '</option>';
                }).join('');
        }
        const editSel = el('matEditCategory');
        if (editSel && !editSel.options.length) {
            editSel.innerHTML = Object.keys(CATEGORIES).map(function (key) {
                return '<option value="' + key + '">' + CATEGORIES[key].label + '</option>';
            }).join('');
        }
    }

    function renderFolderOptions() {
        const uploadSel = el('matUploadFolder');
        const editSel = el('matEditFolder');
        if (uploadSel) {
            uploadSel.innerHTML = state.folders.map(f =>
                '<option value="' + f.id + '">' + esc(f.name) + '</option>'
            ).join('') || '<option value="">（暂无文件夹，点右侧新建）</option>';
        }
        if (editSel) {
            editSel.innerHTML = state.folders.map(f =>
                '<option value="' + f.id + '">' + esc(f.name) + '</option>'
            ).join('');
        }
    }

    function fileExtLabel(item) {
        return String(item.fileExt || ext(item.originalName) || 'file').replace(/^\./, '').toUpperCase();
    }

    function folderSelectHtml(item) {
        let opts = '<option value="none"' + (item.folderId == null ? ' selected' : '') + '>未分类</option>';
        opts += state.folders.map(f =>
            '<option value="' + f.id + '"' + (Number(item.folderId) === Number(f.id) ? ' selected' : '') + '>' + esc(f.name) + '</option>'
        ).join('');
        return '<div class="mat-folder-move">' + svg('folder') +
            '<select class="mat-folder-move-select" data-mat-move-id="' + item.id + '" aria-label="修改所属文件夹" title="修改所属文件夹">' + opts + '</select>' +
            '<svg class="mat-folder-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</div>';
    }

    function categoryBadgeHtml(item, full) {
        const key = CATEGORIES[item.category] ? item.category : 'other';
        const meta = CATEGORIES[key];
        return '<span class="mat-category-badge cat-' + key + '">' + esc(full ? meta.label : meta.short) + '</span>';
    }

    function categorySelectHtml(item) {
        const key = CATEGORIES[item.category] ? item.category : 'other';
        const opts = Object.keys(CATEGORIES).map(function (k) {
            return '<option value="' + k + '"' + (k === key ? ' selected' : '') + '>' + CATEGORIES[k].short + '</option>';
        }).join('');
        return '<select class="mat-category-select cat-' + key + '" data-mat-category-id="' + item.id + '" title="设置资料分类" aria-label="设置资料分类">' + opts + '</select>';
    }

    function cardHtml(item) {
        const meta = typeMeta(item.previewType);
        const cover = item.previewType === 'image'
            ? '<img src="' + esc(item.filePath) + '" alt="" loading="lazy">'
            : '<span class="mat-cover-icon">' + meta.icon + '</span><span class="mat-cover-ext">' + esc(fileExtLabel(item)) + '</span>';
        return '<article class="mat-card" data-id="' + item.id + '">' +
            '<div class="mat-card-open" data-mat-action="preview" data-id="' + item.id + '">' +
                '<div class="mat-card-cover' + (item.previewType === 'image' ? ' image' : '') + '" style="color:' + meta.color + ';background:' + meta.bg + '">' +
                    cover + '<span class="mat-cover-type">' + esc(meta.label) + '</span>' +
                '</div>' +
                '<div class="mat-card-copy">' +
                    '<div class="mat-card-title" title="' + esc(item.title) + '">' + esc(item.title) + '</div>' +
                    '<div class="mat-card-file" title="' + esc(item.originalName) + '">' + esc(item.originalName) + '</div>' +
                    '<div class="mat-card-meta">' + categorySelectHtml(item) + '<span>' + formatSize(item.sizeBytes) + '</span><span class="mat-meta-dot">·</span><span>' + dateText(item.createdAt) + '</span></div>' +
                '</div>' +
            '</div>' +
            '<div class="mat-card-foot">' + folderSelectHtml(item) +
                '<div class="mat-card-actions">' +
                    actionBtn('preview', '预览', svg('view'), item.id) +
                    actionBtn('download', '下载', svg('download'), item.id) +
                    actionBtn('edit', '编辑', svg('edit'), item.id) +
                    actionBtn('delete', '删除', svg('trash'), item.id, ' danger') +
                '</div>' +
            '</div>' +
        '</article>';
    }

    function actionBtn(action, title, icon, id, extra) {
        return '<button type="button" class="mat-icon-btn' + (extra || '') + '" title="' + title + '" aria-label="' + title + '" data-mat-action="' + action + '" data-id="' + id + '">' + icon + '</button>';
    }

    function listRowHtml(item) {
        const meta = typeMeta(item.previewType);
        const thumb = item.previewType === 'image'
            ? '<img src="' + esc(item.filePath) + '" alt="" loading="lazy">'
            : esc(fileExtLabel(item));
        return '<div class="mat-table-row" data-id="' + item.id + '">' +
            '<div class="mat-row-main" data-mat-action="preview" data-id="' + item.id + '">' +
                '<div class="mat-row-thumb" style="color:' + meta.color + ';background:' + meta.bg + '">' + thumb + '</div>' +
                '<div class="mat-row-copy"><div class="mat-row-title-line">' + categorySelectHtml(item) +
                '<div class="mat-row-title" title="' + esc(item.title) + '">' + esc(item.title) + '</div></div>' +
                '<div class="mat-row-file" title="' + esc(item.originalName) + '">' + esc(item.originalName) + '</div></div>' +
            '</div>' +
            '<div class="mat-row-folder">' + folderSelectHtml(item) + '</div>' +
            '<div class="mat-row-size">' + formatSize(item.sizeBytes) + '</div>' +
            '<div class="mat-row-date">' + dateText(item.createdAt) + '</div>' +
            '<div class="mat-row-actions">' +
                actionBtn('preview', '预览', svg('view'), item.id) +
                actionBtn('download', '下载', svg('download'), item.id) +
                actionBtn('edit', '编辑', svg('edit'), item.id) +
                actionBtn('delete', '删除', svg('trash'), item.id, ' danger') +
            '</div>' +
        '</div>';
    }

    function listHtml() {
        return '<div class="mat-table">' +
            '<div class="mat-table-head"><span>资料</span><span>文件夹</span><span>大小</span><span>上传时间</span><span>操作</span></div>' +
            state.list.map(listRowHtml).join('') +
        '</div>';
    }

    function renderViewToggle() {
        document.querySelectorAll('[data-mat-view]').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-mat-view') === state.viewMode);
        });
    }

    function renderList() {
        const box = el('matList');
        if (!box) return;
        if (state.loading) {
            let skeleton = '';
            for (let i = 0; i < 6; i++) {
                skeleton += state.viewMode === 'grid'
                    ? '<div class="mat-skeleton"><i></i><b></b><b></b><b></b></div>'
                    : '<div class="mat-skeleton mat-skeleton-row"><i></i><b></b><b></b></div>';
            }
            box.innerHTML = state.viewMode === 'grid'
                ? '<div class="mat-grid">' + skeleton + '</div>'
                : '<div class="mat-skeleton-table">' + skeleton + '</div>';
            const pager = el('matPager');
            if (pager) pager.innerHTML = '';
            renderViewToggle();
            return;
        }
        if (!state.list.length) {
            const title = state.q
                ? '没有找到与「' + esc(state.q) + '」相关的资料'
                : (state.category !== 'all'
                    ? '这个文件夹里还没有「' + categoryMeta(state.category).label + '」'
                    : (state.type !== 'all' ? '当前类型下还没有资料' : '这个文件夹还是空的，上传第一份资料吧'));
            box.innerHTML = '<div class="mat-empty">' +
                '<div class="mat-empty-icon">' + svg('folder') + '</div>' +
                '<div class="mat-empty-title">' + title + '</div>' +
                '<div class="mat-empty-sub">支持 PDF、图片、TXT / Markdown、音频、视频，单个文件不超过 100MB</div>' +
                '<button type="button" class="pq-btn pq-btn--primary" id="matEmptyUpload">上传资料</button>' +
            '</div>';
            const btn = el('matEmptyUpload');
            if (btn) btn.addEventListener('click', openUploadModal);
            renderViewToggle();
            return;
        }
        box.innerHTML = state.viewMode === 'grid' ? '<div class="mat-grid">' + state.list.map(cardHtml).join('') + '</div>' : listHtml();
        renderViewToggle();
    }

    function renderPager() {
        const pager = el('matPager');
        if (!pager) return;
        const totalPages = Math.ceil(state.total / state.limit);
        if (totalPages <= 1) { pager.innerHTML = ''; return; }
        let html = '<button type="button" class="mat-page-btn" data-page="' + (state.page - 1) + '"' + (state.page <= 1 ? ' disabled' : '') + '>上一页</button>';
        const start = Math.max(1, state.page - 2);
        const end = Math.min(totalPages, start + 4);
        for (let p = start; p <= end; p++) {
            html += '<button type="button" class="mat-page-btn' + (p === state.page ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
        }
        if (end < totalPages) html += '<span class="mat-page-gap">…</span>';
        html += '<button type="button" class="mat-page-btn" data-page="' + (state.page + 1) + '"' + (state.page >= totalPages ? ' disabled' : '') + '>下一页</button>';
        pager.innerHTML = html;
    }

    /* ---------------- 上传 ---------------- */
    function openUploadModal() {
        state.uploadFiles = [];
        el('matFileInput').value = '';
        el('matTitle').value = '';
        el('matDesc').value = '';
        el('matProgress').hidden = true;
        el('matProgressBar').style.width = '0%';
        el('matProgressText').textContent = '正在上传…';
        el('matUploadSubmit').disabled = false;
        el('matUploadSubmit').textContent = '开始上传';
        renderFolderOptions();
        renderCategories();
        const uploadSel = el('matUploadFolder');
        if (uploadSel) {
            const active = Number(state.folder);
            const found = state.folders.find(f => Number(f.id) === active);
            uploadSel.value = found ? String(found.id) : (state.folders[0] ? String(state.folders[0].id) : '');
        }
        const catSel = el('matUploadCategory');
        if (catSel) catSel.value = state.category === 'all' ? 'auto' : state.category;
        renderUploadFiles();
        openModal('upload');
    }

    function totalUploadSize() {
        return state.uploadFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);
    }

    function updateUploadMode() {
        const n = state.uploadFiles.length;
        const single = n === 1;
        const field = el('matTitleField');
        const note = el('matBatchNote');
        if (field) field.hidden = !single;
        if (note) note.hidden = single || n === 0;
        const grid = el('matFormGrid');
        if (grid) grid.classList.toggle('single-field', !single);
        const title = el('matTitle');
        if (single && title && !title.value.trim()) {
            title.value = baseName(state.uploadFiles[0].name).slice(0, 200);
        }
        const submit = el('matUploadSubmit');
        if (submit && !submit.disabled) submit.textContent = n > 1 ? '上传 ' + n + ' 个文件' : '开始上传';
    }

    function renderUploadFiles() {
        const box = el('matFileList');
        if (!box) return;
        const files = state.uploadFiles;
        if (!files.length) {
            box.hidden = true;
            box.innerHTML = '';
            updateUploadMode();
            return;
        }
        box.hidden = false;
        let rows = '';
        files.forEach(function (file, index) {
            rows += '<div class="mat-file-row">' +
                '<span class="mat-file-ext">' + esc(ext(file.name).toUpperCase() || 'FILE') + '</span>' +
                '<span class="mat-file-name" title="' + esc(file.name) + '">' + esc(file.name) + '</span>' +
                '<span class="mat-file-size">' + formatSize(file.size) + '</span>' +
                '<button type="button" class="mat-file-remove" data-file-index="' + index + '" title="移除" aria-label="移除文件">×</button>' +
            '</div>';
        });
        box.innerHTML = '<div class="mat-file-head"><div>已选择 <strong>' + files.length + '</strong> 个文件' +
            '<span class="mat-file-total">合计 ' + formatSize(totalUploadSize()) + '</span></div>' +
            '<button type="button" class="mat-file-clear" id="matFileClearAll">清空</button></div>' +
            '<div class="mat-file-rows">' + rows + '</div>';
        updateUploadMode();
    }

    function addUploadFiles(fileList) {
        const incoming = Array.from(fileList || []);
        if (!incoming.length) return;
        incoming.forEach(function (file) {
            if (file.size > MAX_SIZE) {
                U.showToast('「' + file.name + '」超过 100MB 上限，已跳过');
                return;
            }
            if (state.uploadFiles.some(f => fileKey(f) === fileKey(file))) return;
            if (state.uploadFiles.length >= MAX_FILES) {
                U.showToast('一次最多上传 ' + MAX_FILES + ' 个文件');
                return;
            }
            state.uploadFiles.push(file);
        });
        renderUploadFiles();
    }

    function removeUploadFile(index) {
        state.uploadFiles.splice(index, 1);
        renderUploadFiles();
    }

    function submitUpload() {
        if (!state.uploadFiles.length) {
            U.showToast('请先选择要上传的文件');
            return;
        }
        const single = state.uploadFiles.length === 1;
        const title = single ? el('matTitle').value.trim() : '';
        const folderId = el('matUploadFolder').value;
        const form = new FormData();
        state.uploadFiles.forEach(function (file) { form.append('files', file); });
        if (title) form.append('title', title);
        form.append('description', el('matDesc').value.trim());
        if (folderId) form.append('folderId', folderId);
        const category = el('matUploadCategory') ? el('matUploadCategory').value : 'auto';
        if (category) form.append('category', category);

        const btn = el('matUploadSubmit');
        btn.disabled = true;
        btn.textContent = '上传中…';
        const box = el('matProgress');
        const bar = el('matProgressBar');
        const text = el('matProgressText');
        box.hidden = false;
        bar.style.width = '0%';
        text.textContent = '正在上传 ' + state.uploadFiles.length + ' 个文件…';

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/materials');
        xhr.upload.onprogress = function (e) {
            if (e.lengthComputable) {
                const p = Math.round((e.loaded / e.total) * 100);
                bar.style.width = p + '%';
                text.textContent = p < 100
                    ? '正在上传 ' + state.uploadFiles.length + ' 个文件 ' + p + '%'
                    : '正在写入资料库…';
            }
        };
        xhr.onerror = function () {
            btn.disabled = false;
            btn.textContent = '开始上传';
            U.showToast('网络异常，上传失败');
        };
        xhr.onload = function () {
            let data = null;
            try { data = JSON.parse(xhr.responseText); } catch (e) { /* 非 JSON */ }
            if (xhr.status >= 200 && xhr.status < 300 && data && Array.isArray(data.list)) {
                const count = Number(data.count) || data.list.length;
                closeModal('upload');
                U.showToast(count > 1 ? '已上传 ' + count + ' 份资料' : '「' + ((data.list[0] && data.list[0].title) || title || '资料') + '」已上传');
                state.type = 'all';
                el('matType').value = 'all';
                state.category = 'all';
                renderCategories();
                const first = data.list[0];
                if (first && first.folderId != null) state.folder = Number(first.folderId);
                state.page = 1;
                renderFolders();
                loadFolders().then(loadCategories).then(loadList);
            } else {
                btn.disabled = false;
                btn.textContent = '开始上传';
                box.hidden = true;
                U.showToast((data && data.error) || ('上传失败：HTTP ' + xhr.status));
            }
        };
        xhr.send(form);
    }

    /* ---------------- 文件夹 ---------------- */
    function openFolderModal() {
        el('matFolderName').value = '';
        el('matFolderError').hidden = true;
        openModal('folder');
        setTimeout(function () { el('matFolderName').focus(); }, 30);
    }

    async function submitFolder() {
        const name = el('matFolderName').value.trim();
        const err = el('matFolderError');
        if (!name) {
            err.textContent = '文件夹名称不能为空';
            err.hidden = false;
            return;
        }
        if (state.folders.some(f => f.name === name)) {
            err.textContent = '已存在同名文件夹';
            err.hidden = false;
            return;
        }
        try {
            const res = await api.post('/api/materials/folders', { name: name });
            closeModal('folder');
            U.showToast('文件夹「' + name + '」已创建');
            await loadFolders();
            if (!el('matUploadModal').hidden) {
                const sel = el('matUploadFolder');
                if (sel && res && res.id) sel.value = String(res.id);
            } else {
                state.folder = res && res.id ? Number(res.id) : state.folder;
                state.page = 1;
                await loadCategories();
                await loadList();
            }
            renderFolders();
        } catch (e) {
            err.textContent = e.message;
            err.hidden = false;
        }
    }

    /* ---------------- 直接移动文件夹 ---------------- */
    async function moveItem(item, rawFolder) {
        const folderId = rawFolder === 'none' ? null : Number(rawFolder);
        if (item.folderId === folderId) return;
        const folder = folderId == null ? null : state.folders.find(f => Number(f.id) === folderId);
        const targetName = folder ? folder.name : '未分类';
        try {
            await api.put('/api/materials/' + item.id + '/folder', { folderId: folderId });
            item.folderId = folderId;
            item.folderName = targetName;
            if (state.previewItem && Number(state.previewItem.id) === Number(item.id)) {
                state.previewItem.folderId = folderId;
                state.previewItem.folderName = targetName;
                const previewMeta = el('matPreviewMeta');
                if (previewMeta) {
                    previewMeta.innerHTML =
                        '<span class="mat-folder-tag">' + svg('folder') + esc(targetName) + '</span>' +
                        categoryBadgeHtml(item, true) +
                        '<span>' + esc(item.originalName) + '</span>' +
                        '<span>' + formatSize(item.sizeBytes) + '</span>' +
                        '<span>上传于 ' + dateText(item.createdAt) + '</span>';
                }
            }
            U.showToast('已移动到「' + targetName + '」');
            await loadFolders();
            await loadCategories();
            await loadList();
        } catch (e) {
            U.showToast('移动失败：' + e.message);
            renderList();
        }
    }

    /* ---------------- 直接设置资料分类 ---------------- */
    async function setItemCategory(item, rawCategory) {
        const category = CATEGORIES[rawCategory] ? rawCategory : null;
        if (!category || category === item.category) return;
        try {
            const res = await api.put('/api/materials/' + item.id + '/category', { category: category });
            item.category = res && res.category ? res.category : category;
            item.categoryLabel = res && res.categoryLabel ? res.categoryLabel : CATEGORIES[item.category].label;
            if (state.previewItem && Number(state.previewItem.id) === Number(item.id)) {
                state.previewItem.category = item.category;
                state.previewItem.categoryLabel = item.categoryLabel;
                const previewMeta = el('matPreviewMeta');
                if (previewMeta) {
                    previewMeta.innerHTML =
                        '<span class="mat-folder-tag">' + svg('folder') + esc(state.previewItem.folderName) + '</span>' +
                        categoryBadgeHtml(state.previewItem, true) +
                        '<span>' + esc(state.previewItem.originalName) + '</span>' +
                        '<span>' + formatSize(state.previewItem.sizeBytes) + '</span>' +
                        '<span>上传于 ' + dateText(state.previewItem.createdAt) + '</span>';
                }
            }
            U.showToast('「' + item.title + '」已设为' + item.categoryLabel);
            await loadCategories();
            await loadList();
        } catch (e) {
            U.showToast('设置分类失败：' + e.message);
            renderList();
        }
    }

    /* ---------------- 编辑 / 删除 ---------------- */
    function openEditModal(item) {
        state.editItem = item;
        el('matEditTitle').value = item.title || '';
        el('matEditDesc').value = item.description || '';
        renderFolderOptions();
        renderCategories();
        const sel = el('matEditFolder');
        if (sel) sel.value = item.folderId ? String(item.folderId) : '';
        const catSel = el('matEditCategory');
        if (catSel) catSel.value = CATEGORIES[item.category] ? item.category : 'other';
        openModal('edit');
    }

    async function submitEdit() {
        const item = state.editItem;
        if (!item) return;
        const title = el('matEditTitle').value.trim();
        if (!title) {
            U.showToast('标题不能为空');
            return;
        }
        const btn = el('matEditSubmit');
        btn.disabled = true;
        try {
            await api.put('/api/materials/' + item.id, {
                title: title,
                description: el('matEditDesc').value.trim(),
                folderId: el('matEditFolder').value ? Number(el('matEditFolder').value) : null,
                category: el('matEditCategory').value || 'other'
            });
            closeModal('edit');
            U.showToast('资料信息已更新');
            await loadFolders();
            await loadCategories();
            await loadList();
        } catch (e) {
            U.showToast('保存失败：' + e.message);
        } finally {
            btn.disabled = false;
        }
    }

    function askConfirm(title, text, action) {
        el('matConfirmTitle').textContent = title;
        el('matConfirmText').textContent = text;
        state.confirmAction = action;
        openModal('confirm');
    }

    function confirmDelete(item) {
        askConfirm('删除资料', '确定删除「' + item.title + '」吗？数据库记录与磁盘文件会一并删除，且不可恢复。', async function () {
            try {
                await api.del('/api/materials/' + item.id);
                closeModal('confirm');
                U.showToast('资料已删除');
                await loadFolders();
                await loadCategories();
                await loadList();
            } catch (e) {
                closeModal('confirm');
                U.showToast('删除失败：' + e.message);
            }
        });
    }

    /* ---------------- 下载 / 预览 ---------------- */
    function downloadItem(item) {
        const a = document.createElement('a');
        a.href = '/api/materials/' + item.id + '/download';
        a.download = item.originalName || '';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    function openPreview(item) {
        state.previewItem = item;
        el('matPreviewTitle').textContent = item.title;
        el('matPreviewMeta').innerHTML =
            '<span class="mat-folder-tag">' + svg('folder') + esc(item.folderName) + '</span>' +
            categoryBadgeHtml(item, true) +
            '<span>' + esc(item.originalName) + '</span>' +
            '<span>' + formatSize(item.sizeBytes) + '</span>' +
            '<span>上传于 ' + dateText(item.createdAt) + '</span>';
        const desc = el('matPreviewDesc');
        if (item.description) {
            desc.textContent = item.description;
            desc.hidden = false;
        } else {
            desc.textContent = '';
            desc.hidden = true;
        }
        const body = el('matPreviewBody');
        const meta = typeMeta(item.previewType);
        if (item.previewType === 'pdf') {
            body.innerHTML = '<iframe class="mat-preview-frame" src="' + esc(item.filePath) + '#view=FitH" title="PDF 预览"></iframe>';
        } else if (item.previewType === 'image') {
            body.innerHTML = '<div class="mat-preview-center"><img class="mat-preview-image" src="' + esc(item.filePath) + '" alt="' + esc(item.title) + '"></div>';
        } else if (item.previewType === 'text') {
            if (item.sizeBytes > PREVIEW_LIMIT) {
                body.innerHTML = unsupportedHtml(meta, '文本超过 2MB，建议下载后查看');
            } else {
                body.innerHTML = '<div class="mat-preview-text-wrap"><pre class="mat-preview-text" id="matPreviewText">加载中…</pre></div>';
                loadText(item);
            }
        } else if (item.previewType === 'audio') {
            body.innerHTML = '<div class="mat-preview-center"><div class="mat-av-card">' +
                '<div class="mat-av-icon">' + svg('audio') + '</div>' +
                '<div class="mat-av-title">' + esc(item.title) + '</div>' +
                '<audio class="mat-preview-audio" src="' + esc(item.filePath) + '" controls></audio>' +
                '</div></div>';
        } else if (item.previewType === 'video') {
            body.innerHTML = '<div class="mat-preview-center"><video class="mat-preview-video" src="' + esc(item.filePath) + '" controls></video></div>';
        } else {
            body.innerHTML = unsupportedHtml(meta, 'Word、Excel、PPT、压缩包等文件可以下载后在本机打开');
        }
        openModal('preview');
        api.post('/api/materials/' + item.id + '/view', {}).catch(function () {});
    }

    function unsupportedHtml(meta, sub) {
        return '<div class="mat-unsupported">' +
            '<div class="mat-unsupported-icon" style="color:' + meta.color + ';background:' + meta.bg + '">' + meta.icon + '</div>' +
            '<div class="mat-unsupported-title">该类型暂不支持页面内预览</div>' +
            '<div class="mat-unsupported-sub">' + esc(sub) + '</div>' +
            '<button type="button" class="pq-btn pq-btn--primary" id="matUnsupportedDownload">下载文件</button>' +
            '</div>';
    }

    async function loadText(item) {
        const pre = el('matPreviewText');
        if (!pre) return;
        try {
            const res = await fetch(item.filePath);
            if (!res.ok) throw new Error('读取文件失败（HTTP ' + res.status + '）');
            const text = await res.text();
            if (state.previewItem && state.previewItem.id === item.id) pre.textContent = text;
        } catch (e) {
            if (pre) pre.textContent = '读取失败：' + e.message;
        }
    }

    /* ---------------- 事件 ---------------- */
    function bindEvents() {
        el('matUploadBtn').addEventListener('click', openUploadModal);
        el('matUploadSubmit').addEventListener('click', submitUpload);
        el('matFolderSubmit').addEventListener('click', submitFolder);
        el('matUploadNewFolder').addEventListener('click', openFolderModal);
        el('matEditSubmit').addEventListener('click', submitEdit);

        el('matConfirmOk').addEventListener('click', function () {
            const fn = state.confirmAction;
            if (fn) fn();
        });

        const fileInput = el('matFileInput');
        fileInput.addEventListener('change', function () {
            if (fileInput.files && fileInput.files.length) addUploadFiles(fileInput.files);
            fileInput.value = '';
        });

        const drop = el('matDrop');
        ['dragenter', 'dragover'].forEach(function (ev) {
            drop.addEventListener(ev, function (e) {
                e.preventDefault();
                drop.classList.add('dragging');
            });
        });
        ['dragleave', 'drop'].forEach(function (ev) {
            drop.addEventListener(ev, function (e) {
                e.preventDefault();
                drop.classList.remove('dragging');
            });
        });
        drop.addEventListener('drop', function (e) {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                addUploadFiles(e.dataTransfer.files);
            }
        });

        el('matFileList').addEventListener('click', function (e) {
            const clearAll = e.target.closest('#matFileClearAll');
            if (clearAll) {
                state.uploadFiles = [];
                el('matFileInput').value = '';
                el('matTitle').value = '';
                renderUploadFiles();
                return;
            }
            const remove = e.target.closest('[data-file-index]');
            if (!remove) return;
            removeUploadFile(Number(remove.getAttribute('data-file-index')));
        });

        document.querySelectorAll('[data-mat-close]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                closeModal(btn.getAttribute('data-mat-close'));
            });
        });

        const search = el('matSearch');
        const clear = el('matSearchClear');
        search.addEventListener('input', function () {
            state.q = search.value.trim();
            clear.hidden = !search.value;
            if (state.searchTimer) clearTimeout(state.searchTimer);
            state.searchTimer = setTimeout(function () {
                state.page = 1;
                loadList();
            }, 300);
        });
        clear.addEventListener('click', function () {
            search.value = '';
            state.q = '';
            clear.hidden = true;
            state.page = 1;
            loadList();
            search.focus();
        });

        el('matType').addEventListener('change', function (e) {
            state.type = e.target.value;
            state.page = 1;
            loadList();
        });

        el('matFolderRow').addEventListener('click', function (e) {
            const chip = e.target.closest('[data-folder]');
            if (!chip) return;
            const v = chip.getAttribute('data-folder');
            state.folder = v === 'all' || v === 'none' ? v : Number(v);
            state.page = 1;
            renderFolders();
            updateMeta();
            loadCategories();
            loadList();
        });

        el('matCategoryRow').addEventListener('click', function (e) {
            const chip = e.target.closest('[data-category]');
            if (!chip) return;
            const v = chip.getAttribute('data-category');
            state.category = v === 'all' ? 'all' : (CATEGORIES[v] ? v : 'all');
            state.page = 1;
            renderCategories();
            loadList();
        });

        el('matViewToggle').addEventListener('click', function (e) {
            const btn = e.target.closest('[data-mat-view]');
            if (!btn) return;
            const mode = btn.getAttribute('data-mat-view');
            if (mode !== 'grid' && mode !== 'list') return;
            state.viewMode = mode;
            saveViewMode(mode);
            renderList();
        });

        el('matList').addEventListener('click', function (e) {
            const catSetter = e.target.closest('[data-mat-category-id]');
            if (catSetter) {
                e.stopPropagation();
                return;
            }
            const btn = e.target.closest('[data-mat-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-mat-action');
            const id = Number(btn.getAttribute('data-id'));
            const item = state.list.find(x => Number(x.id) === id);
            if (!item) return;
            if (action === 'preview') openPreview(item);
            else if (action === 'download') downloadItem(item);
            else if (action === 'edit') openEditModal(item);
            else if (action === 'delete') confirmDelete(item);
        });

        el('matList').addEventListener('change', function (e) {
            const catSel = e.target.closest('[data-mat-category-id]');
            if (catSel) {
                const catItem = state.list.find(x => Number(x.id) === Number(catSel.getAttribute('data-mat-category-id')));
                if (catItem) setItemCategory(catItem, catSel.value);
                return;
            }
            const sel = e.target.closest('[data-mat-move-id]');
            if (!sel) return;
            const item = state.list.find(x => Number(x.id) === Number(sel.getAttribute('data-mat-move-id')));
            if (!item) return;
            moveItem(item, sel.value);
        });

        el('matPager').addEventListener('click', function (e) {
            const btn = e.target.closest('[data-page]');
            if (!btn || btn.disabled) return;
            state.page = Number(btn.getAttribute('data-page'));
            loadList();
            const top = el('viewMaterials');
            if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        el('matPreviewDownload').addEventListener('click', function () {
            if (state.previewItem) downloadItem(state.previewItem);
        });
        el('matPreviewEdit').addEventListener('click', function () {
            const item = state.previewItem;
            if (!item) return;
            closeModal('preview');
            openEditModal(item);
        });
        el('matPreviewBody').addEventListener('click', function (e) {
            if (e.target && e.target.id === 'matUnsupportedDownload' && state.previewItem) {
                downloadItem(state.previewItem);
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            const open = Object.keys(MODAL_IDS).filter(name => {
                const node = el(MODAL_IDS[name]);
                return node && !node.hidden;
            });
            if (open.length) closeModal(open[open.length - 1]);
        });
    }

    /* ---------------- 入口 ---------------- */
    async function enter() {
        if (!state.initialized) {
            bindEvents();
            state.initialized = true;
        }
        closeAllModals();
        // 先取文件夹，再渲染列表：卡片/列表底部下拉必须一开始就带完整选项
        await loadFolders();
        await loadCategories();
        await loadList();
    }

    PQ.materials = { enter: enter };
})();
