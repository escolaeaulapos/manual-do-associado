/**
 * database.js
 * Módulo de banco de dados para o Manual do Associado.
 * Utiliza SQLite via better-sqlite3 para persistência local.
 * Cria tabelas, insere dados iniciais (seed) e exporta a instância do banco.
 */

const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

/**
 * Inicializa o banco de dados SQLite.
 * - Cria o diretório 'data' caso não exista.
 * - Cria as tabelas necessárias caso não existam.
 * - Popula com dados iniciais (admin, usuário demo, módulos) se estiverem vazias.
 * @returns {DatabaseSync} Instância do banco de dados node:sqlite
 */
function initDatabase() {
  // Garante que o diretório de dados exista
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('[DB] Diretório de dados criado:', dataDir);
  }

  const dbPath = path.join(dataDir, 'database.sqlite');
  const db = new DatabaseSync(dbPath);

  // Ativa WAL mode para melhor performance em leituras concorrentes
  db.exec('PRAGMA journal_mode = WAL;');
  // Ativa chaves estrangeiras
  db.exec('PRAGMA foreign_keys = ON;');

  console.log('[DB] Conectado ao banco de dados:', dbPath);

  // =============================================
  // Criação das tabelas
  // =============================================

  // Tabela de usuários
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de módulos de treinamento
  db.exec(`
    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      video_filename TEXT,
      video_url TEXT,
      order_index INTEGER,
      duration_label TEXT,
      is_full_training INTEGER DEFAULT 0
    )
  `);

  // Tabela de progresso do usuário por módulo
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_progress (
      user_id INTEGER NOT NULL,
      module_id INTEGER NOT NULL,
      completed INTEGER DEFAULT 0,
      completed_at DATETIME,
      PRIMARY KEY(user_id, module_id)
    )
  `);

  // Tabela de logs de acesso (auditoria)
  db.exec(`
    CREATE TABLE IF NOT EXISTS access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT,
      module_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('[DB] Tabelas verificadas/criadas com sucesso.');

  // =============================================
  // Dados iniciais (Seed)
  // =============================================

  // Verifica se já existem usuários cadastrados
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();

  if (userCount.count === 0) {
    console.log('[DB] Inserindo dados iniciais de usuários...');

    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)
    `);

    // Administrador padrão
    const adminHash = bcrypt.hashSync('admin123', 10);
    insertUser.run('Administrador', 'admin@eaula.com.br', adminHash, 'admin');

    // Usuário demo (associado)
    const demoHash = bcrypt.hashSync('123456', 10);
    insertUser.run('Associado Demo', 'associado@eaula.com.br', demoHash, 'user');

    console.log('[DB] Usuários iniciais criados: admin@eaula.com.br / associado@eaula.com.br');
  }

  // Verifica se já existem módulos cadastrados
  const moduleCount = db.prepare('SELECT COUNT(*) as count FROM modules').get();

  if (moduleCount.count === 0) {
    console.log('[DB] Inserindo dados iniciais de módulos...');

    const insertModule = db.prepare(`
      INSERT INTO modules (title, description, video_filename, order_index, duration_label, is_full_training)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Módulo 1 — Treinamento Completo (vídeo integral)
    insertModule.run(
      'Treinamento Completo',
      'Assista todo o treinamento de uma vez. Conteúdo completo para novos associados da eAula Pós.',
      'MANUAL DO ASSOCIADO - EAULA - COMPLETO.mp4',
      1,
      '30 min',
      1
    );

    // Módulo 2 — Introdução, Login e Página Inicial
    insertModule.run(
      'Introdução, Login e Página Inicial',
      'Aprenda os primeiros passos: como acessar a plataforma, fazer login e navegar pela página inicial.',
      'AULA 1 - INTRODUÇÃO-LOGUIN-PAGINA INICIAL.mp4',
      2,
      '10 min',
      0
    );

    // Módulo 3 — Área do Aluno
    insertModule.run(
      'Área do Aluno',
      'Conheça a área do aluno: funcionalidades, recursos disponíveis e como aproveitar ao máximo a plataforma.',
      'AULA 2 - ÁREA DO ALUNO.mp4',
      3,
      '12 min',
      0
    );

    // Módulo 4 — Em breve
    insertModule.run(
      'Módulo 3 - Em breve',
      'Conteúdo em preparação. Em breve estará disponível.',
      null,
      4,
      '—',
      0
    );

    // Módulo 5 — Em breve
    insertModule.run(
      'Módulo 4 - Em breve',
      'Conteúdo em preparação. Em breve estará disponível.',
      null,
      5,
      '—',
      0
    );

    // Módulo 6 — Perguntas Frequentes
    insertModule.run(
      'Perguntas Frequentes',
      'Respostas para as dúvidas mais comuns dos novos associados.',
      null,
      6,
      '—',
      0
    );

    console.log('[DB] Módulos iniciais criados com sucesso.');
  }

  return db;
}

module.exports = { initDatabase };
