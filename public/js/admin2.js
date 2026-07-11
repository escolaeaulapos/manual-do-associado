/* ═══════════════════════════════════════════════════════════════════
   admin.js — Admin Panel
   Manual do Associado — eAula Pós
   ═══════════════════════════════════════════════════════════════════ */

let adminActiveTab = 'users';
let adminAvailableVideos = [];
let progressRefreshInterval = null;
// Map de módulos para edição segura (evita passar JSON no onclick)
let adminModulesMap = {};

async function renderAdminPage() {
    const appEl = document.getElementById('app');

    appEl.innerHTML = renderAppHeader() + `
        <div class="admin-page">
            <div class="container">
                <div class="admin-page-title">
                    <span class="material-icons">admin_panel_settings</span>
                    Painel Administrativo
                </div>

                <div class="admin-tabs">
                    <button class="admin-tab ${adminActiveTab === 'users' ? 'active' : ''}" onclick="switchAdminTab('users')">
                        <span class="material-icons">people</span>
                        <span>Usuários</span>
                    </button>
                    <button class="admin-tab ${adminActiveTab === 'modules' ? 'active' : ''}" onclick="switchAdminTab('modules')">
                        <span class="material-icons">view_module</span>
                        <span>Módulos</span>
                    </button>
                    <button class="admin-tab ${adminActiveTab === 'stats' ? 'active' : ''}" onclick="switchAdminTab('stats')">
                        <span class="material-icons">bar_chart</span>
                        <span>Estatísticas</span>
                    </button>
                    <button class="admin-tab ${adminActiveTab === 'progress' ? 'active' : ''}" onclick="switchAdminTab('progress')">
                        <span class="material-icons">trending_up</span>
                        <span>Progresso</span>
                    </button>
                </div>

                <div id="adminTabContent">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Carregando...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    await loadAdminTab(adminActiveTab);
}

function switchAdminTab(tab) {
    adminActiveTab = tab;

    // Para o auto-refresh quando trocar de aba
    if (progressRefreshInterval) {
        clearInterval(progressRefreshInterval);
        progressRefreshInterval = null;
    }

    // Update tab active state
    document.querySelectorAll('.admin-tab').forEach(t => {
        t.classList.toggle('active', t.onclick.toString().includes(`'${tab}'`));
    });

    loadAdminTab(tab);
}

async function loadAdminTab(tab) {
    const content = document.getElementById('adminTabContent');
    if (!content) return;

    content.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Carregando...</p>
        </div>
    `;

    try {
        switch (tab) {
            case 'users': await renderUsersTab(content); break;
            case 'modules': await renderModulesTab(content); break;
            case 'stats': await renderStatsTab(content); break;
            case 'progress': await renderProgressTab(content); break;
        }
    } catch (err) {
        content.innerHTML = `
            <div class="empty-state">
                <span class="material-icons">error_outline</span>
                <h3>Erro ao carregar</h3>
                <p>${escapeHtml(err.message)}</p>
                <button class="btn btn-primary" onclick="loadAdminTab('${tab}')" style="margin-top: 16px;">
                    <span class="material-icons">refresh</span>
                    Tentar novamente
                </button>
            </div>
        `;
    }
}

/* ═══════════════════════════════════════════════════════════════════
   USERS TAB
   ═══════════════════════════════════════════════════════════════════ */

