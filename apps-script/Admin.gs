// Admin.gs - setup/seed, triggers, daily integrity scan, reminders, backups, manual-edit audit.
var FF_V = FF_V || {};
FF_V.Admin = '0.3.0';

var FF_SEED_JARS = ['Thiết yếu', 'Ăn uống ngoài', 'Xe và di chuyển', 'Gia đình và con', 'Cá nhân và vui chơi', 'Cho đi và xã hội'];

// Provisional category -> jar mapping taken from REQUIREMENTS_SPECIFICATION section 4 (editable in the app).
var FF_SEED_CATEGORIES = [
  ['Đi chợ', 1], ['Siêu thị', 1], ['Hoá đơn điện', 1], ['Internet', 1], ['Thuốc', 1], ['Khám bệnh', 1], ['Phí chung cư', 1], ['Đồ dùng gia đình', 1], ['Thuê nhà', 1], ['Gas', 1],
  ['Ăn ngoài', 2], ['Cà phê', 2], ['Trà sữa', 2],
  ['Xăng dầu', 3], ['Gửi xe', 3], ['Grab', 3], ['Di chuyển', 3], ['Xe máy', 3], ['Sửa chữa nhà', 3], ['Chi phí vận hành ô tô', 3],
  ['Cheppy', 4], ['Khám thai', 4], ['Trang phục', 4], ['Giáo dục', 4],
  ['Du lịch', 5], ['Làm đẹp', 5], ['Mỹ phẩm', 5], ['Giải trí', 5], ['Thể thao', 5], ['Điện thoại', 5], ['Netflix', 5],
  ['Lì xì', 6], ['Đi đám', 6], ['Đồ cúng', 6], ['Từ thiện', 6], ['Cưới hỏi', 6], ['Bạn bè', 6], ['BIH', 6], ['EIU', 6]
];
var FF_SEED_INCOME = ['Lương', 'Thưởng', 'Đầu tư', 'Lãi tiết kiệm', 'Thu khác'];

// Wallet list from the approved specification (section 3). Opening balances are entered later by the user.
var FF_SEED_WALLETS = [
  ['Ví - Cục Thịt', 'cash', '', 'M01', 'active'],
  ['Ví - Cục Cá', 'cash', '', 'M02', 'active'],
  ['BIDV - Cục Cá', 'bank', 'BIDV', 'M02', 'active'],
  ['BIDV - Cục Thịt', 'bank', 'BIDV', 'M01', 'active'],
  ['Vietinbank - Cục Thịt', 'bank', 'Vietinbank', 'M01', 'active'],
  ['Vietinbank - Cục Cá', 'bank', 'Vietinbank', 'M02', 'active'],
  ['HSBC', 'bank', 'HSBC', 'M01', 'active'],
  ['Beo', 'held_in_trust', '', 'M01', 'closed']
];

// ---------- Phase 0 helpers (run from the Apps Script editor) ----------
function whoAmI() {
  var e = '';
  try { e = Session.getActiveUser().getEmail(); } catch (x) { e = 'ERROR: ' + x.message; }
  Logger.log('Active user: ' + (e || '(blank)'));
  return e;
}

function helloFamilyFinance() {
  var ss = getSs_();
  var msg = 'OK. File: "' + ss.getName() + '". Versions: ' + JSON.stringify(FF_V);
  Logger.log(msg);
  return msg;
}

// ---------- Setup ----------
function setupSpreadsheet() {
  requireMember_({ allowEmpty: true });
  return withLock_(function () { return setupCore_(getSs_()); });
}

