const express = require('express');
const store = require('../services/store');
const {
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth
} = require('../middleware/auth');

const router = express.Router();
const INSTITUTIONAL_DOMAIN = '@sempreuninassau.com.br';

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    clinicId: user.clinic_id || null
  };
}

// POST /api/auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role,
      cnpj,
      crmv,
      phone,
      address
    } = req.body || {};

    const cleanRole = String(role || '').trim();
    if (!['tutor', 'admin', 'clinic'].includes(cleanRole)) {
      return res.status(400).json({ error: 'Perfil inválido. Escolha tutor, clinic ou admin.' });
    }

    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');

    if (!cleanName || !cleanEmail || cleanPassword.length < 4) {
      return res.status(400).json({
        error: 'Nome, e-mail e senha (mínimo 4 caracteres) são obrigatórios.'
      });
    }

    if (cleanRole === 'admin' && !cleanEmail.endsWith(INSTITUTIONAL_DOMAIN)) {
      return res.status(400).json({
        error: `Cadastro institucional exige e-mail ${INSTITUTIONAL_DOMAIN}.`
      });
    }

    const existingUser = await store.findByField('users', 'email', cleanEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'Já existe uma conta cadastrada com este e-mail.' });
    }

    let createdClinic = null;
    if (cleanRole === 'clinic') {
      const existingClinic = await store.findByField('clinics', 'email', cleanEmail);
      if (existingClinic) {
        createdClinic = existingClinic;
      } else {
        createdClinic = await store.insert('clinics', {
          name: cleanName,
          cnpj: String(cnpj || '').trim() || null,
          crmv: String(crmv || '').trim() || null,
          email: cleanEmail,
          phone: String(phone || '').trim() || null,
          address: String(address || '').trim() || null,
          status: 'Parceiro Credenciado'
        });
      }
    }

    const createdUser = await store.insert('users', {
      name: cleanName,
      email: cleanEmail,
      password_hash: hashPassword(cleanPassword),
      role: cleanRole,
      clinic_id: createdClinic ? createdClinic.id : null
    });

    const userDto = sanitizeUser(createdUser);
    const token = signToken(userDto);

    return res.status(201).json({
      user: userDto,
      clinic: createdClinic,
      token
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, role } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');
    const cleanRole = String(role || '').trim();

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const user = await store.findByField('users', 'email', cleanEmail);
    if (!user || !verifyPassword(cleanPassword, user.password_hash)) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    if (cleanRole && user.role !== cleanRole) {
      return res.status(403).json({
        error: `Esta conta pertence ao perfil "${user.role}", não "${cleanRole}".`
      });
    }

    if (user.role === 'admin' && !cleanEmail.endsWith(INSTITUTIONAL_DOMAIN)) {
      return res.status(403).json({
        error: `Para acessar como Coordenação / Médico Veterinário, utilize um e-mail institucional ${INSTITUTIONAL_DOMAIN}.`
      });
    }

    const userDto = sanitizeUser(user);
    const token = signToken(userDto);

    return res.json({
      user: userDto,
      token
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