async function renderUsersTab(container) {
    const data = await api('/api/admin/users');
    const users = data.users || data || [];

    if (users.length === 0) {
        container.innerHTML = `
            <div class="admin-toolbar">
                <span class="admin-toolbar-title">Gerenciar Usuários</span>
                <button class="btn btn-primary btn-sm" onclick="openUserModal()">
                    <span class="material-icons">person_add</span>
                    Novo Usuário
                </button>
            </div>
            <div class="empty-state">
                <span class="material-icons">people_outline</span>
                <h3>Nenhum usuário cadastrado</h3>
                <p>Clique em "Novo Usuário" para adicionar o primeiro.</p>
            </div>
        `;
        return;
    }

    const rows = users.map(user => `
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:10px;">
                    <div class="header-avatar" style="width:32px;height:32px;font-size:12px;">
                        ${(user.name || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    ${escapeHtml(user.name)}
                </div>
            </td>
            <td>${escapeHtml(user.email)}</td>
            <td>
                <span class="badge ${user.role === 'admin' ? 'badge-secondary' : 'badge-neutral'}">
                    ${user.role === 'admin' ? 'Admin' : 'Usuário'}
                </span>
            </td>
            <td>${formatDate(user.created_at || user.createdAt)}</td>
            <td>
                <div class="table-actions">
                    <button class="table-action-btn" onclick="openUserModal(${JSON.stringify(user).replace(/"/g, '&quot;')})" title="Editar">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="table-action-btn delete" onclick="deleteUser('${user.id || user._id}', '${escapeHtml(user.name)}')" title="Excluir">
                        <span class="material-icons">delete_outline</span>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    container.innerHTML = `
        <div class="admin-tab-content active" style="display:block;">
            <div class="admin-toolbar">
                <span class="admin-toolbar-title">${users.length} usuário${users.length !== 1 ? 's' : ''}</span>
                <button class="btn btn-primary btn-sm" onclick="openUserModal()">
                    <span class="material-icons">person_add</span>
                    Novo Usuário
                </button>
            </div>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>E-mail</th>
                            <th>Função</th>
                            <th>Data de Cadastro</th>
                            <th style="width:100px">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function openUserModal(user = null) {
    const isEdit = !!user;
    const title = isEdit ? 'Editar Usuário' : 'Novo Usuário';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <div class="modal-body">
                <form id="userForm">
                    <div class="form-group">
                        <label class="form-label">Nome</label>
                        <input type="text" class="form-input" id="userFormName" value="${isEdit ? escapeHtml(user.name) : ''}" placeholder="Nome completo" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">E-mail</label>
                        <input type="email" class="form-input" id="userFormEmail" value="${isEdit ? escapeHtml(user.email) : ''}" placeholder="email@exemplo.com" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Senha ${isEdit ? '(deixe em branco para manter)' : ''}</label>
                        <input type="password" class="form-input" id="userFormPassword" placeholder="${isEdit ? '••••••••' : 'Mínimo 6 caracteres'}" ${isEdit ? '' : 'required'}>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Função</label>
                        <select class="form-select" id="userFormRole">
                            <option value="user" ${isEdit && user.role === 'user' ? 'selected' : ''}>Usuário</option>
                            <option value="admin" ${isEdit && user.role === 'admin' ? 'selected' : ''}>Administrador</option>
                        </select>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                <button class="btn btn-primary" id="userFormSubmit">
                    <span class="material-icons">${isEdit ? 'save' : 'person_add'}</span>
                    ${isEdit ? 'Salvar' : 'Criar Usuário'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    // Submit handler
    document.getElementById('userFormSubmit').addEventListener('click', async () => {
        const name = document.getElementById('userFormName').value.trim();
        const email = document.getElementById('userFormEmail').value.trim();
        const password = document.getElementById('userFormPassword').value.trim();
        const role = document.getElementById('userFormRole').value;

        if (!name || !email) {
            showToast('Preencha todos os campos obrigatórios.', 'warning');
            return;
        }

        if (!isEdit && !password) {
            showToast('A senha é obrigatória para novos usuários.', 'warning');
            return;
        }

        const submitBtn = document.getElementById('userFormSubmit');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="loading-spinner" style="width:18px;height:18px;border-width:2px;"></div>';

        try {
            const body = { name, email, role };
            if (password) body.password = password;

            if (isEdit) {
                await api(`/api/admin/users/${user.id || user._id}`, {
                    method: 'PUT',
                    body: JSON.stringify(body),
                });
                showToast('Usuário atualizado com sucesso!', 'success');
            } else {
                await api('/api/admin/users', {
                    method: 'POST',
                    body: JSON.stringify(body),
                });
                showToast('Usuário criado com sucesso!', 'success');
            }

            overlay.remove();
            await loadAdminTab('users');
        } catch (err) {
            showToast(err.message || 'Erro ao salvar usuário.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span class="material-icons">${isEdit ? 'save' : 'person_add'}</span>${isEdit ? 'Salvar' : 'Criar Usuário'}`;
        }
    });
}

async function deleteUser(userId, userName) {
    showConfirm(
        `Tem certeza que deseja excluir o usuário <strong>${escapeHtml(userName)}</strong>? Esta ação não pode ser desfeita.`,
        async () => {
            try {
                await api(`/api/admin/users/${userId}`, { method: 'DELETE' });
                showToast('Usuário excluído com sucesso!', 'success');
                await loadAdminTab('users');
            } catch (err) {
                showToast(err.message || 'Erro ao excluir usuário.', 'error');
            }
        }
    );
}

/* ═══════════════════════════════════════════════════════════════════
   MODULES TAB
   ═══════════════════════════════════════════════════════════════════ */

async function renderModulesTab(container) {
    const [modulesData, videosData] = await Promise.all([
        api('/api/modules'),
        api('/api/admin/videos').catch(() => ({ videos: [] })),
    ]);

    const modules = modulesData.modules || modulesData || [];
    adminAvailableVideos = videosData.files || videosData.videos || [];

    if (modules.length === 0) {
        container.innerHTML = `
            <div class="admin-toolbar">
                <span class="admin-toolbar-title">Gerenciar Módulos</span>
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-outline btn-sm" onclick="refreshVideos()">
                        <span class="material-icons">refresh</span>
                        Atualizar vídeos da pasta
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="openModuleModal()">
                        <span class="material-icons">add</span>
                        Novo Módulo
                    </button>
                </div>
            </div>
            <div class="empty-state">
                <span class="material-icons">view_module</span>
                <h3>Nenhum módulo cadastrado</h3>
                <p>Clique em "Novo Módulo" para adicionar o primeiro.</p>
            </div>
        `;
        return;
    }

    const moduleCards = modules.map((mod, index) => {
        const modId = String(mod.id || mod._id);
        const hasVideoUrl = !!mod.video_url;
        const hasVideoFile = !!mod.video_filename || !!mod.video_file || !!mod.videoFile;
        const hasVideo = hasVideoUrl || hasVideoFile;
        const videoName = hasVideoUrl ? 'Link do YouTube' : (mod.video_filename || mod.video_file || mod.videoFile || '');
        // Store in map for safe retrieval on edit
        adminModulesMap[modId] = mod;

        return `
            <div class="admin-module-card" draggable="true"
                 data-module-id="${modId}"
                 data-order="${mod.order || index}"
                 ondragstart="handleDragStart(event)"
                 ondragover="handleDragOver(event)"
                 ondragenter="handleDragEnter(event)"
                 ondragleave="handleDragLeave(event)"
                 ondrop="handleDrop(event)"
                 ondragend="handleDragEnd(event)">
                <div class="drag-handle">
                    <span class="material-icons">drag_indicator</span>
                </div>
                <div class="admin-module-order">${mod.order || index + 1}</div>
                <div class="admin-module-info">
                    <div class="admin-module-name">
                        ${escapeHtml(mod.title || mod.titulo)}
                        ${mod.is_full_training || mod.isFullTraining ? '<span class="badge badge-secondary" style="margin-left:8px;font-size:10px;">Treinamento Completo</span>' : ''}
                    </div>
                    <div class="admin-module-desc">${escapeHtml(mod.description || mod.descricao || 'Sem descrição')}</div>
                </div>
                <div class="admin-module-video-badge ${hasVideo ? '' : 'no-video'}">
                    <span class="material-icons">${hasVideo ? 'videocam' : 'videocam_off'}</span>
                    ${hasVideo ? escapeHtml(videoName).substring(0, 22) : 'Sem vídeo'}
                </div>
                <div class="admin-module-actions">
                    <button class="table-action-btn" onclick="openModuleById('${modId}')" title="Editar">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="table-action-btn delete" onclick="deleteModule('${modId}', '${escapeHtml(mod.title || mod.titulo)}')" title="Excluir">
                        <span class="material-icons">delete_outline</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="admin-tab-content active" style="display:block;">
            <div class="admin-toolbar">
                <span class="admin-toolbar-title">${modules.length} módulo${modules.length !== 1 ? 's' : ''}</span>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-outline btn-sm" onclick="refreshVideos()">
                        <span class="material-icons">refresh</span>
                        Atualizar vídeos
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="openModuleModal()">
                        <span class="material-icons">add</span>
                        Novo Módulo
                    </button>
                </div>
            </div>
            <div class="admin-modules-list" id="adminModulesList">
                ${moduleCards}
            </div>
        </div>
    `;
}

// Look up module by ID from the safe map, then open modal
function openModuleById(moduleId) {
    const mod = adminModulesMap[String(moduleId)];
    if (!mod) {
        showToast('Módulo não encontrado.', 'error');
        return;
    }
    openModuleModal(mod);
}

function openModuleModal(module = null) {
    try {
        const isEdit = !!module;
        const title = isEdit ? 'Editar Módulo' : 'Novo Módulo';

        const videoOptions = adminAvailableVideos.map(v => {
            const fileName = typeof v === 'string' ? v : v.filename || v.name;
            const selected = isEdit && (module.video_file === fileName || module.videoFile === fileName) ? 'selected' : '';
            return `<option value="${escapeHtml(fileName)}" ${selected}>${escapeHtml(fileName)}</option>`;
        }).join('');

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal" style="max-width: 560px;">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="moduleForm">
                        <div class="form-group">
                            <label class="form-label">Título</label>
                            <input type="text" class="form-input" id="moduleFormTitle" value="${isEdit ? escapeHtml(module.title || module.titulo || '') : ''}" placeholder="Nome do módulo" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Descrição</label>
                            <textarea class="form-textarea form-textarea-lg" id="moduleFormDesc" placeholder="Descrição do conteúdo do módulo...">${isEdit ? escapeHtml(module.description || module.descricao || '') : ''}</textarea>
                            <div class="form-hint-block" id="chapterHint" style="display:none;">
                                💡 <strong>Dica para o Treinamento Completo:</strong> Use o formato abaixo para criar capítulos clicáveis no vídeo:<br>
                                <code>0:00 - Introdução e Boas-Vindas</code><br>
                                <code>5:30 - Painel do Aluno</code><br>
                                <code>12:00 - Como Fazer Matrícula</code>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Link Externo (YouTube/Vimeo)</label>
                            <input type="url" class="form-input" id="moduleFormVideoUrl" value="${isEdit ? escapeHtml(module.video_url || '') : ''}" placeholder="Ex: https://youtu.be/abc123xyz">
                            <div class="form-hint">Se preenchido, o sistema usará este link (prioridade).</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Vídeo</label>
                            <select class="form-select" id="moduleFormVideo">
                                <option value="">Nenhum vídeo selecionado</option>
                                ${videoOptions}
                            </select>
                            <div class="form-hint">Selecione um vídeo disponível ou faça upload abaixo.</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Upload de Vídeo</label>
                            <div class="upload-area" id="uploadArea">
                                <span class="material-icons">cloud_upload</span>
                                <p>Clique ou arraste um arquivo de vídeo</p>
                                <small>MP4, WebM, AVI (máx. 500MB)</small>
                            </div>
                            <input type="file" id="moduleVideoUpload" accept="video/*" style="display:none;">
                            <div class="upload-progress" id="uploadProgress" style="display:none;">
                                <div class="upload-progress-bar">
                                    <div class="upload-progress-fill" id="uploadProgressFill" style="width:0%"></div>
                                </div>
                                <div class="upload-progress-text" id="uploadProgressText">0%</div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Duração</label>
                            <input type="text" class="form-input" id="moduleFormDuration" value="${isEdit ? escapeHtml(module.duration || '') : ''}" placeholder="Ex: 5 min">
                        </div>
                        <div class="form-group">
                            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;font-weight:500;color:var(--text-color);">
                                <input type="checkbox" id="moduleFormFullTraining" ${isEdit && (module.is_full_training || module.isFullTraining) ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary-color);flex-shrink:0;cursor:pointer;">
                                <span>Este é o <strong>Treinamento Completo</strong> (vídeo de 30min+ com todos os conteúdos)</span>
                            </label>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                    <button class="btn btn-primary" id="moduleFormSubmit">
                        <span class="material-icons">${isEdit ? 'save' : 'add'}</span>
                        ${isEdit ? 'Salvar' : 'Criar Módulo'}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        // Upload area click
        const uploadArea = overlay.querySelector('#uploadArea');
        const fileInput = overlay.querySelector('#moduleVideoUpload');

        uploadArea.addEventListener('click', () => fileInput.click());

        // Show/hide chapter hint when "Treinamento Completo" is toggled
        const fullTrainingChk = overlay.querySelector('#moduleFormFullTraining');
        const chapterHint = overlay.querySelector('#chapterHint');
        const updateHint = () => {
            if (chapterHint) chapterHint.style.display = fullTrainingChk.checked ? 'block' : 'none';
        };
        fullTrainingChk.addEventListener('change', updateHint);
        updateHint(); // run on open (in case editing an existing full-training module)

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary)';
            uploadArea.style.background = 'rgba(19,48,133,0.03)';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '';
            uploadArea.style.background = '';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '';
            uploadArea.style.background = '';
            if (e.dataTransfer.files.length > 0) {
                handleVideoUpload(e.dataTransfer.files[0], overlay);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleVideoUpload(fileInput.files[0], overlay);
            }
        });

        // Submit handler
        overlay.querySelector('#moduleFormSubmit').addEventListener('click', async () => {
            const titleVal = overlay.querySelector('#moduleFormTitle').value.trim();
            const desc = overlay.querySelector('#moduleFormDesc').value.trim();
            const videoUrl = overlay.querySelector('#moduleFormVideoUrl').value.trim();
            const videoFile = overlay.querySelector('#moduleFormVideo').value;
            const duration = overlay.querySelector('#moduleFormDuration').value.trim();
            const isFullTraining = overlay.querySelector('#moduleFormFullTraining').checked;

            if (!titleVal) {
                showToast('O título é obrigatório.', 'warning');
                return;
            }

            const submitBtn = overlay.querySelector('#moduleFormSubmit');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="loading-spinner" style="width:18px;height:18px;border-width:2px;"></div>';

            try {
                const body = {
                    title: titleVal,
                    description: desc,
                    video_url: videoUrl || null,
                    video_filename: videoFile || null,
                    duration_label: duration || null,
                    is_full_training: isFullTraining,
                };

                if (isEdit) {
                    await api(`/api/admin/modules/${module.id || module._id}`, {
                        method: 'PUT',
                        body: JSON.stringify(body),
                    });
                    showToast('Módulo atualizado com sucesso!', 'success');
                } else {
                    await api('/api/admin/modules', {
                        method: 'POST',
                        body: JSON.stringify(body),
                    });
                    showToast('Módulo criado com sucesso!', 'success');
                }

                overlay.remove();
                // Reset App modules so they refetch
                App.modules = [];
                await loadAdminTab('modules');
            } catch (err) {
                showToast(err.message || 'Erro ao salvar módulo.', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span class="material-icons">${isEdit ? 'save' : 'add'}</span>${isEdit ? 'Salvar' : 'Criar Módulo'}`;
            }
        });
    } catch (err) {
        showToast('Erro ao abrir o formulário: ' + err.message, 'error');
        console.error(err);
    }
}

async function handleVideoUpload(file, overlay) {
    const progressEl = overlay.querySelector('#uploadProgress');
    const progressFill = overlay.querySelector('#uploadProgressFill');
    const progressText = overlay.querySelector('#uploadProgressText');
    const uploadArea = overlay.querySelector('#uploadArea');

    progressEl.style.display = 'block';
    uploadArea.innerHTML = `
        <span class="material-icons">movie</span>
        <p>${escapeHtml(file.name)}</p>
        <small>${(file.size / 1024 / 1024).toFixed(1)} MB</small>
    `;

    const formData = new FormData();
    formData.append('video', file);

    try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = percent + '%';
                progressText.textContent = percent + '%';
            }
        });

        const result = await new Promise((resolve, reject) => {
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    let errMsg = `[Status ${xhr.status}]`;
                    try {
                        const err = JSON.parse(xhr.responseText);
                        errMsg += ` - ${err.message || err.error || 'Erro no upload'}`;
                    } catch {
                        errMsg += ` - ${xhr.responseText.substring(0, 50) || 'Erro na resposta'}`;
                    }
                    reject(new Error(errMsg));
                }
            });
            xhr.addEventListener('error', () => reject(new Error(`Erro na rede (Status: ${xhr.status})`)));
            xhr.open('POST', '/api/admin/upload');
            xhr.send(formData);
        });

        const uploadedFile = result.filename || result.file || file.name;

        // Add to video select
        const videoSelect = overlay.querySelector('#moduleFormVideo');
        const option = document.createElement('option');
        option.value = uploadedFile;
        option.textContent = uploadedFile;
        option.selected = true;
        videoSelect.appendChild(option);

        progressText.textContent = 'Upload concluído!';
        progressText.style.color = 'var(--accent)';
        showToast('Vídeo enviado com sucesso!', 'success');

    } catch (err) {
        progressText.textContent = 'Erro no upload';
        progressText.style.color = 'var(--danger)';
        showToast(err.message || 'Erro ao enviar vídeo.', 'error');
    }
}

async function deleteModule(moduleId, moduleName) {
    showConfirm(
        `Tem certeza que deseja excluir o módulo <strong>${escapeHtml(moduleName)}</strong>? Esta ação não pode ser desfeita.`,
        async () => {
            try {
                await api(`/api/admin/modules/${moduleId}`, { method: 'DELETE' });
                showToast('Módulo excluído com sucesso!', 'success');
                App.modules = [];
                await loadAdminTab('modules');
            } catch (err) {
                showToast(err.message || 'Erro ao excluir módulo.', 'error');
            }
        }
    );
}

async function refreshVideos() {
    try {
        const data = await api('/api/admin/videos');
        adminAvailableVideos = data.files || data.videos || [];
        showToast(`${adminAvailableVideos.length} vídeo(s) encontrado(s).`, 'success');
    } catch (err) {
        showToast(err.message || 'Erro ao buscar vídeos.', 'error');
    }
}

/* ─── Drag & Drop Reorder ───────────────────────────────────────── */

let draggedElement = null;

function handleDragStart(e) {
    draggedElement = e.target.closest('.admin-module-card');
    draggedElement.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedElement.dataset.moduleId);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    const card = e.target.closest('.admin-module-card');
    if (card && card !== draggedElement) {
        card.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const card = e.target.closest('.admin-module-card');
    if (card) {
        card.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    const targetCard = e.target.closest('.admin-module-card');
    if (!targetCard || !draggedElement || targetCard === draggedElement) return;

    targetCard.classList.remove('drag-over');

    const list = document.getElementById('adminModulesList');
    const cards = Array.from(list.querySelectorAll('.admin-module-card'));
    const fromIndex = cards.indexOf(draggedElement);
    const toIndex = cards.indexOf(targetCard);

    if (fromIndex < toIndex) {
        targetCard.parentNode.insertBefore(draggedElement, targetCard.nextSibling);
    } else {
        targetCard.parentNode.insertBefore(draggedElement, targetCard);
    }

    // Update order numbers visually
    const updatedCards = Array.from(list.querySelectorAll('.admin-module-card'));
    updatedCards.forEach((card, idx) => {
        const orderEl = card.querySelector('.admin-module-order');
        if (orderEl) orderEl.textContent = idx + 1;
    });

    // Save new order
    saveModuleOrder(updatedCards);
}

function handleDragEnd(e) {
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
        draggedElement = null;
    }
    document.querySelectorAll('.admin-module-card').forEach(c => {
        c.classList.remove('drag-over');
    });
}

async function saveModuleOrder(cards) {
    const order = cards.map((card, idx) => ({
        id: card.dataset.moduleId,
        order: idx + 1,
    }));

    try {
        await api('/api/admin/modules/reorder', {
            method: 'PUT',
            body: JSON.stringify({ order }),
        });
        showToast('Ordem atualizada com sucesso!', 'success');
    } catch (err) {
        showToast('Erro ao salvar ordem. Recarregue a página.', 'error');
    }
}

/* ═══════════════════════════════════════════════════════════════════
   STATISTICS TAB
   ═══════════════════════════════════════════════════════════════════ */

async function renderStatsTab(container) {
    const data = await api('/api/admin/stats');
    const stats = data.stats || data || {};

    container.innerHTML = `
        <div class="admin-tab-content active" style="display:block;">
            <div class="stats-grid">
                <div class="stat-card stat-users" style="${staggerDelay(0, 0)}">
                    <div class="stat-card-icon">
                        <span class="material-icons">people</span>
                    </div>
                    <div class="stat-card-number" data-target="${stats.totalUsers || 0}">0</div>
                    <div class="stat-card-label">Total de Usuários</div>
                </div>
                <div class="stat-card stat-modules" style="${staggerDelay(1, 0)}">
                    <div class="stat-card-icon">
                        <span class="material-icons">view_module</span>
                    </div>
                    <div class="stat-card-number" data-target="${stats.totalModules || 0}">0</div>
                    <div class="stat-card-label">Total de Módulos</div>
                </div>
                <div class="stat-card stat-completions" style="${staggerDelay(2, 0)}">
                    <div class="stat-card-icon">
                        <span class="material-icons">check_circle</span>
                    </div>
                    <div class="stat-card-number" data-target="${stats.totalCompletions || 0}">0</div>
                    <div class="stat-card-label">Conclusões Totais</div>
                </div>
                <div class="stat-card stat-access" style="${staggerDelay(3, 0)}">
                    <div class="stat-card-icon">
                        <span class="material-icons">login</span>
                    </div>
                    <div class="stat-card-number" data-target="${stats.recentAccess || stats.accessLast30Days || 0}">0</div>
                    <div class="stat-card-label">Acessos (30 dias)</div>
                </div>
            </div>
        </div>
    `;

    // Animate numbers
    setTimeout(() => {
        document.querySelectorAll('.stat-card-number[data-target]').forEach(el => {
            const target = parseInt(el.dataset.target, 10);
            animateNumber(el, target, 1200);
        });
    }, 200);
}

/* ═══════════════════════════════════════════════════════════════════
   USER PROGRESS TAB
   ═══════════════════════════════════════════════════════════════════ */

async function renderProgressTab(container) {
    // Carrega dados frescos do servidor
    await refreshProgressData(container);

    // Inicia auto-refresh a cada 15 segundos
    if (progressRefreshInterval) clearInterval(progressRefreshInterval);
    progressRefreshInterval = setInterval(async () => {
        // Só atualiza se ainda estiver na aba de progresso
        if (adminActiveTab === 'progress' && document.getElementById('adminTabContent')) {
            await refreshProgressData(container);
        } else {
            clearInterval(progressRefreshInterval);
        }
    }, 15000);
}

async function refreshProgressData(container) {
    const data = await api('/api/admin/user-progress');
    const users = data.users || data || [];

    if (users.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-icons">trending_up</span>
                <h3>Nenhum dado de progresso</h3>
                <p>Os dados aparecerão quando os usuários começarem o treinamento.</p>
            </div>
        `;
        return;
    }

    const rows = users.map((user, idx) => {
        const percent = user.progressPercent || user.progress_percent || 0;
        const userId = user.id || user._id || idx;
        const modules = user.modules || user.moduleProgress || [];

        const expandedModules = modules.map(m => {
            const done = m.completed;
            return `
                <div class="expanded-module-item ${done ? 'done' : 'not-done'}">
                    <span class="material-icons">${done ? 'check_circle' : 'radio_button_unchecked'}</span>
                    <span class="expanded-module-title">${escapeHtml(m.title || m.module_title || 'Módulo')}</span>
                    ${done ? '<span class="expanded-module-badge">Concluído</span>' : '<span class="expanded-module-badge not-done-badge">Pendente</span>'}
                </div>
            `;
        }).join('');

        return `
            <tr class="expandable-row" onclick="toggleExpandRow('expand-${userId}', this)">
                <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div class="header-avatar" style="width:32px;height:32px;font-size:12px;">
                            ${(user.name || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        ${escapeHtml(user.name || '—')}
                    </div>
                </td>
                <td>${escapeHtml(user.email || '—')}</td>
                <td>
                    <div class="progress-mini-bar">
                        <div class="progress-mini-track">
                            <div class="progress-mini-fill" style="width: ${percent}%"></div>
                        </div>
                        <span class="progress-mini-label">${percent}%</span>
                    </div>
                </td>
                <td>
                    <span class="material-icons expand-icon" style="color:var(--text-light);font-size:20px;">expand_more</span>
                </td>
            </tr>
            <tr class="expanded-content" id="expand-${userId}">
                <td colspan="4">
                    <div class="expanded-modules-list">
                        ${expandedModules || '<p style="color:var(--text-light);font-size:13px;">Nenhum módulo registrado.</p>'}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="admin-tab-content active" style="display:block;">
            <div class="admin-toolbar">
                <span class="admin-toolbar-title">Progresso dos Usuários</span>
            </div>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Usuário</th>
                            <th>E-mail</th>
                            <th>Progresso Geral</th>
                            <th style="width:50px;text-align:center;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function toggleExpandRow(expandId, triggerRow) {
    const expandedRow = document.getElementById(expandId);
    if (!expandedRow) return;

    const isShown = expandedRow.classList.contains('show');

    // Close all other expanded rows
    document.querySelectorAll('.expanded-content.show').forEach(el => {
        el.classList.remove('show');
    });
    document.querySelectorAll('.expandable-row.expanded').forEach(el => {
        el.classList.remove('expanded');
    });

    if (!isShown) {
        expandedRow.classList.add('show');
        triggerRow.classList.add('expanded');
    }
}