// Creates missing sheets/headers and seeds empty config sheets. Never deletes or overwrites data.
function setupCore_(ss) {
  var report = { created: [], seeded: [] };
  Object.keys(FF_SCHEMA).forEach(function (name) {
    var def = schemaOf_(name);
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      report.created.push(name);
      sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols]);
      sh.getRange(1, 1, 1, def.cols.length).setFontWeight('bold');
      sh.setFrozenRows(1);
      // One call per run of same-typed columns (fewer calls = faster in Apps Script).
      var runStart = 0;
      for (var ci = 1; ci <= def.cols.length; ci++) {
        if (ci === def.cols.length || def.types[ci] !== def.types[runStart]) {
          sh.getRange(1, runStart + 1, sh.getMaxRows(), ci - runStart).setNumberFormat(def.types[runStart] === 'n' ? '0' : '@');
          runStart = ci;
        }
      }
      if (FF_LEDGER_SHEETS.indexOf(name) >= 0) {
        try { sh.protect().setWarningOnly(true).setDescription('Chỉ ghi qua ứng dụng. Sửa tay sẽ bị ghi nhật ký.'); } catch (e) { /* protection is best effort */ }
      }
    } else {
      var head = sh.getRange(1, 1, 1, def.cols.length).getValues()[0];
      for (var i = 0; i < def.cols.length; i++) {
        if (head[i] !== def.cols[i]) throw ffErr_('SETUP', 'Sheet "' + name + '" có tiêu đề cột khác cấu trúc mong đợi ở cột ' + (i + 1) + '.');
      }
    }
  });
  var junk = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (junk && ss.getSheets().length > 1 && junk.getLastRow() === 0) { try { ss.deleteSheet(junk); } catch (e) { /* ignore */ } }
  FF_CTX.cache = {};

  function empty(name) { return readAll_(name).length === 0; }
  if (empty('Members')) {
    appendRows_('Members', [
      { member_id: 'M01', display_name: 'Cục Thịt', email: '', active: 1 },
      { member_id: 'M02', display_name: 'Cục Cá', email: '', active: 1 }
    ]);
    report.seeded.push('Members');
  }
  if (empty('Jars')) {
    appendRows_('Jars', FF_SEED_JARS.map(function (n, i) { return { jar_id: 'J' + (i + 1), name: n, sort_order: i + 1, active: 1 }; }));
    report.seeded.push('Jars');
  }
  if (empty('Categories')) {
    var cats = [];
    FF_SEED_CATEGORIES.forEach(function (c, i) { cats.push({ category_id: 'C' + pad3_(cats.length + 1), name: c[0], kind: 'expense', jar_id: 'J' + c[1], active: 1 }); });
    FF_SEED_INCOME.forEach(function (n) { cats.push({ category_id: 'C' + pad3_(cats.length + 1), name: n, kind: 'income', jar_id: '', active: 1 }); });
    appendRows_('Categories', cats);
    report.seeded.push('Categories');
  }
  if (empty('Wallets')) {
    var cutoff = FF_DEFAULT_SETTINGS.cutoff_date;
    appendRows_('Wallets', FF_SEED_WALLETS.map(function (w, i) {
      return { wallet_id: 'W' + pad3_(i + 1), name: w[0], wallet_type: w[1], bank_name: w[2], owner_member_id: w[3], holder_name: w[1] === 'held_in_trust' ? 'Chưa ghi tên người gửi' : '', opening_balance: 0, opening_date: cutoff, status: w[4] };
    }));
    report.seeded.push('Wallets');
  }
  if (empty('Settings')) {
    appendRows_('Settings', Object.keys(FF_DEFAULT_SETTINGS).map(function (k) { return { key: k, value: FF_DEFAULT_SETTINGS[k] }; }));
    report.seeded.push('Settings');
  }
  audit_('setup', '', report);
  return report;
}

function pad3_(n) { var s = String(n); while (s.length < 3) s = '0' + s; return s; }

// Reports what is still missing before the app can be used.
function checkSetup() {
  requireMember_({ allowEmpty: true });
  var problems = [];
  Object.keys(FF_SCHEMA).forEach(function (n) { if (!getSs_().getSheetByName(n)) problems.push('Thiếu sheet ' + n); });
  if (!problems.length) {
    var ms = readAll_('Members');
    ms.forEach(function (m) { if (!m.email) problems.push('Chưa nhập email cho ' + m.display_name + ' (sheet Members, cột email).'); });
    if (getSetting_('env') !== 'DATA') problems.push('Settings.env không phải DATA.');
    var scan = integrityScan_();
    if (!scan.ok) problems.push('Kiểm tra toàn vẹn phát hiện ' + scan.issues.length + ' vấn đề.');
  }
  var out = problems.length ? problems.join('\n') : 'Mọi thứ đã sẵn sàng.';
  Logger.log(out);
  return out;
}

