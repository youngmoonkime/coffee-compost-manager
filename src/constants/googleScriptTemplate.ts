/**
 * 구글 스프레드시트 Apps Script 연동 템플릿 코드 및 안내 가이드
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * 커피박 부숙 관리 시스템 - 구글 스프레드시트 실시간 연동 Web App (v2)
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
 * [v2 변경점 - 중요]
 * 앱은 (배치, 경과 일차)당 계측 기록을 1건만 보관합니다.
 * 이 스크립트도 "레코드 키" 열을 기준으로 행을 갱신(upsert)하므로,
 * 같은 날 여러 번 저장하거나 일괄 동기화를 반복해도 시트에 중복 행이 쌓이지 않고
 * 앱의 [최근 계측 기록]과 시트 내용이 항상 일치합니다.
 */

// 앱이 이 값을 보고 스크립트가 최신인지 판단한다. 코드를 고치면 반드시 올릴 것.
var SCRIPT_VERSION = 2;

var MEASURE_SHEET = "커피박_부숙일지";
var BATCH_SHEET = "배치_관리현황";
var MEASURE_HEADERS = [
  "기록 일시", "배치 코드", "목장명", "경과 일차", "심부 온도(℃)", "심부 함수율(%)",
  "외기 온도(℃)", "외기 습도(%)", "온도차(℃)", "부숙 판정", "비고", "레코드 키"
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
    return jsonResponse({
      status: "success",
      message: "구글 시트 연동 웹 앱이 정상 동작 중입니다!",
      spreadsheetTitle: ss.getName(),
      connectedAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
    });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
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
    Number(data.tempDiff || 0),
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

  if (sheet.getLastColumn() < MEASURE_HEADERS.length) {
    sheet.getRange(1, 1, 1, MEASURE_HEADERS.length).setValues([MEASURE_HEADERS]);
    sheet.getRange(1, 1, 1, MEASURE_HEADERS.length)
      .setBackground("#2e4a2b").setFontColor("#ffffff").setFontWeight("bold");

    // 키가 비어 있는 기존 행은 배치 코드 + 일차로 키를 복구
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
