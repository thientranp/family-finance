// Events.gs - Sự kiện (chuyến đi/dịp cần biết chi tiêu riêng, vd đi du lịch, về quê, theo dõi chi
// phí vận hành xe...) — quyết định 07/11/2026.
//
// Nguyên tắc:
// - Chỉ gắn với giao dịch Chi tiêu (expense); không áp dụng Thu nhập/Chuyển ví/Mua tài sản/...
//   (xem planPost_ trong Ledger.gs, case 'expense').
// - Một giao dịch chỉ gắn ĐÚNG 1 sự kiện (cột event_id trên Transactions).
// - Ngày bắt đầu/kết thúc chỉ để hiển thị/tham khảo — KHÔNG bắt buộc giao dịch phải nằm trong
//   khoảng ngày đó (vd mua sắm chuẩn bị trước chuyến đi, hoặc sự kiện không có ngày kết thúc như
//   theo dõi chi phí xe lâu dài).
// - "Bật tự gắn" (current_event_id trên Members) là theo TỪNG THÀNH VIÊN: người nào bật thì chỉ
//   giao dịch do chính người đó tạo mới tự gắn; bật sự kiện mới tự tắt sự kiện cũ của chính mình.
//   Tại một giao dịch cụ thể, người dùng vẫn được CHỌN TAY sự kiện khác (hoặc bỏ gắn) để ghi đè.
// - Kết thúc sự kiện (status='ended') khoá cứng: không gắn thêm giao dịch mới nào nữa (tay hoặc tự
//   động); ai đang bật sự kiện đó sẽ tự tắt.
// - Xoá: chỉ xoá cứng được khi chưa có giao dịch nào gắn vào (giống Assets/GoldLots); có rồi thì chỉ
//   ẩn (active=0).
var FF_V = FF_V || {};
FF_V.Events = '0.3.0';

function eventRowOrThrow_(id) {
  var e = readAll_('Events').filter(function (x) { return x.event_id === id; })[0];
  if (!e) throw ffErr_('EVENT', 'Không tìm thấy sự kiện này.');
  return e;
}

// True nếu sự kiện này member hiện tại được phép thấy/dùng: chung (shared) hoặc riêng của chính
// member đó.
function eventVisibleTo_(e, memberId) { return e.scope !== 'personal' || e.owner_member_id === memberId; }

function createEvent_(m, p) {
  return withLock_(function () {
    var row = eventRow_(p, m);
    appendRows_('Events', [row]);
    audit_('event:create', row.event_id, { name: row.name, scope: row.scope });
    return { event_id: row.event_id };
  });
}

function eventRow_(p, m, idForNew, sourceRef) {
  var scope = p.scope === 'personal' ? 'personal' : 'shared';
  var row = {
    event_id: idForNew || nextCode_('Events', 'event_id', 'EV', 3),
    name: reqText_(p.name, 'Tên sự kiện', 1, 120),
    scope: scope,
    owner_member_id: scope === 'personal' ? memberIdOrThrow_(p.owner_member_id || (m && m.member_id), 'Chủ sự kiện') : '',
    start_date: p.start_date ? ymd_(p.start_date, 'Ngày bắt đầu') : '',
    end_date: p.end_date ? ymd_(p.end_date, 'Ngày kết thúc') : '',
    planned_budget: (p.planned_budget === undefined || p.planned_budget === '') ? null : signed_(p.planned_budget, 'Ngân sách dự kiến'),
    status: p.status === 'ended' ? 'ended' : 'ongoing',
    note: clip_(p.note, 300), active: 1,
    created_by: (m && m.member_id) || '', created_at: nowIso_(),
    source_ref: sourceRef ? clip_(sourceRef, 60) : ''
  };
  if (row.planned_budget !== null && row.planned_budget < 0) throw ffErr_('AMOUNT', 'Ngân sách dự kiến không được âm.');
  if (row.start_date && row.end_date && row.end_date < row.start_date) throw ffErr_('DATE', 'Ngày kết thúc không được trước ngày bắt đầu.');
  return row;
}