// ---------- Triggers ----------
function installTriggers() {
  requireMember_();
  var names = ['dailyJob', 'weeklyBackup', 'monthlyExport', 'onEditAudit'];
  ScriptApp.getProjectTriggers().forEach(function (t) { if (names.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyJob').timeBased().everyDays(1).atHour(6).inTimezone(FF_TZ).create();
  ScriptApp.newTrigger('weeklyBackup').timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(2).inTimezone(FF_TZ).create();
  ScriptApp.newTrigger('monthlyExport').timeBased().onMonthDay(1).atHour(3).inTimezone(FF_TZ).create();
  ScriptApp.newTrigger('onEditAudit').forSpreadsheet(getSs_()).onEdit().create();
  var msg = 'Đã cài 4 trigger: dailyJob, weeklyBackup, monthlyExport, onEditAudit.';
  Logger.log(msg);
  return msg;
}

// ---------- Notifications (dedupe + delivery status + retry) ----------
function memberEmails_() {
  return readAll_('Members').filter(function (m) { return m.active === 1 && m.email; }).map(function (m) { return m.email; });
}

// Sends one mail per recipient at most once per key. Failed sends are retried (max 3 attempts).
// A soft daily cap keeps us below the consumer MailApp quota.
function notify_(key, subject, body) {
  var sentToday = 0, today = todayYmd_();
  var rows = readAll_('Notifications');
  rows.forEach(function (r) { if (r.status === 'sent' && r.created_at.slice(0, 10) === today) sentToday++; });
  var result = { sent: 0, skipped: 0, failed: 0 };
  memberEmails_().forEach(function (email) {
    var k = key + '|' + email;
    var ex = rows.filter(function (r) { return r.key === k; })[0];
    if (ex && (ex.status === 'sent' || ex.attempts >= 3)) { result.skipped++; return; }
    if (sentToday >= 80) { result.skipped++; return; }
    try {
      sendMail_(email, subject, body);
      sentToday++; result.sent++;
      if (ex) updateRow_('Notifications', ex._row, { status: 'sent', attempts: (ex.attempts || 0) + 1, last_error: '' });
      else appendRows_('Notifications', [{ key: k, created_at: nowIso_(), to: email, subject: subject, status: 'sent', attempts: 1, last_error: '' }]);
    } catch (e) {
      result.failed++;
      var err = String(e && e.message || e).slice(0, 200);
      if (ex) updateRow_('Notifications', ex._row, { status: 'failed', attempts: (ex.attempts || 0) + 1, last_error: err });
      else appendRows_('Notifications', [{ key: k, created_at: nowIso_(), to: email, subject: subject, status: 'failed', attempts: 1, last_error: err }]);
    }
  });
  return result;
}

// ---------- Daily job ----------
function dailyJob() {
  try {
    FF_CTX.cache = {};
    var scan = integrityJob_();
    var rem = remindersJob_(todayYmd_());
    return { integrity: scan.ok, reminders: rem };
  } catch (e) {
    try { audit_('error:dailyJob', '', String(e && e.message || e)); } catch (x) { /* ignore */ }
    throw e;
  }
}

function runIntegrityCheck() {
  requireMember_();
  var r = integrityJob_();
  Logger.log(JSON.stringify(r));
  return r;
}

function integrityJob_() {
  var scan = integrityScan_();
  setSetting_('last_integrity', nowIso_() + (scan.ok ? ' OK' : ' LỖI ' + scan.issues.length));
  if (!scan.ok) {
    var sig = sha256Hex_(JSON.stringify(scan.issues)).slice(0, 16);
    var body = 'Kiểm tra toàn vẹn dữ liệu phát hiện ' + scan.issues.length + ' vấn đề:\n\n' +
      scan.issues.slice(0, 20).map(function (i) { return '- [' + i.code + '] ' + i.ref + ': ' + i.msg; }).join('\n') +
      '\n\nHãy KHÔNG sửa thêm trên file. Mở Sheets, xem Tệp > Lịch sử phiên bản để khôi phục nếu cần.';
    notify_('integrity:' + sig, '[Family Finance] Cảnh báo toàn vẹn dữ liệu', body);
    audit_('integrity:fail', sig, { count: scan.issues.length, first: scan.issues[0] });
  }
  return scan;
}

// ---------- Reminders ----------
function pad2_(n) { return (n < 10 ? '0' : '') + n; }

function addDays_(ymd, delta) {
  var d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10) + delta));
  return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate());
}

