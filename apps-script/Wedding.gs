// Wedding.gs - Sổ cưới: sổ lưu trữ thuần (quyết định 07/11/2026). KHÔNG tạo giao dịch, KHÔNG ảnh
// hưởng ví/thu nhập/dòng tiền gia đình — chỉ là một cuốn sổ ghi lại ai mừng gì trong đám cưới, để
// tra cứu và (khi cần) biết đã đáp lễ ai chưa. Vì không chạm vào sổ cái nên không cần cơ chế khoá
// xoá kiểu Assets/Gold — sửa/xoá tự do như một danh bạ thông thường.
var FF_V = FF_V || {};
FF_V.Wedding = '0.3.0';

var FF_WEDDING_SIDES = { Anh: 'Bên chú rể (Anh)', Em: 'Bên cô dâu (Em)' };

function weddingGiftOrThrow_(id) {
  var g = readAll_('WeddingGifts').filter(function (x) { return x.gift_id === id; })[0];
  if (!g) throw ffErr_('WEDDING', 'Không tìm thấy dòng sổ cưới này.');
  return g;
}

function weddingRow_(p, idForNew) {
  var row = {
    gift_id: idForNew || nextCode_('WeddingGifts', 'gift_id', 'WG', 4),
    wedding_date: ymd_(p.wedding_date, 'Ngày cưới'),
    side: (p.side === 'Em' ? 'Em' : 'Anh'),
    guest_name: reqText_(p.guest_name, 'Tên khách / gia đình', 1, 160),
    address: clip_(p.address, 160),
    cash_amount: !p.cash_amount ? 0 : signed_(p.cash_amount, 'Tiền mừng'),
    gold_amount: !p.gold_amount ? 0 : qty_(p.gold_amount, 'Vàng (chỉ)', 100000),
    usd_amount: !p.usd_amount ? 0 : signed_(p.usd_amount, 'USD'),
    relationship: clip_(p.relationship, 60), payment_method: clip_(p.payment_method, 60),
    repaid: p.repaid ? 1 : 0, note: clip_(p.note, 300), active: 1,
    source_ref: p.source_ref ? clip_(p.source_ref, 60) : ''
  };
  if (row.cash_amount < 0) throw ffErr_('AMOUNT', 'Tiền mừng không được âm.');
  if (row.usd_amount < 0) throw ffErr_('AMOUNT', 'USD không được âm.');
  // Không bắt buộc phải có Tiền mừng/Vàng/USD > 0: một số khách trong sổ gốc chỉ ghi tên (có mặt)
  // mà không ghi rõ số tiền mừng — vẫn cho lưu để không làm mất dữ liệu lịch sử (95/487 dòng gốc).
  return row;
}

function createWeddingGift_(m, p) {
  return withLock_(function () {
    var row = weddingRow_(p);
    appendRows_('WeddingGifts', [row]);
    audit_('wedding:create', row.gift_id, { guest_name: row.guest_name });
    return { gift_id: row.gift_id };
  });
}

function updateWeddingGift_(m, p) {
  return withLock_(function () {
    var g = weddingGiftOrThrow_(p.gift_id);
    var patch = {};
    if (p.wedding_date !== undefined) patch.wedding_date = ymd_(p.wedding_date, 'Ngày cưới');
    if (p.side !== undefined) patch.side = p.side === 'Em' ? 'Em' : 'Anh';
    if (p.guest_name !== undefined) patch.guest_name = reqText_(p.guest_name, 'Tên khách / gia đình', 1, 160);
    if (p.address !== undefined) patch.address = clip_(p.address, 160);
    if (p.cash_amount !== undefined) patch.cash_amount = p.cash_amount === '' ? 0 : signed_(p.cash_amount, 'Tiền mừng');
    if (p.gold_amount !== undefined) patch.gold_amount = !p.gold_amount ? 0 : qty_(p.gold_amount, 'Vàng (chỉ)', 100000);
    if (p.usd_amount !== undefined) patch.usd_amount = p.usd_amount === '' ? 0 : signed_(p.usd_amount, 'USD');
    if (p.relationship !== undefined) patch.relationship = clip_(p.relationship, 60);
    if (p.payment_method !== undefined) patch.payment_method = clip_(p.payment_method, 60);
    if (p.repaid !== undefined) patch.repaid = p.repaid ? 1 : 0;
    if (p.note !== undefined) patch.note = clip_(p.note, 300);
    if (p.active !== undefined) patch.active = p.active ? 1 : 0;
    updateRow_('WeddingGifts', g._row, patch);
    audit_('wedding:update', g.gift_id, { before: { guest_name: g.guest_name }, patch: patch });
    return { gift_id: g.gift_id };
  });
}

