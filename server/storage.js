// Armazenamento simples em arquivo JSON.
//
// Modelo (versão 2):
//   users:  conta de login (nome + senha) e a lista de mundos dos quais participa
//   worlds: cada mundo é um "save" compartilhável (como um mundo de Minecraft):
//           tem dono, membros convidados, casas e um treinador por conta.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX_WORLDS = 12;
const TRASH_DAYS = 7; // mundos excluídos ficam na lixeira por 7 dias
const BACKUP_EVERY = 30 * 60 * 1000; // cópia de segurança automática a cada 30 min (se mudou algo)
const BACKUPS_KEEP = 48;

export class Storage {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'db.json');
    fs.mkdirSync(dir, { recursive: true });
    this.db = { version: 2, users: {}, worlds: {} };
    if (fs.existsSync(this.file)) {
      try {
        this.db = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      } catch (e) {
        console.error('[db] arquivo corrompido, criando backup:', e.message);
        fs.copyFileSync(this.file, this.file + '.corrompido-' + Date.now());
        this.db = { version: 2, users: {}, worlds: {} };
      }
    }
    this.migrate();
    this.db.trash ||= {};
    this.purgeTrash();
    this.dirty = false;
    this.changedSinceBackup = true;
    this.timer = setInterval(() => this.flush(), 8000);
    this.backupTimer = setInterval(() => this.backup(), BACKUP_EVERY);
    this.backup();
  }

  // Cópias de segurança rotativas em data/backups (as mais antigas são apagadas)
  backup() {
    if (!this.changedSinceBackup || !fs.existsSync(this.file)) return;
    this.changedSinceBackup = false;
    try {
      const dir = path.join(this.dir, 'backups');
      fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
      fs.copyFileSync(this.file, path.join(dir, `db-${stamp}.json`));
      const files = fs.readdirSync(dir).filter((f) => f.startsWith('db-')).sort();
      for (const f of files.slice(0, Math.max(0, files.length - BACKUPS_KEEP))) fs.unlinkSync(path.join(dir, f));
    } catch (e) { console.error('[db] falha no backup:', e.message); }
  }

  purgeTrash() {
    const limit = Date.now() - TRASH_DAYS * 86400000;
    for (const [id, t] of Object.entries(this.db.trash)) if (t.deletedAt < limit) delete this.db.trash[id];
  }

  // Versão 1 tinha um único mundo compartilhado e um save por conta.
  migrate() {
    const db = this.db;
    db.users ||= {};
    db.worlds ||= {};
    if ((db.version || 1) >= 2) return;
    const backup = this.file.replace(/\.json$/, `.v1-backup-${Date.now()}.json`);
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, backup);
    const ownerWorld = {};
    for (const [key, u] of Object.entries(db.users)) {
      u.worlds = [];
      if (u.save) {
        const w = this.newWorldObject(key, `Mundo de ${u.name}`);
        w.players[key] = u.save;
        db.worlds[w.id] = w;
        u.worlds.push(w.id);
        ownerWorld[key] = w;
      }
      delete u.save;
    }
    for (const [plotId, h] of Object.entries(db.houses || {})) {
      const w = ownerWorld[h.owner];
      if (w) w.houses[plotId] = h;
    }
    delete db.houses;
    db.version = 2;
    this.dirty = true;
    this.flush();
    console.log(`[db] dados migrados para o formato de mundos (backup em ${path.basename(backup)})`);
  }

  markDirty() { this.dirty = true; this.changedSinceBackup = true; }

  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.db));
    fs.renameSync(tmp, this.file);
  }

  close() {
    clearInterval(this.timer);
    clearInterval(this.backupTimer);
    this.flush();
  }

  // ------------------------------------------------------------ contas
  static hashPassword(pass, salt) {
    return crypto.scryptSync(pass, salt, 32).toString('hex');
  }

  static key(name) { return String(name).toLowerCase(); }

  getUser(name) {
    return this.db.users[Storage.key(name)] || null;
  }

  createUser(name, pass) {
    const key = Storage.key(name);
    if (this.db.users[key]) return null;
    const salt = crypto.randomBytes(16).toString('hex');
    const user = {
      name, salt, hash: Storage.hashPassword(pass, salt), token: crypto.randomBytes(24).toString('hex'),
      created: Date.now(), worlds: [],
    };
    this.db.users[key] = user;
    this.markDirty();
    return user;
  }

  checkPassword(user, pass) {
    const h = Storage.hashPassword(pass, user.salt);
    return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(user.hash, 'hex'));
  }

  userByToken(token) {
    if (!token) return null;
    return Object.values(this.db.users).find((u) => u.token === token) || null;
  }

  newToken(user) {
    user.token = crypto.randomBytes(24).toString('hex');
    this.markDirty();
    return user.token;
  }

  // ------------------------------------------------------------ mundos
  newWorldObject(ownerKey, name) {
    return {
      id: crypto.randomBytes(5).toString('hex'), name, owner: ownerKey, created: Date.now(),
      invite: null, members: [ownerKey], houses: {}, players: {},
    };
  }

  createWorld(user, name, cheats = false) {
    const key = Storage.key(user.name);
    const owned = user.worlds.filter((id) => this.db.worlds[id] && this.db.worlds[id].owner === key);
    if (owned.length >= MAX_WORLDS) return null;
    const w = this.newWorldObject(key, name);
    w.cheats = !!cheats;
    this.db.worlds[w.id] = w;
    user.worlds.push(w.id);
    this.markDirty();
    return w;
  }

  // Excluir manda para a lixeira (dá para restaurar por 7 dias)
  deleteWorld(id) {
    const w = this.db.worlds[id];
    if (!w) return;
    for (const k of w.members) {
      const u = this.db.users[k];
      if (u) u.worlds = u.worlds.filter((x) => x !== id);
    }
    this.db.trash[id] = { world: w, deletedAt: Date.now() };
    delete this.db.worlds[id];
    this.purgeTrash();
    this.markDirty();
  }

  trashOf(ownerKey) {
    return Object.entries(this.db.trash).filter(([, t]) => t.world.owner === ownerKey)
      .map(([id, t]) => ({ id, name: t.world.name, deletedAt: t.deletedAt, members: t.world.members.length, players: Object.keys(t.world.players || {}).length }));
  }

  restoreWorld(id, ownerKey) {
    const t = this.db.trash[id];
    if (!t || t.world.owner !== ownerKey) return null;
    const w = t.world;
    this.db.worlds[id] = w;
    delete this.db.trash[id];
    for (const k of w.members) {
      const u = this.db.users[k];
      if (u && !u.worlds.includes(id)) u.worlds.push(id);
    }
    this.markDirty();
    return w;
  }

  newInvite(w) {
    // sem letras/números parecidos (0/O, 1/I)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do code = Array.from({ length: 6 }, () => chars[crypto.randomInt(chars.length)]).join('');
    while (Object.values(this.db.worlds).some((x) => x.invite === code));
    w.invite = code;
    this.markDirty();
    return code;
  }

  worldByInvite(code) {
    const c = String(code || '').trim().toUpperCase();
    if (!c) return null;
    return Object.values(this.db.worlds).find((w) => w.invite === c) || null;
  }

  addMember(w, user) {
    const key = Storage.key(user.name);
    if (!w.members.includes(key)) w.members.push(key);
    if (!user.worlds.includes(w.id)) user.worlds.push(w.id);
    this.markDirty();
  }

  removeMember(w, key) {
    w.members = w.members.filter((k) => k !== key);
    const u = this.db.users[key];
    if (u) u.worlds = u.worlds.filter((x) => x !== w.id);
    this.markDirty();
  }
}
