/**
 * 구글 스프레드시트 Apps Script 연동 템플릿 코드 및 안내 가이드
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * 커피박 부숙 관리 시스템 - 구글 스프레드시트 실시간 연동 Web App (v5)
 * =========================================================================
 * [간편 1분 설정 방법]
 * 1. 구글 스프레드시트 새 문서(sheets.new)를 만듭니다.
 * 2. 상단 메뉴 [확장 프로그램] > [Apps Script]를 클릭합니다.
 * 3. 기본 내용을 모두 지우고 이 코드를 그대로 붙여넣은 뒤 저장(Ctrl+S)합니다.
 * 4. 우측 상단 [배포] > [새 배포] 클릭
 *    - 유형 선택: [웹 앱]
 *    - 다음 사용자로 실행: [나 (내 계정)]
 *    - 액세스 권한이 있는 사용자: [모든 사용자 (Anyone)]  ★필수 선택★
 * 5. [배포] 버튼 클릭 후 생성된 "웹 앱 URL"을 복사하여 앱에 입력하세요.
 *
 * ※ 코드를 고쳤다면 반드시 [배포] > [배포 관리] > 연필(수정) > 버전 [새 버전]
 *    으로 다시 배포해야 변경 내용이 반영됩니다.
 *
 * [중요]
 * 앱은 (배치, 경과 일차)당 계측 기록을 1건만 보관합니다.
 * 이 스크립트도 "레코드 키" 열을 기준으로 행을 갱신(upsert)하므로,
 * 같은 날 여러 번 저장하거나 일괄 동기화를 반복해도 시트에 중복 행이 쌓이지 않고
 * 앱의 [최근 계측 기록]과 시트 내용이 항상 일치합니다.
 *
 * [v5 변경점]
 * 앱에서 배치를 지우거나 전체 삭제하면 시트에서도 해당 행이 지워집니다.
 * 앱의 모든 추가·수정·삭제가 시트에 그대로 반영됩니다.
 *
 * [v4 변경점]
 * 앱이 실행될 때 시트에서 배치·계측 기록을 통째로 읽어옵니다(백엔드 역할).
 * 어느 기기에서 접속하든 같은 시트를 보게 됩니다.
 *
 * [v3 변경점]
 * '온도차(℃)' 열이 '직전 대비 심부온도(℃)' 로 바뀌었습니다.
 * 심부온도는 외기와 비교하는 값이 아니라, 같은 더미를 기간을 두고 다시 재서
 * 추이를 보는 값이기 때문입니다. 기존 시트의 헤더는 자동으로 갱신됩니다.
 */

// 앱이 이 값을 보고 스크립트가 최신인지 판단한다. 코드를 고치면 반드시 올릴 것.
var SCRIPT_VERSION = 5;

