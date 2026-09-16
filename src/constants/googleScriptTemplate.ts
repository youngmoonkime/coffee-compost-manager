/**
 * 구글 스프레드시트 Apps Script 연동 템플릿 코드 및 안내 가이드
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * 커피박 부숙 관리 시스템 - 구글 스프레드시트 연동 Web App (v11)
 * =========================================================================
 * [간편 설정 방법]
 * 1. 구글 스프레드시트 새 문서(sheets.new)를 만듭니다. (기존 시트를 계속 써도 됩니다)
 * 2. 상단 메뉴 [확장 프로그램] > [Apps Script]를 클릭합니다.
 * 3. 기본 내용을 모두 지우고 이 코드를 그대로 붙여넣은 뒤 저장(Ctrl+S)합니다.
 * 4. ★사진 권한★ 위쪽 함수 선택 칸에서 "setupPhotoFolder" 를 고르고 [실행]
 *    → [권한 검토] → 계정 선택 → (확인되지 않은 앱 경고가 나오면) [고급] → [이동] → [허용]
 *    (v7 에서 이미 허용했다면 건너뛰어도 됩니다)
 * 5. 배포
 *    - 처음이면: [배포] > [새 배포] > 유형 [웹 앱]
 *        다음 사용자로 실행: [나]  /  액세스 권한이 있는 사용자: [모든 사용자]  ★필수★
 *    - 이미 배포했다면: [배포] > [배포 관리] > 연필(수정) > 버전 [새 버전] > [배포]
 *      (이렇게 해야 웹 앱 URL 이 바뀌지 않습니다)
 *
 * [기록 방식]
 * 목장마다 "주간기록_목장이름" 탭이 따로 생기고, 기록 한 건이 그 탭의 한 행입니다.
 * 탭 안은 하역 장소 → 측정 일시 순으로 정렬되어, 한 더미의 함수율 변화가 위아래로 이어집니다.
 * 목장 + 하역 장소 + 측정일이 같으면 새 행을 만들지 않고 기존 행을 갱신합니다.
 *
 * [v11 변경점] 예전 탭 자동 맞춤 시점 수정
 * 3지점 칸 두 개를 끼워 넣는 일이 저장할 때만 일어나서, 재배포 직후 첫 [불러오기] 에서
 * 예전 행의 사진·레코드 키가 한 칸씩 밀려 읽히는 문제가 있었습니다.
 * 이제 탭을 읽을 때도 모양을 먼저 맞춥니다.
 *
 * [v10] 심부 3지점 측정
 * 심부 온도·함수율은 같은 높이에서 30cm 간격으로 3군데를 재고 평균을 기록합니다.
 * "심부 온도 3지점", "심부 함수율 3지점" 칸에 잰 값이 그대로 남아 평균의 근거를 볼 수 있습니다.
 * 기존 탭에는 두 칸이 자동으로 끼워 넣어집니다 (기록은 그대로 유지).
 *
 * [v9] 보안 강화
 * 이 웹 앱은 주소만 알면 누구나 호출할 수 있으므로 들어오는 값을 검사합니다.
 * - =, +, -, @ 로 시작하는 글자는 수식이 아닌 글자로 저장 (시트 수식 주입 방지)
 * - 사진 파일 ID 형식 검사, 사진은 JPEG·5MB·3장 이하만 저장
 *
 * [v8] 목장별 탭 분리
 * 예전 "커피박_주간기록" 탭의 기록은 처음 실행될 때 목장별 탭으로 자동으로 옮겨지고,
 * 원래 탭은 "커피박_주간기록(v7 백업)" 으로 이름만 바뀌어 남습니다. 확인 후 지워도 됩니다.
 * 새 사진은 "커피박_현장사진/목장이름" 폴더에 저장됩니다.
 *
 * [v7] 파봉 작업 사진 — 시트의 "사진 1~3" 칸에 썸네일, "사진 링크" 칸에 원본 링크.
 * 사진은 링크가 있는 사람만 볼 수 있게 공유됩니다(썸네일 표시에 필요).
 * 앱에서 기록을 지우면 그 기록의 사진은 드라이브 휴지통으로 이동합니다(30일 안에 복구 가능).
 */

