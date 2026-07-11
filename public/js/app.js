/* ═══════════════════════════════════════════════════════════════════
   app.js — SPA Router & Global Utilities
   Manual do Associado — eAula Pós
   ═══════════════════════════════════════════════════════════════════ */

// ─── Global State ──────────────────────────────────────────────────
const App = {
    user: null,
    modules: [],
    progress: {},
    currentRoute: '',
    loading: false,
};

// ─── API Helper ────────────────────────────────────────────────────
async function api(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
    };

    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...(options.headers || {}),
        },
    };

    // Don't set Content-Type for FormData (browser will set multipart boundary)
    if (options.body instanceof FormData) {
        delete mergedOptions.headers['Content-Type'];
    }

    try {
        const response = await fetch(url, mergedOptions);

        if (response.status === 401) {
            App.user = null;
            navigate('#/login');
            throw new Error('Sessão expirada. Faça login novamente.');
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || 'Erro na requisição');
        }

        return data;
    } catch (err) {
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
            throw new Error('Erro de conexão. Verifique sua internet.');
        }
        throw err;
    }
}

// ─── Router ────────────────────────────────────────────────────────
function navigate(hash) {
    window.location.hash = hash;
}

function parseRoute() {
    const hash = window.location.hash || '#/';
    const parts = hash.replace('#', '').split('/').filter(Boolean);

    return {
        path: parts[0] || '',
        params: parts.slice(1),
        full: hash,
    };
}

async function handleRoute() {
    const route = parseRoute();
    const appEl = document.getElementById('app');

    // Avoid re-rendering same route
    if (App.currentRoute === route.full) return;
    App.currentRoute = route.full;

    // Auth guard
    const publicRoutes = ['login'];
    const isPublic = publicRoutes.includes(route.path);

    if (!App.user && !isPublic) {
        navigate('#/login');
        return;
    }

    if (App.user && route.path === 'login') {
        navigate('#/dashboard');
        return;
    }

    // Route to page
    switch (route.path) {
        case 'login':
            renderLoginPage();
            break;

        case 'dashboard':
            await renderDashboard();
            break;

        case 'module':
            if (route.params[0]) {
                await renderModulePage(route.params[0]);
            } else {
                navigate('#/dashboard');
            }
            break;

        case 'admin':
            if (App.user && App.user.role === 'admin') {
                await renderAdminPage();
            } else {
                showToast('Acesso negado. Área restrita a administradores.', 'error');
                navigate('#/dashboard');
            }
            break;

        default:
            navigate(App.user ? '#/dashboard' : '#/login');
            break;
    }
}

// ─── Init ──────────────────────────────────────────────────────────
async function init() {
    try {
        const data = await api('/api/me');
        App.user = data.user || data;
    } catch (err) {
        App.user = null;
    }

    handleRoute();
}

window.addEventListener('hashchange', () => {
    App.currentRoute = ''; // Force re-render on hash change
    handleRoute();
});

window.addEventListener('load', init);

// ─── Header scroll effect ─────────────────────────────────────────
window.addEventListener('scroll', () => {
    const header = document.querySelector('.app-header');
    if (header) {
        header.classList.toggle('scrolled', window.scrollY > 10);
    }
});