function daysBetween_(a, b) {
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
}

function remindersJob_(today) {
  var period = periodOf_(today), sent = 0;
  var st = buildState_();
  // recurring bills and loan instalments
  readAll_('Reminders').forEach(function (r) {
    if (r.active !== 1) return;
    var due = period + '-' + pad2_(r.day_of_month);
    var start = addDays_(due, -r.days_before);
    if (today >= start && today <= due) {
      sent += notify_('rem:' + r.reminder_id + ':' + period + ':upcoming', '[Family Finance] Sắp đến hạn: ' + r.title,
        r.title + ' đến hạn vào ngày ' + due + '.').sent;
    }
    if (r.type === 'loan_payment' && today > due) {
      var paid = st.txnList.some(function (t) { return t.txn_kind === 'loan_payment' && t.ref_id === r.ref_id && periodOf_(t.txn_date) === period && !st.reversedBy[t.txn_id]; });
      if (!paid) sent += notify_('rem:' + r.reminder_id + ':' + period + ':overdue', '[Family Finance] Quá hạn: ' + r.title,
        'Chưa thấy khoản trả nợ tháng ' + period + ' cho "' + r.title + '" (hạn ' + due + ').').sent;
    }
  });
  // budget thresholds
  budgetView_(null, period).jars.forEach(function (j) {
    if (j.status === 'over') sent += notify_('budget:' + period + ':' + j.jar_id + ':over', '[Family Finance] Vượt ngân sách lọ "' + j.name + '"',
      'Lọ "' + j.name + '" tháng ' + period + ' đã chi ' + j.spent + ' / ngân sách ' + j.budget + '.').sent;
    else if (j.status === 'warn') sent += notify_('budget:' + period + ':' + j.jar_id + ':warn', '[Family Finance] Lọ "' + j.name + '" gần hết ngân sách',
      'Lọ "' + j.name + '" tháng ' + period + ' đã dùng ' + j.pct + '% ngân sách.').sent;
  });
  // data-entry reminder
  var days = Number(getSetting_('data_entry_days', '3')) || 3;
  var lastEntry = '';
  st.txnList.forEach(function (t) {
    if ((t.txn_kind === 'income' || t.txn_kind === 'expense') && t.created_at.slice(0, 10) > lastEntry) lastEntry = t.created_at.slice(0, 10);
  });
  if (lastEntry && daysBetween_(lastEntry, today) >= days) {
    sent += notify_('entry:' + today, '[Family Finance] Nhắc nhập thu chi', 'Đã ' + daysBetween_(lastEntry, today) + ' ngày chưa có khoản thu chi mới (lần cuối ' + lastEntry + ').').sent;
  }
  return { sent: sent };
}

// ---------- Backups ----------
function backupFolders_() {
  var rootName = FF_CTX.backupRootName || 'Family Finance - Backup';
  function child(parent, name) {
    var it = parent.getFoldersByName(name);
    return it.hasNext() ? it.next() : parent.createFolder(name);
  }
  var rootIt = DriveApp.getFoldersByName(rootName);
  var root = rootIt.hasNext() ? rootIt.next() : DriveApp.createFolder(rootName);
  return { root: root, weekly: child(root, 'Weekly'), monthly: child(root, 'Monthly_Excel') };
}

function stampLocal_() { return Utilities.formatDate(new Date(), FF_TZ, 'yyyyMMdd-HHmm'); }

function pruneFolder_(folder, keep) {
  var files = [], it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
  var removed = 0;
  for (var i = keep; i < files.length; i++) { files[i].setTrashed(true); removed++; }
  return removed;
}

