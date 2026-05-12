
(function () {
    'use strict';

    // ─── Auth Config ─────────────────────────────────────────────
    // SHA-256 of the admin password.
    // Default: "CalOlimpico@Admin"
    const ADMIN_PASSWORD_HASH = '315b0921c11ccc2c5066cb1459de9fe0b221ea29bf08682653a74a16e95c894a';

    const SESSION_KEY         = 'calolimpico_admin_auth';
    const ATTEMPTS_KEY        = 'calolimpico_admin_attempts';
    const LOCKOUT_KEY         = 'calolimpico_admin_lockout';
    const MAX_ATTEMPTS        = 5;
    const LOCKOUT_DURATION_MS = 60_000; // 60 seconds

    // ─── State ───────────────────────────────────────────────────
    let olimpiadas = [];
    let editingIndex = null; // null = adding new, number = editing existing
    let quickFilter = 'all';
    let modalDirty = false;

    // ─── DOM ─────────────────────────────────────────────────────
    const loginScreen    = document.getElementById('login-screen');
    const adminScreen    = document.getElementById('admin-screen');
    const loginForm      = document.getElementById('login-form');
    const passwordInput  = document.getElementById('password-input');
    const loginError     = document.getElementById('login-error');
    const loginErrorText = document.getElementById('login-error-text');
    const loginLockout   = document.getElementById('login-lockout');
    const lockoutCountdown = document.getElementById('lockout-countdown');
    const loginBtnText   = document.getElementById('login-btn-text');
    const loginSpinner   = document.getElementById('login-spinner');
    const logoutBtn      = document.getElementById('logout-btn');
    const addBtn         = document.getElementById('add-btn');
    const exportBtn      = document.getElementById('export-btn');
    const exportBtnMobile = document.getElementById('export-btn-mobile');
    const searchInput    = document.getElementById('search-input');
    const olimpiadasList = document.getElementById('olimpiadas-list');
    const emptyState     = document.getElementById('empty-state');
    const countLabel     = document.getElementById('count-label');
    const quickFiltersEl = document.getElementById('quick-filters');
    const metricTotal = document.getElementById('metric-total');
    const metricOpenSoon = document.getElementById('metric-open-soon');
    const metricMissingEvents = document.getElementById('metric-missing-events');
    const metricMissingMaterials = document.getElementById('metric-missing-materials');

    const modal          = document.getElementById('modal');
    const modalBackdrop  = document.getElementById('modal-backdrop');
    const modalClose     = document.getElementById('modal-close');
    const modalCancel    = document.getElementById('modal-cancel');
    const modalSave      = document.getElementById('modal-save');
    const modalTitle     = document.getElementById('modal-title');
    const modalError     = document.getElementById('modal-error');
    const modalErrorText = document.getElementById('modal-error-text');

    const confirmDialog  = document.getElementById('confirm-dialog');
    const confirmText    = document.getElementById('confirm-text');
    const confirmCancel  = document.getElementById('confirm-cancel');
    const confirmDelete  = document.getElementById('confirm-delete');

    // Modal form fields
    const fId           = document.getElementById('f-id');
    const fSigla        = document.getElementById('f-sigla');
    const fNome         = document.getElementById('f-nome');
    const fModalidade   = document.getElementById('f-modalidade');
    const fMaterias     = document.getElementById('f-materias');
    const fSiteOficial  = document.getElementById('f-site-oficial');
    const fDescricao    = document.getElementById('f-descricao');
    const eventosListEl = document.getElementById('eventos-list');
    const eventosEmpty  = document.getElementById('eventos-empty');
    const materiaisListEl = document.getElementById('materiais-list');
    const materiaisEmpty  = document.getElementById('materiais-empty');
    const addEventoBtn  = document.getElementById('add-evento-btn');
    const addMaterialBtn = document.getElementById('add-material-btn');
    const nivelCheckboxes = document.getElementById('nivel-checkboxes');
    const modalDirtyIndicator = document.getElementById('modal-dirty-indicator');

    const NIVEIS = [
        'Ensino Fundamental I',
        'Ensino Fundamental II',
        'Ensino Médio',
        'Livre',
    ];

    // ═══════════════════════════════════════════════════════════
    // Crypto Helpers
    // ═══════════════════════════════════════════════════════════
    async function sha256(text) {
        const msgBuffer = new TextEncoder().encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ═══════════════════════════════════════════════════════════
    // Auth — session validation, rate limiting, guard
    // ═══════════════════════════════════════════════════════════

    /**
     * Stores the actual password hash (not just '1') so that the session
     * cannot be forged by simply setting the key to an arbitrary value
     * from the browser console.
     */
    function isAuthenticated() {
        return sessionStorage.getItem(SESSION_KEY) === ADMIN_PASSWORD_HASH;
    }

    function setAuth(value) {
        if (value) {
            sessionStorage.setItem(SESSION_KEY, ADMIN_PASSWORD_HASH);
        } else {
            sessionStorage.removeItem(SESSION_KEY);
        }
    }

    // ─── Rate limiting ────────────────────────────────────────
    function isLockedOut() {
        const until = parseInt(sessionStorage.getItem(LOCKOUT_KEY) || '0', 10);
        return Date.now() < until;
    }

    function lockoutRemainingSeconds() {
        const until = parseInt(sessionStorage.getItem(LOCKOUT_KEY) || '0', 10);
        return Math.max(0, Math.ceil((until - Date.now()) / 1000));
    }

    function recordFailedAttempt() {
        const attempts = parseInt(sessionStorage.getItem(ATTEMPTS_KEY) || '0', 10) + 1;
        if (attempts >= MAX_ATTEMPTS) {
            sessionStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_DURATION_MS));
            sessionStorage.setItem(ATTEMPTS_KEY, '0');
            startLockoutCountdown();
        } else {
            sessionStorage.setItem(ATTEMPTS_KEY, String(attempts));
            const remaining = MAX_ATTEMPTS - attempts;
            const plural = remaining !== 1;
            showLoginError(`Senha incorreta. ${remaining} tentativa${plural ? 's' : ''} restante${plural ? 's' : ''}.`);
        }
    }

    function clearRateLimitState() {
        sessionStorage.removeItem(ATTEMPTS_KEY);
        sessionStorage.removeItem(LOCKOUT_KEY);
    }

    let lockoutTimer = null;

    function startLockoutCountdown() {
        const loginBtn = document.getElementById('login-btn');
        loginError.classList.add('hidden');
        loginLockout.classList.remove('hidden');
        passwordInput.disabled = true;
        loginBtn.disabled = true;

        function tick() {
            const secs = lockoutRemainingSeconds();
            lockoutCountdown.textContent = secs;
            if (secs <= 0) {
                loginLockout.classList.add('hidden');
                passwordInput.disabled = false;
                loginBtn.disabled = false;
                passwordInput.focus();
                lockoutTimer = null;
            } else {
                lockoutTimer = setTimeout(tick, 1000);
            }
        }
        tick();
    }

    // ─── Guard — called before every privileged action ───────
    function guardAdmin() {
        if (!isAuthenticated()) {
            handleLogout();
            return false;
        }
        return true;
    }

    function showLoginError(msg) {
        loginErrorText.textContent = msg;
        loginError.classList.remove('hidden');
    }

    function showLoginScreen() {
        loginScreen.classList.remove('hidden');
        adminScreen.classList.add('hidden');
        // Close any open dialogs/modals so they don't remain visible
        modal.classList.add('hidden');
        confirmDialog.classList.add('hidden');
        document.body.style.overflow = '';
        passwordInput.value = '';
        loginError.classList.add('hidden');
        loginLockout.classList.add('hidden');
        // Restore lockout countdown if still active
        if (isLockedOut()) startLockoutCountdown();
    }

    function showAdminScreen() {
        loginScreen.classList.add('hidden');
        adminScreen.classList.remove('hidden');
    }

    async function handleLogin(e) {
        e.preventDefault();

        if (isLockedOut()) return; // blocked — shouldn't be reachable with button disabled

        const pwd = passwordInput.value.trim();
        if (!pwd) return;

        // Show spinner
        loginBtnText.textContent = 'Verificando...';
        loginSpinner.classList.remove('hidden');
        loginError.classList.add('hidden');

        try {
            const hash = await sha256(pwd);
            if (hash === ADMIN_PASSWORD_HASH) {
                clearRateLimitState();
                setAuth(true);
                showAdminScreen();
                await loadData();
            } else {
                passwordInput.value = '';
                passwordInput.focus();
                recordFailedAttempt();
            }
        } catch (err) {
            console.error('Auth error:', err);
            showLoginError('Erro ao verificar a senha. Tente novamente.');
        } finally {
            loginBtnText.textContent = 'Entrar';
            loginSpinner.classList.add('hidden');
        }
    }

    function handleLogout() {
        setAuth(false);
        olimpiadas = [];
        if (lockoutTimer) {
            clearTimeout(lockoutTimer);
            lockoutTimer = null;
        }
        showLoginScreen();
    }

    // Re-validate auth whenever the tab becomes visible again (guards against
    // session being cleared in another tab or via DevTools while away)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !adminScreen.classList.contains('hidden')) {
            if (!isAuthenticated()) {
                handleLogout();
            }
        }
    });

    // ═══════════════════════════════════════════════════════════
    // Data Loading
    // ═══════════════════════════════════════════════════════════
    async function loadData() {
        try {
            const res = await fetch('dados.json?_=' + Date.now());
            if (!res.ok) throw new Error('HTTP ' + res.status);
            olimpiadas = await res.json();
        } catch (err) {
            olimpiadas = [];
            showToast('Erro ao carregar dados.json: ' + err.message, 'error');
        }
        renderList();
    }

    // ═══════════════════════════════════════════════════════════
    // Render List
    // ═══════════════════════════════════════════════════════════
    function getEventReferenceDate(ev) {
        return ev?.data || ev?.['data-f'] || ev?.['data-i'] || '';
    }

    function getInscricaoDate(o) {
        const ev = (o.eventos || []).find(e => e.tipo === 'Inscrição');
        return getEventReferenceDate(ev);
    }

    function daysUntil(dateStr) {
        if (!dateStr) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(dateStr + 'T00:00:00');
        return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    }

    function getOlimpiadaFlags(o) {
        const hasEvents = (o.eventos || []).length > 0;
        const hasMaterials = (o.materiais_estudo || []).length > 0;
        const hasSite = !!String(o.site_oficial || '').trim();
        const hasDescription = !!String(o.descricao || '').trim();
        const inscricaoDays = daysUntil(getInscricaoDate(o));
        const openSoon = inscricaoDays !== null && inscricaoDays >= 0 && inscricaoDays <= 30;
        const incomplete = !hasEvents || !hasMaterials || !hasSite || !hasDescription;
        return { hasEvents, hasMaterials, hasSite, hasDescription, openSoon, incomplete };
    }

    function matchesQuickFilter(o) {
        const flags = getOlimpiadaFlags(o);
        if (quickFilter === 'needs-events') return !flags.hasEvents;
        if (quickFilter === 'needs-materials') return !flags.hasMaterials;
        if (quickFilter === 'open-soon') return flags.openSoon;
        if (quickFilter === 'incomplete') return flags.incomplete;
        return true;
    }

    function updateQuickFilterUI() {
        if (!quickFiltersEl) return;
        quickFiltersEl.querySelectorAll('.admin-filter-btn').forEach(btn => {
            const active = btn.dataset.filter === quickFilter;
            if (active) {
                btn.classList.remove('bg-slate-800', 'border', 'border-slate-700', 'text-slate-300', 'hover:text-white');
                btn.classList.add('bg-yellow-400', 'text-slate-900');
            } else {
                btn.classList.remove('bg-yellow-400', 'text-slate-900');
                btn.classList.add('bg-slate-800', 'border', 'border-slate-700', 'text-slate-300', 'hover:text-white');
            }
        });
    }

    function updateMetrics() {
        const openSoonCount = olimpiadas.filter(o => getOlimpiadaFlags(o).openSoon).length;
        const missingEventsCount = olimpiadas.filter(o => !getOlimpiadaFlags(o).hasEvents).length;
        const missingMaterialsCount = olimpiadas.filter(o => !getOlimpiadaFlags(o).hasMaterials).length;
        metricTotal.textContent = String(olimpiadas.length);
        metricOpenSoon.textContent = String(openSoonCount);
        metricMissingEvents.textContent = String(missingEventsCount);
        metricMissingMaterials.textContent = String(missingMaterialsCount);
    }

    function renderList(filter) {
        const query = (filter ?? searchInput.value).toLowerCase().trim();
        const filtered = olimpiadas.filter(o => {
            if (!matchesQuickFilter(o)) return false;
            if (!query) return true;
            return (
                o.sigla.toLowerCase().includes(query) ||
                o.nome.toLowerCase().includes(query) ||
                (o.materias || []).some(m => m.toLowerCase().includes(query)) ||
                (o.nivel_escolar || []).some(n => n.toLowerCase().includes(query)) ||
                String(o.descricao || '').toLowerCase().includes(query)
            );
        });

        updateMetrics();
        updateQuickFilterUI();

        countLabel.textContent = `${filtered.length} de ${olimpiadas.length} olimpíada${olimpiadas.length !== 1 ? 's' : ''}`;

        if (filtered.length === 0) {
            olimpiadasList.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
        emptyState.classList.add('hidden');

        olimpiadasList.innerHTML = filtered.map((o, visIdx) => {
            const realIdx = olimpiadas.indexOf(o);
            const eventCount = (o.eventos || []).length;
            const matCount   = (o.materiais_estudo || []).length;
            const nivelBadges = (o.nivel_escolar || [])
                .map(n => `<span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700 text-slate-300">${escHtml(n)}</span>`)
                .join('');
            const materiaBadges = (o.materias || [])
                .map(m => `<span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/40 text-blue-300">${escHtml(m)}</span>`)
                .join('');
            const modalidadeColor = {
                'Presencial': 'bg-green-900/40 text-green-300',
                'Online':     'bg-blue-900/40 text-blue-300',
                'Híbrida':    'bg-purple-900/40 text-purple-300',
            }[o.modalidade] || 'bg-slate-700 text-slate-300';

            const flags = getOlimpiadaFlags(o);
            const statusBadges = [
                !flags.hasEvents ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">Sem cronograma</span>' : '',
                !flags.hasMaterials ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">Sem materiais</span>' : '',
                flags.openSoon ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Inscrição próxima</span>' : '',
            ].filter(Boolean).join('');

            return `
            <div class="group flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-4 bg-slate-800 hover:bg-slate-800/80 transition-colors" data-idx="${realIdx}">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs font-bold text-yellow-400 font-mono">${escHtml(o.sigla)}</span>
                        <span class="hidden sm:block text-slate-600">·</span>
                        <span class="text-sm font-medium text-slate-100 truncate">${escHtml(o.nome)}</span>
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-medium ${modalidadeColor}">${escHtml(o.modalidade || '—')}</span>
                    </div>
                    <div class="flex flex-wrap gap-1 mt-1.5">
                        ${nivelBadges}
                        ${materiaBadges}
                    </div>
                    <div class="mt-1 text-xs text-slate-500">
                        ${eventCount} evento${eventCount !== 1 ? 's' : ''} · ${matCount} material${matCount !== 1 ? 'is' : ''} · ID: <code class="text-slate-400">${escHtml(o.id)}</code>
                    </div>
                    ${statusBadges ? `<div class="mt-2 flex flex-wrap gap-1">${statusBadges}</div>` : ''}
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button
                        class="edit-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 transition-colors"
                        data-idx="${realIdx}"
                    >
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        Editar
                    </button>
                    <button
                        class="delete-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/40 transition-colors"
                        data-idx="${realIdx}"
                    >
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        Remover
                    </button>
                </div>
            </div>`;
        }).join('');

        // Bind row buttons
        olimpiadasList.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openModal(parseInt(btn.dataset.idx, 10)));
        });
        olimpiadasList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => openConfirmDelete(parseInt(btn.dataset.idx, 10)));
        });
    }

    // ═══════════════════════════════════════════════════════════
    // Modal — open / close
    // ═══════════════════════════════════════════════════════════
    function buildNivelCheckboxes(selected) {
        nivelCheckboxes.innerHTML = NIVEIS.map(n => {
            const checked = (selected || []).includes(n);
            const id = 'nivel-' + n.replace(/\s+/g, '-');
            return `
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="${id}" value="${escAttr(n)}" ${checked ? 'checked' : ''}
                    class="nivel-checkbox sr-only">
                <span class="nivel-label inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-slate-600 text-slate-300 hover:border-yellow-400/40 transition-all cursor-pointer select-none">${escHtml(n)}</span>
            </label>`;
        }).join('');

        // Toggle visual style on change
        nivelCheckboxes.querySelectorAll('.nivel-checkbox').forEach(cb => {
            const label = cb.nextElementSibling;
            cb.addEventListener('change', () => syncNivelLabel(cb, label));
            syncNivelLabel(cb, label);
        });
    }

    function syncNivelLabel(cb, label) {
        if (cb.checked) {
            label.classList.add('bg-yellow-400/15', 'border-yellow-400/50', 'text-yellow-300');
            label.classList.remove('text-slate-300', 'border-slate-600');
        } else {
            label.classList.remove('bg-yellow-400/15', 'border-yellow-400/50', 'text-yellow-300');
            label.classList.add('text-slate-300', 'border-slate-600');
        }
    }

    function getSelectedNiveis() {
        return Array.from(nivelCheckboxes.querySelectorAll('.nivel-checkbox:checked')).map(cb => cb.value);
    }

    function openModal(idx) {
        if (!guardAdmin()) return;
        editingIndex = (idx === undefined) ? null : idx;
        const o = (editingIndex !== null) ? olimpiadas[editingIndex] : null;

        modalTitle.textContent = o ? 'Editar Olimpíada' : 'Adicionar Olimpíada';
        hideModalError();

        // Populate fields
        fSigla.value     = o ? o.sigla      : '';
        fId.value        = o ? o.id         : '';
        fNome.value      = o ? o.nome       : '';
        fModalidade.value = o ? (o.modalidade || '') : '';
        fMaterias.value  = o ? (o.materias || []).join(', ') : '';
        fSiteOficial.value = o ? (o.site_oficial || '') : '';
        fDescricao.value = o ? (o.descricao || '') : '';

        buildNivelCheckboxes(o ? o.nivel_escolar : []);
        renderEventos(o ? (o.eventos || []) : []);
        renderMateriais(o ? (o.materiais_estudo || []) : []);

        // Auto-generate ID from sigla (only when adding new)
        if (!o) {
            fSigla.addEventListener('input', autoGenerateId, { once: false });
        } else {
            fSigla.removeEventListener('input', autoGenerateId);
        }

        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        setModalDirty(false);
        fSigla.focus();
    }

    function autoGenerateId() {
        if (!fId.value || fId.dataset.manual !== '1') {
            const year = new Date().getFullYear();
            fId.value = fSigla.value.toLowerCase().replace(/[^a-z0-9]/g, '') + year;
        }
    }

    function setModalDirty(value) {
        modalDirty = !!value;
        if (modalDirty) modalDirtyIndicator.classList.remove('hidden');
        else modalDirtyIndicator.classList.add('hidden');
    }

    function closeModal(forceClose = false) {
        const force = forceClose === true;
        if (modalDirty && !force) {
            const shouldClose = window.confirm('Existem alterações não salvas. Deseja fechar mesmo assim?');
            if (!shouldClose) return;
        }
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        fSigla.removeEventListener('input', autoGenerateId);
        fId.dataset.manual = '';
        editingIndex = null;
        setModalDirty(false);
    }

    function showModalError(msg) {
        modalErrorText.textContent = msg;
        modalError.classList.remove('hidden');
        modalError.classList.add('flex');
    }

    function hideModalError() {
        modalError.classList.add('hidden');
        modalError.classList.remove('flex');
    }

    // ═══════════════════════════════════════════════════════════
    // Eventos sub-editor
    // ═══════════════════════════════════════════════════════════
    let eventosBuffer = [];

    function renderEventos(eventos) {
        eventosBuffer = eventos.map(e => ({ ...e }));
        _redrawEventos();
    }

    function _redrawEventos() {
        if (eventosBuffer.length === 0) {
            eventosListEl.innerHTML = '';
            eventosEmpty.classList.remove('hidden');
            return;
        }
        eventosEmpty.classList.add('hidden');

        eventosListEl.innerHTML = eventosBuffer.map((e, i) => {
            const isRange = ('data-i' in e) || ('data-f' in e);
            return `
            <div class="evento-row bg-slate-900/60 border border-slate-700 rounded-xl p-3 space-y-2" data-ei="${i}">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex-1 grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[10px] font-medium text-slate-400 mb-1">Tipo</label>
                            <input type="text" class="evento-tipo admin-input w-full text-xs" value="${escAttr(e.tipo || '')}" placeholder="Ex: Inscrição, Prova">
                        </div>
                        <div>
                            <label class="block text-[10px] font-medium text-slate-400 mb-1">Tipo de data</label>
                            <select class="evento-date-type admin-input w-full text-xs">
                                <option value="single" ${!isRange ? 'selected' : ''}>Data única</option>
                                <option value="range"  ${isRange  ? 'selected' : ''}>Intervalo</option>
                            </select>
                        </div>
                    </div>
                    <button class="evento-remove mt-5 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors shrink-0">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="evento-date-fields grid gap-2 ${isRange ? 'grid-cols-2' : 'grid-cols-1'}">
                    ${isRange
                        ? `<div><label class="block text-[10px] font-medium text-slate-400 mb-1">Data início</label>
                           <input type="date" class="evento-date-i admin-input w-full text-xs" value="${escAttr(e['data-i'] || '')}"></div>
                           <div><label class="block text-[10px] font-medium text-slate-400 mb-1">Data fim</label>
                           <input type="date" class="evento-date-f admin-input w-full text-xs" value="${escAttr(e['data-f'] || '')}"></div>`
                        : `<div><label class="block text-[10px] font-medium text-slate-400 mb-1">Data</label>
                           <input type="date" class="evento-date admin-input w-full text-xs" value="${escAttr(e.data || '')}"></div>`
                    }
                </div>
                <div>
                    <label class="block text-[10px] font-medium text-slate-400 mb-1">Descrição</label>
                    <input type="text" class="evento-desc admin-input w-full text-xs" value="${escAttr(e.descricao || '')}" placeholder="Descrição do evento">
                </div>
            </div>`;
        }).join('');

        // Bind remove buttons
        eventosListEl.querySelectorAll('.evento-remove').forEach((btn, i) => {
            btn.addEventListener('click', () => {
                eventosBuffer.splice(i, 1);
                _redrawEventos();
                setModalDirty(true);
            });
        });

        // Bind date type switches
        eventosListEl.querySelectorAll('.evento-date-type').forEach((sel, i) => {
            sel.addEventListener('change', () => {
                collectEventosFromDOM();
                const wasRange = ('data-i' in eventosBuffer[i]) || ('data-f' in eventosBuffer[i]);
                if (sel.value === 'range' && !wasRange) {
                    eventosBuffer[i] = { ...eventosBuffer[i], 'data-i': '', 'data-f': '' };
                    delete eventosBuffer[i].data;
                } else if (sel.value === 'single' && wasRange) {
                    eventosBuffer[i] = { ...eventosBuffer[i], data: '' };
                    delete eventosBuffer[i]['data-i'];
                    delete eventosBuffer[i]['data-f'];
                }
                _redrawEventos();
                setModalDirty(true);
            });
        });
    }

    function collectEventosFromDOM() {
        eventosListEl.querySelectorAll('.evento-row').forEach((row, i) => {
            if (!eventosBuffer[i]) return;
            const tipo = row.querySelector('.evento-tipo').value.trim();
            const desc = row.querySelector('.evento-desc').value.trim();
            const dateType = row.querySelector('.evento-date-type').value;

            eventosBuffer[i].tipo = tipo;
            eventosBuffer[i].descricao = desc;

            if (dateType === 'range') {
                eventosBuffer[i]['data-i'] = row.querySelector('.evento-date-i')?.value || '';
                eventosBuffer[i]['data-f'] = row.querySelector('.evento-date-f')?.value || '';
                delete eventosBuffer[i].data;
            } else {
                eventosBuffer[i].data = row.querySelector('.evento-date')?.value || '';
                delete eventosBuffer[i]['data-i'];
                delete eventosBuffer[i]['data-f'];
            }
        });
    }

    function addEvento() {
        eventosBuffer.push({ tipo: '', data: '', descricao: '' });
        _redrawEventos();
        setModalDirty(true);
        // Scroll to new event
        const rows = eventosListEl.querySelectorAll('.evento-row');
        if (rows.length > 0) rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ═══════════════════════════════════════════════════════════
    // Materiais sub-editor
    // ═══════════════════════════════════════════════════════════
    let materiaisBuffer = [];

    function renderMateriais(materiais) {
        materiaisBuffer = materiais.map(m => ({ ...m }));
        _redrawMateriais();
    }

    function _redrawMateriais() {
        if (materiaisBuffer.length === 0) {
            materiaisListEl.innerHTML = '';
            materiaisEmpty.classList.remove('hidden');
            return;
        }
        materiaisEmpty.classList.add('hidden');

        materiaisListEl.innerHTML = materiaisBuffer.map((m, i) => `
            <div class="material-row bg-slate-900/60 border border-slate-700 rounded-xl p-3" data-mi="${i}">
                <div class="flex items-start gap-2">
                    <div class="flex-1 grid grid-cols-1 gap-2">
                        <div>
                            <label class="block text-[10px] font-medium text-slate-400 mb-1">Título</label>
                            <input type="text" class="material-titulo admin-input w-full text-xs" value="${escAttr(m.titulo || '')}" placeholder="Nome do material">
                        </div>
                        <div>
                            <label class="block text-[10px] font-medium text-slate-400 mb-1">URL</label>
                            <input type="url" class="material-url admin-input w-full text-xs" value="${escAttr(m.url || '')}" placeholder="https://...">
                        </div>
                    </div>
                    <button class="material-remove mt-5 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors shrink-0">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

        materiaisListEl.querySelectorAll('.material-remove').forEach((btn, i) => {
            btn.addEventListener('click', () => {
                materiaisBuffer.splice(i, 1);
                _redrawMateriais();
                setModalDirty(true);
            });
        });
    }

    function collectMateriaisFromDOM() {
        materiaisListEl.querySelectorAll('.material-row').forEach((row, i) => {
            if (!materiaisBuffer[i]) return;
            materiaisBuffer[i].titulo = row.querySelector('.material-titulo').value.trim();
            materiaisBuffer[i].url    = row.querySelector('.material-url').value.trim();
        });
    }

    function addMaterial() {
        materiaisBuffer.push({ titulo: '', url: '' });
        _redrawMateriais();
        setModalDirty(true);
        const rows = materiaisListEl.querySelectorAll('.material-row');
        if (rows.length > 0) rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ═══════════════════════════════════════════════════════════
    // Save Modal
    // ═══════════════════════════════════════════════════════════
    function saveModal() {
        if (!guardAdmin()) return;
        hideModalError();

        // Collect sub-editors
        collectEventosFromDOM();
        collectMateriaisFromDOM();

        // Validate
        const sigla = fSigla.value.trim();
        const id    = fId.value.trim();
        const nome  = fNome.value.trim();
        const modalidade = fModalidade.value;
        const siteOficial = fSiteOficial.value.trim();
        const descricao = fDescricao.value.trim();

        if (!sigla) return showModalError('A sigla é obrigatória.');
        if (!id)    return showModalError('O ID é obrigatório.');
        if (!nome)  return showModalError('O nome é obrigatório.');
        if (!modalidade) return showModalError('Selecione a modalidade.');
        if (siteOficial && !/^https?:\/\/.+/i.test(siteOficial)) {
            return showModalError('O site oficial deve começar com http:// ou https://');
        }

        // Check for duplicate ID (when adding, or when editing and ID changed)
        const existingIdx = olimpiadas.findIndex(o => o.id === id);
        if (existingIdx !== -1 && existingIdx !== editingIndex) {
            return showModalError(`ID "${id}" já está em uso por "${olimpiadas[existingIdx].sigla}".`);
        }

        const materias = fMaterias.value.split(',').map(s => s.trim()).filter(Boolean);
        const niveis   = getSelectedNiveis();

        const knownKeys = new Set([
            'id',
            'sigla',
            'nome',
            'nivel_escolar',
            'materias',
            'modalidade',
            'descricao',
            'site_oficial',
            'eventos',
            'materiais_estudo',
        ]);
        const existing = editingIndex !== null ? olimpiadas[editingIndex] : null;
        const preservedFields = existing
            ? Object.fromEntries(Object.entries(existing).filter(([key]) => !knownKeys.has(key)))
            : {};

        const obj = {
            ...preservedFields,
            id,
            sigla,
            nome,
            nivel_escolar: niveis,
            materias,
            modalidade,
            descricao,
            site_oficial: siteOficial,
            eventos: eventosBuffer.filter(e => e.tipo || e.data || e['data-i'] || e['data-f'] || e.descricao),
            materiais_estudo: materiaisBuffer.filter(m => m.titulo || m.url),
        };

        if (editingIndex !== null) {
            olimpiadas[editingIndex] = obj;
            showToast(`"${sigla}" atualizado com sucesso.`, 'success');
        } else {
            olimpiadas.push(obj);
            showToast(`"${sigla}" adicionado com sucesso.`, 'success');
        }

        closeModal(true);
        renderList();
    }

    // ═══════════════════════════════════════════════════════════
    // Delete
    // ═══════════════════════════════════════════════════════════
    let deleteTargetIdx = null;

    function openConfirmDelete(idx) {
        if (!guardAdmin()) return;
        deleteTargetIdx = idx;
        const o = olimpiadas[idx];
        confirmText.textContent = `Tem certeza que deseja remover "${o.nome}" (${o.sigla})? Esta ação não pode ser desfeita nesta sessão.`;
        confirmDialog.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeConfirmDialog() {
        confirmDialog.classList.add('hidden');
        document.body.style.overflow = '';
        deleteTargetIdx = null;
    }

    function handleDelete() {
        if (deleteTargetIdx === null) return;
        if (!guardAdmin()) return;
        const removed = olimpiadas.splice(deleteTargetIdx, 1)[0];
        closeConfirmDialog();
        renderList();
        showToast(`"${removed.sigla}" removido.`, 'info');
    }

    // ═══════════════════════════════════════════════════════════
    // Export JSON
    // ═══════════════════════════════════════════════════════════
    function exportJSON() {
        if (!guardAdmin()) return;
        const json = JSON.stringify(olimpiadas, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'dados.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('dados.json exportado. Substitua o arquivo no repositório para salvar.', 'success');
    }

    // ═══════════════════════════════════════════════════════════
    // Toast
    // ═══════════════════════════════════════════════════════════
    let toastTimer = null;
    const toast    = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    const toastIcon = document.getElementById('toast-icon');

    function showToast(msg, type) {
        const icons = {
            success: '✅',
            error:   '❌',
            info:    'ℹ️',
        };
        toastIcon.textContent = icons[type] || 'ℹ️';
        toastMsg.textContent  = msg;
        toast.classList.remove('hidden');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.add('hidden'), 4000);
    }

    // ═══════════════════════════════════════════════════════════
    // Utility
    // ═══════════════════════════════════════════════════════════
    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escAttr(str) {
        return String(str).replace(/"/g, '&quot;');
    }

    // ═══════════════════════════════════════════════════════════
    // Event Bindings
    // ═══════════════════════════════════════════════════════════
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    addBtn.addEventListener('click', () => openModal());
    exportBtn.addEventListener('click', exportJSON);
    exportBtnMobile.addEventListener('click', exportJSON);

    searchInput.addEventListener('input', () => renderList());
    if (quickFiltersEl) {
        quickFiltersEl.querySelectorAll('.admin-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                quickFilter = btn.dataset.filter || 'all';
                renderList();
            });
        });
    }

    // Modal
    modalClose.addEventListener('click', closeModal);
    modalCancel.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);
    modalSave.addEventListener('click', saveModal);
    addEventoBtn.addEventListener('click', addEvento);
    addMaterialBtn.addEventListener('click', addMaterial);
    modal.addEventListener('input', () => {
        if (!modal.classList.contains('hidden')) setModalDirty(true);
    });

    // Mark ID as manually edited so auto-generate doesn't override
    fId.addEventListener('input', () => { fId.dataset.manual = '1'; });

    // Confirm dialog
    confirmCancel.addEventListener('click', closeConfirmDialog);
    confirmDelete.addEventListener('click', handleDelete);

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (!confirmDialog.classList.contains('hidden')) closeConfirmDialog();
            else if (!modal.classList.contains('hidden')) closeModal();
        }
    });

    // ═══════════════════════════════════════════════════════════
    // Init
    // ═══════════════════════════════════════════════════════════
    if (isAuthenticated()) {
        showAdminScreen();
        loadData();
    } else {
        showLoginScreen();
    }

})();