// 앱이 이 값을 보고 스크립트가 최신인지 판단한다. 코드를 고치면 반드시 올릴 것.
var SCRIPT_VERSION = 11;

var SHEET_PREFIX = "주간기록_";
var LEGACY_SHEET = "커피박_주간기록";
var LEGACY_BACKUP = "커피박_주간기록(v7 백업)";
var PHOTO_FOLDER_NAME = "커피박_현장사진";
var HEADERS = [
  "측정 일시", "목장", "하역 장소", "수거량(kg)", "심부 온도(℃)", "심부 함수율(%)",
  "외기 온도(℃)", "외기 습도(%)", "직전 대비 심부온도(℃)", "직전 대비 함수율(%p)",
  "판정", "비고", "심부 온도 3지점(℃)", "심부 함수율 3지점(%)",
  "사진 1", "사진 2", "사진 3", "사진 링크", "레코드 키"
];
var LOCATION_COL = 3;
var VERDICT_COL = 11;
var POINTS_COL = 13;   // 심부 온도 3지점 / 그 다음 칸이 함수율 3지점
var PHOTO_COL = 15;
var PHOTO_SLOTS = 3;
var LINK_COL = 18;
var KEY_COL = 19;
// v9 까지의 탭 모양 (17열, 마지막이 레코드 키) — 3지점 칸을 끼워 넣을 때만 쓴다
var V9_COLUMN_COUNT = 17;
var V9_LINK_INDEX = 15;
var V9_KEY_INDEX = 16;
var V6_KEY_INDEX = 12;
var PHOTO_ROW_HEIGHT = 90;
var DEFAULT_ROW_HEIGHT = 21;

// 입력 검사 — 웹 앱은 주소만 알면 누구나 호출할 수 있으므로 들어온 값을 그대로 믿지 않는다
var FILE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;
var DATETIME_RE = /^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$/;
var MAX_PHOTO_BYTES = 5 * 1024 * 1024;
var MAX_PHOTO_IDS = 10;

