/**
 * server.js
 * Servidor principal do Manual do Associado — LMS da eAula Pós.
 * 
 * Responsabilidades:
 * - Configuração do Express com sessões e CORS
 * - Rotas de autenticação (login, logout, sessão atual)
 * - Rotas de módulos e progresso do usuário
 * - Streaming de vídeo com suporte a Range Requests (seeking)
 * - Painel administrativo (CRUD de usuários, módulos, upload, estatísticas)
 * - Servir arquivos estáticos e suporte a SPA (Single Page Application)
 */

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { initDatabase } = require('./database');
const { requireAuth, requireAdmin } = require('./middleware/auth');

// =============================================
// Inicialização
// =============================================

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializa o banco de dados e obtém a instância
const db = initDatabase();

// Diretório onde estão armazenados os vídeos de treinamento
const VIDEO_DIR = process.env.VIDEO_DIR || path.join(__dirname, 'videos');

// =============================================
// Middlewares globais
// =============================================

// Habilita CORS para desenvolvimento
app.use(cors({
  origin: true,
  credentials: true
}));

// Parsing de JSON e formulários
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração de sessão
app.use(session({
  secret: 'manual-do-associado-eaula-pos-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    httpOnly: true,
    secure: false // Definir como true em produção com HTTPS
  }
}));

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// =============================================
// Configuração do Multer para upload de vídeos
// =============================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Garante que o diretório de vídeos existe
    if (!fs.existsSync(VIDEO_DIR)) {
      fs.mkdirSync(VIDEO_DIR, { recursive: true });
    }
    cb(null, VIDEO_DIR);
  },
  filename: (req, file, cb) => {
    // Mantém o nome original do arquivo
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Aceita apenas arquivos .mp4
    if (path.extname(file.originalname).toLowerCase() === '.mp4') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos .mp4 são permitidos.'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // Limite de 5GB
  }
});

// =============================================
// ROTAS DE AUTENTICAÇÃO
// =============================================

/**
 * POST /api/login
 * Autentica o usuário com email e senha.
 * Cria sessão e registra log de acesso.
 */
app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;

    // Validação dos campos
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email e senha são obrigatórios.'
      });
    }

    // Busca o usuário pelo email
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos.'
      });
    }

    // Verifica a senha com bcrypt
    const passwordValid = bcrypt.compareSync(password, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos.'
      });
    }

    // Cria a sessão do usuário
    req.session.userId = user.id;
    req.session.role = user.role;

    // Registra o log de acesso
    db.prepare(
      'INSERT INTO access_logs (user_id, action) VALUES (?, ?)'
    ).run(user.id, 'login');

    console.log(`[AUTH] Login realizado: ${user.email} (${user.role})`);

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[AUTH] Erro no login:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno no servidor.'
    });
  }
});

/**
 * POST /api/logout
 * Encerra a sessão do usuário.
 */
app.post('/api/logout', (req, res) => {
  try {
    // Registra o log antes de destruir a sessão
    if (req.session.userId) {
      db.prepare(
        'INSERT INTO access_logs (user_id, action) VALUES (?, ?)'
      ).run(req.session.userId, 'logout');
    }

    req.session.destroy((err) => {
      if (err) {
        console.error('[AUTH] Erro ao encerrar sessão:', err.message);
        return res.status(500).json({
          success: false,
          message: 'Erro ao encerrar sessão.'
        });
      }

      res.json({ success: true });
    });
  } catch (error) {
    console.error('[AUTH] Erro no logout:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno no servidor.'
    });
  }
});

/**
 * GET /api/me
 * Retorna os dados do usuário autenticado na sessão atual.
 */
app.get('/api/me', (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Não autenticado.'
      });
    }

    const user = db.prepare(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?'
    ).get(req.session.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('[AUTH] Erro ao buscar usuário atual:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno no servidor.'
    });
  }
});

// =============================================
// ROTAS DE MÓDULOS (requerem autenticação)
// =============================================

/**
 * GET /api/modules
 * Lista todos os módulos ordenados por order_index.
 */
app.get('/api/modules', requireAuth, (req, res) => {
  try {
    const modulesDb = db.prepare(
      'SELECT * FROM modules ORDER BY order_index ASC'
    ).all();

    const modules = modulesDb.map(mod => ({
      ...mod,
      video_file: mod.video_filename,
      order: mod.order_index,
      duration: mod.duration_label
    }));

    res.json({ success: true, modules });
  } catch (error) {
    console.error('[MÓDULOS] Erro ao listar módulos:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar módulos.'
    });
  }
});