var MEASURE_SHEET = "커피박_부숙일지";
var BATCH_SHEET = "배치_관리현황";
var MEASURE_HEADERS = [
  "기록 일시", "배치 코드", "목장명", "경과 일차", "심부 온도(℃)", "심부 함수율(%)",
  "외기 온도(℃)", "외기 습도(%)", "직전 대비 심부온도(℃)", "부숙 판정", "비고", "레코드 키"
];
var VERDICT_COL = 10;
var KEY_COL = 12;

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

    // 앱이 실행될 때 시트의 내용을 그대로 읽어간다. 시트가 원본이고 앱은 화면이다.
    if (action === "load") {
      return jsonResponse({
        status: "success",
        spreadsheetTitle: ss.getName(),
        batches: readBatches(ss),
        measurements: readMeasurements(ss),
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

/** 셀 값이 Date 든 문자열이든 'YYYY-MM-DD' 로 통일 */
function toDateString(v) {
  if (!v && v !== 0) return "";
  if (Object.prototype.toString.call(v) === "[object Date]") {
    return Utilities.formatDate(v, "Asia/Seoul", "yyyy-MM-dd");
  }
  return String(v).trim().slice(0, 10);
}

/** 셀 값을 'YYYY-MM-DD HH:mm' 로 통일 */
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

/**
 * 배치_관리현황 은 이벤트 로그다. 신규 하역 -> 수거량 수정 -> 완숙 완료 순으로
 * 다시 재생(replay)해서 각 배치의 현재 상태를 복원한다.
 */
function readBatches(ss) {
  var sheet = ss.getSheetByName(BATCH_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  var byCode = {};
  var order = [];

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var event = String(r[0] || "");
    var code = String(r[2] || "").trim();
    if (!code || code === "-") continue;

    if (!byCode[code]) {
      byCode[code] = {
        code: code,
        ranchName: "",
        startDate: "",
        initialWeightKg: 0,
        status: "fermenting",
        notes: ""
      };
      order.push(code);
    }

    var b = byCode[code];
    var ranch = String(r[3] || "").trim();
    if (ranch && ranch !== "-") b.ranchName = ranch;

    var start = toDateString(r[4]);
    if (start && start !== "-") b.startDate = start;

    if (r[5] !== "" && r[5] !== null && r[5] !== undefined) {
      var kg = Number(r[5]);
      if (!isNaN(kg)) b.initialWeightKg = kg;
    }

    var note = String(r[7] || "").trim();
    if (note) b.notes = note;

    if (event.indexOf("완숙") !== -1) {
      b.status = "completed";
      b.completedDate = toDateString(r[1]);
    }
  }

  var out = [];
  for (var j = 0; j < order.length; j++) out.push(byCode[order[j]]);
  return out;
}

/** 커피박_부숙일지는 recordKey 로 upsert 되는 상태 표라 그대로 읽으면 된다 */
function readMeasurements(ss) {
  var sheet = ss.getSheetByName(MEASURE_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var width = Math.max(sheet.getLastColumn(), MEASURE_HEADERS.length);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
  var out = [];

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var code = String(r[1] || "").trim();
    var day = Number(String(r[3] || "").replace("D+", "").trim());
    if (!code || code === "-" || !day) continue;

    var dt = toDateTimeString(r[0]);
    var delta = r[8];

    out.push({
      recordKey: String(r[11] || "") || (code + "|D" + day),
      batchCode: code,
      ranchName: String(r[2] || ""),
      dayNumber: day,
      date: dt.slice(0, 10),
      time: dt.length >= 16 ? dt.slice(11, 16) : "",
      coreTemp: Number(r[4]) || 0,
      moisture: Number(r[5]) || 0,
      ambientTemp: Number(r[6]) || 0,
      ambientHum: Number(r[7]) || 0,
      coreTempDelta: (delta === "" || delta === null || delta === undefined) ? null : Number(delta),
      notes: String(r[10] || "")
    });
  }

  return out;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

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

    // 2. 배치 이벤트 (신규 하역 / 완숙 완료 / 수거량 수정)
    if (data.eventType === "batch_created" ||
        data.eventType === "batch_completed" ||
        data.eventType === "batch_updated") {
      var batchSheet = getOrCreateSheet(ss, BATCH_SHEET, [
        "이벤트", "등록 일시", "배치 코드", "목장명", "하역 일자", "커피박 수거량(kg)", "현재 상태", "비고"
      ], "#1e3a29");

      batchSheet.appendRow([
        data.eventType === "batch_created" ? "신규 하역"
          : data.eventType === "batch_completed" ? "완숙 완료"
          : "수거량 수정",
        data.timestamp || new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        data.batchCode || "-",
        data.ranchName || "-",
        data.startDate || "-",
        Number(data.initialWeightKg || 0),
        data.status === "completed" ? "완숙 완료" : "부숙 진행 중",
        data.notes || ""
      ]);

      return jsonResponse({
        status: "success",
        message: "배치 정보가 스프레드시트에 반영되었습니다.",
        sheet: BATCH_SHEET
      });
    }

    // 2-1. 배치 삭제 -> 그 배치의 계측 행과 배치 이벤트 행을 모두 제거
    if (data.eventType === "batch_deleted") {
      var delCode = String(data.batchCode || "").trim();
      if (!delCode) {
        return jsonResponse({ status: "error", message: "삭제할 배치 코드가 없습니다." });
      }
      var removedLogs = deleteRowsByColumn(ss, MEASURE_SHEET, 2, delCode);
      var removedEvents = deleteRowsByColumn(ss, BATCH_SHEET, 3, delCode);
      return jsonResponse({
        status: "success",
        message: delCode + " 삭제 (계측 " + removedLogs + "행 / 배치 이력 " + removedEvents + "행)",
        removed: removedLogs + removedEvents
      });
    }

    // 2-2. 전체 삭제 -> 두 시트의 데이터 행을 모두 비운다 (헤더는 유지)
    if (data.eventType === "clear_all") {
      var clearedLogs = clearDataRows(ss, MEASURE_SHEET);
      var clearedEvents = clearDataRows(ss, BATCH_SHEET);
      return jsonResponse({
        status: "success",
        message: "시트를 비웠습니다 (계측 " + clearedLogs + "행 / 배치 이력 " + clearedEvents + "행)",
        cleared: clearedLogs + clearedEvents
      });
    }

    var logSheet = getMeasureSheet(ss);

    // 3. 앱에서 계측 기록 삭제 -> 시트에서도 해당 행 제거
    if (data.eventType === "measurement_deleted") {
      var rowIdx = findRowByKey(logSheet, data.recordKey || "");
      if (rowIdx > 0) {
        logSheet.deleteRow(rowIdx);
        return jsonResponse({ status: "success", message: "계측 기록이 시트에서 삭제되었습니다.", row: rowIdx });
      }
      return jsonResponse({ status: "success", message: "시트에 해당 기록이 없어 건너뛰었습니다." });
    }

    // 4. 일괄 동기화 (모두 upsert 이므로 중복이 생기지 않음)
    if (data.isBulk && isArray(data.items)) {
      var bulk = upsertRows(logSheet, data.items);
      return jsonResponse({
        status: "success",
        message: "계측 기록 " + data.items.length + "건을 시트와 일치시켰습니다. (신규 " +
          bulk.inserted + "건 / 갱신 " + bulk.updated + "건)",
        count: data.items.length,
        inserted: bulk.inserted,
        updated: bulk.updated
      });
    }

    // 5. 방어: 계측 데이터가 아닌 페이로드가 부숙일지에 잘못 기록되는 것을 막는다.
    //    (앱은 새 이벤트를 보내는데 스크립트가 구버전이면 D+0 / 값 0 인 쓰레기 행이 생겼다)
    if (data.eventType) {
      return jsonResponse({
        status: "error",
        message: "이 스크립트가 처리할 수 없는 이벤트입니다: " + data.eventType +
          ". 앱의 [연동 마법사]에서 최신 스크립트를 복사해 붙여넣고 [배포 관리 > 새 버전]으로 재배포해주세요."
      });
    }
    if (data.dayNumber === undefined || data.dayNumber === null) {
      return jsonResponse({
        status: "error",
        message: "계측 데이터 형식이 아닙니다(경과 일차 누락). 시트에 기록하지 않았습니다."
      });
    }

    // 6. 실시간 단일 계측 데이터 upsert
    var single = upsertRows(logSheet, [data]);
    return jsonResponse({
      status: "success",
      message: single.updated > 0
        ? "같은 일차의 기존 행을 최신 값으로 갱신했습니다."
        : "실시간 계측 데이터가 시트에 추가되었습니다.",
      inserted: single.inserted,
      updated: single.updated
    });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

/** recordKey 기준으로 기존 행을 갱신하거나 새로 추가 */
function upsertRows(sheet, items) {
  var keyMap = readKeyMap(sheet);
  var pending = [];
  var pendingIndex = {};
  var inserted = 0;
  var updated = 0;
  var baseRow = sheet.getLastRow();

  for (var i = 0; i < items.length; i++) {
    var row = formatMeasurementRow(items[i]);
    var key = row[KEY_COL - 1];

    // 같은 요청 안에 중복 키가 또 나온 경우: 아직 시트에 쓰기 전이므로
    // 대기 배열의 값을 최신 값으로 교체한다. (시트에 직접 쓰면 아래 일괄
    // 기록 때 예전 값으로 덮여버린다.)
    if (pendingIndex.hasOwnProperty(key)) {
      pending[pendingIndex[key]] = row;
      continue;
    }

    var existing = keyMap[key];
    if (existing) {
      sheet.getRange(existing, 1, 1, row.length).setValues([row]);
      styleVerdictCell(sheet, existing);
      updated++;
    } else {
      pendingIndex[key] = pending.length;
      pending.push(row);
      inserted++;
    }
  }

  if (pending.length > 0) {
    var startRow = baseRow + 1;
    sheet.getRange(startRow, 1, pending.length, MEASURE_HEADERS.length).setValues(pending);
    for (var r = 0; r < pending.length; r++) {
      styleVerdictCell(sheet, startRow + r);
    }
  }

  return { inserted: inserted, updated: updated };
}

/** 시트의 데이터 행을 모두 지운다 (헤더 행은 남긴다). 지운 행 수를 반환. */
function clearDataRows(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 0;
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  sheet.deleteRows(2, last - 1);
  return last - 1;
}

/** 특정 열의 값이 일치하는 행을 모두 삭제. 지운 행 수를 반환. */
function deleteRowsByColumn(ss, sheetName, col, value) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 0;
  var last = sheet.getLastRow();
  if (last < 2) return 0;

  var vals = sheet.getRange(2, col, last - 1, 1).getValues();
  var removed = 0;

  // 아래에서 위로 지워야 남은 행의 번호가 밀리지 않는다
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0] || "").trim() === value) {
      sheet.deleteRow(i + 2);
      removed++;
    }
  }
  return removed;
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