/** 처음 한 번 편집기에서 실행해 드라이브 권한을 허용하세요 */
function setupPhotoFolder() {
  var folder = getPhotoFolder();
  Logger.log("사진 폴더 준비 완료: " + folder.getUrl());
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return jsonResponse({
        status: "error",
        message: "스프레드시트를 찾을 수 없습니다. 스프레드시트 상단 [확장 프로그램 > Apps Script]에서 작성해주세요."
      });
    }

    var action = (e && e.parameter && e.parameter.action) || "ping";

    // 앱이 실행될 때 모든 목장 탭의 기록을 읽어간다. 시트가 원본이고 앱은 화면이다.
    if (action === "load") {
      // 옮길 예전 탭이 있을 때만 잠금을 잡는다 (평소 불러오기는 기다리지 않게)
      if (ss.getSheetByName(LEGACY_SHEET)) withLock(function () { migrateLegacySheet(ss); });
      var records = [];
      var sheets = listRecordSheets(ss);
      for (var i = 0; i < sheets.length; i++) records = records.concat(readRecords(sheets[i]));
      return jsonResponse({
        status: "success",
        spreadsheetTitle: ss.getName(),
        records: records,
        loadedAt: fieldNow()
      });
    }

    return jsonResponse({
      status: "success",
      message: "구글 시트 연동 웹 앱이 정상 동작 중입니다!",
      spreadsheetTitle: ss.getName(),
      connectedAt: fieldNow()
    });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);

    var contents = e && e.postData ? e.postData.contents : "";
    if (!contents) {
      return jsonResponse({ status: "error", message: "전송된 데이터가 없습니다." });
    }

    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return jsonResponse({
        status: "error",
        message: "스프레드시트가 연결되지 않았습니다. 스프레드시트 안에서 [확장 프로그램 > Apps Script]로 실행해주세요."
      });
    }

    // 1. 연결 테스트 핑
    if (data.isTest) {
      return jsonResponse({
        status: "success",
        message: "구글 시트 웹 앱과 정상 연결되었습니다!",
        spreadsheetTitle: ss.getName()
      });
    }

    migrateLegacySheet(ss);

    // 2. 기록 한 건 저장 (같은 레코드 키면 갱신). 새 사진이 있으면 드라이브에 먼저 올린다.
    if (data.eventType === "record_saved") {
      if (!data.recordKey) {
        return jsonResponse({ status: "error", message: "레코드 키가 없어 기록하지 않았습니다." });
      }

      var uploaded = [];
      if (isArray(data.newPhotos) && data.newPhotos.length > 0) {
        try {
          uploaded = savePhotos(data.newPhotos, data.ranchName);
        } catch (photoErr) {
          return jsonResponse({
            status: "error",
            message: "사진을 드라이브에 저장하지 못했습니다. Apps Script 편집기에서 setupPhotoFolder 를 실행해 권한을 허용했는지 확인해주세요. (" + photoErr + ")"
          });
        }
      }
      data.photoIds = toIdList(data.photoIds).concat(uploaded);

      var sheet = getRecordSheet(ss, data.ranchName);
      var single = upsertRows(sheet, [data]);
      tidySheet(sheet);
      return jsonResponse({
        status: "success",
        message: (single.updated > 0 ? "같은 날짜의 기존 행을 최신 값으로 갱신했습니다." : "기록이 시트에 추가되었습니다.") +
          " (" + sheet.getName() + ")" +
          (uploaded.length > 0 ? " 사진 " + uploaded.length + "장 저장" : ""),
        inserted: single.inserted,
        updated: single.updated,
        photoIds: data.photoIds
      });
    }

    // 3. 일괄 동기화 — 목장별 탭으로 나눠 upsert (중복이 생기지 않음)
    if (data.eventType === "bulk_records" && isArray(data.items)) {
      var groups = {};
      for (var g = 0; g < data.items.length; g++) {
        var name = ranchSheetName(data.items[g].ranchName);
        (groups[name] = groups[name] || { ranch: data.items[g].ranchName, items: [] }).items.push(data.items[g]);
      }
      var inserted = 0;
      var updated = 0;
      for (var key in groups) {
        if (!groups.hasOwnProperty(key)) continue;
        var groupSheet = getRecordSheet(ss, groups[key].ranch);
        var res = upsertRows(groupSheet, groups[key].items);
        tidySheet(groupSheet);
        inserted += res.inserted;
        updated += res.updated;
      }
      return jsonResponse({
        status: "success",
        message: "기록 " + data.items.length + "건을 시트와 일치시켰습니다. (신규 " + inserted + "건 / 갱신 " + updated + "건)",
        count: data.items.length,
        inserted: inserted,
        updated: updated
      });
    }

    // 4. 기록 삭제 — 그 기록의 사진은 드라이브 휴지통으로
    if (data.eventType === "record_deleted") {
      var sheets = listRecordSheets(ss);
      for (var s = 0; s < sheets.length; s++) {
        var rowIdx = readKeyMap(sheets[s])[data.recordKey || ""];
        if (rowIdx) {
          trashFiles(parsePhotoIds(sheets[s].getRange(rowIdx, LINK_COL).getValue()));
          sheets[s].deleteRow(rowIdx);
          return jsonResponse({ status: "success", message: "기록이 시트에서 삭제되었습니다. (" + sheets[s].getName() + ")" });
        }
      }
      return jsonResponse({ status: "success", message: "시트에 해당 기록이 없어 건너뛰었습니다." });
    }

    // 5. 전체 삭제 — 모든 목장 탭의 데이터 행을 비운다 (헤더는 유지). 사진도 휴지통으로.
    if (data.eventType === "clear_all") {
      var cleared = 0;
      var all = listRecordSheets(ss);
      for (var c = 0; c < all.length; c++) {
        var last = all[c].getLastRow();
        if (last < 2) continue;
        var links = all[c].getRange(2, LINK_COL, last - 1, 1).getValues();
        for (var l = 0; l < links.length; l++) trashFiles(parsePhotoIds(links[l][0]));
        all[c].deleteRows(2, last - 1);
        cleared += last - 1;
      }
      return jsonResponse({ status: "success", message: "시트를 비웠습니다 (" + cleared + "행)", cleared: cleared });
    }

    return jsonResponse({
      status: "error",
      message: "이 스크립트가 처리할 수 없는 요청입니다: " + (data.eventType || "알 수 없음") +
        ". 앱의 [연동 마법사]에서 최신 스크립트를 복사해 붙여넣고 [배포 관리 > 새 버전]으로 재배포해주세요."
    });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function withLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* ───────────── 목장별 탭 ───────────── */