// Compares row counts and the last hash of a copy with the live file.
function verifyCopy_(src, copy) {
  function summary(ss) {
    var tx = ss.getSheetByName('Transactions'), en = ss.getSheetByName('Entries');
    var lastTx = tx.getLastRow();
    var lastHash = lastTx > 1 ? String(tx.getRange(lastTx, schemaOf_('Transactions').cols.indexOf('row_hash') + 1).getValue()) : '';
    return { txns: Math.max(0, lastTx - 1), entries: Math.max(0, en.getLastRow() - 1), hash: lastHash };
  }
  var a = summary(src), b = summary(copy);
  return { ok: a.txns === b.txns && a.entries === b.entries && a.hash === b.hash, source: a, copy: b };
}

function weeklyBackup() {
  try {
    var res = withLock_(function () {
      var ss = getSs_(), f = backupFolders_();
      var file = DriveApp.getFileById(ss.getId()).makeCopy('FF-DATA-' + stampLocal_(), f.weekly);
      var v = verifyCopy_(ss, SpreadsheetApp.openById(file.getId()));
      var removed = v.ok ? pruneFolder_(f.weekly, Number(getSetting_('weekly_keep', '8')) || 8) : 0;
      setSetting_('last_backup_weekly', nowIso_() + (v.ok ? ' OK' : ' LỖI'));
      audit_('backup:weekly', file.getId(), { ok: v.ok, removed: removed, check: v });
      return { ok: v.ok, file_id: file.getId(), pruned: removed, check: v };
    });
    if (!res.ok) notify_('backup:weekly:' + todayYmd_(), '[Family Finance] Sao lưu tuần KHÔNG khớp', 'Bản sao tuần không khớp dữ liệu gốc. Hãy kiểm tra thư mục sao lưu trong Google Drive.');
    return res;
  } catch (e) {
    try { notify_('backup:weekly:err:' + todayYmd_(), '[Family Finance] Sao lưu tuần thất bại', String(e && e.message || e)); } catch (x) { /* ignore */ }
    throw e;
  }
}

function monthlyExport() {
  try {
    var res = withLock_(function () {
      var ss = getSs_(), f = backupFolders_();
      var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx';
      var resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
      var code = resp.getResponseCode();
      var bytes = resp.getContent();
      var ok = code === 200 && bytes.length > 1000 && bytes[0] === 80 && bytes[1] === 75; // "PK" zip signature
      var name = 'FF-DATA-' + Utilities.formatDate(new Date(), FF_TZ, 'yyyy-MM') + '.xlsx';
      var fileId = '', removed = 0;
      if (ok) {
        fileId = f.monthly.createFile(resp.getBlob().setName(name)).getId();
        removed = pruneFolder_(f.monthly, Number(getSetting_('monthly_keep', '24')) || 24);
      }
      setSetting_('last_backup_monthly', nowIso_() + (ok ? ' OK' : ' LỖI'));
      audit_('backup:monthly', fileId, { ok: ok, http: code, size: bytes.length, removed: removed });
      return { ok: ok, file_id: fileId, http: code, size: bytes.length, pruned: removed };
    });
    if (!res.ok) notify_('backup:monthly:' + todayYmd_(), '[Family Finance] Xuất Excel tháng thất bại', 'Không xuất được file Excel hằng tháng (HTTP ' + res.http + ').');
    return res;
  } catch (e) {
    try { notify_('backup:monthly:err:' + todayYmd_(), '[Family Finance] Xuất Excel tháng thất bại', String(e && e.message || e)); } catch (x) { /* ignore */ }
    throw e;
  }
}

// ---------- Manual-edit audit (installable onEdit trigger) ----------
function onEditAudit(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    var name = sh.getName();
    if (!FF_SCHEMA[name] || name === 'Notifications') return;
    var who = '';
    try { who = (e.user && e.user.getEmail && e.user.getEmail()) || ''; } catch (x) { who = ''; }
    appendRows_('AuditLog', [{
      ts: nowIso_(), actor: who || 'unknown', action: 'manual-edit', ref_id: name + '!' + e.range.getA1Notation(),
      details: JSON.stringify({ old: e.oldValue === undefined ? null : String(e.oldValue).slice(0, 200), value: e.value === undefined ? null : String(e.value).slice(0, 200) })
    }]);
  } catch (err) { /* never block the user's edit */ }
}
