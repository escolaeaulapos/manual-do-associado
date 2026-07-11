/* ═══════════════════════════════════════════════════════════════════
   login.js — Login Page
   Manual do Associado — eAula Pós
   ═══════════════════════════════════════════════════════════════════ */

function renderLoginPage() {
    const appEl = document.getElementById('app');

    appEl.innerHTML = `
        <div class="login-page">
            <!-- Floating Orbs -->
            <div class="login-orb login-orb-1"></div>
            <div class="login-orb login-orb-2"></div>
            <div class="login-orb login-orb-3"></div>

            <div class="login-card">
                <div class="login-logo">
                    <div class="login-logo-text" style="display:flex;justify-content:center;">
                        <img src="/img/logo.png" alt="eAula" style="height:60px; mix-blend-mode: multiply;" />
                    </div>
                </div>
                <div class="login-subtitle">Manual do Associado</div>

                <form class="login-form" id="loginForm" autocomplete="on">
                    <div class="login-error" id="loginError">
                        <span class="material-icons">error_outline</span>
                        <span id="loginErrorText">Erro ao fazer login</span>
                    </div>

                    <div class="login-field">
                        <label for="loginEmail">E-mail</label>
                        <div class="login-input-wrap">
                            <span class="material-icons">mail_outline</span>
                            <input
                                type="email"
                                id="loginEmail"
                                name="email"
                                placeholder="seu@email.com"
                                autocomplete="email"
                                required
                            >
                        </div>
                    </div>

                    <div class="login-field">
                        <label for="loginPassword">Senha</label>
                        <div class="login-input-wrap">
                            <span class="material-icons">lock_outline</span>
                            <input
                                type="password"
                                id="loginPassword"
                                name="password"
                                placeholder="••••••••"
                                autocomplete="current-password"
                                required
                            >
                            <button type="button" class="login-toggle-pw" id="togglePassword" tabindex="-1" aria-label="Mostrar senha">
                                <span class="material-icons">visibility_off</span>
                            </button>
                        </div>
                    </div>

                    <label class="login-remember">
                        <input type="checkbox" id="loginRemember" name="remember">
                        <div class="checkmark">
                            <span class="material-icons">check</span>
                        </div>
                        <span>Manter conectado</span>
                    </label>

                    <button type="submit" class="login-btn" id="loginBtn">
                        Entrar
                    </button>
                </form>
            </div>
        </div>
    `;

    // Wire up form
    const form = document.getElementById('loginForm');
    const togglePw = document.getElementById('togglePassword');
    const pwInput = document.getElementById('loginPassword');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = pwInput.value;
        await handleLogin(email, password);
    });

    // Toggle password visibility
    togglePw.addEventListener('click', () => {
        const isPassword = pwInput.type === 'password';
        pwInput.type = isPassword ? 'text' : 'password';
        togglePw.querySelector('.material-icons').textContent =
            isPassword ? 'visibility' : 'visibility_off';
    });

    // Focus email input after render
    setTimeout(() => {
        document.getElementById('loginEmail')?.focus();
    }, 600);
}

async function handleLogin(email, password) {
    const btn = document.getElementById('loginBtn');
    const errorEl = document.getElementById('loginError');
    const errorText = document.getElementById('loginErrorText');

    // Hide previous errors
    errorEl.classList.remove('show');

    // Validate
    if (!email || !password) {
        errorText.textContent = 'Preencha todos os campos.';
        errorEl.classList.add('show');
        return;
    }

    // Loading state
    const originalBtnText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner" style="margin: 0 auto;"></div>';

    try {
        const data = await api('/api/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        App.user = data.user || data;
        App.currentRoute = ''; // Reset to allow navigation
        navigate('#/dashboard');
        showToast('Login realizado com sucesso!', 'success');
    } catch (err) {
        errorText.textContent = err.message || 'E-mail ou senha incorretos.';
        errorEl.classList.add('show');

        // Shake animation on error
        const card = document.querySelector('.login-card');
        card.style.animation = 'none';
        card.offsetHeight; // Trigger reflow
        card.style.animation = '';

        btn.disabled = false;
        btn.textContent = originalBtnText;
    }
}
