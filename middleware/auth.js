/**
 * middleware/auth.js
 * Middlewares de autenticação e autorização para o Manual do Associado.
 * Protege rotas que exigem login e/ou permissão de administrador.
 */

/**
 * Middleware que exige autenticação.
 * Verifica se o usuário possui uma sessão ativa (req.session.userId).
 * Retorna 401 caso o usuário não esteja autenticado.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Não autorizado. Faça login para continuar.'
    });
  }
  next();
}

/**
 * Middleware que exige permissão de administrador.
 * Verifica primeiro se o usuário está autenticado e depois se possui role 'admin'.
 * Retorna 401 se não autenticado ou 403 se não for administrador.
 */
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Não autorizado. Faça login para continuar.'
    });
  }

  if (req.session.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Permissão de administrador necessária.'
    });
  }

  next();
}

module.exports = { requireAuth, requireAdmin };