function updateEvent_(m, p) {
  return withLock_(function () {
    var e = eventRowOrThrow_(p.event_id);
    var patch = {};
    if (p.name !== undefined) patch.name = reqText_(p.name, 'Tên sự kiện', 1, 120);
    if (p.start_date !== undefined) patch.start_date = p.start_date ? ymd_(p.start_date, 'Ngày bắt đầu') : '';
    if (p.end_date !== undefined) patch.end_date = p.end_date ? ymd_(p.end_date, 'Ngày kết thúc') : '';
    if (p.planned_budget !== undefined) {
      patch.planned_budget = p.planned_budget === '' ? null : signed_(p.planned_budget, 'Ngân sách dự kiến');
      if (patch.planned_budget !== null && patch.planned_budget < 0) throw ffErr_('AMOUNT', 'Ngân sách dự kiến không được âm.');
    }
    if (p.note !== undefined) patch.note = clip_(p.note, 300);
    if (p.active !== undefined) patch.active = p.active ? 1 : 0;
    var sd = patch.start_date !== undefined ? patch.start_date : e.start_date;
    var ed = patch.end_date !== undefined ? patch.end_date : e.end_date;
    if (sd && ed && ed < sd) throw ffErr_('DATE', 'Ngày kết thúc không được trước ngày bắt đầu.');
    updateRow_('Events', e._row, patch);
    audit_('event:update', e.event_id, { before: { name: e.name }, patch: patch });
    return { event_id: e.event_id };
  });
}

// Đánh dấu "đã kết thúc" — khoá cứng: không gắn thêm giao dịch mới (tay hoặc tự động). Tự tắt
// current_event_id của bất kỳ ai đang bật sự kiện này.
function endEvent_(m, p) {
  return withLock_(function () {
    var e = eventRowOrThrow_(p.event_id);
    if (e.status === 'ended') return { event_id: e.event_id };
    updateRow_('Events', e._row, { status: 'ended' });
    readAll_('Members').forEach(function (mm) {
      if (mm.current_event_id === e.event_id) updateRow_('Members', mm._row, { current_event_id: '' });
    });
    audit_('event:end', e.event_id, { name: e.name });
    return { event_id: e.event_id };
  });
}

function eventHasTxn_(eventId) {
  return readAll_('Transactions').some(function (t) { return t.event_id === eventId; });
}

function deleteEvent_(m, p) {
  return withLock_(function () {
    var e = eventRowOrThrow_(p.event_id);
    if (eventHasTxn_(e.event_id)) throw ffErr_('EVENT', 'Sự kiện này đã có giao dịch gắn vào — không xoá được, chỉ có thể ẩn.');
    readAll_('Members').forEach(function (mm) {
      if (mm.current_event_id === e.event_id) updateRow_('Members', mm._row, { current_event_id: '' });
    });
    deleteRow_('Events', e._row);
    audit_('event:delete', e.event_id, { name: e.name });
    return { ok: true };
  });
}

// Bật/tắt "tự gắn" cho CHÍNH người gọi (m). event_id rỗng = tắt. Chỉ cho bật sự kiện 'ongoing' mà
// người đó thấy được (chung, hoặc riêng của chính mình).
function setCurrentEvent_(m, p) {
  return withLock_(function () {
    var eventId = p.event_id || '';
    if (eventId) {
      var e = eventRowOrThrow_(eventId);
      if (e.status !== 'ongoing') throw ffErr_('EVENT', 'Sự kiện "' + e.name + '" đã kết thúc, không bật được nữa.');
      if (!eventVisibleTo_(e, m.member_id)) throw ffErr_('EVENT', 'Bạn không có quyền dùng sự kiện này.');
    }
    updateRow_('Members', m._row, { current_event_id: eventId });
    audit_('event:set_current', eventId, { member: m.member_id });
    return { current_event_id: eventId };
  });
}

function eventsView_(m) {
  var all = readAll_('Events').filter(function (e) { return eventVisibleTo_(e, m.member_id); });
  var spentBy = {};
  readAll_('Transactions').forEach(function (t) {
    if (t.txn_kind === 'expense' && t.event_id) spentBy[t.event_id] = (spentBy[t.event_id] || 0) + t.amount;
  });
  return {
    current_event_id: m.current_event_id || '',
    events: all.map(function (e) {
      var spent = spentBy[e.event_id] || 0;
      return {
        event_id: e.event_id, name: e.name, scope: e.scope, owner_member_id: e.owner_member_id,
        start_date: e.start_date, end_date: e.end_date, planned_budget: e.planned_budget,
        status: e.status, note: e.note, active: e.active, spent: spent,
        remaining: e.planned_budget === null ? null : e.planned_budget - spent,
        has_txn: spent > 0 || eventHasTxn_(e.event_id)
      };
    })
  };
}

