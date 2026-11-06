// Config.gs - wallets, jars, categories, reminders, settings (all audited).
var FF_V = FF_V || {};
FF_V.Config = '0.3.0';

var FF_WALLET_TYPES = { cash: 'Tiền mặt', bank: 'Ngân hàng', savings: 'Tiết kiệm', held_in_trust: 'Giữ hộ' };

function uniqueName_(sheet, name, exceptId, idCol) {
  var low = name.toLowerCase();
  return !readAll_(sheet).some(function (r) { return r.name.toLowerCase() === low && r[idCol] !== exceptId; });
}

function saveWallet_(m, p) {
  return withLock_(function () {
    var name = reqText_(p.name, 'Tên ví', 2, 80);
    var type = String(p.wallet_type || '');
    if (p.wallet_id) {
      var w = readAll_('Wallets').filter(function (x) { return x.wallet_id === p.wallet_id; })[0];
      if (!w) throw ffErr_('WALLET', 'Ví không tồn tại.');
      if (!uniqueName_('Wallets', name, w.wallet_id, 'wallet_id')) throw ffErr_('WALLET', 'Đã có ví trùng tên.');
      var patch = { name: name, bank_name: clip_(p.bank_name, 80) };
      if (p.owner_member_id) patch.owner_member_id = memberIdOrThrow_(p.owner_member_id, 'Chủ ví');
      if (p.status && p.status !== w.status) {
        if (p.status !== 'active' && p.status !== 'closed') throw ffErr_('WALLET', 'Trạng thái ví không hợp lệ.');
        if (p.status === 'closed') {
          var bal = buildState_().walletBal[w.wallet_id];
          if (bal !== 0) throw ffErr_('WALLET', 'Chỉ đóng được ví khi số dư bằng 0 (hiện ' + bal + '). Hãy chuyển hoặc điều chỉnh trước.');
        }
        patch.status = p.status;
      }
      if (w.wallet_type === 'held_in_trust' && p.holder_name !== undefined) patch.holder_name = reqText_(p.holder_name, 'Tên người gửi', 2, 80);
      updateRow_('Wallets', w._row, patch);
      audit_('wallet:update', w.wallet_id, { before: { name: w.name, status: w.status, owner: w.owner_member_id }, patch: patch });
      return { wallet_id: w.wallet_id };
    }
    if (!FF_WALLET_TYPES[type]) throw ffErr_('WALLET', 'Loại ví không hợp lệ.');
    if (!uniqueName_('Wallets', name, '', 'wallet_id')) throw ffErr_('WALLET', 'Đã có ví trùng tên.');
    var holder = '';
    if (type === 'held_in_trust') holder = reqText_(p.holder_name, 'Tên người gửi', 2, 80);
    var row = {
      wallet_id: nextCode_('Wallets', 'wallet_id', 'W', 3), name: name, wallet_type: type, bank_name: clip_(p.bank_name, 80),
      owner_member_id: memberIdOrThrow_(p.owner_member_id, 'Chủ ví'), holder_name: holder,
      opening_balance: p.opening_balance === undefined || p.opening_balance === '' ? 0 : signed_(p.opening_balance, 'Số dư đầu'),
      opening_date: ymd_(p.opening_date || getSetting_('cutoff_date'), 'Ngày bắt đầu'), status: 'active'
    };
    appendRows_('Wallets', [row]);
    audit_('wallet:create', row.wallet_id, { name: row.name, type: row.wallet_type, opening: row.opening_balance });
    return { wallet_id: row.wallet_id };
  });
}

// Changing the opening balance rewrites history of that wallet's balance, so it needs a reason and is audited.
function setWalletOpening_(m, p) {
  return withLock_(function () {
    var w = readAll_('Wallets').filter(function (x) { return x.wallet_id === p.wallet_id; })[0];
    if (!w) throw ffErr_('WALLET', 'Ví không tồn tại.');
    var bal = signed_(p.opening_balance, 'Số dư đầu');
    var date = ymd_(p.opening_date, 'Ngày bắt đầu');
    var reason = reqText_(p.reason, 'Lý do', 3, 300);
    updateRow_('Wallets', w._row, { opening_balance: bal, opening_date: date });
    audit_('wallet:opening', w.wallet_id, { before: { balance: w.opening_balance, date: w.opening_date }, after: { balance: bal, date: date }, reason: reason });
    return { wallet_id: w.wallet_id };
  });
}

function saveJar_(m, p) {
  return withLock_(function () {
    var name = reqText_(p.name, 'Tên lọ', 2, 60);
    if (p.jar_id) {
      var j = readAll_('Jars').filter(function (x) { return x.jar_id === p.jar_id; })[0];
      if (!j) throw ffErr_('JAR', 'Lọ không tồn tại.');
      if (!uniqueName_('Jars', name, j.jar_id, 'jar_id')) throw ffErr_('JAR', 'Đã có lọ trùng tên.');
      var patch = { name: name };
      if (p.active !== undefined) patch.active = p.active ? 1 : 0;
      updateRow_('Jars', j._row, patch);
      audit_('jar:update', j.jar_id, { before: { name: j.name, active: j.active }, patch: patch });
      return { jar_id: j.jar_id };
    }
    if (!uniqueName_('Jars', name, '', 'jar_id')) throw ffErr_('JAR', 'Đã có lọ trùng tên.');
    var jars = readAll_('Jars');
    var maxOrder = 0;
    jars.forEach(function (x) { if (x.sort_order > maxOrder) maxOrder = x.sort_order; });
    var row = { jar_id: nextCode_('Jars', 'jar_id', 'J', 1), name: name, sort_order: maxOrder + 1, active: 1 };
    appendRows_('Jars', [row]);
    audit_('jar:create', row.jar_id, { name: name });
    return { jar_id: row.jar_id };
  });
}

