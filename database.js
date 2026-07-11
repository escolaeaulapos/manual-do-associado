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
      INSERT INTO modules (title, description, video_url, order_index, duration_label, is_full_training)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const vimeoUrl = 'https://vimeo.com/1209072794?share=copy&fl=sv&fe=ci';

    insertModule.run('Introdução e Login', '0:00 - Introdução, Login e Pagina Inicial', vimeoUrl, 1, '10 min', 0);
    insertModule.run('Painel do Aluno', '2:08 - Como usar o Painel do Aluno', vimeoUrl + '#t=2m8s', 2, '5 min', 0);
    insertModule.run('Nova Matrícula', '07:39 - Como realizar uma nova matrícula', vimeoUrl + '#t=7m39s', 3, '5 min', 0);
    insertModule.run('Menu Acessos', '13:21 - Menu Acessos', vimeoUrl + '#t=13m21s', 4, '5 min', 0);
    insertModule.run('Cursos em Andamento', '16:12 - Menu em curso', vimeoUrl + '#t=16m12s', 5, '5 min', 0);
    insertModule.run('Menu Lateral e Financeiro', '24:09 - Menu Lateral e Financeiro', vimeoUrl + '#t=24m9s', 6, '5 min', 0);
    
    insertModule.run('Treinamento Completo', '0:00 - Introdução, Login e Pagina Inicial\n2:08 - Como usar o Painel do Aluno\n07:39 - Como realizar uma nova matrícula\n13:21 - Menu Acessos\n16:12 - Menu em curso\n24:09 - Menu Lateral e Financeiro', vimeoUrl, 7, '30 min', 1);

    console.log('[DB] Módulos iniciais criados com sucesso.');
  }

  return db;
}

module.exports = { initDatabase };
