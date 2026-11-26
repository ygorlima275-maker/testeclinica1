const fs = require('fs');
const path = require('path');
const { supabase, isSupabaseConfigured } = require('../config/supabase');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_TABLES = [
  'users',
  'clinics',
  'animals',
  'collections',
  'appointments',
  'clinic_contacts'
];

function createEmptyState() {
  const tables = {};
  const sequences = {};
  for (const t of DEFAULT_TABLES) {
    tables[t] = [];
    sequences[t] = 1;
  }
  return { tables, sequences };
}

function loadDiskState() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.tables && parsed.sequences) {
        for (const t of DEFAULT_TABLES) {
          if (!Array.isArray(parsed.tables[t])) parsed.tables[t] = [];
          if (!Number.isFinite(parsed.sequences[t])) parsed.sequences[t] = 1;
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Store] Aviso ao ler arquivo local de dados:', err.message);
  }
  return createEmptyState();
}

const localState = loadDiskState();

function saveDiskState() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(localState, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Store] Aviso ao salvar arquivo local de dados:', err.message);
  }
}

function ensureLocalTable(table) {
  if (!Array.isArray(localState.tables[table])) {
    localState.tables[table] = [];
  }
  if (!Number.isFinite(localState.sequences[table])) {
    const maxId = localState.tables[table].reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
    localState.sequences[table] = maxId + 1;
  }
}

let lastStorageMode = isSupabaseConfigured() ? 'supabase' : 'local-json';

function isMissingTableError(error) {
  if (!error) return false;
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    (typeof error.message === 'string' && error.message.includes('Could not find the table'))
  );
}

function getStorageMode() {
  return lastStorageMode;
}

async function list(table, { orderBy = 'id', ascending = true } = {}) {
  if (supabase) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending });

    if (!error) {
      lastStorageMode = 'supabase';
      return data || [];
    }
    if (!isMissingTableError(error)) {
      throw new Error(`Erro ao consultar ${table}: ${error.message}`);
    }
  }

  lastStorageMode = 'local-json';
  ensureLocalTable(table);
  const rows = [...localState.tables[table]];
  rows.sort((a, b) => {
    const av = a[orderBy] ?? 0;
    const bv = b[orderBy] ?? 0;
    if (av < bv) return ascending ? -1 : 1;
    if (av > bv) return ascending ? 1 : -1;
    return 0;
  });
  return rows;
}

async function getById(table, id) {
  const numId = Number(id);
  if (!Number.isFinite(numId)) return null;

  if (supabase) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', numId)
      .maybeSingle();

    if (!error) {
      lastStorageMode = 'supabase';
      return data || null;
    }
    if (!isMissingTableError(error)) {
      throw new Error(`Erro ao buscar ${table}#${numId}: ${error.message}`);
    }
  }

  lastStorageMode = 'local-json';
  ensureLocalTable(table);
  return localState.tables[table].find((item) => item.id === numId) || null;
}

async function findByField(table, field, value) {
  if (supabase) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq(field, value)
      .maybeSingle();

    if (!error) {
      lastStorageMode = 'supabase';
      return data || null;
    }
    if (!isMissingTableError(error)) {
      throw new Error(`Erro ao consultar ${table}.${field}: ${error.message}`);
    }
  }

  lastStorageMode = 'local-json';
  ensureLocalTable(table);
  return (
    localState.tables[table].find(
      (item) => String(item[field] || '').toLowerCase() === String(value || '').toLowerCase()
    ) || null
  );
}

async function insert(table, payload) {
  if (supabase) {
    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select()
      .single();

    if (!error) {
      lastStorageMode = 'supabase';
      return data;
    }
    if (!isMissingTableError(error)) {
      const err = new Error(error.message);
      err.code = error.code;
      throw err;
    }
  }

  lastStorageMode = 'local-json';
  ensureLocalTable(table);
  const row = {
    id: localState.sequences[table]++,
    ...payload,
    created_at: new Date().toISOString()
  };
  localState.tables[table].push(row);
  saveDiskState();
  return row;
}

async function update(table, id, payload) {
  const numId = Number(id);
  if (!Number.isFinite(numId)) return null;

  if (supabase) {
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', numId)
      .select()
      .maybeSingle();

    if (!error) {
      lastStorageMode = 'supabase';
      return data || null;
    }
    if (!isMissingTableError(error)) {
      const err = new Error(error.message);
      err.code = error.code;
      throw err;
    }
  }

  lastStorageMode = 'local-json';
  ensureLocalTable(table);
  const rows = localState.tables[table];
  const idx = rows.findIndex((item) => item.id === numId);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...payload, updated_at: new Date().toISOString() };
  saveDiskState();
  return rows[idx];
}

async function remove(table, id) {
  const numId = Number(id);
  if (!Number.isFinite(numId)) return false;

  if (supabase) {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq('id', numId)
      .select('id');

    if (!error) {
      lastStorageMode = 'supabase';
      return Array.isArray(data) && data.length > 0;
    }
    if (!isMissingTableError(error)) {
      throw new Error(`Erro ao remover ${table}#${numId}: ${error.message}`);
    }
  }

  lastStorageMode = 'local-json';
  ensureLocalTable(table);
  const rows = localState.tables[table];
  const before = rows.length;
  localState.tables[table] = rows.filter((item) => item.id !== numId);
  const deleted = localState.tables[table].length < before;
  if (deleted) saveDiskState();
  return deleted;
}

module.exports = {
  list,
  getById,
  findByField,
  insert,
  update,
  remove,
  getStorageMode
};