function saveCategory_(m, p) {
  return withLock_(function () {
    var name = reqText_(p.name, 'Tên danh mục', 2, 80);
    var kind = String(p.kind || '');
    if (kind !== 'income' && kind !== 'expense') throw ffErr_('CATEGORY', 'Loại danh mục không hợp lệ.');
    var jarId = '';
    if (kind === 'expense') jarId = jarOrThrow_(p.jar_id).jar_id;
    if (p.category_id) {
      var c = readAll_('Categories').filter(function (x) { return x.category_id === p.category_id; })[0];
      if (!c) throw ffErr_('CATEGORY', 'Danh mục không tồn tại.');
      if (c.kind !== kind) throw ffErr_('CATEGORY', 'Không đổi được loại của danh mục đã có.');
      if (!uniqueName_('Categories', name, c.category_id, 'category_id')) throw ffErr_('CATEGORY', 'Đã có danh mục trùng tên.');
      var patch = { name: name, jar_id: jarId };
      if (p.active !== undefined) patch.active = p.active ? 1 : 0;
      updateRow_('Categories', c._row, patch);
      audit_('category:update', c.category_id, { before: { name: c.name, jar: c.jar_id, active: c.active }, patch: patch });
      return { category_id: c.category_id };
    }
    if (!uniqueName_('Categories', name, '', 'category_id')) throw ffErr_('CATEGORY', 'Đã có danh mục trùng tên.');
    var row = { category_id: nextCode_('Categories', 'category_id', 'C', 3), name: name, kind: kind, jar_id: jarId, active: 1 };
    appendRows_('Categories', [row]);
    audit_('category:create', row.category_id, { name: name, kind: kind, jar: jarId });
    return { category_id: row.category_id };
  });
}

function saveSettings_(m, p) {
  return withLock_(function () {
    var changed = {};
    if (p.budget_warn_pct !== undefined) {
      var w = toNumber_(p.budget_warn_pct, 'Ngưỡng cảnh báo');
      if (w < 1 || w > 100) throw ffErr_('SETTING', 'Ngưỡng cảnh báo phải từ 1 đến 100.');
      setSetting_('budget_warn_pct', w); changed.budget_warn_pct = w;
    }
    if (p.data_entry_days !== undefined) {
      var d = toNumber_(p.data_entry_days, 'Số ngày nhắc nhập liệu');
      if (d < 1 || d > 30) throw ffErr_('SETTING', 'Số ngày nhắc nhập liệu phải từ 1 đến 30.');
      setSetting_('data_entry_days', d); changed.data_entry_days = d;
    }
    audit_('settings:update', '', changed);
    return changed;
  });
}

function listReminders_() {
  return readAll_('Reminders').map(function (r) {
    return { reminder_id: r.reminder_id, type: r.type, title: r.title, day_of_month: r.day_of_month, days_before: r.days_before, ref_id: r.ref_id, active: r.active };
  });
}

// type: monthly_bill (recurring bill/tuition/credit card) | loan_payment (monthly loan instalment)
function saveReminder_(m, p) {
  return withLock_(function () {
    var type = String(p.type || '');
    if (type !== 'monthly_bill' && type !== 'loan_payment') throw ffErr_('REMINDER', 'Loại nhắc nhở không hợp lệ.');
    var day = toNumber_(p.day_of_month, 'Ngày trong tháng');
    if (day < 1 || day > 28) throw ffErr_('REMINDER', 'Ngày trong tháng phải từ 1 đến 28.');
    var before = p.days_before === undefined || p.days_before === '' ? 2 : toNumber_(p.days_before, 'Nhắc trước');
    if (before < 0 || before > 14) throw ffErr_('REMINDER', 'Nhắc trước phải từ 0 đến 14 ngày.');
    var ref = '';
    if (type === 'loan_payment') {
      ref = String(p.ref_id || '');
      if (!readAll_('Liabilities').some(function (l) { return l.liability_id === ref; })) throw ffErr_('REMINDER', 'Chọn khoản vay hợp lệ.');
    }
    var row = { type: type, title: reqText_(p.title, 'Tiêu đề', 2, 100), day_of_month: day, days_before: before, ref_id: ref, active: p.active === undefined ? 1 : (p.active ? 1 : 0) };
    if (p.reminder_id) {
      var r = readAll_('Reminders').filter(function (x) { return x.reminder_id === p.reminder_id; })[0];
      if (!r) throw ffErr_('REMINDER', 'Nhắc nhở không tồn tại.');
      updateRow_('Reminders', r._row, row);
      audit_('reminder:update', r.reminder_id, row);
      return { reminder_id: r.reminder_id };
    }
    row.reminder_id = nextCode_('Reminders', 'reminder_id', 'R', 3);
    appendRows_('Reminders', [row]);
    audit_('reminder:create', row.reminder_id, row);
    return { reminder_id: row.reminder_id };
  });
}
