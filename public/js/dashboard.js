/* ═══════════════════════════════════════════════════════════════════
   dashboard.js — Dashboard Page
   Manual do Associado — eAula Pós
   ═══════════════════════════════════════════════════════════════════ */

async function renderDashboard() {
    const appEl = document.getElementById('app');

    // Show loading while fetching
    appEl.innerHTML = renderAppHeader() + `
        <div class="dashboard-page">
            <div class="container">
                <div class="page-loading">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Carregando seu painel...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    try {
        // Fetch modules and progress in parallel
        const [modulesData, progressData] = await Promise.all([
            api('/api/modules'),
            api('/api/progress'),
        ]);

        App.modules = modulesData.modules || modulesData || [];
        App.progress = {};

        // Normalize progress data
        const progressList = progressData.progress || progressData || [];
        if (Array.isArray(progressList)) {
            progressList.forEach(p => {
                App.progress[p.module_id || p.moduleId] = p;
            });
        }

        renderDashboardContent();
    } catch (err) {
        appEl.innerHTML = renderAppHeader() + `
            <div class="dashboard-page">
                <div class="container">
                    <div class="empty-state">
                        <span class="material-icons">cloud_off</span>
                        <h3>Erro ao carregar</h3>
                        <p>${escapeHtml(err.message)}</p>
                        <button class="btn btn-primary" onclick="renderDashboard()" style="margin-top: 20px;">
                            <span class="material-icons">refresh</span>
                            Tentar novamente
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

function renderDashboardContent() {
    const appEl = document.getElementById('app');
    const userName = App.user?.name?.split(' ')[0] || 'Associado';

    // Separate full training module from regular modules
    const allModules = App.modules || [];
    const fullTrainingModule = allModules.find(m => m.is_full_training || m.isFullTraining);
    const regularModules = allModules.filter(m => !m.is_full_training && !m.isFullTraining);

    // Check full training progress
    const ftProg = fullTrainingModule ? App.progress[fullTrainingModule.id || fullTrainingModule._id] : null;
    const ftCompleted = ftProg && ftProg.completed;

    // Calculate progress based on regular modules
    const totalRegular = regularModules.length;
    let completedCount = regularModules.filter(m => {
        const prog = App.progress[m.id || m._id];
        return prog && prog.completed;
    }).length;
    
    // Override if full training is completed
    if (ftCompleted) {
        completedCount = totalRegular;
    }

    const progressPercent = totalRegular > 0 ? Math.round((completedCount / totalRegular) * 100) : 0;

    // Build module cards HTML
    const moduleCardsHtml = regularModules.map((mod, index) => {
        const prog = App.progress[mod.id || mod._id];
        const isCompleted = (prog && prog.completed) || ftCompleted;
        const hasVideo = !!mod.video_url || !!mod.video_filename || !!mod.video_file || !!mod.videoFile;
        const statusClass = isCompleted ? 'completed' : (!hasVideo ? 'unavailable' : 'pending');
        const cardClass = isCompleted ? 'completed' : (!hasVideo ? 'unavailable' : '');

        let statusBadge;
        if (isCompleted) {
            statusBadge = `<div class="module-card-status completed"><span class="material-icons">check_circle</span>Concluído</div>`;
        } else if (!hasVideo) {
            statusBadge = `<div class="module-card-status unavailable"><span class="material-icons">schedule</span>Em breve</div>`;
        } else {
            statusBadge = `<div class="module-card-status pending"><span class="material-icons">radio_button_unchecked</span>Pendente</div>`;
        }

        const clickHandler = hasVideo
            ? `onclick="navigate('#/module/${mod.id || mod._id}')" `
            : '';

        return `
            <div class="module-card ${cardClass}" ${clickHandler} style="${staggerDelay(index, 0.3)}">
                <div class="module-card-header">
                    <div class="module-card-icon">${index + 1}</div>
                    ${statusBadge}
                </div>
                <div class="module-card-title">${escapeHtml(mod.title || mod.titulo)}</div>
                <div class="module-card-duration">
                    <span class="material-icons">schedule</span>
                    ${escapeHtml(mod.duration || '—')}
                </div>
            </div>
        `;
    }).join('');

    // Full training card HTML
    let fullTrainingHtml = '';
    if (fullTrainingModule) {
        const ftHasVideo = !!fullTrainingModule.video_url || !!fullTrainingModule.video_filename || !!fullTrainingModule.video_file || !!fullTrainingModule.videoFile;
        const ftClick = ftHasVideo
            ? `onclick="navigate('#/module/${fullTrainingModule.id || fullTrainingModule._id}')"` : '';
        const ftDisabled = ftHasVideo ? '' : 'style="opacity: 0.55; cursor: not-allowed;"';
        const ftBadge = ftCompleted ? `<div class="module-card-status completed" style="margin-left: auto; margin-right: 16px;"><span class="material-icons">check_circle</span>Concluído</div>` : '';

        fullTrainingHtml = `
            <div class="full-training-card" ${ftClick} ${ftDisabled}>
                <div class="full-training-play">
                    <span class="material-icons">play_arrow</span>
                </div>
                <div class="full-training-info">
                    <div class="full-training-label">Treinamento Completo</div>
                    <div class="full-training-title">${escapeHtml(fullTrainingModule.title || fullTrainingModule.titulo || 'Assistir Treinamento Completo')}</div>
                    <div class="full-training-duration">
                        <span class="material-icons">schedule</span>
                        ${escapeHtml(fullTrainingModule.duration || '30 min')}
                    </div>
                </div>
                ${ftBadge}
                <span class="material-icons full-training-arrow">arrow_forward</span>
            </div>
        `;
    }

    appEl.innerHTML = renderAppHeader() + `
        <div class="dashboard-page">
            <div class="container">
                <!-- Welcome Card -->
                <div class="welcome-card">
                    <div class="welcome-greeting">Olá, ${escapeHtml(userName)}! 👋</div>
                    <div class="welcome-subtitle">Continue seu treinamento e domine todas as ferramentas da plataforma.</div>
                </div>

                <!-- Progress Section -->
                <div class="progress-section">
                    <div class="progress-header">
                        <span class="progress-title">Seu progresso geral</span>
                        <span class="progress-percentage" id="progressPercent">0%</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" id="progressBar" style="width: 0%"></div>
                    </div>
                    <div class="progress-label">${completedCount} de ${totalRegular} módulos concluídos</div>
                </div>

                <!-- Full Training Card -->
                ${fullTrainingHtml}

                <!-- Modules Section -->
                ${regularModules.length > 0 ? `
                    <div class="modules-section-header">
                        <span class="modules-section-title">
                            ${fullTrainingModule ? 'Ou estude por módulos' : 'Módulos de Treinamento'}
                        </span>
                        <div class="modules-section-line"></div>
                    </div>
                    <div class="modules-grid">
                        ${moduleCardsHtml}
                    </div>
                ` : `
                    <div class="empty-state" style="margin-top: 40px;">
                        <span class="material-icons">school</span>
                        <h3>Nenhum módulo disponível</h3>
                        <p>Os módulos de treinamento serão adicionados em breve.</p>
                    </div>
                `}
            </div>
        </div>
    `;

    // Animate progress bar after render
    requestAnimationFrame(() => {
        setTimeout(() => {
            const bar = document.getElementById('progressBar');
            const percentEl = document.getElementById('progressPercent');
            if (bar) bar.style.width = progressPercent + '%';
            if (percentEl) animateNumber(percentEl, progressPercent, 1000);
            // Fix: append % after animation
            if (percentEl) {
                setTimeout(() => {
                    percentEl.textContent = progressPercent + '%';
                }, 1050);
            }
        }, 200);
    });
}
