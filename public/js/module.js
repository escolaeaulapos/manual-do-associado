/* ═══════════════════════════════════════════════════════════════════
   module.js — Module Player Page
   Manual do Associado — eAula Pós
   ═══════════════════════════════════════════════════════════════════ */

async function renderModulePage(moduleId) {
    const appEl = document.getElementById('app');

    // Show loading
    appEl.innerHTML = renderAppHeader() + `
        <div class="module-page">
            <div class="container">
                <div class="page-loading">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Carregando módulo...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    try {
        // Fetch modules and progress if not already loaded
        if (!App.modules || App.modules.length === 0) {
            const modulesData = await api('/api/modules');
            App.modules = modulesData.modules || modulesData || [];
        }

        const progressData = await api('/api/progress');
        const progressList = progressData.progress || progressData || [];
        App.progress = {};
        if (Array.isArray(progressList)) {
            progressList.forEach(p => {
                App.progress[p.module_id || p.moduleId] = p;
            });
        }

        // Find the current module
        const currentModule = App.modules.find(m =>
            String(m.id || m._id) === String(moduleId)
        );

        if (!currentModule) {
            showToast('Módulo não encontrado.', 'error');
            navigate('#/dashboard');
            return;
        }

        const isFullTraining = currentModule.is_full_training || currentModule.isFullTraining;

        if (isFullTraining) {
            renderFullTrainingContent(currentModule);
        } else {
            renderModuleContent(currentModule);
        }
    } catch (err) {
        appEl.innerHTML = renderAppHeader() + `
            <div class="module-page">
                <div class="container">
                    <div class="empty-state">
                        <span class="material-icons">error_outline</span>
                        <h3>Erro ao carregar módulo</h3>
                        <p>${escapeHtml(err.message)}</p>
                        <button class="btn btn-primary" onclick="renderModulePage('${moduleId}')" style="margin-top: 20px;">
                            <span class="material-icons">refresh</span>
                            Tentar novamente
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

// ─── Treinamento Completo — layout especial ──────────────────────────
function renderFullTrainingContent(module) {
    const appEl = document.getElementById('app');
    const moduleId = module.id || module._id;
    const hasVideoUrl = !!module.video_url;
    const hasVideoFile = !!module.video_filename || !!module.video_file || !!module.videoFile;
    const hasVideo = hasVideoUrl || hasVideoFile;
    const videoFile = module.video_filename || module.video_file || module.videoFile || '';

    // Parse description as chapters.
    // Formato esperado: linhas como "0:00 - Introdução\n5:30 - Painel do Aluno\n..."
    // Se não existir, mostra só a descrição normal
    const desc = module.description || module.descricao || '';
    const chapters = parseChapters(desc);

    let videoHtml;
    if (hasVideoUrl) {
        const embedUrl = getEmbedUrl(module.video_url);
        videoHtml = `
            <div class="video-container" id="ftVideoContainer">
                <iframe 
                    id="moduleIframe"
                    src="${escapeHtml(embedUrl)}" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen
                    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: var(--radius-lg) var(--radius-lg) 0 0; z-index: 10;"
                ></iframe>
            </div>
        `;
    } else if (hasVideoFile) {
        videoHtml = `
            <div class="video-container" id="ftVideoContainer">
                <video
                    id="moduleVideo"
                    controls
                    preload="metadata"
                    controlslist="nodownload"
                >
                    <source src="/api/videos/${encodeURIComponent(videoFile)}" type="video/mp4">
                    Seu navegador não suporta o player de vídeo.
                </video>
            </div>
        `;
    } else {
        videoHtml = `
            <div class="video-container">
                <div class="video-unavailable">
                    <span class="material-icons">upcoming</span>
                    <p>Vídeo em breve</p>
                    <small>Este conteúdo está sendo preparado</small>
                </div>
            </div>
        `;
    }

    // Build chapters HTML
    let chaptersHtml = '';
    if (chapters.length > 0) {
        const chapterItems = chapters.map((ch, i) => `
            <div class="ft-chapter-item" onclick="seekVideo(${ch.seconds})" id="ftChapter${i}">
                <div class="ft-chapter-time">${ch.time}</div>
                <div class="ft-chapter-body">
                    <div class="ft-chapter-title">${escapeHtml(ch.title)}</div>
                    ${ch.desc ? `<div class="ft-chapter-desc">${escapeHtml(ch.desc)}</div>` : ''}
                </div>
                <span class="material-icons ft-chapter-arrow">play_circle_outline</span>
            </div>
        `).join('');

        chaptersHtml = `
            <div class="ft-chapters">
                <h3 class="ft-chapters-title">
                    <span class="material-icons">format_list_bulleted</span>
                    Conteúdo do Treinamento
                </h3>
                <div class="ft-chapters-list">
                    ${chapterItems}
                </div>
            </div>
        `;
    } else {
        // Fallback: show description as plain text
        chaptersHtml = desc ? `
            <div class="ft-chapters">
                <h3 class="ft-chapters-title">
                    <span class="material-icons">info_outline</span>
                    Sobre este treinamento
                </h3>
                <div class="ft-desc-plain">${escapeHtml(desc)}</div>
            </div>
        ` : '';
    }

    appEl.innerHTML = renderAppHeader() + `
        <div class="module-page">
            <div class="container">
                <!-- Back button -->
                <div class="ft-back-row">
                    <button class="btn btn-ghost" onclick="navigate('#/dashboard')">
                        <span class="material-icons">arrow_back</span>
                        Voltar ao Painel
                    </button>
                </div>

                <!-- Video -->
                ${videoHtml}

                <!-- Module title below video -->
                <div class="ft-header">
                    <div class="ft-badge">
                        <span class="material-icons">play_circle_filled</span>
                        Treinamento Completo
                    </div>
                    <h1 class="ft-title">${escapeHtml(module.title || module.titulo)}</h1>
                    <div class="ft-meta">
                        <span class="material-icons">schedule</span>
                        ${escapeHtml(module.duration || '—')}
                    </div>
                </div>

                <!-- Chapters / Content -->
                ${chaptersHtml}
            </div>
        </div>
    `;

    // Setup video: restore position, auto-complete (marks only the full training itself)
    if (hasVideo) {
        setupVideoAutoComplete(moduleId, true);
        setupChapterHighlight(chapters);
    }
}

// Parse chapters from description.
// Accepts lines like:
//   0:00 - Introdução
//   5:30 Painel do Aluno - explicação detalhada
//   00:05:30 - Outro tema
function parseChapters(desc) {
    if (!desc) return [];
    const lines = desc.split(/\n/).map(l => l.trim()).filter(Boolean);
    const chapters = [];
    // Regex: optional HH: then MM:SS or M:SS
    const timeRe = /^(\d{1,2}:)?\d{1,2}:\d{2}/;
    lines.forEach(line => {
        const m = line.match(timeRe);
        if (m) {
            const timeStr = m[0];
            const rest = line.slice(timeStr.length).replace(/^[\s\-–:]+/, '').trim();
            const parts = rest.split(/\s*[-–]\s*/, 2);
            chapters.push({
                time: timeStr,
                seconds: timeToSeconds(timeStr),
                title: parts[0] || rest,
                desc: parts[1] || '',
            });
        }
    });
    return chapters;
}

function timeToSeconds(t) {
    const parts = t.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
}

function seekVideo(seconds) {
    const video = document.getElementById('moduleVideo');
    if (video) {
        video.currentTime = seconds;
        video.play();
    } else {
        const iframe = document.getElementById('moduleIframe');
        if (iframe) {
            let src = iframe.src;
            if (src.includes('youtube.com') || src.includes('youtu.be')) {
                src = src.replace(/([?&])start=\d+/, '');
                src += (src.includes('?') ? '&' : '?') + 'start=' + seconds;
                if (!src.includes('autoplay=1')) {
                    src += '&autoplay=1';
                }
                iframe.src = src;
            } else if (src.includes('vimeo.com')) {
                // Usa a API de postMessage do Vimeo para pular o tempo sem recarregar o iframe
                iframe.contentWindow.postMessage(JSON.stringify({ method: 'seekTo', value: seconds }), '*');
                iframe.contentWindow.postMessage(JSON.stringify({ method: 'play' }), '*');
            } else if (src.includes('drive.google.com')) {
                // Google Drive does not support URL timestamp seeking in iframes.
                // We just alert the user or do nothing.
                if (typeof showToast === 'function') {
                    showToast('O Google Drive não permite avançar o tempo automaticamente. Por favor, avance manualmente no player.', 'info');
                }
            }
        }
    }
    // Scroll to video
    document.getElementById('ftVideoContainer')?.scrollIntoView({ behavior: 'smooth' });
}

// Highlight active chapter based on video time
function setupChapterHighlight(chapters) {
    const video = document.getElementById('moduleVideo');
    if (!video || chapters.length === 0) return;

    video.addEventListener('timeupdate', () => {
        const t = video.currentTime;
        let activeIdx = 0;
        for (let i = 0; i < chapters.length; i++) {
            if (t >= chapters[i].seconds) activeIdx = i;
        }
        chapters.forEach((_, i) => {
            const el = document.getElementById(`ftChapter${i}`);
            if (!el) return;
            if (i === activeIdx) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    });
}

function getEmbedUrl(url) {
    if (!url) return '';
    let videoId = '';
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^"&?\/\s]{11})/);
    if (ytMatch) return 'https://www.youtube.com/embed/' + ytMatch[1] + '?rel=0&modestbranding=1';
    
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
    if (vimeoMatch) {
        const hashMatch = url.match(/(#t=\w+)/);
        const hash = hashMatch ? hashMatch[1] : '';
        return 'https://player.vimeo.com/video/' + vimeoMatch[1] + '?title=0&byline=0&portrait=0&api=1' + hash;
    }
    
    // Google Drive support
    const gdriveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (gdriveMatch) return 'https://drive.google.com/file/d/' + gdriveMatch[1] + '/preview';
    
    return url;
}

// ─── Regular Module ──────────────────────────────────────────────────
function renderModuleContent(module) {
    const appEl = document.getElementById('app');
    const moduleId = module.id || module._id;
    const hasVideoUrl = !!module.video_url;
    const hasVideoFile = !!module.video_filename || !!module.video_file || !!module.videoFile;
    const hasVideo = hasVideoUrl || hasVideoFile;
    const videoFile = module.video_filename || module.video_file || module.videoFile || '';
    const prog = App.progress[moduleId];
    const isCompleted = prog && prog.completed;

    // Get regular (non-full-training) modules for sidebar & navigation
    const regularModules = (App.modules || []).filter(m => !m.is_full_training && !m.isFullTraining);

    // Find prev/next within regular modules
    const currentIndex = regularModules.findIndex(m =>
        String(m.id || m._id) === String(moduleId)
    );
    const prevModule = currentIndex > 0 ? regularModules[currentIndex - 1] : null;
    const nextModule = currentIndex < regularModules.length - 1 ? regularModules[currentIndex + 1] : null;

    // Video section
    let videoHtml;
    if (hasVideoUrl) {
        const embedUrl = getEmbedUrl(module.video_url);
        videoHtml = `
            <div class="video-container" style="max-width: 1000px; margin: 0 auto; position: relative; aspect-ratio: 16/9;">
                <iframe 
                    id="moduleIframe"
                    src="${escapeHtml(embedUrl)}" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen
                    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: var(--radius-lg); z-index: 10;"
                ></iframe>
            </div>
        `;
    } else if (hasVideoFile) {
        videoHtml = `
            <div class="video-container" style="max-width: 1000px; margin: 0 auto;">
                <video id="moduleVideo" class="ft-video-element" controls style="width: 100%; aspect-ratio: 16/9; background: #000; border-radius: var(--radius-lg); display: block;">
                    <source src="/api/videos/${encodeURIComponent(videoFile)}" type="video/mp4">
                    Seu navegador não suporta o player de vídeo.
                </video>
            </div>
        `;
    } else {
        videoHtml = `
            <div class="video-container">
                <div class="video-unavailable">
                    <span class="material-icons">upcoming</span>
                    <p>Vídeo em breve</p>
                    <small>Este conteúdo está sendo preparado</small>
                </div>
            </div>
        `;
    }

    // Sidebar modules list (only regular modules)
    const sidebarItems = regularModules.map((mod, i) => {
        const modId = mod.id || mod._id;
        const modProg = App.progress[modId];
        const modCompleted = modProg && modProg.completed;
        const isActive = String(modId) === String(moduleId);
        const modHasVideo = !!mod.video_url || !!mod.video_filename || !!mod.video_file || !!mod.videoFile;

        const classes = [
            'sidebar-module-item',
            isActive ? 'active' : '',
            modCompleted ? 'completed' : '',
        ].filter(Boolean).join(' ');

        const clickable = modHasVideo || isActive;

        return `
            <div class="${classes}" ${clickable ? `onclick="navigate('#/module/${modId}')"` : ''} ${!clickable ? 'style="opacity:0.5;cursor:not-allowed;"' : ''}>
                <div class="sidebar-module-num">
                    ${modCompleted ? '<span class="material-icons" style="font-size:14px;">check</span>' : (i + 1)}
                </div>
                <div class="sidebar-module-text">
                    <div class="sidebar-module-name">${escapeHtml(mod.title || mod.titulo)}</div>
                </div>
                ${modCompleted ? '<span class="material-icons sidebar-module-check">check_circle</span>' : ''}
            </div>
        `;
    }).join('');

    // Complete button
    const completeBtnClass = isCompleted ? 'btn btn-success btn-complete-done' : 'btn btn-outline';
    const completeBtnIcon = isCompleted ? 'check_circle' : 'radio_button_unchecked';
    const completeBtnText = isCompleted ? 'Concluído' : 'Marcar como concluído';

    appEl.innerHTML = renderAppHeader() + `
        <div class="module-page">
            <div class="container">
                <div class="module-layout">
                    <div class="module-main">
                        ${videoHtml}

                        <div class="module-info">
                            <h1>${escapeHtml(module.title || module.titulo)}</h1>
                            <div class="module-info-meta">
                                <span>
                                    <span class="material-icons">schedule</span>
                                    ${escapeHtml(module.duration || '—')}
                                </span>
                            </div>
                            <p>${escapeHtml(module.description || module.descricao || 'Sem descrição disponível.')}</p>
                        </div>

                        <div class="module-actions">
                            ${prevModule ? `
                                <button class="btn btn-outline" onclick="navigate('#/module/${prevModule.id || prevModule._id}')">
                                    <span class="material-icons">arrow_back</span>
                                    Módulo Anterior
                                </button>
                            ` : `
                                <button class="btn btn-outline" disabled>
                                    <span class="material-icons">arrow_back</span>
                                    Módulo Anterior
                                </button>
                            `}

                            <button class="${completeBtnClass}" id="completeBtn" onclick="toggleComplete('${moduleId}')">
                                <span class="material-icons">${completeBtnIcon}</span>
                                ${completeBtnText}
                            </button>

                            ${nextModule ? `
                                <button class="btn btn-outline" onclick="navigate('#/module/${nextModule.id || nextModule._id}')">
                                    Próximo Módulo
                                    <span class="material-icons">arrow_forward</span>
                                </button>
                            ` : `
                                <button class="btn btn-outline" disabled>
                                    Próximo Módulo
                                    <span class="material-icons">arrow_forward</span>
                                </button>
                            `}
                        </div>
                    </div>

                    <div class="module-sidebar">
                        <div class="sidebar-header">
                            <div class="sidebar-title">Módulos do Treinamento</div>
                        </div>
                        <div class="sidebar-list">
                            ${sidebarItems}
                        </div>
                        <div class="sidebar-back" onclick="navigate('#/dashboard')">
                            <span class="material-icons">arrow_back</span>
                            Voltar ao Painel
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Auto-mark as completed at 95% video progress (regular module only)
    if (hasVideo) {
        setupVideoAutoComplete(moduleId, false);
    }
}

// ─── Auto-Complete e Salvar Progresso do Vídeo ──────────────────────
// isFullTraining: if true, marks only the full-training module, never regular modules
function setupVideoAutoComplete(moduleId, isFullTraining) {
    const video = document.getElementById('moduleVideo');
    if (!video) return;

    const storageKey = `video_progress_${App.user.id}_${moduleId}`;

    // Recupera o progresso salvo
    const savedTime = localStorage.getItem(storageKey);
    if (savedTime) {
        video.currentTime = parseFloat(savedTime);
    }

    let autoCompleted = false;

    // Salva o progresso no localStorage periodicamente
    video.addEventListener('timeupdate', () => {
        // Save position every ~5 seconds worth of events
        localStorage.setItem(storageKey, video.currentTime);

        if (autoCompleted) return;
        if (!video.duration || video.duration === 0) return;

        const percent = video.currentTime / video.duration;

        // Auto-complete: só marca o módulo CORRETO
        // Para o treinamento completo, marca só ele mesmo (não os módulos individuais)
        if (percent >= 0.95) {
            autoCompleted = true;
            const prog = App.progress[moduleId];
            if (!prog || !prog.completed) {
                markComplete(moduleId);
            }
        }
    });

    // Garante completar ao terminar o vídeo
    video.addEventListener('ended', () => {
        if (!autoCompleted) {
            autoCompleted = true;
            const prog = App.progress[moduleId];
            if (!prog || !prog.completed) {
                markComplete(moduleId);
            }
        }
        // Remove do storage quando finalizar completamente
        localStorage.removeItem(storageKey);
    });
}

// ─── Toggle Complete ───────────────────────────────────────────────
async function toggleComplete(moduleId) {
    const prog = App.progress[moduleId];
    const isCurrentlyCompleted = prog && prog.completed;

    if (isCurrentlyCompleted) {
        await markIncomplete(moduleId);
    } else {
        await markComplete(moduleId);
    }
}

async function markComplete(moduleId) {
    try {
        await api(`/api/progress/${moduleId}`, { 
            method: 'POST',
            body: JSON.stringify({ completed: true })
        });

        // Update local state
        if (!App.progress[moduleId]) {
            App.progress[moduleId] = { module_id: moduleId };
        }
        App.progress[moduleId].completed = true;
        App.progress[moduleId].completed_at = new Date().toISOString();

        // Update UI
        updateCompleteButton(true);
        updateSidebarItem(moduleId, true);
        showToast('Módulo marcado como concluído!', 'success');
    } catch (err) {
        showToast(err.message || 'Erro ao marcar como concluído.', 'error');
    }
}

async function markIncomplete(moduleId) {
    try {
        await api(`/api/progress/${moduleId}`, { 
            method: 'POST',
            body: JSON.stringify({ completed: false })
        });

        // Update local state
        if (App.progress[moduleId]) {
            App.progress[moduleId].completed = false;
            App.progress[moduleId].completed_at = null;
        }

        // Update UI
        updateCompleteButton(false);
        updateSidebarItem(moduleId, false);
        showToast('Módulo desmarcado.', 'info');
    } catch (err) {
        showToast(err.message || 'Erro ao desmarcar módulo.', 'error');
    }
}

function updateCompleteButton(completed) {
    const btn = document.getElementById('completeBtn');
    if (!btn) return;

    if (completed) {
        btn.className = 'btn btn-success btn-complete-done';
        btn.innerHTML = '<span class="material-icons">check_circle</span>Concluído';
    } else {
        btn.className = 'btn btn-outline';
        btn.innerHTML = '<span class="material-icons">radio_button_unchecked</span>Marcar como concluído';
    }
}

function updateSidebarItem(moduleId, completed) {
    const items = document.querySelectorAll('.sidebar-module-item');
    items.forEach(item => {
        const onClick = item.getAttribute('onclick') || '';
        if (onClick.includes(moduleId)) {
            if (completed) {
                item.classList.add('completed');
                const numEl = item.querySelector('.sidebar-module-num');
                if (numEl) numEl.innerHTML = '<span class="material-icons" style="font-size:14px;">check</span>';
                if (!item.querySelector('.sidebar-module-check')) {
                    const check = document.createElement('span');
                    check.className = 'material-icons sidebar-module-check';
                    check.textContent = 'check_circle';
                    item.appendChild(check);
                }
            } else {
                item.classList.remove('completed');
                const checkIcon = item.querySelector('.sidebar-module-check');
                if (checkIcon) checkIcon.remove();
            }
        }
    });
}

// Global keydown/keyup listener for Spacebar play/pause without scrolling or triggering buttons
function handleSpacebar(e) {
    // Only intercept if we are on the module page
    if (window.location.hash.includes('module')) {
        // Don't intercept if user is typing in an input or textarea
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

        if (e.code === 'Space') {
            e.preventDefault(); // Prevent page scroll and default button clicks
            e.stopPropagation(); // Stop event from reaching the native video player controls

            // Remove focus from any button (like the fullscreen button)
            if (document.activeElement && document.activeElement !== document.body) {
                document.activeElement.blur();
            }

            // Only toggle play/pause on keydown (prevent double toggle on keyup)
            if (e.type === 'keydown') {
                const video = document.getElementById('moduleVideo');
                if (video) {
                    if (video.paused) {
                        video.play();
                    } else {
                        video.pause();
                    }
                }
            }
        }
    }
}

window.addEventListener('keydown', handleSpacebar, true);
window.addEventListener('keyup', handleSpacebar, true);

// Aggressively remove focus from the video element when interacted with 
// so native controls (like fullscreen) don't retain focus and hijack Enter/Space.
document.addEventListener('fullscreenchange', () => {
    if (document.activeElement && document.activeElement.tagName === 'VIDEO') {
        document.activeElement.blur();
    }
});

// Use event delegation to catch clicks on the video container
document.addEventListener('mouseup', (e) => {
    if (e.target && e.target.tagName === 'VIDEO') {
        setTimeout(() => {
            if (document.activeElement && document.activeElement.tagName === 'VIDEO') {
                document.activeElement.blur();
            }
        }, 50);
    }
}, true);