/** 목장 이름 → 탭 이름. 시트 이름에 쓰기 곤란한 문자는 공백으로 바꾼다. */
function ranchSheetName(ranchName) {
  var clean = String(ranchName || "").replace(/[\\[\\]*?\\/\\\\:'"]/g, " ").replace(/\\s+/g, " ").trim();
  return (SHEET_PREFIX + (clean || "목장 미지정")).slice(0, 100);
}

function listRecordSheets(ss) {
  var out = [];
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().indexOf(SHEET_PREFIX) !== 0) continue;
    // 읽기 전에 모양부터 맞춘다 — 안 그러면 예전 탭의 사진·레코드 키를 한 칸씩 밀려 읽는다
    upgradeSheetShape(sheets[i]);
    out.push(sheets[i]);
  }
  return out;
}

/** v9 까지의 탭(17열)이면 "비고" 뒤에 3지점 칸 두 개를 끼워 넣는다 (기존 값은 오른쪽으로 밀린다) */
function upgradeSheetShape(sheet) {
  if (sheet.getLastColumn() === V9_COLUMN_COUNT &&
      String(sheet.getRange(1, V9_COLUMN_COUNT).getValue()) === "레코드 키") {
    sheet.insertColumnsBefore(POINTS_COL, 2);
    ensureHeaders(sheet);
  }
}

/** 목장 탭 확보 — 없으면 만들고, 헤더가 다르면 최신본으로 맞춘다 */
function getRecordSheet(ss, ranchName) {
  var name = ranchSheetName(ranchName);
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  upgradeSheetShape(sheet);
  ensureHeaders(sheet);
  return sheet;
}

function ensureHeaders(sheet) {
  // 격자 칸이 모자라면 먼저 늘린다 (칸을 지워 좁아진 탭에서 범위 오류가 나지 않도록)
  var short = HEADERS.length - sheet.getMaxColumns();
  if (short > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), short);

  var current = sheet.getLastColumn() > 0 ? sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0] : [];
  var changed = false;
  for (var c = 0; c < HEADERS.length; c++) {
    if (String(current[c] || "") !== HEADERS[c]) changed = true;
  }
  if (!changed) return;

  var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setValues([HEADERS]);
  headerRange.setBackground("#2e4a2b").setFontColor("#ffffff").setFontWeight("bold");
  headerRange.setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.setRowHeight(1, 35);
  sheet.setFrozenRows(1);
  // 측정 일시가 날짜로 자동 변환되지 않도록 텍스트로 고정 (정렬도 글자 순서로 정확해진다)
  sheet.getRange("A:A").setNumberFormat("@");
  sheet.setColumnWidths(PHOTO_COL, PHOTO_SLOTS, 120);
}

/**
 * v7 까지 쓰던 한 탭("커피박_주간기록")의 기록을 목장별 탭으로 옮긴다.
 * 옮긴 뒤 원래 탭은 지우지 않고 이름만 바꿔 백업으로 남긴다. 한 번만 실행된다.
 */