function findRowByKey(sheet, key) {
  if (!key) return -1;
  var map = readKeyMap(sheet);
  return map[key] || -1;
}

/** 행 데이터 포맷 변환 */
function formatMeasurementRow(data) {
  var day = Number(data.dayNumber || 0);
  var key = data.recordKey || ((data.batchCode || "-") + "|D" + day);
  return [
    data.dateTime || new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    data.batchCode || "-",
    data.ranchName || "-",
    "D+" + day,
    Number(data.coreTemp || 0),
    Number(data.moisture || 0),
    Number(data.ambientTemp || 0),
    Number(data.ambientHum || 0),
    data.coreTempDelta === "" || data.coreTempDelta === null || data.coreTempDelta === undefined
      ? ""
      : Number(data.coreTempDelta),
    data.verdictTitle || "-",
    data.notes || "",
    key
  ];
}

/** 부숙 판정 셀 색상 서식 */
function styleVerdictCell(sheet, row) {
  try {
    var cell = sheet.getRange(row, VERDICT_COL);
    var text = String(cell.getValue());
    if (text.indexOf("완숙") !== -1) {
      cell.setBackground("#e6f4ea").setFontColor("#137333").setFontWeight("bold");
    } else if (text.indexOf("교반") !== -1 || text.indexOf("위험") !== -1) {
      cell.setBackground("#fce8e6").setFontColor("#c5221f").setFontWeight("bold");
    } else {
      cell.setBackground("#e8f0fe").setFontColor("#1a73e8").setFontWeight("normal");
    }
  } catch (e) {
    // 서식 실패가 데이터 저장을 막지 않도록 무시
  }
}