// Trang chi tiết: tổng chi + phân theo lọ + theo thành viên chi, danh sách giao dịch (mới nhất
// trước).
function eventDetailView_(m, p) {
  var e = eventRowOrThrow_(p.event_id);
  if (!eventVisibleTo_(e, m.member_id)) throw ffErr_('EVENT', 'Bạn không có quyền xem sự kiện này.');
  var jn = nameMap_('Jars', 'jar_id', 'name'), mn = nameMap_('Members', 'member_id', 'display_name');
  var txns = readAll_('Transactions').filter(function (t) { return t.txn_kind === 'expense' && t.event_id === e.event_id; });
  var byJar = {}, byMember = {}, total = 0;
  var rows = txns.map(function (t) {
    total += t.amount;
    byJar[t.jar_id] = (byJar[t.jar_id] || 0) + t.amount;
    byMember[t.paid_by] = (byMember[t.paid_by] || 0) + t.amount;
    return { txn_id: t.txn_id, date: t.txn_date, amount: t.amount, jar: jn[t.jar_id] || '', paid_by: mn[t.paid_by] || '', note: t.note };
  }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  return {
    event: {
      event_id: e.event_id, name: e.name, scope: e.scope, start_date: e.start_date, end_date: e.end_date,
      planned_budget: e.planned_budget, status: e.status, note: e.note
    },
    total: total, remaining: e.planned_budget === null ? null : e.planned_budget - total,
    by_jar: Object.keys(byJar).map(function (k) { return { jar: jn[k] || '(không lọ)', amount: byJar[k] }; }),
    by_member: Object.keys(byMember).map(function (k) { return { member: mn[k] || k, amount: byMember[k] }; }),
    transactions: rows
  };
}

// Nhập sự kiện cũ từ Excel + gắn event_id vào các giao dịch Chi tiêu ĐÃ nhập trước đây (khớp theo
// idempotency_key 'imp:finance:<ID cũ>'). AN TOÀN: event_id không nằm trong canon_()/hashOf_() (xem
// Ledger.gs) nên không ảnh hưởng chuỗi row_hash chống sửa của sổ cái. Chạy lại không nhân đôi (dựa
// vào source_ref của Events, và bỏ qua giao dịch đã có event_id).
// rows: [{source_ref, name, start_date, end_date, status, note, finance_ids:[id cũ,...]}]
function importEventsCore_(m, rows) {
  var existing = {};
  readAll_('Events').forEach(function (e) { if (e.source_ref) existing[e.source_ref] = e.event_id; });
  var created = [], skipped = [], tagged = 0, taggedSkipped = 0;
  var byKey = {};
  readAll_('Transactions').forEach(function (t) { if (t.idempotency_key) byKey[t.idempotency_key] = t; });
  rows.forEach(function (r) {
    var eventId;
    if (r.source_ref && existing[r.source_ref]) {
      eventId = existing[r.source_ref];
      skipped.push(r.source_ref);
    } else {
      var row = eventRow_({ name: r.name, scope: 'shared', start_date: r.start_date, end_date: r.end_date, status: r.status, note: r.note }, m, '', r.source_ref);
      appendRows_('Events', [row]);
      existing[row.source_ref] = row.event_id;
      eventId = row.event_id;
      created.push(eventId);
    }
    (r.finance_ids || []).forEach(function (fid) {
      var t = byKey['imp:finance:' + fid];
      if (!t || t.txn_kind !== 'expense') return;
      if (t.event_id) { taggedSkipped++; return; }
      updateRow_('Transactions', t._row, { event_id: eventId });
      t.event_id = eventId;
      tagged++;
    });
  });
  if (created.length) audit_('event:import', '', { count: created.length, tagged: tagged });
  return { created: created, skipped: skipped, tagged: tagged, tagged_skipped: taggedSkipped };
}
