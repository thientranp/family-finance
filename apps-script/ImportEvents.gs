// ImportEvents.gs - Nhập sự kiện cũ từ Excel (Appsheet_Finance.xlsx, sheet "event") + gắn event_id
// vào các giao dịch Chi tiêu ĐÃ nhập trước đây (khớp theo idempotency_key "imp:finance:<ID cũ>").
// Chỉ một lần, chạy tay từ Apps Script Editor sau khi đã setupSpreadsheet() và deploy code mới.
//
// Bối cảnh: sheet "event" gốc có 9 sự kiện, trong đó:
// - "Sinh hoạt" (g1f16d2f) là mã mặc định gắn cho 4320/4504 dòng (không phải một dịp cụ thể) ->
//   KHÔNG tạo sự kiện, các dòng này giữ nguyên KHÔNG gắn sự kiện nào.
// - "Mua xe" (64fd2c98) trước đây dùng để quản lý khoản vay + mua xe, nay đã có Liabilities/Assets
//   lo riêng -> BỎ QUA theo yêu cầu người dùng (07/11/2026), không tạo sự kiện, 5 dòng chi tiêu cũ
//   gắn mã này giữ nguyên KHÔNG gắn sự kiện nào.
// - 6 sự kiện còn lại được nhập ở đây: 5 chuyến đi/dịp đã xong (status=ended) + "Cx-3" được hiểu lại
//   thành theo dõi CHI PHÍ VẬN HÀNH XE liên tục (status=ongoing, không đặt ngày kết thúc) theo
//   quyết định người dùng.
// - Chỉ 174 dòng KIỂU CHI TIÊU (Chi) được gắn; 5 dòng THU NHẬP dưới sự kiện "Về quê" KHÔNG được gắn
//   (quyết định: sự kiện chỉ áp dụng cho Chi tiêu).
//
// AN TOÀN: event_id không nằm trong canon_()/hashOf_() (xem Ledger.gs) nên việc ghi bổ sung
// event_id vào dòng sổ cái đã tồn tại KHÔNG làm hỏng chuỗi row_hash chống sửa.
var FF_V = FF_V || {};
FF_V.ImportEvents = '0.3.0';