/**
 * GET /api/modules/:id
 * Retorna um módulo específico pelo ID.
 */
app.get('/api/modules/:id', requireAuth, (req, res) => {
  try {
    const module = db.prepare(
      'SELECT * FROM modules WHERE id = ?'
    ).get(req.params.id);

    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Módulo não encontrado.'
      });
    }

    res.json({ success: true, module });
  } catch (error) {
    console.error('[MÓDULOS] Erro ao buscar módulo:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar módulo.'
    });
  }
});

// =============================================
// ROTAS DE PROGRESSO (requerem autenticação)
// =============================================

/**
 * GET /api/progress
 * Retorna o progresso do usuário autenticado em todos os módulos.
 */
app.get('/api/progress', requireAuth, (req, res) => {
  try {
    const progress = db.prepare(
      'SELECT module_id, completed, completed_at FROM user_progress WHERE user_id = ?'
    ).all(req.session.userId);

    res.json({ success: true, progress });
  } catch (error) {
    console.error('[PROGRESSO] Erro ao buscar progresso:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar progresso.'
    });
  }
});

/**
 * POST /api/progress/:moduleId
 * Atualiza (upsert) o progresso do usuário em um módulo específico.
 * Registra log de acesso.
 */
app.post('/api/progress/:moduleId', requireAuth, (req, res) => {
  try {
    const { moduleId } = req.params;
    const { completed } = req.body;
    const userId = req.session.userId;

    // Verifica se o módulo existe
    const module = db.prepare('SELECT id FROM modules WHERE id = ?').get(moduleId);
    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Módulo não encontrado.'
      });
    }

    // Upsert: insere ou atualiza o progresso
    const completedAt = completed ? new Date().toISOString() : null;

    db.prepare(`
      INSERT INTO user_progress (user_id, module_id, completed, completed_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, module_id)
      DO UPDATE SET completed = excluded.completed, completed_at = excluded.completed_at
    `).run(userId, moduleId, completed ? 1 : 0, completedAt);

    // Registra log de acesso
    const action = completed ? 'module_completed' : 'module_progress';
    db.prepare(
      'INSERT INTO access_logs (user_id, action, module_id) VALUES (?, ?, ?)'
    ).run(userId, action, moduleId);

    res.json({ success: true });
  } catch (error) {
    console.error('[PROGRESSO] Erro ao atualizar progresso:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar progresso.'
    });
  }
});

// =============================================
// STREAMING DE VÍDEO (requer autenticação)
// =============================================

/**
 * GET /api/videos/:filename
 * Faz streaming de vídeo com suporte a HTTP Range Requests.
 * Isso permite que o player de vídeo faça seeking (avançar/retroceder).
 */
app.get('/api/videos/:filename', requireAuth, (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(VIDEO_DIR, filename);

    // Verifica se o arquivo existe
    if (!fs.existsSync(filePath)) {
      console.warn(`[VÍDEO] Arquivo não encontrado: ${filePath}`);
      return res.status(404).json({
        success: false,
        message: 'Vídeo não encontrado.'
      });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    // Registra log de acesso ao vídeo
    db.prepare(
      'INSERT INTO access_logs (user_id, action) VALUES (?, ?)'
    ).run(req.session.userId, `video_stream:${filename}`);

    const range = req.headers.range;

    if (range) {
      // Requisição parcial (Range Request) — necessário para seeking no vídeo
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Validação do range
      if (start >= fileSize) {
        res.status(416).set({
          'Content-Range': `bytes */${fileSize}`
        }).end();
        return;
      }

      const chunkSize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4'
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      // Requisição completa (sem Range) — envia o arquivo inteiro
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes'
      });

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  } catch (error) {
    console.error('[VÍDEO] Erro no streaming:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao reproduzir vídeo.'
    });
  }
});

// =============================================
// ROTAS ADMINISTRATIVAS (requerem admin)
// =============================================

// --- Gestão de Usuários ---

/**
 * GET /api/admin/users
 * Lista todos os usuários (sem expor o hash da senha).
 */
app.get('/api/admin/users', requireAdmin, (req, res) => {
  try {
    const users = db.prepare(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    ).all();

    res.json({ success: true, users });
  } catch (error) {
    console.error('[ADMIN] Erro ao listar usuários:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuários.'
    });
  }
});

/**
 * POST /api/admin/users
 * Cria um novo usuário com senha hasheada.
 */
