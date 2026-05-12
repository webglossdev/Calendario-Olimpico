(function () {
    'use strict';

    // ─── Auth Config ─────────────────────────────────────────────
    // SHA-256 hash of the admin password (do not store plaintext here).
    const ADMIN_PASSWORD_HASH = '315b0921c11ccc2c5066cb1459de9fe0b221ea29bf08682653a74a16e95c894a';

    const SESSION_KEY         = 'calolimpico_admin_auth';
    const ATTEMPTS_KEY        = 'calolimpico_admin_attempts';
    const LOCKOUT_KEY         = 'calolimpico_admin_lockout';
    const MAX_ATTEMPTS        = 5;
    const LOCKOUT_DURATION_MS = 60_000; // 60 seconds

    // ─── State ───────────────────────────────────────────────────
    let olimpiadas = [];
    let editingIndex = null; // null = adding new, number = editing existing

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
    const fDescricao    = document.getElementById('f-descricao');
    const fSiteOficial  = document.getElementById('f-site-oficial');
    const eventosListEl = document.getElementById('eventos-list');
    const eventosEmpty  = document.getElementById('eventos-empty');
    const materiaisListEl = document.getElementById('materiais-list');
    const materiaisEmpty  = document.getElementById('materiais-empty');
    const fontesListEl  = document.getElementById('fontes-list');
    const fontesEmpty   = document.getElementById('fontes-empty');
    const addEventoBtn  = document.getElementById('add-evento-btn');
    const addMaterialBtn = document.getElementById('add-material-btn');
    const addFonteBtn   = document.getElementById('add-fonte-btn');
    const nivelCheckboxes = document.getElementById('nivel-checkboxes');
    const tabButtons    = document.querySelectorAll('.modal-tab-btn');
    const tabPanels     = document.querySelectorAll('.modal-tab-panel');

    // Stats DOM
    const statTotal     = document.getElementById('stat-total');
    const statInscricao = document.getElementById('stat-inscricao');
    const statSemDesc   = document.getElementById('stat-sem-desc');
    const statSemEvento = document.getElementById('stat-sem-evento');

    const NIVEIS = [
        'Ensino Fundamental I',
        'Ensino Fundamental II',
        'Ensino Médio',
        'Livre',
    ];

    const EVENTO_TIPOS = ['Inscrição', 'Prova', 'Resultado', 'Premiação', 'Outro'];

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
        modal.classList.add('hidden');
        confirmDialog.classList.add('hidden');
        document.body.style.overflow = '';
        passwordInput.value = '';
        loginError.classList.add('hidden');
        loginLockout.classList.add('hidden');
        if (isLockedOut()) startLockoutCountdown();
    }

    function showAdminScreen() {
        loginScreen.classList.add('hidden');
        adminScreen.classList.remove('hidden');
    }

    async function handleLogin(e) {
        e.preventDefault();

        if (isLockedOut()) return;

        const pwd = passwordInput.value.trim();
        if (!pwd) return;

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
            loginBtnText.textContent = 'Autenticar Sessão';
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
    // Stats Dashboard
    // ═══════════════════════════════════════════════════════════
    function updateStats() {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const total = olimpiadas.length;
        let inscAberta = 0, semDesc = 0, semEvento = 0;
        olimpiadas.forEach(o => {
            if (!o.descricao) semDesc++;
            if (!o.eventos || o.eventos.length === 0) { semEvento++; return; }
            const inscEv = o.eventos.find(e => e.tipo === 'Inscrição');
            if (inscEv) {
                const fim = inscEv['data-f'] || inscEv.data || '';
                if (fim && new Date(fim + 'T23:59:59') >= hoje) inscAberta++;
            }
        });
        statTotal.textContent = total;
        statInscricao.textContent = inscAberta;
        statSemDesc.textContent = semDesc;
        statSemEvento.textContent = semEvento;
    }

    // ═══════════════════════════════════════════════════════════
    // Render List
    // ═══════════════════════════════════════════════════════════
    function renderList(filter) {
        const query = (filter ?? searchInput.value).toLowerCase().trim();
        const filtered = olimpiadas.filter(o => {
            if (!query) return true;
            return (
                o.sigla.toLowerCase().includes(query) ||
                o.nome.toLowerCase().includes(query) ||
                (o.materias || []).some(m => m.toLowerCase().includes(query)) ||
                (o.nivel_escolar || []).some(n => n.toLowerCase().includes(query)) ||
                (o.modalidade || '').toLowerCase().includes(query)
            );
        });

        countLabel.textContent = `${filtered.length} de ${olimpiadas.length} cadastrada${olimpiadas.length !== 1 ? 's' : ''}`;

        if (filtered.length === 0) {
            olimpiadasList.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
        emptyState.classList.add('hidden');

        olimpiadasList.innerHTML = filtered.map((o) => {
            const realIdx = olimpiadas.indexOf(o);
            const eventCount = (o.eventos || []).length;
            const matCount   = (o.materiais_estudo || []).length;
            const hasDesc    = !!o.descricao;
            const hasSite    = !!o.site_oficial;

            const nivelBadges = (o.nivel_escolar || [])
                .map(n => `<span class="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-950/50 border border-slate-800 text-slate-300">${escHtml(n)}</span>`)
                .join('');
            const materiaBadges = (o.materias || [])
                .map(m => `<span class="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-950/60 border border-blue-900/40 text-blue-300">${escHtml(m)}</span>`)
                .join('');
            const modalidadeColor = {
                'Presencial': 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
                'Online':     'bg-violet-500/10 border-violet-500/20 text-violet-400',
                'Híbrida':    'bg-amber-500/10 border-amber-500/20 text-amber-400',
            }[o.modalidade] || 'bg-slate-800 border-slate-700 text-slate-400';

            return `
            <div class="group p-5 hover:bg-slate-800/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/40 last:border-none" data-idx="${realIdx}">
                <div class="flex-1 min-w-0 space-y-2">
                    <div class="flex items-center gap-2.5 flex-wrap">
                        <span class="text-sm font-extrabold text-yellow-400 tracking-tight">${escHtml(o.sigla)}</span>
                        <span class="text-slate-600">•</span>
                        <span class="text-sm font-bold text-white truncate">${escHtml(o.nome)}</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold border ${modalidadeColor}">${escHtml(o.modalidade || '—')}</span>
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                        ${nivelBadges}
                        ${materiaBadges}
                    </div>
                    <div class="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                        <span><strong>${eventCount}</strong> evento${eventCount !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span><strong>${matCount}</strong> material${matCount !== 1 ? 'is' : ''}</span>
                        <span>•</span>
                        <span class="${hasDesc ? 'text-emerald-400/80 font-medium' : 'text-slate-600'}">${hasDesc ? '✓ Descrição' : '✗ Sem Descrição'}</span>
                        <span>•</span>
                        <span class="${hasSite ? 'text-blue-400/80 font-medium' : 'text-slate-600'}">${hasSite ? '✓ Link Oficial' : '✗ Sem Link'}</span>
                        <span>•</span>
                        <span class="text-slate-600 font-mono">ID: ${escHtml(o.id)}</span>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button
                        class="edit-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition-all shadow-sm"
                        data-idx="${realIdx}"
                        title="Editar detalhes e datas"
                    >
                        <svg class="w-3.5 h-3.5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        Editar
                    </button>
                    <button
                        class="delete-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 border border-red-500/20 transition-all shadow-sm"
                        data-idx="${realIdx}"
                        title="Remover permanentemente"
                    >
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        Excluir
                    </button>
                </div>
            </div>`;
        }).join('');

        olimpiadasList.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openModal(parseInt(btn.dataset.idx, 10)));
        });
        olimpiadasList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => openConfirmDelete(parseInt(btn.dataset.idx, 10)));
        });

        updateStats();
    }

    // ═══════════════════════════════════════════════════════════
    // Modal Tabs Navigation Logic
    // ═══════════════════════════════════════════════════════════
    function switchTab(targetTabId) {
        tabButtons.forEach(btn => {
            const isTarget = btn.dataset.tab === targetTabId;
            if (isTarget) {
                btn.classList.add('active', 'border-yellow-400', 'text-yellow-400');
                btn.classList.remove('border-transparent', 'text-slate-400');
            } else {
                btn.classList.remove('active', 'border-yellow-400', 'text-yellow-400');
                btn.classList.add('border-transparent', 'text-slate-400');
            }
        });

        tabPanels.forEach(panel => {
            if (panel.id === targetTabId) {
                panel.classList.remove('hidden');
                panel.classList.add('block');
            } else {
                panel.classList.remove('block');
                panel.classList.add('hidden');
            }
        });
    }

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

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
                <span class="nivel-label inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700/80 bg-slate-950/40 text-slate-300 hover:border-yellow-400/40 transition-all select-none">${escHtml(n)}</span>
            </label>`;
        }).join('');

        nivelCheckboxes.querySelectorAll('.nivel-checkbox').forEach(cb => {
            const label = cb.nextElementSibling;
            cb.addEventListener('change', () => syncNivelLabel(cb, label));
            syncNivelLabel(cb, label);
        });
    }

    function syncNivelLabel(cb, label) {
        if (cb.checked) {
            label.classList.add('bg-yellow-400/15', 'border-yellow-400/50', 'text-yellow-300');
            label.classList.remove('text-slate-300', 'border-slate-700/80', 'bg-slate-950/40');
        } else {
            label.classList.remove('bg-yellow-400/15', 'border-yellow-400/50', 'text-yellow-300');
            label.classList.add('text-slate-300', 'border-slate-700/80', 'bg-slate-950/40');
        }
    }

    function getSelectedNiveis() {
        return Array.from(nivelCheckboxes.querySelectorAll('.nivel-checkbox:checked')).map(cb => cb.value);
    }

    function openModal(idx) {
        if (!guardAdmin()) return;
        editingIndex = (idx === undefined) ? null : idx;
        const o = (editingIndex !== null) ? olimpiadas[editingIndex] : null;

        modalTitle.textContent = o ? `Editar: ${o.sigla}` : 'Cadastrar Nova Olimpíada';
        hideModalError();
        
        // Always reset modal to the first tab for consistent UX
        switchTab('tab-geral');

        // Populate basic fields
        fSigla.value      = o ? o.sigla      : '';
        fId.value         = o ? o.id         : '';
        fNome.value       = o ? o.nome       : '';
        fModalidade.value = o ? (o.modalidade || '') : '';
        fMaterias.value   = o ? (o.materias || []).join(', ') : '';
        
        // Populate new native fields
        fDescricao.value   = o ? (o.descricao || '') : '';
        fSiteOficial.value = o ? (o.site_oficial || '') : '';

        buildNivelCheckboxes(o ? o.nivel_escolar : []);
        renderEventos(o ? (o.eventos || []) : []);
        renderMateriais(o ? (o.materiais_estudo || []) : []);
        renderFontes(o ? (o.fontes_oficiais || []) : []);

        if (!o) {
            fSigla.addEventListener('input', autoGenerateId, { once: false });
        } else {
            fSigla.removeEventListener('input', autoGenerateId);
        }

        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        fSigla.focus();
    }

    function autoGenerateId() {
        if (!fId.value || fId.dataset.manual !== '1') {
            const year = new Date().getFullYear();
            fId.value = fSigla.value.toLowerCase().replace(/[^a-z0-9]/g, '') + year;
        }
    }

    function closeModal() {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        fSigla.removeEventListener('input', autoGenerateId);
        fId.dataset.manual = '';
        editingIndex = null;
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
            const tipoOptions = EVENTO_TIPOS.map(t =>
                `<option value="${escAttr(t)}" ${(e.tipo || '') === t ? 'selected' : ''}>${escHtml(t)}</option>`
            ).join('');
            const tipoIsCustom = e.tipo && !EVENTO_TIPOS.includes(e.tipo);
            return `
            <div class="evento-row backdrop-blur-md bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3 transition-all hover:border-slate-700" data-ei="${i}">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo de Evento</label>
                            <select class="evento-tipo admin-input w-full text-xs font-semibold text-yellow-400">
                                ${tipoOptions}
                                ${tipoIsCustom ? `<option value="${escAttr(e.tipo)}" selected>${escHtml(e.tipo)}</option>` : ''}
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Formato de Data</label>
                            <select class="evento-date-type admin-input w-full text-xs">
                                <option value="single" ${!isRange ? 'selected' : ''}>Data Específica</option>
                                <option value="range"  ${isRange  ? 'selected' : ''}>Período / Intervalo</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex flex-col gap-1 mt-4 shrink-0">
                        <button class="evento-up p-1 rounded-lg text-slate-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors ${i === 0 ? 'opacity-30 pointer-events-none' : ''}" title="Mover para cima">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>
                        </button>
                        <button class="evento-down p-1 rounded-lg text-slate-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors ${i === eventosBuffer.length - 1 ? 'opacity-30 pointer-events-none' : ''}" title="Mover para baixo">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                        </button>
                        <button class="evento-remove p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Excluir evento">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>
                </div>
                <div class="evento-date-fields grid gap-3 ${isRange ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} pt-1 border-t border-slate-900">
                    ${isRange
                        ? `<div><label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Data Inicial</label>
                           <input type="date" class="evento-date-i admin-input w-full text-xs font-mono" value="${escAttr(e['data-i'] || '')}"></div>
                           <div><label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Data Final</label>
                           <input type="date" class="evento-date-f admin-input w-full text-xs font-mono" value="${escAttr(e['data-f'] || '')}"></div>`
                        : `<div><label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Data do Evento</label>
                           <input type="date" class="evento-date admin-input w-full text-xs font-mono" value="${escAttr(e.data || '')}"></div>`
                    }
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Descrição / Contexto</label>
                    <input type="text" class="evento-desc admin-input w-full text-xs" value="${escAttr(e.descricao || '')}" placeholder="Ex: Prazo final para cadastro na plataforma oficial">
                </div>
            </div>`;
        }).join('');

        eventosListEl.querySelectorAll('.evento-remove').forEach((btn, i) => {
            btn.addEventListener('click', () => { collectEventosFromDOM(); eventosBuffer.splice(i, 1); _redrawEventos(); });
        });
        eventosListEl.querySelectorAll('.evento-up').forEach((btn, i) => {
            btn.addEventListener('click', () => { collectEventosFromDOM(); [eventosBuffer[i-1], eventosBuffer[i]] = [eventosBuffer[i], eventosBuffer[i-1]]; _redrawEventos(); });
        });
        eventosListEl.querySelectorAll('.evento-down').forEach((btn, i) => {
            btn.addEventListener('click', () => { collectEventosFromDOM(); [eventosBuffer[i], eventosBuffer[i+1]] = [eventosBuffer[i+1], eventosBuffer[i]]; _redrawEventos(); });
        });

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
                // Clean empty string definitions to maintain highly optimal schema structure
                if (!eventosBuffer[i]['data-i']) delete eventosBuffer[i]['data-i'];
                if (!eventosBuffer[i]['data-f']) delete eventosBuffer[i]['data-f'];
            } else {
                eventosBuffer[i].data = row.querySelector('.evento-date')?.value || '';
                delete eventosBuffer[i]['data-i'];
                delete eventosBuffer[i]['data-f'];
                if (!eventosBuffer[i].data) delete eventosBuffer[i].data;
            }
        });
    }

    function addEvento() {
        collectEventosFromDOM();
        eventosBuffer.push({ tipo: 'Prova', data: '', descricao: '' });
        _redrawEventos();
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
            <div class="material-row backdrop-blur-md bg-slate-950/60 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700" data-mi="${i}">
                <div class="flex items-start gap-3">
                    <div class="flex-1 space-y-3">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Título do Recurso</label>
                            <input type="text" class="material-titulo admin-input w-full text-xs font-semibold text-white" value="${escAttr(m.titulo || '')}" placeholder="Ex: Provas Anteriores e Gabaritos Oficiais">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">URL de Destino</label>
                            <input type="url" class="material-url admin-input w-full text-xs font-mono text-blue-300" value="${escAttr(m.url || '')}" placeholder="https://...">
                        </div>
                    </div>
                    <button class="material-remove mt-5 p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0" title="Remover material">
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
        collectMateriaisFromDOM();
        materiaisBuffer.push({ titulo: '', url: '' });
        _redrawMateriais();
        const rows = materiaisListEl.querySelectorAll('.material-row');
        if (rows.length > 0) rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ═══════════════════════════════════════════════════════════
    // Fontes Oficiais sub-editor
    // ═══════════════════════════════════════════════════════════
    let fontesBuffer = [];

    function renderFontes(fontes) {
        fontesBuffer = (fontes || []).map(f => ({ ...f }));
        _redrawFontes();
    }

    function _redrawFontes() {
        if (fontesBuffer.length === 0) {
            fontesListEl.innerHTML = '';
            fontesEmpty.classList.remove('hidden');
            return;
        }
        fontesEmpty.classList.add('hidden');

        fontesListEl.innerHTML = fontesBuffer.map((f, i) => `
            <div class="fonte-row backdrop-blur-md bg-slate-950/60 border border-blue-900/30 rounded-xl p-4 transition-all hover:border-blue-800/50" data-fi="${i}">
                <div class="flex items-start gap-3">
                    <div class="flex-1 space-y-3">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Título da Fonte</label>
                            <input type="text" class="fonte-titulo admin-input w-full text-xs font-semibold text-white" value="${escAttr(f.titulo || '')}" placeholder="Ex: Edital Oficial 2026">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">URL</label>
                            <input type="url" class="fonte-url admin-input w-full text-xs font-mono text-blue-300" value="${escAttr(f.url || '')}" placeholder="https://...">
                        </div>
                    </div>
                    <button class="fonte-remove mt-5 p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0" title="Remover fonte">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

        fontesListEl.querySelectorAll('.fonte-remove').forEach((btn, i) => {
            btn.addEventListener('click', () => { fontesBuffer.splice(i, 1); _redrawFontes(); });
        });
    }

    function collectFontesFromDOM() {
        fontesListEl.querySelectorAll('.fonte-row').forEach((row, i) => {
            if (!fontesBuffer[i]) return;
            fontesBuffer[i].titulo = row.querySelector('.fonte-titulo').value.trim();
            fontesBuffer[i].url    = row.querySelector('.fonte-url').value.trim();
        });
    }

    function addFonte() {
        collectFontesFromDOM();
        fontesBuffer.push({ titulo: '', url: '' });
        _redrawFontes();
        const rows = fontesListEl.querySelectorAll('.fonte-row');
        if (rows.length > 0) rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ═══════════════════════════════════════════════════════════
    // Save Modal
    // ═══════════════════════════════════════════════════════════
    function saveModal() {
        if (!guardAdmin()) return;
        hideModalError();

        collectEventosFromDOM();
        collectMateriaisFromDOM();
        collectFontesFromDOM();

        const sigla      = fSigla.value.trim();
        const id         = fId.value.trim();
        const nome       = fNome.value.trim();
        const modalidade = fModalidade.value;
        const descricao  = fDescricao.value.trim();
        const siteOficial = fSiteOficial.value.trim();

        if (!sigla) {
            switchTab('tab-geral');
            return showModalError('A sigla da olimpíada é obrigatória.');
        }
        if (!id) {
            switchTab('tab-geral');
            return showModalError('O identificador (ID) é obrigatório.');
        }
        if (!nome) {
            switchTab('tab-geral');
            return showModalError('O nome completo da competição é obrigatório.');
        }
        if (!modalidade) {
            switchTab('tab-geral');
            return showModalError('Selecione a modalidade da olimpíada.');
        }

        const existingIdx = olimpiadas.findIndex(o => o.id === id);
        if (existingIdx !== -1 && existingIdx !== editingIndex) {
            switchTab('tab-geral');
            return showModalError(`O ID "${id}" já se encontra em uso pela competição "${olimpiadas[existingIdx].sigla}".`);
        }

        const materias = fMaterias.value.split(',').map(s => s.trim()).filter(Boolean);
        const niveis   = getSelectedNiveis();

        const knownKeys = new Set([
            'id', 'sigla', 'nome', 'nivel_escolar', 'materias', 'modalidade',
            'eventos', 'materiais_estudo', 'fontes_oficiais', 'descricao', 'site_oficial',
        ]);
        const existing = editingIndex !== null ? olimpiadas[editingIndex] : null;
        const preservedFields = existing
            ? Object.fromEntries(Object.entries(existing).filter(([key]) => !knownKeys.has(key)))
            : {};

        const finalEventos = eventosBuffer.filter(e => e.tipo || e.data || e['data-i'] || e['data-f'] || e.descricao);
        const finalMateriais = materiaisBuffer.filter(m => m.titulo || m.url);
        const finalFontes = fontesBuffer.filter(f => f.titulo || f.url);

        const obj = {
            ...preservedFields,
            id, sigla, nome,
            descricao: descricao || undefined,
            site_oficial: siteOficial || undefined,
            nivel_escolar: niveis,
            materias, modalidade,
            eventos: finalEventos,
            materiais_estudo: finalMateriais,
            fontes_oficiais: finalFontes.length > 0 ? finalFontes : undefined,
        };

        if (!obj.descricao) delete obj.descricao;
        if (!obj.site_oficial) delete obj.site_oficial;
        if (!obj.fontes_oficiais) delete obj.fontes_oficiais;

        if (editingIndex !== null) {
            olimpiadas[editingIndex] = obj;
            showToast(`"${sigla}" atualizada com sucesso.`, 'success');
        } else {
            olimpiadas.push(obj);
            showToast(`"${sigla}" cadastrada com sucesso.`, 'success');
        }

        closeModal();
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
        confirmText.textContent = `Tem certeza de que deseja remover permanentemente "${o.nome}" (${o.sigla}) do sistema?`;
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
        showToast(`"${removed.sigla}" foi excluída.`, 'info');
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
        showToast('Arquivo exportado com sucesso. Substitua dados.json no repositório.', 'success');
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
        toastTimer = setTimeout(() => toast.classList.add('hidden'), 4500);
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

    // Modal bindings
    modalClose.addEventListener('click', closeModal);
    modalCancel.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);
    modalSave.addEventListener('click', saveModal);
    addEventoBtn.addEventListener('click', addEvento);
    addMaterialBtn.addEventListener('click', addMaterial);
    addFonteBtn.addEventListener('click', addFonte);

    fId.addEventListener('input', () => { fId.dataset.manual = '1'; });

    // Confirm dialog bindings
    confirmCancel.addEventListener('click', closeConfirmDialog);
    confirmDelete.addEventListener('click', handleDelete);

    // Keyboard navigation shortcuts
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (!confirmDialog.classList.contains('hidden')) closeConfirmDialog();
            else if (!modal.classList.contains('hidden')) closeModal();
        }
    });

    // ═══════════════════════════════════════════════════════════
    // Init Boot
    // ═══════════════════════════════════════════════════════════
    if (isAuthenticated()) {
        showAdminScreen();
        loadData();
    } else {
        showLoginScreen();
    }

})();