function migrateLegacySheet(ss) {
  var legacy = ss.getSheetByName(LEGACY_SHEET);
  if (!legacy) return;

  // v6 시트(13열)는 사진 칸이 없어 레코드 키 위치가 다르다
  var width = legacy.getLastColumn();
  var isV6 = width === 13 && String(legacy.getRange(1, 13).getValue()) === "레코드 키";
  var last = legacy.getLastRow();

  if (last >= 2) {
    var rows = legacy.getRange(2, 1, last - 1, Math.max(width, HEADERS.length)).getValues();
    var groups = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var dt = toDateTimeString(r[0]);
      if (!dt) continue;
      var ranch = String(r[1] || "").trim();
      var location = String(r[2] || "").trim();
      var item = {
        dateTime: dt,
        ranchName: ranch,
        location: location,
        collectedKg: r[3],
        coreTemp: r[4],
        moisture: r[5],
        ambientTemp: r[6],
        ambientHum: r[7],
        coreTempDelta: r[8],
        moistureDelta: r[9],
        verdictTitle: r[10],
        notes: r[11],
        photoIds: isV6 ? [] : parsePhotoIds(r[V9_LINK_INDEX]),
        recordKey: String((isV6 ? r[V6_KEY_INDEX] : r[V9_KEY_INDEX]) || "") || (ranch + "|" + location + "|" + dt.slice(0, 10))
      };
      var name = ranchSheetName(ranch);
      (groups[name] = groups[name] || { ranch: ranch, items: [] }).items.push(item);
    }
    for (var key in groups) {
      if (!groups.hasOwnProperty(key)) continue;
      var sheet = getRecordSheet(ss, groups[key].ranch);
      upsertRows(sheet, groups[key].items);
      tidySheet(sheet);
    }
  }

  var backupName = LEGACY_BACKUP;
  for (var n = 2; ss.getSheetByName(backupName); n++) backupName = LEGACY_BACKUP + " " + n;
  legacy.setName(backupName);
}

/* ───────────── 사진 (구글 드라이브) ───────────── */

/** 스프레드시트와 같은 폴더 안에 사진 폴더를 한 번 만들고, 그 뒤로는 계속 같은 폴더를 쓴다 */
function getPhotoFolder() {
  var props = PropertiesService.getScriptProperties();
  var savedId = props.getProperty("PHOTO_FOLDER_ID");
  if (savedId) {
    try {
      var saved = DriveApp.getFolderById(savedId);
      if (!saved.isTrashed()) return saved;
    } catch (e) {
      // 폴더가 지워졌으면 새로 만든다
    }
  }

  var parent = DriveApp.getRootFolder();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    var parents = DriveApp.getFileById(ss.getId()).getParents();
    if (parents.hasNext()) parent = parents.next();
  }

  var folder = getOrCreateFolder(parent, PHOTO_FOLDER_NAME);
  props.setProperty("PHOTO_FOLDER_ID", folder.getId());
  return folder;
}

function getOrCreateFolder(parent, name) {
  var existing = parent.getFoldersByName(name);
  return existing.hasNext() ? existing.next() : parent.createFolder(name);
}

/**
 * base64 사진들을 목장별 폴더에 저장하고 파일 ID 목록을 돌려준다.
 * 웹 앱은 주소만 알면 누구나 호출할 수 있고 사진은 링크 공유로 올라가므로,
 * 사진이 아닌 파일이 드라이브에 공개로 올라가지 않도록 장수·용량·JPEG 여부를 확인한다.
 */