function deleteWeddingGift_(m, p) {
  return withLock_(function () {
    var g = weddingGiftOrThrow_(p.gift_id);
    deleteRow_('WeddingGifts', g._row);
    audit_('wedding:delete', g.gift_id, { guest_name: g.guest_name });
    return { ok: true };
  });
}

// f: {q, side, relationship, repaid} — tất cả không bắt buộc.
function weddingGiftsView_(f) {
  f = f || {};
  var q = f.q ? String(f.q).toLowerCase() : '';
  var all = readAll_('WeddingGifts');
  var rows = all.filter(function (g) {
    if (g.active !== 1 && !f.include_inactive) return false;
    if (f.side && g.side !== f.side) return false;
    if (f.relationship && g.relationship !== f.relationship) return false;
    if (f.repaid === '1' && g.repaid !== 1) return false;
    if (f.repaid === '0' && g.repaid === 1) return false;
    if (q && (g.guest_name + ' ' + g.address + ' ' + g.note).toLowerCase().indexOf(q) < 0) return false;
    return true;
  }).sort(function (a, b) { return a.wedding_date < b.wedding_date ? -1 : a.wedding_date > b.wedding_date ? 1 : a.guest_name.localeCompare(b.guest_name); });
  var totals = { cash: 0, gold: 0, usd: 0, count: rows.length };
  rows.forEach(function (g) { totals.cash += g.cash_amount; totals.gold += g.gold_amount; totals.usd += g.usd_amount; });
  var relationships = {};
  all.forEach(function (g) { if (g.relationship) relationships[g.relationship] = true; });
  return {
    gifts: rows.map(function (g) {
      return {
        gift_id: g.gift_id, wedding_date: g.wedding_date, side: g.side, side_label: FF_WEDDING_SIDES[g.side] || g.side,
        guest_name: g.guest_name, address: g.address, cash_amount: g.cash_amount, gold_amount: g.gold_amount,
        usd_amount: g.usd_amount, relationship: g.relationship, payment_method: g.payment_method,
        repaid: g.repaid, note: g.note, active: g.active
      };
    }),
    totals: totals, relationships: Object.keys(relationships).sort()
  };
}

// Nhập 487 dòng sổ cưới cũ từ Excel. rows: [{wedding_date,side,guest_name,address,cash_amount,
// gold_amount,usd_amount,relationship,payment_method,repaid,note,source_ref}]. Mỗi dòng có
// source_ref riêng (vd "imp:wedding:<STT cũ>"); chạy lại không nhân đôi. KHÔNG tạo giao dịch nào —
// đây là sổ lưu trữ thuần, đúng quyết định đã duyệt.
// Tách lõi (không tự khoá) để ImportGoldWedding.gs gọi được từ bên trong 1 withLock_ ngoài cùng của
// nó mà không bị khoá lồng khoá (LockService không tái vào được).
function importWeddingGifts_(m, p) { return withLock_(function () { return importWeddingGiftsCore_(m, p); }); }
function importWeddingGiftsCore_(m, p) {
    var existing = {};
    readAll_('WeddingGifts').forEach(function (g) { if (g.source_ref) existing[g.source_ref] = g.gift_id; });
    var rows = p.rows || [], toAppend = [], created = [], skipped = [];
    rows.forEach(function (r) {
      if (r.source_ref && existing[r.source_ref]) { skipped.push(r.source_ref); return; }
      var row = weddingRow_(r, '');
      toAppend.push(row);
      if (row.source_ref) existing[row.source_ref] = true;
    });
    var base = 0;
    readAll_('WeddingGifts').forEach(function (g) { var mm = String(g.gift_id).match(/(\d+)$/); if (mm && +mm[1] > base) base = +mm[1]; });
    toAppend.forEach(function (row, i) {
      var n = String(base + i + 1); while (n.length < 4) n = '0' + n;
      row.gift_id = 'WG' + n;
      created.push(row.gift_id);
    });
    if (toAppend.length) {
      appendRows_('WeddingGifts', toAppend);
      audit_('wedding:import', '', { count: toAppend.length });
    }
    return { created: created, skipped: skipped };
}