var FF_EVENT_SEED = [
  {
    "source_ref": "imp:event:41f16d2f",
    "name": "Về quê Quảng Trị (2024)",
    "start_date": "2024-09-21",
    "end_date": "2024-12-17",
    "status": "ended",
    "note": "Nhập từ dữ liệu cũ (Appsheet_Finance.xlsx, sheet event id 41f16d2f).",
    "finance_ids": [
      "e2a40943",
      "f3e9547d",
      "afda019e",
      "a6b38891",
      "e81d6dcf",
      "27a799cd",
      "66749f85",
      "6780a206",
      "bc4dc005",
      "cb7503fe",
      "722d211e",
      "976dd2f8",
      "61a76463",
      "74316078",
      "a7ac0d56",
      "eabcbb1d",
      "6a781bed",
      "abe14448",
      "55b704d1",
      "60510193",
      "58285f5a",
      "de1f0b39",
      "8c228323",
      "26b24cbc",
      "490ad157",
      "6f1570aa",
      "33657036",
      "42158623",
      "7f49d69d",
      "b5328678",
      "23375f77",
      "cba19767",
      "c1f407d1",
      "ecf6762c",
      "5dbfd342",
      "5a979a23",
      "41b27f3e",
      "f0a7d32f",
      "39282dff",
      "3194d1ec",
      "7c756458",
      "4f76cdd2",
      "7f3bb475",
      "f3bc2038",
      "60faefc5",
      "e117d01f",
      "ad5aa7c6",
      "8e6068fb",
      "a444dfc3",
      "fb3649bd",
      "3becd843",
      "a6de0fb9",
      "c4f6848d",
      "55272b83",
      "2b053ead",
      "9162d576",
      "f0eca601",
      "1b03d39f",
      "72ca381d",
      "c9770ac5",
      "90461711",
      "7c5d339d",
      "85214404",
      "8d636eed",
      "c70c0764",
      "23b691d5",
      "944e1e94",
      "ebc2fff5",
      "5171e2ca",
      "6d7c0450",
      "18b786db",
      "0e3b39fe",
      "96241ef0",
      "c2d74da4",
      "0e0250b4",
      "190cdaa9",
      "7dfac709",
      "5a88e339",
      "6015a621",
      "eb8da833",
      "0896c76e",
      "1c4d8be6",
      "4e145c00",
      "af717b4f",
      "9290ae65",
      "1193636f",
      "af8fa6f7",
      "a289c70f",
      "6f095a96",
      "b9903626",
      "99893029",
      "ea0c3362",
      "a0aeedcc",
      "6c9189b1",
      "95bcc5ca",
      "44c09256",
      "753e66e2",
      "e996f0a7",
      "8ea32eca",
      "74751463",
      "47193fc9",
      "9287f7b1",
      "3030238a",
      "91dead9a",
      "18a1f4b5",
      "3bfe22f7",
      "3a5acb91",
      "d54131e7",
      "3c19519f",
      "b7661644",
      "5306d635",
      "50ae64ce",
      "e0af54c7",
      "16145947",
      "6d013d01",
      "2d48b43d",
      "e719554b",
      "bef554c0",
      "f3be9c99",
      "fa05d200",
      "c81e294d",
      "4984555c",
      "293618c5",
      "fa5a435d",
      "5d0fed2b",
      "1870968d",
      "a0d49e71",
      "aa95aaef",
      "906a7282",
      "5976ae91",
      "da05acaf"
    ]
  },
  {
    "source_ref": "imp:event:46e6f311",
    "name": "Du lịch Vũng Tàu (5/2023)",
    "start_date": "2023-05-14",
    "end_date": "2023-05-15",
    "status": "ended",
    "note": "Nhập từ dữ liệu cũ (Appsheet_Finance.xlsx, sheet event id 46e6f311).",
    "finance_ids": [
      "3a4ad2f6",
      "02b355da",
      "fb6a35b0",
      "db6c26b0",
      "a3438078",
      "6a641014",
      "b3ae3b41",
      "62ae8037",
      "782c7cb8",
      "d0e1dfe1",
      "524cc9a0",
      "c84d1cf8"
    ]
  },
  {
    "source_ref": "imp:event:b9b3398d",
    "name": "Du lịch Vũng Tàu (6/2024)",
    "start_date": "2024-06-02",
    "end_date": "2024-06-03",
    "status": "ended",
    "note": "Nhập từ dữ liệu cũ (Appsheet_Finance.xlsx, sheet event id b9b3398d).",
    "finance_ids": [
      "4cb53cee",
      "038c168b",
      "e68007e1"
    ]
  },
  {
    "source_ref": "imp:event:f81b6e23",
    "name": "Du lịch Phan Thiết (11/2023)",
    "start_date": "2023-11-19",
    "end_date": "2023-11-20",
    "status": "ended",
    "note": "Nhập từ dữ liệu cũ (Appsheet_Finance.xlsx, sheet event id f81b6e23).",
    "finance_ids": [
      "13370dcb",
      "4b61d93d",
      "860786ca"
    ]
  },
  {
    "source_ref": "imp:event:30c95520",
    "name": "Du lịch Phan Thiết (3/2025)",
    "start_date": "2025-03-09",
    "end_date": "",
    "status": "ended",
    "note": "Nhập từ dữ liệu cũ (Appsheet_Finance.xlsx, sheet event id 30c95520; không có ngày kết thúc trong dữ liệu gốc).",
    "finance_ids": [
      "7193f4d7",
      "9aa373a6",
      "4e45cb86",
      "b95b812a",
      "810a2fcd",
      "7be19938",
      "34fef851",
      "dc994582",
      "4b489a15"
    ]
  },
  {
    "source_ref": "imp:event:d1c29ab8",
    "name": "Cx-3 — chi phí vận hành xe",
    "start_date": "2025-01-01",
    "end_date": "",
    "status": "ongoing",
    "note": "Nhập từ dữ liệu cũ (Appsheet_Finance.xlsx, sheet event id d1c29ab8). Theo dõi liên tục chi phí vận hành xe Cx-3 (xăng, bảo trì, đăng kiểm, bảo hiểm...), không đặt ngày kết thúc — bật \"tự gắn\" khi cần ghi thêm chi phí xe mới.",
    "finance_ids": [
      "3581de89",
      "95eec3ba",
      "3d881642",
      "34309acb",
      "2a0fa614",
      "5ed0a85d",
      "b0fdd6fa",
      "e3997e1a",
      "45d90e65",
      "6f2d5ff2",
      "76f9cd29",
      "da21c29a",
      "2b79b53b",
      "4ac03191",
      "6138d113",
      "14821718"
    ]
  }
];

function impEventsPlan_(m, commit) {
  var lines = [];
  var totalFinance = 0;
  FF_EVENT_SEED.forEach(function (e) { totalFinance += (e.finance_ids || []).length; });
  lines.push('Nguồn: ' + FF_EVENT_SEED.length + ' sự kiện, ' + totalFinance + ' dòng chi tiêu cần gắn.');
  var createdCount = 0, skippedCount = 0, taggedCount = 0, taggedSkippedCount = 0;
  if (commit) {
    var res = importEventsCore_(m, FF_EVENT_SEED);
    createdCount = res.created.length; skippedCount = res.skipped.length;
    taggedCount = res.tagged; taggedSkippedCount = res.tagged_skipped;
    lines.push('Đã ghi: ' + createdCount + ' sự kiện mới (' + skippedCount + ' đã có từ trước, bỏ qua), ' +
      taggedCount + ' giao dịch được gắn event_id (' + taggedSkippedCount + ' đã gắn từ trước, bỏ qua).');
    audit_('import:events', '', { created: createdCount, skipped: skippedCount, tagged: taggedCount });
  } else {
    FF_EVENT_SEED.forEach(function (e) {
      var exists = readAll_('Events').some(function (x) { return x.source_ref === e.source_ref; });
      lines.push((exists ? '[đã có, bỏ qua] ' : '[sẽ nhập] ') + e.name + ' (' + (e.finance_ids || []).length + ' dòng chi tiêu, trạng thái ' + e.status + ')');
    });
  }
  return lines.join('\n');
}

function importEventsDryRun() {
  var m = requireMember_();
  var text = 'DRY RUN sự kiện (Appsheet_Finance.xlsx) ' + nowIso_() + '\n' + impEventsPlan_(m, false);
  Logger.log(text);
  return text;
}

function importEvents() {
  var m = requireMember_();
  var text = withLock_(function () {
    return 'IMPORT sự kiện (Appsheet_Finance.xlsx) ' + nowIso_() + '\n' + impEventsPlan_(m, true);
  });
  Logger.log(text);
  return text;
}