// ─── Toast Notifications ──────────────────────────────────────────
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const iconMap = {
        success: 'check',
        error: 'close',
        warning: 'warning',
        info: 'info',
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <span class="material-icons">${iconMap[type] || 'info'}</span>
        </div>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" onclick="dismissToast(this.parentElement)">
            <span class="material-icons">close</span>
        </button>
    `;

    container.appendChild(toast);

    // Auto dismiss after 4 seconds
    setTimeout(() => dismissToast(toast), 4000);
}

function dismissToast(toast) {
    if (!toast || toast.classList.contains('removing')) return;
    toast.classList.add('removing');
    setTimeout(() => {
        if (toast.parentElement) {
            toast.parentElement.removeChild(toast);
        }
    }, 300);
}

// ─── Render App Header ─────────────────────────────────────────────
function renderAppHeader() {
    const initials = App.user?.name
        ? App.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        : '??';

    const adminLink = App.user?.role === 'admin'
        ? `<a href="#/admin" class="header-admin-link">
               <span class="material-icons">admin_panel_settings</span>
               <span>Admin</span>
           </a>`
        : '';

    return `
        <!-- Sidebar -->
        <aside class="app-sidebar" id="appSidebar">
            <div class="sidebar-brand">
                <a href="#/dashboard" class="header-logo" style="display:flex;align-items:center;">
                    <img src="/img/logo.png" alt="eAula" style="height:40px; mix-blend-mode: multiply;" />
                </a>
            </div>
            
            <nav class="sidebar-nav">
                <a href="#/dashboard" class="sidebar-link ${location.hash.includes('dashboard') || location.hash === '' ? 'active' : ''}">
                    <span class="material-icons">menu_book</span>
                    <span>Manual do Associado</span>
                </a>
                
                ${App.user?.role === 'admin' ? `
                <a href="#/admin" class="sidebar-link ${location.hash.includes('admin') ? 'active' : ''}">
                    <span class="material-icons">admin_panel_settings</span>
                    <span>Painel Administrativo</span>
                </a>
                ` : ''}
            </nav>

            <div class="sidebar-footer">
                <div class="sidebar-user-info">
                    <div class="header-avatar">${initials}</div>
                    <div class="sidebar-user-details">
                        <span class="sidebar-user-name">${escapeHtml(App.user?.name || '')}</span>
                        <span class="sidebar-user-role">${App.user?.role === 'admin' ? 'Administrador' : 'Associado'}</span>
                    </div>
                </div>
                <button class="sidebar-logout-btn" onclick="handleLogout()">
                    <span class="material-icons">logout</span>
                    Sair
                </button>
            </div>
        </aside>

        <!-- Overlay for mobile sidebar -->
        <div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div>

        <!-- Header -->
        <header class="app-header">
            <div class="header-inner">
                <div class="header-left">
                    <button class="mobile-menu-btn" onclick="toggleSidebar()">
                        <span class="material-icons">menu</span>
                    </button>
                    <span class="header-title">Manual do Associado</span>
                </div>
                <div class="header-right">
                    <button class="header-logout-btn hide-on-mobile" onclick="navigate('#/dashboard')" title="Página Inicial" style="margin-right: 8px; border-color: var(--primary-color); color: var(--primary-color);">
                        <span class="material-icons">home</span>
                        <span>Início</span>
                    </button>
                    ${App.user?.role === 'admin' ? `
                    <button class="header-logout-btn hide-on-mobile" onclick="navigate('#/admin')" title="Painel Administrativo" style="margin-right: 8px; border-color: var(--purple); color: var(--purple);">
                        <span class="material-icons">admin_panel_settings</span>
                        <span>Admin</span>
                    </button>
                    ` : ''}
                    <div class="header-user">
                        <div class="header-avatar">${initials}</div>
                        <span class="header-user-name hide-on-mobile">${escapeHtml(App.user?.name || '')}</span>
                    </div>
                    <button class="header-logout-btn hide-on-mobile" onclick="handleLogout()" title="Sair">
                        <span class="material-icons">logout</span>
                        <span>Sair</span>
                    </button>
                </div>
            </div>
        </header>
    `;
}

function toggleSidebar() {
    document.getElementById('appSidebar')?.classList.toggle('open');
    document.getElementById('sidebarOverlay')?.classList.toggle('show');
}

// ─── Logout ────────────────────────────────────────────────────────
async function handleLogout() {
    try {
        await api('/api/logout', { method: 'POST' });
    } catch (err) {
        // Ignore errors during logout
    }
    App.user = null;
    App.modules = [];
    App.progress = {};
    App.currentRoute = '';
    navigate('#/login');
}

// ─── Utility Functions ─────────────────────────────────────────────
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function animateNumber(element, target, duration = 1000) {
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (target - start) * eased);

        element.textContent = current.toLocaleString('pt-BR');

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// ─── Loading State ─────────────────────────────────────────────────
function showLoading(container) {
    if (typeof container === 'string') {
        container = document.querySelector(container);
    }
    if (!container) return;

    container.innerHTML = `
        <div class="page-loading">
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Carregando...</p>
            </div>
        </div>
    `;
}

// ─── Confirm Dialog ────────────────────────────────────────────────
function showConfirm(message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal" style="max-width: 400px;">
            <div class="modal-body" style="padding-top: 32px;">
                <div class="confirm-icon">
                    <span class="material-icons">warning_amber</span>
                </div>
                <p class="confirm-text">${message}</p>
                <div class="confirm-actions">
                    <button class="btn btn-outline btn-cancel">Cancelar</button>
                    <button class="btn btn-danger btn-confirm">Confirmar</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.btn-cancel').addEventListener('click', () => {
        overlay.remove();
    });

    overlay.querySelector('.btn-confirm').addEventListener('click', () => {
        overlay.remove();
        onConfirm();
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

// ─── Stagger animation delays ─────────────────────────────────────
function staggerDelay(index, base = 0.25) {
    return `animation-delay: ${base + index * 0.06}s`;
}