function savePhotos(photos, ranchName) {
  if (photos.length > PHOTO_SLOTS) {
    throw new Error("사진은 한 번에 " + PHOTO_SLOTS + "장까지 올릴 수 있습니다.");
  }
  var folder = getOrCreateFolder(getPhotoFolder(), ranchSheetName(ranchName).slice(SHEET_PREFIX.length));
  var ids = [];
  for (var i = 0; i < photos.length; i++) {
    var p = photos[i];
    if (!p || !p.base64) continue;
    var bytes = Utilities.base64Decode(String(p.base64));
    if (bytes.length > MAX_PHOTO_BYTES) throw new Error("사진 용량이 너무 큽니다.");
    // JPEG 시그니처(FF D8 FF). base64Decode 는 부호 있는 바이트를 주므로 & 0xff 로 비교한다.
    if (bytes.length < 3 || (bytes[0] & 0xff) !== 0xff || (bytes[1] & 0xff) !== 0xd8 || (bytes[2] & 0xff) !== 0xff) {
      throw new Error("JPEG 사진만 올릴 수 있습니다.");
    }
    var blob = Utilities.newBlob(bytes, "image/jpeg", safeFileName(p.fileName, i));
    var file = folder.createFile(blob);
    try {
      // 시트의 썸네일(IMAGE 함수)과 앱 미리보기가 보이려면 링크 공유가 필요하다
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      // 조직 정책으로 공유가 막혀 있어도 파일 저장과 링크는 유지한다
    }
    ids.push(file.getId());
  }
  return ids;
}

function trashFiles(ids) {
  for (var i = 0; i < ids.length; i++) {
    try {
      DriveApp.getFileById(ids[i]).setTrashed(true);
    } catch (e) {
      // 이미 지워졌거나 권한이 없으면 건너뛴다
    }
  }
}

/**
 * 드라이브 파일 ID 목록. 형식에 맞는 ID 만 받는다 —
 * ID 는 썸네일 IMAGE 수식 안에 들어가므로, 검사하지 않으면 수식을 끼워 넣어 시트 내용을 밖으로 빼낼 수 있다.
 */
function toIdList(v) {
  if (!isArray(v)) return [];
  var out = [];
  for (var i = 0; i < v.length && out.length < MAX_PHOTO_IDS; i++) {
    var id = String(v[i] || "").trim();
    if (FILE_ID_RE.test(id)) out.push(id);
  }
  return out;
}