app.post('/api/admin/users', requireAdmin, (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validação dos campos obrigatórios
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nome, email e senha são obrigatórios.'
      });
    }

    // Verifica se o email já existe
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Já existe um usuário com este email.'
      });
    }

    // Hash da senha com bcrypt
    const passwordHash = bcrypt.hashSync(password, 10);

    const result = db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(name, email, passwordHash, role || 'user');

    const user = db.prepare(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?'
    ).get(result.lastInsertRowid);

    console.log(`[ADMIN] Usuário criado: ${email}`);

    res.status(201).json({ success: true, user });
  } catch (error) {
    console.error('[ADMIN] Erro ao criar usuário:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar usuário.'
    });
  }
});

/**
 * PUT /api/admin/users/:id
 * Atualiza um usuário existente.
 */
app.put('/api/admin/users/:id', requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { name, email, password, role } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Nome e email são obrigatórios.'
      });
    }

    // Verifica se o usuário existe
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    // Verifica se o novo email já está em uso por outro usuário
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Já existe outro usuário com este email.'
      });
    }

    if (password) {
      // Atualiza com nova senha
      const passwordHash = bcrypt.hashSync(password, 10);
      db.prepare(
        'UPDATE users SET name = ?, email = ?, password_hash = ?, role = ? WHERE id = ?'
      ).run(name, email, passwordHash, role || 'user', userId);
    } else {
      // Atualiza sem alterar a senha
      db.prepare(
        'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?'
      ).run(name, email, role || 'user', userId);
    }

    console.log(`[ADMIN] Usuário atualizado: ${email}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN] Erro ao atualizar usuário:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar usuário.'
    });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Remove um usuário. Não permite remover o próprio usuário logado.
 */
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    // Não permite excluir o próprio usuário
    if (userId === req.session.userId) {
      return res.status(400).json({
        success: false,
        message: 'Você não pode excluir seu próprio usuário.'
      });
    }

    // Verifica se o usuário existe
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    // Remove o progresso e logs do usuário antes de excluí-lo
    db.prepare('DELETE FROM user_progress WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM access_logs WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    console.log(`[ADMIN] Usuário removido: ${user.email}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN] Erro ao remover usuário:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover usuário.'
    });
  }
});

// --- Gestão de Módulos ---

/**
 * GET /api/admin/modules
 * Lista todos os módulos com indicação se o arquivo de vídeo existe no disco.
 */
app.get('/api/admin/modules', requireAdmin, (req, res) => {
  try {
    const modules = db.prepare(
      'SELECT * FROM modules ORDER BY order_index ASC'
    ).all();

    // Adiciona o campo video_exists verificando se o arquivo existe no diretório
    const modulesWithStatus = modules.map(mod => ({
      ...mod,
      video_exists: mod.video_filename
        ? fs.existsSync(path.join(VIDEO_DIR, mod.video_filename))
        : false
    }));

    res.json({ success: true, modules: modulesWithStatus });
  } catch (error) {
    console.error('[ADMIN] Erro ao listar módulos:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar módulos.'
    });
  }
});

/**
 * POST /api/admin/modules
 * Cria um novo módulo com order_index automático.
 */
app.post('/api/admin/modules', requireAdmin, (req, res) => {
  try {
    const { title, description, video_filename, video_url, duration_label, is_full_training } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'O título do módulo é obrigatório.'
      });
    }

    // Calcula o próximo order_index automaticamente
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(order_index), 0) as max_order FROM modules'
    ).get();
    const nextOrder = maxOrder.max_order + 1;

    const result = db.prepare(`
      INSERT INTO modules (title, description, video_filename, video_url, order_index, duration_label, is_full_training)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      description || null,
      video_filename || null,
      video_url || null,
      nextOrder,
      duration_label || '—',
      is_full_training ? 1 : 0
    );

    const module = db.prepare('SELECT * FROM modules WHERE id = ?').get(result.lastInsertRowid);

    console.log(`[ADMIN] Módulo criado: ${title}`);

    res.status(201).json({ success: true, module });
  } catch (error) {
    console.error('[ADMIN] Erro ao criar módulo:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar módulo.'
    });
  }
});

/**
 * PUT /api/admin/modules/:id
 * Atualiza os campos de um módulo existente.
 */
app.put('/api/admin/modules/:id', requireAdmin, (req, res) => {
  try {
    const moduleId = parseInt(req.params.id, 10);
    const { title, description, video_filename, video_url, duration_label, is_full_training } = req.body;

    // Verifica se o módulo existe
    const existing = db.prepare('SELECT * FROM modules WHERE id = ?').get(moduleId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Módulo não encontrado.'
      });
    }

    // Atualiza apenas os campos fornecidos, mantendo os valores existentes
    db.prepare(`
      UPDATE modules
      SET title = ?, description = ?, video_filename = ?, video_url = ?, duration_label = ?, is_full_training = ?
      WHERE id = ?
    `).run(
      title !== undefined ? title : existing.title,
      description !== undefined ? description : existing.description,
      video_filename !== undefined ? video_filename : existing.video_filename,
      video_url !== undefined ? video_url : existing.video_url,
      duration_label !== undefined ? duration_label : existing.duration_label,
      is_full_training !== undefined ? (is_full_training ? 1 : 0) : existing.is_full_training,
      moduleId
    );

    console.log(`[ADMIN] Módulo atualizado: ID ${moduleId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN] Erro ao atualizar módulo:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar módulo.'
    });
  }
});