/** 계측 일지 시트 확보 (구버전 11열 시트에는 "레코드 키" 열을 자동 보강) */
function getMeasureSheet(ss) {
  var sheet = getOrCreateSheet(ss, MEASURE_SHEET, MEASURE_HEADERS, "#2e4a2b");

  var lastCol = sheet.getLastColumn();
  var needsKeyBackfill = lastCol < MEASURE_HEADERS.length;

  // 열 수가 모자라거나 헤더 문구가 달라졌으면 헤더를 최신본으로 맞춘다.
  // (v3 에서 '온도차(℃)' -> '직전 대비 심부온도(℃)' 로 이름이 바뀌었다)
  var current = lastCol > 0 ? sheet.getRange(1, 1, 1, MEASURE_HEADERS.length).getValues()[0] : [];
  var headerChanged = needsKeyBackfill;
  for (var c = 0; c < MEASURE_HEADERS.length; c++) {
    if (String(current[c] || "") !== MEASURE_HEADERS[c]) headerChanged = true;
  }

  if (headerChanged) {
    var headerRange = sheet.getRange(1, 1, 1, MEASURE_HEADERS.length);
    headerRange.setValues([MEASURE_HEADERS]);
    headerRange.setBackground("#2e4a2b").setFontColor("#ffffff").setFontWeight("bold");
  }

  // 키가 비어 있는 기존 행은 배치 코드 + 일차로 키를 복구
  if (needsKeyBackfill) {
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var body = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
      var keys = [];
      for (var i = 0; i < body.length; i++) {
        var code = String(body[i][1] || "-");
        var day = Number(String(body[i][3] || "").replace("D+", "")) || 0;
        keys.push([code + "|D" + day]);
      }
      sheet.getRange(2, KEY_COL, keys.length, 1).setValues(keys);
    }
  }

  return sheet;
}

/** 시트가 없으면 생성하고 헤더 서식을 설정 */
function getOrCreateSheet(ss, sheetName, headers, headerColor) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground(headerColor || "#2e4a2b");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");
    headerRange.setVerticalAlignment("middle");
    sheet.setRowHeight(1, 35);
    sheet.setFrozenRows(1);

    for (var c = 1; c <= headers.length; c++) {
      sheet.autoResizeColumn(c);
    }
  }

  return sheet;
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
    title: "구글 스프레드시트 생성",
    desc: "Google Drive 또는 sheets.new에 접속하여 새 스프레드시트를 만듭니다.",
  },
  {
    step: 2,
    title: "Apps Script 열기",
    desc: "스프레드시트 상단 메뉴 [확장 프로그램] > [Apps Script]를 클릭합니다.",
  },
  {
    step: 3,
    title: "코드 붙여넣기 및 저장",
    desc: "제공된 스크립트 코드를 모두 복사하여 붙여넣고 저장(Ctrl+S)합니다.",
  },
  {
    step: 4,
    title: "웹 앱 배포 (중요)",
    desc: "우측 상단 [배포] > [새 배포] > 유형 [웹 앱] 선택 후, '액세스 권한이 있는 사용자'를 반드시 [모든 사용자(Anyone)]로 지정하고 배포합니다.",
  },
  {
    step: 5,
    title: "URL 등록 완료",
    desc: "발급된 '웹 앱 URL'을 복사하여 아래 입력창에 붙여넣으면 즉시 실시간 동기화가 활성화됩니다. 코드를 갱신했다면 [배포 관리]에서 '새 버전'으로 재배포해야 합니다.",
  },
];