function safeFileName(name, index) {
  var clean = String(name || "").replace(/[\\\\/:*?"<>|\\u0000-\\u001f]/g, "_").trim().slice(0, 120);
  if (!clean) clean = "photo_" + index;
  return /\\.jpe?g$/i.test(clean) ? clean : clean + ".jpg";
}

/** =, +, -, @ 로 시작하는 글자는 시트가 수식으로 해석하므로 앞에 ' 를 붙여 글자로 저장한다 */
function safeText(v) {
  var s = String(v === null || v === undefined ? "" : v);
  return s.length > 1 && /^[=+\\-@]/.test(s) ? "'" + s : s;
}

function safeNumber(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

/** "사진 링크" 칸의 드라이브 링크들에서 파일 ID 를 뽑는다 */
function parsePhotoIds(text) {
  var ids = [];
  var re = /\\/d\\/([A-Za-z0-9_-]{10,})/g;
  var m;
  while ((m = re.exec(String(text || ""))) !== null) ids.push(m[1]);
  return ids;
}

function viewUrl(id) {
  return "https://drive.google.com/file/d/" + id + "/view";
}

function thumbnailFormula(id) {
  return id ? '=IMAGE("https://drive.google.com/thumbnail?id=' + id + '&sz=w400")' : "";
}

/* ───────────── 행 읽기·쓰기 ───────────── */

/** 셀 값이 Date 든 문자열이든 'YYYY-MM-DD HH:mm' 로 통일 */
function toDateTimeString(v) {
  if (!v && v !== 0) return "";
  if (Object.prototype.toString.call(v) === "[object Date]") {
    return Utilities.formatDate(v, "Asia/Seoul", "yyyy-MM-dd HH:mm");
  }
  return String(v).trim();
}

function fieldNow() {
  return Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm");
}

function readRecords(sheet) {
  if (sheet.getLastRow() < 2) return [];

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
  var out = [];

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var dt = toDateTimeString(r[0]);
    if (!dt) continue;

    out.push({
      date: dt.slice(0, 10),
      time: dt.length >= 16 ? dt.slice(11, 16) : "",
      ranchName: String(r[1] || "").trim(),
      location: String(r[2] || "").trim(),
      collectedKg: Number(r[3]) || 0,
      coreTemp: Number(r[4]) || 0,
      moisture: Number(r[5]) || 0,
      ambientTemp: Number(r[6]) || 0,
      ambientHum: Number(r[7]) || 0,
      notes: String(r[11] || ""),
      coreTempPoints: String(r[POINTS_COL - 1] || ""),
      moisturePoints: String(r[POINTS_COL] || ""),
      photoIds: parsePhotoIds(r[LINK_COL - 1]),
      recordKey: String(r[KEY_COL - 1] || "")
    });
  }

  return out;
}

/** 레코드 키 기준으로 기존 행을 갱신하거나 새로 추가 */
function upsertRows(sheet, items) {
  var keyMap = readKeyMap(sheet);
  var pending = [];
  var pendingIndex = {};
  var inserted = 0;
  var updated = 0;

  for (var i = 0; i < items.length; i++) {
    var row = formatRow(items[i]);
    var key = row.values[KEY_COL - 1];

    // 같은 요청 안에 같은 키가 또 나오면 대기 중인 행을 최신 값으로 교체
    if (pendingIndex.hasOwnProperty(key)) {
      pending[pendingIndex[key]] = row;
      continue;
    }

    var existing = keyMap[key];
    if (existing) {
      sheet.getRange(existing, 1, 1, HEADERS.length).setValues([row.values]);
      sheet.getRange(existing, PHOTO_COL, 1, PHOTO_SLOTS).setFormulas([row.formulas]);
      updated++;
    } else {
      pendingIndex[key] = pending.length;
      pending.push(row);
      inserted++;
    }
  }

  if (pending.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    var values = [];
    var formulas = [];
    for (var p = 0; p < pending.length; p++) {
      values.push(pending[p].values);
      formulas.push(pending[p].formulas);
    }
    sheet.getRange(startRow, 1, pending.length, HEADERS.length).setValues(values);
    sheet.getRange(startRow, PHOTO_COL, pending.length, PHOTO_SLOTS).setFormulas(formulas);
  }

  return { inserted: inserted, updated: updated };
}

/** 레코드 키 -> 행 번호 맵 */
function readKeyMap(sheet) {
  var map = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;

  var keys = sheet.getRange(2, KEY_COL, lastRow - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    var k = String(keys[i][0] || "");
    if (k) map[k] = i + 2;
  }
  return map;
}

/** 행 값(사진 칸은 비워 두고)과 사진 썸네일 수식을 따로 만든다 */
function formatRow(data) {
  var delta = function (v) { return (v === "" || v === null || v === undefined) ? "" : safeNumber(v); };
  var ids = toIdList(data.photoIds);
  var links = [];
  for (var i = 0; i < ids.length; i++) links.push(viewUrl(ids[i]));

  var formulas = [];
  for (var s = 0; s < PHOTO_SLOTS; s++) formulas.push(thumbnailFormula(ids[s]));

  // 외부에서 온 글자는 모두 safeText 로, 숫자는 safeNumber 로 넣는다 (수식 주입 방지)
  return {
    values: [
      DATETIME_RE.test(String(data.dateTime || "")) ? data.dateTime : fieldNow(),
      safeText(data.ranchName || "-"),
      safeText(data.location || "-"),
      safeNumber(data.collectedKg),
      safeNumber(data.coreTemp),
      safeNumber(data.moisture),
      safeNumber(data.ambientTemp),
      safeNumber(data.ambientHum),
      delta(data.coreTempDelta),
      delta(data.moistureDelta),
      safeText(data.verdictTitle || "-"),
      safeText(data.notes || ""),
      safeText(data.coreTempPoints || ""),
      safeText(data.moisturePoints || ""),
      "", "", "",
      links.join("\\n"),
      safeText(data.recordKey)
    ],
    formulas: formulas
  };
}

function verdictStyle(text) {
  text = String(text || "");
  if (text.indexOf("사용 가능") !== -1) return ["#e6f4ea", "#137333", "bold"];
  if (text.indexOf("혼합 필요") !== -1) return ["#fce8e6", "#c5221f", "bold"];
  if (text.indexOf("건조") !== -1) return ["#fef7e0", "#b06000", "bold"];
  return ["#e8f0fe", "#1a73e8", "normal"];
}

/**
 * 탭을 하역 장소 → 측정 일시 순으로 정렬하고 서식을 다시 입힌다.
 * 행 높이는 정렬해도 따라 움직이지 않으므로 사진이 있는 행을 다시 찾아 키운다.
 */
function tidySheet(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return;
  var n = last - 1;

  try {
    if (n > 1) {
      sheet.getRange(2, 1, n, HEADERS.length).sort([
        { column: LOCATION_COL, ascending: true },
        { column: 1, ascending: true }
      ]);
    }

    var verdicts = sheet.getRange(2, VERDICT_COL, n, 1).getValues();
    var links = sheet.getRange(2, LINK_COL, n, 1).getValues();
    var backgrounds = [];
    var colors = [];
    var weights = [];
    for (var i = 0; i < n; i++) {
      var st = verdictStyle(verdicts[i][0]);
      backgrounds.push([st[0]]);
      colors.push([st[1]]);
      weights.push([st[2]]);
    }
    var verdictRange = sheet.getRange(2, VERDICT_COL, n, 1);
    verdictRange.setBackgrounds(backgrounds).setFontColors(colors).setFontWeights(weights);

    sheet.setRowHeights(2, n, DEFAULT_ROW_HEIGHT);
    for (var r = 0; r < n; r++) {
      if (String(links[r][0] || "")) sheet.setRowHeight(r + 2, PHOTO_ROW_HEIGHT);
    }
  } catch (e) {
    // 정렬·서식 실패가 데이터 저장을 막지 않도록 무시
  }
}

function isArray(v) {
  return Object.prototype.toString.call(v) === "[object Array]";
}

/** JSON 반환 도우미 */
function jsonResponse(obj) {
  obj.scriptVersion = SCRIPT_VERSION;
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export const GOOGLE_SHEETS_GUIDE_STEPS = [
  {
    step: 1,
    title: "구글 스프레드시트 열기",
    desc: "기록을 모을 스프레드시트를 엽니다. 처음이면 sheets.new 로 새로 만들고, 이미 연결했다면 그 시트를 엽니다.",
  },
  {
    step: 2,
    title: "Apps Script 열기",
    desc: "스프레드시트 상단 메뉴 [확장 프로그램] > [Apps Script]를 클릭합니다.",
  },
  {
    step: 3,
    title: "코드 붙여넣기 및 저장",
    desc: "위의 [코드 복사]로 복사한 코드를, 편집기의 기존 내용을 모두 지운 뒤 붙여넣고 저장(Ctrl+S)합니다.",
  },
  {
    step: 4,
    title: "사진 권한 허용 (처음 한 번)",
    desc: "편집기 위쪽 함수 선택 칸에서 'setupPhotoFolder'를 고르고 [실행] → [권한 검토] → 계정 선택 → '확인되지 않은 앱' 경고가 나오면 [고급] → [이동] → [허용]을 누릅니다. 이미 허용했다면 건너뜁니다.",
  },
  {
    step: 5,
    title: "웹 앱 배포 (중요)",
    desc: "처음이면 [배포] > [새 배포] > 유형 [웹 앱], '액세스 권한이 있는 사용자'를 [모든 사용자]로 지정합니다. 이미 배포했다면 [배포 관리] > 연필 > 버전 [새 버전] > [배포]로 재배포해야 URL이 그대로 유지됩니다.",
  },
  {
    step: 6,
    title: "URL 등록 완료",
    desc: "웹 앱 URL을 아래 입력창에 붙여넣으면, 기록을 저장할 때마다 '주간기록_목장이름' 탭에 목장별로 쌓입니다.",
  },
];
