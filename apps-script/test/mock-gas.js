'use strict';
// In-memory stand-ins for the Google services used by the .gs files.
// Purpose: run the REAL Apps Script code locally. Not part of the deployment.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function createMocks(opts = {}) {
  const registry = { spreadsheets: {}, files: {}, folders: {} };
  const props = {};
  const state = { activeEmail: opts.activeEmail || '', mails: [], triggers: [], clock: 1700000000000, locked: false };
  const nextTime = () => new Date((state.clock += 1000));

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const NUM_RE = /^-?\d+(\.\d+)?$/;

  class Range {
    constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
    getSheet() { return this.sheet; }
    getA1Notation() { return 'R' + this.r + 'C' + this.c; }
    getValues() {
      const out = [];
      for (let i = 0; i < this.nr; i++) {
        const row = [];
        for (let j = 0; j < this.nc; j++) {
          const v = (this.sheet.data[this.r - 1 + i] || [])[this.c - 1 + j];
          row.push(v === undefined ? '' : v);
        }
        out.push(row);
      }
      return out;
    }
    getValue() { return this.getValues()[0][0]; }
    setValues(vals) {
      if (this.r + this.nr - 1 > this.sheet.maxRows) throw new Error('The coordinates of the target range are outside the dimensions of the sheet.');
      if (vals.length !== this.nr || (vals[0] || []).length !== this.nc) throw new Error('The number of rows/columns in the data does not match the range.');
      for (let i = 0; i < this.nr; i++) {
        const rowIdx = this.r - 1 + i;
        this.sheet.data[rowIdx] = this.sheet.data[rowIdx] || [];
        for (let j = 0; j < this.nc; j++) {
          let v = vals[i][j];
          const fmt = this.sheet.fmt[this.c + j] || 'General';
          // Mimic Google Sheets auto-conversion when the column is not plain text.
          if (typeof v === 'string' && fmt !== '@') {
            if (DATE_RE.test(v)) { const [y, m, d] = v.split('-').map(Number); v = new Date(Date.UTC(y, m - 1, d, -7)); }
            else if (NUM_RE.test(v)) v = Number(v);
          }
          this.sheet.data[rowIdx][this.c - 1 + j] = v;
        }
      }
      return this;
    }
    setValue(v) { return this.setValues([[v]]); }
    setNumberFormat(f) { for (let j = 0; j < this.nc; j++) this.sheet.fmt[this.c + j] = f; return this; }
    setFontWeight() { return this; }
    clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) { const row = this.sheet.data[this.r - 1 + i]; if (row) row[this.c - 1 + j] = ''; } return this; }
  }

  class Sheet {
    constructor(ss, name) { Object.assign(this, { ss, name, data: [], maxRows: 1000, fmt: {} }); }
    getName() { return this.name; }
    getMaxRows() { return this.maxRows; }
    insertRowsAfter(pos, n) { this.maxRows += n; }
    setFrozenRows() {}
    protect() { const p = { setWarningOnly() { return p; }, setDescription() { return p; } }; return p; }
    getLastRow() {
      for (let i = this.data.length - 1; i >= 0; i--) {
        if ((this.data[i] || []).some((v) => v !== '' && v !== undefined && v !== null)) return i + 1;
      }
      return 0;
    }
    getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
  }

  class Spreadsheet {
    constructor(name) { this.id = 'ss_' + crypto.randomBytes(6).toString('hex'); this.name = name; this.sheets = [new Sheet(this, 'Sheet1')]; }
    getId() { return this.id; }
    getName() { return this.name; }
    getSheets() { return this.sheets.slice(); }
    getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
    insertSheet(n) { const s = new Sheet(this, n); this.sheets.push(s); return s; }
    deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
    _clone(name) {
      const c = new Spreadsheet(name);
      c.sheets = this.sheets.map((s) => { const n = new Sheet(c, s.name); n.data = JSON.parse(JSON.stringify(s.data)); n.maxRows = s.maxRows; n.fmt = { ...s.fmt }; return n; });
      return c;
    }
  }

  class DriveFile {
    constructor(name, parent, kind, ref) { this.id = kind === 'sheet' ? ref : 'f_' + crypto.randomBytes(6).toString('hex'); this.name = name; this.parent = parent; this.kind = kind; this.ref = ref; this.trashed = false; this.created = nextTime(); registry.files[this.id] = this; }
    getId() { return this.id; }
    getName() { return this.name; }
    getDateCreated() { return this.created; }
    setTrashed(t) { this.trashed = t; return this; }
    makeCopy(name, folder) {
      const src = registry.spreadsheets[this.ref];
      const copy = src._clone(name);
      registry.spreadsheets[copy.id] = copy;
      return new DriveFile(name, folder || this.parent, 'sheet', copy.id); // file id == spreadsheet id, as in Google Drive
    }
  }
  class Folder {
    constructor(name, parent) { this.id = 'd_' + crypto.randomBytes(6).toString('hex'); this.name = name; this.parent = parent; this.children = []; this.trashed = false; registry.folders[this.id] = this; if (parent) parent.children.push(this); }
    getId() { return this.id; }
    getFoldersByName(n) { const l = this.children.filter((c) => c instanceof Folder && c.name === n && !c.trashed); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; }
    createFolder(n) { return new Folder(n, this); }
    getFiles() { const l = Object.values(registry.files).filter((f) => f.parent === this && !f.trashed); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; }
    createFile(blob) { return new DriveFile(blob.name, this, 'blob', null); }
    setTrashed(t) { this.trashed = t; return this; }
  }
  const rootFolder = new Folder('My Drive', null);

  const SpreadsheetApp = {
    create(name) {
      const ss = new Spreadsheet(name);
      registry.spreadsheets[ss.id] = ss;
      new DriveFile(name, rootFolder, 'sheet', ss.id);
      return ss;
    },
    openById(id) { const s = registry.spreadsheets[id]; if (!s) throw new Error('No spreadsheet with id ' + id); return s; }
  };

  const DriveApp = {
    getFileById(id) { const f = registry.files[id]; if (!f) throw new Error('No file ' + id); return f; },
    getFoldersByName(n) { return rootFolder.getFoldersByName(n); },
    createFolder(n) { return rootFolder.createFolder(n); }
  };

  const pad = (n, w = 2) => String(n).padStart(w, '0');
  function formatDate(date, tz, fmt) {
    const d = new Date(date.getTime() + 7 * 3600000); // Asia/Ho_Chi_Minh, no DST
    const map = { yyyy: d.getUTCFullYear(), MM: pad(d.getUTCMonth() + 1), dd: pad(d.getUTCDate()), HH: pad(d.getUTCHours()), mm: pad(d.getUTCMinutes()), ss: pad(d.getUTCSeconds()), XXX: '+07:00' };
    return fmt.replace(/'T'/g, 'T').replace(/yyyy|MM|dd|HH|mm|ss|XXX/g, (k) => map[k]);
  }

  const Utilities = {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    computeDigest(alg, str) { return Array.from(crypto.createHash('sha256').update(str, 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)); },
    formatDate,
    getUuid() { return crypto.randomUUID(); },
    sleep() {}
  };

  const triggerBuilder = (handler) => {
    const t = { handler, kind: 'time' };
    const chain = new Proxy({}, { get: (_, p) => (p === 'create' ? () => { state.triggers.push(t); return t; } : p === 'forSpreadsheet' ? () => { t.kind = 'sheet'; return chain; } : () => chain) });
    return chain;
  };

  const mocks = {
    console, Date, Math, JSON, Number, String, Object, Array, RegExp, Error, isFinite, isNaN, parseInt, parseFloat,
    SpreadsheetApp, DriveApp, Utilities,
    LockService: { getScriptLock() { return { waitLock() { if (state.locked) throw new Error('lock busy'); state.locked = true; }, releaseLock() { state.locked = false; } }; } },
    Session: { getActiveUser() { return { getEmail: () => state.activeEmail }; }, getEffectiveUser() { return { getEmail: () => 'owner@test.local' }; } },
    PropertiesService: { getScriptProperties() { return { getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }; } },
    MailApp: { sendEmail(o) { state.mails.push(o); } },
    Logger: { log() {} },
    UrlFetchApp: {
      fetch() {
        const bytes = [80, 75, ...Array.from({ length: 2000 }, (_, i) => i % 200)];
        return { getResponseCode: () => 200, getContent: () => bytes, getBlob: () => ({ name: '', setName(n) { this.name = n; return this; } }) };
      }
    },
    ScriptApp: {
      WeekDay: { SUNDAY: 'SUNDAY' },
      getOAuthToken: () => 'token',
      newTrigger: (h) => triggerBuilder(h),
      getProjectTriggers: () => state.triggers.map((t) => ({ getHandlerFunction: () => t.handler, _t: t })),
      deleteTrigger: (tr) => { state.triggers = state.triggers.filter((t) => t !== tr._t); }
    },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
      createHtmlOutput: (html) => { const o = { html, setTitle() { return o; }, addMetaTag() { return o; }, setXFrameOptionsMode() { return o; } }; return o; },
      createHtmlOutputFromFile: (n) => { const o = { html: fs.readFileSync(path.join(__dirname, '..', n + '.html'), 'utf8'), setTitle() { return o; }, addMetaTag() { return o; }, setXFrameOptionsMode() { return o; } }; return o; }
    }
  };
  return { mocks, registry, props, state, SpreadsheetApp };
}

// Load every .gs file (in dependency-agnostic order) into one shared global context.
function loadApp(opts = {}) {
  const vm = require('vm');
  const m = createMocks(opts);
  const ctx = vm.createContext({ ...m.mocks });
  const dir = path.join(__dirname, '..');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.gs')).sort((a, b) => (a === 'Core.gs' ? -1 : b === 'Core.gs' ? 1 : a.localeCompare(b)));
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  return { ctx, run: (code) => vm.runInContext(code, ctx), ...m };
}

module.exports = { createMocks, loadApp };