/**
 * DELETE /api/admin/modules/:id
 * Remove um módulo e o progresso associado.
 */
app.delete('/api/admin/modules/:id', requireAdmin, (req, res) => {
  try {
    const moduleId = parseInt(req.params.id, 10);

    // Verifica se o módulo existe
    const module = db.prepare('SELECT id, title FROM modules WHERE id = ?').get(moduleId);
    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Módulo não encontrado.'
      });
    }

    // Remove progresso e logs associados ao módulo
    db.prepare('DELETE FROM user_progress WHERE module_id = ?').run(moduleId);
    db.prepare('DELETE FROM access_logs WHERE module_id = ?').run(moduleId);
    db.prepare('DELETE FROM modules WHERE id = ?').run(moduleId);

    console.log(`[ADMIN] Módulo removido: ${module.title}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN] Erro ao remover módulo:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover módulo.'
    });
  }
});

/**
 * PUT /api/admin/modules/reorder
 * Reordena os módulos com base no array de IDs fornecido.
 * Corpo: { order: [id1, id2, id3, ...] }
 */
app.put('/api/admin/modules/reorder', requireAdmin, (req, res) => {
  try {
    const { order } = req.body;

    if (!Array.isArray(order)) {
      return res.status(400).json({
        success: false,
        message: 'O campo "order" deve ser um array de IDs.'
      });
    }

    // Atualiza o order_index de cada módulo em uma transação
    const updateOrder = db.prepare(
      'UPDATE modules SET order_index = ? WHERE id = ?'
    );

    const reorderTransaction = db.transaction((orderArray) => {
      orderArray.forEach((moduleId, index) => {
        updateOrder.run(index + 1, moduleId);
      });
    });

    reorderTransaction(order);

    console.log('[ADMIN] Módulos reordenados com sucesso.');

    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN] Erro ao reordenar módulos:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao reordenar módulos.'
    });
  }
});

// --- Upload de Vídeos ---

/**
 * POST /api/admin/upload
 * Faz upload de um arquivo de vídeo (.mp4) para o diretório de vídeos.
 */
app.post('/api/admin/upload', requireAdmin, upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo enviado.'
      });
    }

    console.log(`[ADMIN] Vídeo enviado: ${req.file.originalname}`);

    res.json({
      success: true,
      filename: req.file.originalname
    });
  } catch (error) {
    console.error('[ADMIN] Erro no upload:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer upload do vídeo.'
    });
  }
});

/**
 * GET /api/admin/videos
 * Lista todos os arquivos .mp4 no diretório de vídeos.
 */
app.get('/api/admin/videos', requireAdmin, (req, res) => {
  try {
    // Verifica se o diretório de vídeos existe
    if (!fs.existsSync(VIDEO_DIR)) {
      return res.json({ success: true, files: [] });
    }

    const files = fs.readdirSync(VIDEO_DIR)
      .filter(file => path.extname(file).toLowerCase() === '.mp4')
      .sort();

    res.json({ success: true, files });
  } catch (error) {
    console.error('[ADMIN] Erro ao listar vídeos:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar vídeos.'
    });
  }
});

// --- Estatísticas e Relatórios ---

/**
 * GET /api/admin/stats
 * Retorna estatísticas gerais do sistema:
 * - Total de usuários, módulos, conclusões
 * - Acessos nos últimos 30 dias
 */
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalModules = db.prepare('SELECT COUNT(*) as count FROM modules').get().count;
    // Busca todos os módulos e seus tipos
    const allModules = db.prepare('SELECT id, is_full_training FROM modules').all();
    const fullTrainingModule = allModules.find(m => m.is_full_training === 1);
    const regularModulesCount = allModules.filter(m => m.is_full_training !== 1).length;

    // Busca todo o progresso dos usuários
    const allProgress = db.prepare('SELECT user_id, module_id, completed FROM user_progress').all();
    
    const users = db.prepare('SELECT id FROM users').all();
    let totalCompletions = 0;

    users.forEach(user => {
      const ftProgress = fullTrainingModule ? allProgress.find(p => p.user_id === user.id && p.module_id === fullTrainingModule.id) : null;
      const ftCompleted = ftProgress ? ftProgress.completed : 0;

      let completedCount = 0;
      allModules.filter(m => m.is_full_training !== 1).forEach(mod => {
        const progress = allProgress.find(p => p.user_id === user.id && p.module_id === mod.id);
        const isCompleted = ftCompleted || (progress && progress.completed ? 1 : 0);
        if (isCompleted) completedCount++;
      });

      const progress_percent = regularModulesCount > 0 ? Math.round((completedCount / regularModulesCount) * 100) : 0;
      if (progress_percent === 100) {
        totalCompletions++;
      }
    });

    // Acessos nos últimos 30 dias (apenas logins reais)
    const recentAccess = db.prepare(`
      SELECT COUNT(*) as count FROM access_logs
      WHERE action = 'login' AND timestamp >= datetime('now', '-30 days')
    `).get().count;

    res.json({
      success: true,
      totalUsers,
      totalModules,
      totalCompletions,
      recentAccess
    });
  } catch (error) {
    console.error('[ADMIN] Erro ao buscar estatísticas:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas.'
    });
  }
});

/**
 * GET /api/admin/user-progress
 * Retorna o progresso de cada usuário em cada módulo.
 * Inclui nome, email e detalhes de progresso por módulo.
 */
app.get('/api/admin/user-progress', requireAdmin, (req, res) => {
  try {
    // Busca todos os usuários (sem senha)
    const users = db.prepare(
      'SELECT id, name, email, role, created_at FROM users ORDER BY name ASC'
    ).all();

    // Busca todos os módulos
    const modules = db.prepare(
      'SELECT id, title, order_index, is_full_training FROM modules ORDER BY order_index ASC'
    ).all();

    // Busca todo o progresso
    const allProgress = db.prepare(
      'SELECT user_id, module_id, completed, completed_at FROM user_progress'
    ).all();

    // Monta a estrutura de dados: cada usuário com seu progresso por módulo
    const usersWithProgress = users.map(user => {
      const fullTrainingModule = modules.find(m => m.is_full_training === 1);
      const regularModules = modules.filter(m => m.is_full_training !== 1);
      
      const ftProgress = fullTrainingModule ? allProgress.find(p => p.user_id === user.id && p.module_id === fullTrainingModule.id) : null;
      const ftCompleted = ftProgress ? ftProgress.completed : 0;

      let completedCount = 0;
      
      const moduleProgress = modules.map(mod => {
        const progress = allProgress.find(
          p => p.user_id === user.id && p.module_id === mod.id
        );
        const isCompleted = ftCompleted || (progress && progress.completed ? 1 : 0);
        
        // Só conta os regulares para o cálculo da porcentagem
        if (mod.is_full_training !== 1 && isCompleted) {
          completedCount++;
        }
        
        return {
          module_id: mod.id,
          module_title: mod.title,
          completed: isCompleted,
          completed_at: progress ? progress.completed_at : null
        };
      });

      const progress_percent = regularModules.length > 0 ? Math.round((completedCount / regularModules.length) * 100) : 0;

      return {
        ...user,
        progress_percent,
        moduleProgress
      };
    });

    res.json({ success: true, users: usersWithProgress });
  } catch (error) {
    console.error('[ADMIN] Erro ao buscar progresso dos usuários:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar progresso dos usuários.'
    });
  }
});

// =============================================
// CATCH-ALL — Suporte a SPA
// =============================================

/**
 * Qualquer rota que não seja /api/* serve o index.html.
 * Isso permite que o roteamento do frontend (SPA) funcione corretamente.
 */
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'views', 'index.html');

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({
      success: false,
      message: 'Aplicação frontend não encontrada. Certifique-se de que a pasta "views" contém o index.html.'
    });
  }
});

// =============================================
// Error Handling Middleware
// =============================================
app.use((err, req, res, next) => {
  console.error('[EXPRESS ERROR]', err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: 'Multer Error: ' + err.message });
  }
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

// =============================================
// Inicialização do servidor
// =============================================

const server = app.listen(PORT, () => {
  console.log('='.repeat(55));
  console.log('  Manual do Associado — eAula Pós');
  console.log(`  Servidor rodando em: http://localhost:${PORT}`);
  console.log(`  Diretório de vídeos: ${VIDEO_DIR}`);
  console.log(`  Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(55));
});

// Disable timeout for large uploads
server.timeout = 0;
server.keepAliveTimeout = 0;
