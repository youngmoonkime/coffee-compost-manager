/**
 * 구글 스프레드시트 Apps Script 연동 템플릿 코드 및 안내 가이드
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * 커피박 부숙 관리 시스템 - 구글 스프레드시트 연동 Web App (v23)
 * =========================================================================
 * [간편 설정 방법]
 * 1. 구글 스프레드시트 새 문서(sheets.new)를 만듭니다. (기존 시트를 계속 써도 됩니다)
 * 2. 상단 메뉴 [확장 프로그램] > [Apps Script]를 클릭합니다.
 * 3. 기본 내용을 모두 지우고 이 코드를 그대로 붙여넣은 뒤 저장(Ctrl+S)합니다.
 * 4. ★사진 권한★ 위쪽 함수 선택 칸에서 "setupPhotoFolder" 를 고르고 [실행]
 *    → [권한 검토] → 계정 선택 → (확인되지 않은 앱 경고가 나오면) [고급] → [이동] → [허용]
 *    (v7 에서 이미 허용했다면 건너뛰어도 됩니다)
 * 4-1. ★AI 권한★ 함수 선택 칸에서 "setupAiAccess" 를 고르고 [실행] → 같은 방법으로 [허용]
 *    (AI 리포트·설명이 Gemini 를 부르려면 "외부 서비스 연결" 권한이 필요합니다)
 * 5. 배포
 *    - 처음이면: [배포] > [새 배포] > 유형 [웹 앱]
 *        다음 사용자로 실행: [나]  /  액세스 권한이 있는 사용자: [모든 사용자]  ★필수★
 *    - 이미 배포했다면: [배포] > [배포 관리] > 연필(수정) > 버전 [새 버전] > [배포]
 *      (이렇게 해야 웹 앱 URL 이 바뀌지 않습니다)
 *
 * [v23 변경점] 구글 문서(Docs) 및 구글 슬라이드(Slides) 원클릭 자동 생성 내보내기
 * - [내보내기 📤] 버튼을 누르면 지소행 에코 그린 템플릿 디자인이 적용된 구글 슬라이드(16:9 발표자료) 및 구글 문서(A4 보고서)를 즉시 만들어 드라이브 URL을 반환합니다.
 * - 대외 보고용(수거 실적)과 목장 내부용(현장 부숙 관리) 리포트를 완벽히 구분하여 정돈된 표/카드/체크리스트 형식으로 생성합니다.
 *
 * [v22 변경점] 악취 측정 기록
 * - "악취측정" 탭에 목장별 악취 측정(사용 전·후)을 저장·삭제하고, 수거 & 임팩트 화면에서 불러옵니다. (회사 관리자만)
 *
 * [v21 변경점] 보안 · 목장 보고서 AI 설명
 * - 연결 테스트(isTest) 요청은 "연결됨"만 돌려주고 다른 일은 하지 않습니다 (접속 코드 없이 AI 를 부를 수 없게).
 * - 목장 내부용 보고서의 [AI 설명 보기](farm_ai_explanation)를 처리합니다. 판정은 앱이 정한 그대로 둡니다.
 *
 * [v20 변경점] 현장 점검은 점검 칸에만 기록
 * - 현장 점검(목장 매니저 포함)은 측정 칸(수거량·심부 온도·함수율·외기·직전 대비·판정·3지점·신규 투입량)을 쓰지 않습니다.
 *   새 행이면 그 칸을 비워 두고, 같은 날 회사가 측정한 행이 있으면 그 측정값을 그대로 둡니다.
 * - 점검이 채우는 칸: 측정 일시·목장·하역 장소·비고·사진·레코드 키·작업 유형·혼합 여부·곰팡이 상태·이상 냄새·깔개 사용량·운영 사이클 ID
 *
 * [v19 변경점] 접속 코드 (회사 관리자 / 목장 매니저)
 * [프로젝트 설정 > 스크립트 속성]에 아래 값을 넣으면 코드 확인이 켜집니다.
 *   - ADMIN_CODE             : 회사 관리자 코드. 넣지 않으면 지금처럼 누구나 전체 기능을 씁니다.
 *   - RANCH_CODE_목장이름     : 목장 매니저 코드 (예: RANCH_CODE_건준목장). 목장마다 하나씩.
 * - 매니저 코드: 그 목장 기록만 불러오고, 그 목장의 현장 점검만 저장합니다 (측정 칸은 바꾸지 못함).
 * - 기록 삭제·전체 초기화·AI·사용량 조회는 관리자 코드로만 됩니다.
 * - 코드는 추측하기 어렵게 8자 이상으로 정하고, 바꾸고 싶으면 속성 값만 바꾸면 됩니다 (재배포 불필요).
 * - GET ?action=whoami&code=... : 코드가 어떤 권한인지 확인 (기록은 주지 않음)
 *
 * [v18] 리포트 드라이브 저장 (이후 삭제)
 *
 * [v17 변경점] 리포트 독자별 구분
 * - 목장 내부용: 현장 상황·관리 포인트·다음 방문 때 할 일 (쉬운 존댓말)
 * - 대외 보고용: 추진 실적·성과와 의의·향후 계획 (개조식 보고서체, 현장 세부 제외)
 *
 * [v16 변경점] Gemini 모델 자동 찾기
 * - 설정된 모델이 없어졌으면(404) 이 키로 쓸 수 있는 최신 Flash 모델을 찾아 저장하고 다시 부릅니다.
 *   찾은 모델은 스크립트 속성 AI_MODEL_RESOLVED 에 남고, setupAiAccess 실행 로그에서도 볼 수 있습니다.
 *
 * [v15 변경점] AI 권한 안내
 * - "setupAiAccess" 함수 추가: 편집기에서 한 번 실행해 외부 서비스 연결(UrlFetchApp) 권한을 허용합니다.
 *   권한이 없으면 앱에 "통신이 되지 않아" 대신 권한 안내(code: no_permission)가 뜹니다.
 * - Gemini 에 요청이 닿지 못한 실패(권한·네트워크)는 하루 사용 횟수에 세지 않습니다.
 * - 설명 종류를 "field"(깔개 사용·이상 신호) / "farm"(신규 목장) 두 가지로 정리했습니다.
 *
 * [v14 변경점] AI 설명 카드 · 비용 절감
 * - "ai_explain" 요청: 앱의 카드(깔개 사용·이상 신호 점검, 신규 목장 검토)에서 [AI 설명 보기]를 눌렀을 때만
 *   코드가 계산한 facts 를 받아 2~4문장 설명을 돌려줍니다.
 * - 하루 호출 상한 기본값 50 → 20 (리포트·설명 합산). 스크립트 속성 AI_DAILY_LIMIT 로 바꿀 수 있습니다.
 * - 응답 토큰 상한: 리포트 1200, 설명 600. flash 모델은 생각(thinking) 토큰을 끕니다.
 * - 실패 응답에 code(no_key / rate_limited / daily_limit)를 붙입니다.
 * - GET ?action=ai_usage : 오늘 사용 횟수 확인 (AI 를 부르지 않음)
 *
 * [v13 변경점] 현장 방문 기록
 * 건준목장은 한 구역에 커피박을 계속 모으고 기존 커피박과 섞어 관리합니다.
 * 그래서 기록 단위를 "주차"가 아니라 "현장 방문 한 번"으로 바꾸고, 기존 칸 뒤에
 * 다음 7칸을 덧붙였습니다. 기존 칸은 그대로 두었으므로 예전 기록은 손상되지 않습니다.
 *   작업 유형 / 신규 투입량(kg) / 혼합 여부 / 곰팡이 상태 / 이상 냄새 /
 *   깔개 사용량(kg) / 운영 사이클 ID
 * 예전 행의 새 칸은 비어 있고, 앱은 그것을 "기록 없음"으로 보여 줍니다.
 * (없는 값을 '곰팡이 없음' 이나 '혼합 완료'로 추정하지 않습니다)
 * "수거량(kg)" 칸은 과거 호환을 위해 남겨 두고, 새 기록은 신규 투입량과 같은 값을 넣습니다.
 *
 * [기록 방식]
 * 목장마다 "주간기록_목장이름" 탭이 따로 생기고, 기록 한 건이 그 탭의 한 행입니다.
 * 탭 안은 하역 장소 → 측정 일시 순으로 정렬되어, 한 더미의 함수율 변화가 위아래로 이어집니다.
 * 목장 + 하역 장소 + 측정일이 같으면 새 행을 만들지 않고 기존 행을 갱신합니다.
 *
 * [v12 변경점] 자원순환 임팩트 리포트 문장 만들기 (AI)
 * 앱이 계산한 숫자를 받아 Gemini 로 문장만 만들어 돌려줍니다. 숫자는 만들지 않습니다.
 * 쓰기 전에 [프로젝트 설정 > 스크립트 속성]에 GEMINI_API_KEY 를 넣어야 합니다.
 *   - GEMINI_API_KEY : Google AI Studio 에서 받은 키 (필수)
 *   - AI_MODEL       : 기본 gemini-3.8-flash (선택). 모델이 없어지면 쓸 수 있는 최신 Flash 를 찾아 AI_MODEL_RESOLVED 에 저장합니다
 *   - AI_DAILY_LIMIT : 하루 호출 상한, 기본 20 (선택)
 *   - AI_TOKEN       : 정해 두면 이 값을 함께 보낸 요청만 받습니다 (선택)
 * 이 시트를 건드리지 않으므로 기록 저장과 부딪히지 않습니다.
 *
 * [v11] 예전 탭 자동 맞춤 시점 수정
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
var SCRIPT_VERSION = 23;

var SHEET_PREFIX = "주간기록_";
var LEGACY_SHEET = "커피박_주간기록";
var LEGACY_BACKUP = "커피박_주간기록(v7 백업)";
var PHOTO_FOLDER_NAME = "커피박_현장사진";
var HEADERS = [
  "측정 일시", "목장", "하역 장소", "수거량(kg)", "심부 온도(℃)", "심부 함수율(%)",
  "외기 온도(℃)", "외기 습도(%)", "직전 대비 심부온도(℃)", "직전 대비 함수율(%p)",
  "판정", "비고", "심부 온도 3지점(℃)", "심부 함수율 3지점(%)",
  "사진 1", "사진 2", "사진 3", "사진 링크", "레코드 키",
  // v13 에서 덧붙인 칸 — 기존 칸 뒤에만 붙여 예전 행이 밀리지 않게 한다
  "작업 유형", "신규 투입량(kg)", "혼합 여부", "곰팡이 상태", "이상 냄새",
  "깔개 사용량(kg)", "운영 사이클 ID"
];
var LOCATION_COL = 3;
var VERDICT_COL = 11;
var POINTS_COL = 13;   // 심부 온도 3지점 / 그 다음 칸이 함수율 3지점
var PHOTO_COL = 15;
var PHOTO_SLOTS = 3;
var LINK_COL = 18;
var KEY_COL = 19;
// v13 에서 덧붙인 칸
var WORK_COL = 20;
var ADDED_COL = 21;
var MIXED_COL = 22;
var MOLD_COL = 23;
var ODOR_COL = 24;
var BEDDING_COL = 25;
var CYCLE_COL = 26;
// 회사가 측정 탭에서만 채우는 칸 — 현장 점검 기록은 이 칸을 쓰지 않는다
// A 측정 일시(기존 행일 때) · D 수거량 · E 심부 온도 · F 함수율 · G 외기 온도 · H 외기 습도
// I/J 직전 대비 · K 판정 · M/N 3지점 · U 신규 투입량
var MEASURED_COLS = [1, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 21];
// v12 까지의 탭 모양 (19열, 마지막이 레코드 키)
var V12_COLUMN_COUNT = 19;
// v9 까지의 탭 모양 (17열, 마지막이 레코드 키) — 3지점 칸을 끼워 넣을 때만 쓴다
var V9_COLUMN_COUNT = 17;
var V9_LINK_INDEX = 15;
var V9_KEY_INDEX = 16;
var V6_KEY_INDEX = 12;
// AI 문장 만들기 설정 — 실제 값은 [프로젝트 설정 > 스크립트 속성]에 둔다
var AI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/";
var AI_MODEL_DEFAULT = "gemini-3.8-flash";
var AI_DAILY_LIMIT_DEFAULT = 20;
var AI_MAX_FACTS_CHARS = 20000;
// 설명 카드는 코드가 추린 facts 만 받는다
var AI_MAX_EXPLAIN_CHARS = 3000;
// 응답 길이 상한 (토큰) — 짧게 쓰라고 시키고, 넘치면 잘리게 둔다
var AI_REPORT_MAX_TOKENS = 1200;
var AI_EXPLAIN_MAX_TOKENS = 600;

var PHOTO_ROW_HEIGHT = 90;
var DEFAULT_ROW_HEIGHT = 21;

// 입력 검사 — 웹 앱은 주소만 알면 누구나 호출할 수 있으므로 들어온 값을 그대로 믿지 않는다
var FILE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;
var DATE_RE = /^\\d{4}-\\d{2}-\\d{2}$/;

// 악취 측정 기록 탭 — 목장 기록 탭(주간기록_)과 따로 둔다
var ODOR_SHEET = "악취측정";
var ODOR_HEADERS = ["측정일", "목장", "측정 장소", "측정 항목", "단위", "사용 전", "사용 후", "저감률(%)", "깔짚 조건", "측정 방법·장비", "비고", "기록 키", "입력 시각"];
var ODOR_GASES = { NH3: { label: "암모니아(NH₃)", unit: "ppm" }, H2S: { label: "황화수소(H₂S)", unit: "ppm" }, OU: { label: "복합악취", unit: "희석배수" } };
var ODOR_KEY_RE = /^odor-[A-Za-z0-9_-]{6,64}$/;
var MAX_TEXT = 200;
var DATETIME_RE = /^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$/;
var MAX_PHOTO_BYTES = 5 * 1024 * 1024;
var MAX_PHOTO_IDS = 10;

/**
 * 처음 한 번 편집기에서 실행해 외부 서비스 연결 권한을 허용하세요 (AI 리포트·설명용).
 * Gemini 주소에 요청만 보내 보고, 키는 쓰지 않으므로 사용 횟수도 늘지 않습니다.
 */
function setupAiAccess() {
  var props = PropertiesService.getScriptProperties();
  var code = UrlFetchApp.fetch(AI_ENDPOINT, { muteHttpExceptions: true }).getResponseCode();
  var apiKey = String(props.getProperty("GEMINI_API_KEY") || "").trim();
  Logger.log("외부 서비스 연결 확인 완료 (응답 " + code + ")");
  if (!apiKey) {
    Logger.log("GEMINI_API_KEY 가 없습니다 — 스크립트 속성에 넣어주세요");
    return;
  }
  // 모델 목록 조회는 요금이 없다 — 지금 설정된 모델과 쓸 수 있는 최신 Flash 를 보여 준다
  Logger.log("지금 쓰는 모델: " + currentAiModel(props) + " / 쓸 수 있는 최신 Flash: " + (findFlashModel(apiKey) || "찾지 못함"));
}

/** 처음 한 번 편집기에서 실행해 드라이브 권한을 허용하세요 */
function setupPhotoFolder() {
  var folder = getPhotoFolder();
  Logger.log("사진 폴더 준비 완료: " + folder.getUrl());
}

/* ─────────────────── 접속 코드 (회사 관리자 / 목장 매니저) ─────────────────── */

// 스크립트 속성
//   ADMIN_CODE              : 회사 관리자 코드 — 넣는 순간부터 코드 확인이 켜진다 (없으면 누구나 전체 기능)
//   RANCH_CODE_<목장 이름>  : 목장 매니저 코드 (예: RANCH_CODE_건준목장) — 그 목장 기록만 보고 현장점검만 저장
var RANCH_CODE_PREFIX = "RANCH_CODE_";

/** 목장 이름 비교는 시트 탭 이름과 같은 규칙으로 */
function sameRanch(a, b) {
  return ranchSheetName(a) === ranchSheetName(b);
}

/** 코드 → 권한. open 이면 ADMIN_CODE 가 없어 아직 누구나 쓰는 상태 */
function resolveAccess(code) {
  var all = PropertiesService.getScriptProperties().getProperties();
  var admin = String(all.ADMIN_CODE || "").trim();
  if (!admin) return { role: "admin", open: true };

  var given = String(code || "").trim();
  if (!given) return { role: "none", open: false };
  if (given === admin) return { role: "admin", open: false };

  for (var key in all) {
    if (!all.hasOwnProperty(key) || key.indexOf(RANCH_CODE_PREFIX) !== 0) continue;
    if (String(all[key]).trim() === given) {
      var ranch = key.slice(RANCH_CODE_PREFIX.length).replace(/\\s+/g, " ").trim();
      if (ranch) return { role: "manager", ranch: ranch, open: false };
    }
  }
  return { role: "none", open: false };
}

function forbidden(message) {
  return { status: "error", code: "forbidden", message: message };
}

/** POST 요청을 권한으로 거른다. 통과하면 null */
function checkPostAccess(data, access) {
  if (access.role === "admin") return null;
  if (access.role !== "manager") return forbidden("접속 코드가 필요합니다. 앱에서 코드를 다시 입력해주세요.");

  if (data.eventType === "record_saved") {
    if (!sameRanch(data.ranchName, access.ranch)) return forbidden(access.ranch + " 기록만 저장할 수 있습니다.");
    if (data.recordType !== "inspection") return forbidden("목장 매니저는 현장 점검만 기록할 수 있습니다.");
    return null;
  }
  if (data.eventType === "bulk_records" && isArray(data.items)) {
    for (var i = 0; i < data.items.length; i++) {
      if (!sameRanch(data.items[i] && data.items[i].ranchName, access.ranch)) {
        return forbidden(access.ranch + " 기록만 저장할 수 있습니다.");
      }
    }
    return null;
  }
  return forbidden("회사 관리자만 할 수 있는 작업입니다.");
}

function accessResponse(access) {
  return {
    status: "success",
    role: access.role,
    ranch: access.ranch || "",
    open: Boolean(access.open)
  };
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
    var access = resolveAccess(e && e.parameter && e.parameter.code);

    // 앱이 처음 열릴 때 코드가 맞는지만 확인한다 (기록은 주지 않는다)
    if (action === "whoami") return jsonResponse(accessResponse(access));

    if (action === "ai_usage") {
      if (access.role !== "admin") return jsonResponse(forbidden("회사 관리자만 볼 수 있습니다."));
      return jsonResponse(readAiUsage());
    }

    // 앱이 실행될 때 모든 목장 탭의 기록을 읽어간다. 시트가 원본이고 앱은 화면이다.
    if (action === "odor_load") {
      if (access.role !== "admin") return jsonResponse(forbidden("회사 관리자만 볼 수 있습니다."));
      var odorSheet = ss.getSheetByName(ODOR_SHEET);
      return jsonResponse({ status: "success", measurements: odorSheet ? readOdorRows(odorSheet) : [] });
    }

    if (action === "load") {
      if (access.role === "none") return jsonResponse(forbidden("접속 코드가 필요합니다. 앱에서 코드를 다시 입력해주세요."));
      // 옮길 예전 탭이 있을 때만 잠금을 잡는다 (평소 불러오기는 기다리지 않게)
      if (ss.getSheetByName(LEGACY_SHEET)) withLock(function () { migrateLegacySheet(ss); });
      var records = [];
      var sheets = listRecordSheets(ss);
      for (var i = 0; i < sheets.length; i++) {
        // 목장 매니저에게는 자기 목장 탭만 준다
        if (access.role === "manager" && sheets[i].getName() !== ranchSheetName(access.ranch)) continue;
        records = records.concat(readRecords(sheets[i]));
      }
      if (access.role === "manager") {
        records = records.filter(function (r) { return sameRanch(r.ranchName, access.ranch); });
      }
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
  var contents = e && e.postData ? e.postData.contents : "";
  if (!contents) {
    return jsonResponse({ status: "error", message: "전송된 데이터가 없습니다." });
  }

  var parsed;
  try {
    parsed = JSON.parse(contents);
  } catch (parseErr) {
    return jsonResponse({ status: "error", message: "보낸 내용을 해석할 수 없습니다." });
  }

  // 1. 연결 테스트 — 코드 없이 받지만 다른 일은 아무것도 하지 않는다 (시트·AI 모두 건드리지 않음)
  if (parsed.isTest) {
    return jsonResponse({ status: "success", message: "구글 시트 웹 앱과 정상 연결되었습니다!" });
  }

  // 접속 코드 확인 — 코드는 확인에만 쓰고 기록에는 남기지 않는다
  var access = resolveAccess(parsed.accessCode);
  delete parsed.accessCode;
  var denied = checkPostAccess(parsed, access);
  if (denied) return jsonResponse(denied);

  // 리포트 문장 만들기 및 문서/슬라이드 내보내기는 시트를 건드리지 않는다 — 잠금을 잡지 않아 기록 저장과 부딪히지 않는다
  // 요청은 예외가 나도 JSON 으로 돌려준다 (앱이 이유를 보여 줄 수 있게)
  if (
    parsed.eventType === "standard_ai_report" ||
    parsed.eventType === "ai_report" ||
    parsed.eventType === "ai_explain" ||
    parsed.eventType === "farm_ai_explanation" ||
    parsed.eventType === "export_google_doc" ||
    parsed.eventType === "export_google_slides"
  ) {
    try {
      if (parsed.eventType === "export_google_doc") {
        return jsonResponse(createGoogleDocReport(parsed));
      }
      if (parsed.eventType === "export_google_slides") {
        return jsonResponse(createGoogleSlidesReport(parsed));
      }
      if (parsed.eventType === "standard_ai_report") {
        return jsonResponse(generateStandardImpactReport(parsed));
      }
      if (parsed.eventType === "farm_ai_explanation") {
        return jsonResponse(generateFarmReportExplanation(parsed));
      }
      return jsonResponse(
        parsed.eventType === "ai_report" ? generateImpactReport(parsed) : generateExplanation(parsed)
      );
    } catch (handlerErr) {
      return jsonResponse({ status: "error", message: "요청을 처리하지 못했습니다: " + handlerErr });
    }
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);

    var data = parsed;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return jsonResponse({
        status: "error",
        message: "스프레드시트가 연결되지 않았습니다. 스프레드시트 안에서 [확장 프로그램 > Apps Script]로 실행해주세요."
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

    // 6. 악취 측정 기록 저장 · 삭제 (회사 관리자만 — 권한 확인은 위에서 끝났다)
    if (data.eventType === "odor_saved") {
      var odor = cleanOdor(data.measurement);
      if (odor.error) return jsonResponse({ status: "error", message: odor.error });
      var sheetO = getOdorSheet(ss);
      var rowO = findOdorRow(sheetO, odor.key);
      var valuesO = [odor.date, odor.ranch, odor.location, ODOR_GASES[odor.gas].label, ODOR_GASES[odor.gas].unit,
        odor.before, odor.after, odor.reduction, odor.bedding, odor.method, odor.notes, odor.key, fieldNow()];
      if (rowO) sheetO.getRange(rowO, 1, 1, ODOR_HEADERS.length).setValues([valuesO]);
      else sheetO.getRange(sheetO.getLastRow() + 1, 1, 1, ODOR_HEADERS.length).setValues([valuesO]);
      return jsonResponse({ status: "success", message: rowO ? "악취 측정 기록을 고쳤습니다." : "악취 측정 기록을 저장했습니다." });
    }
    if (data.eventType === "odor_deleted") {
      var keyO = String(data.key || "");
      if (!ODOR_KEY_RE.test(keyO)) return jsonResponse({ status: "error", message: "기록 키가 올바르지 않습니다." });
      var sheetD = ss.getSheetByName(ODOR_SHEET);
      var rowD = sheetD ? findOdorRow(sheetD, keyO) : 0;
      if (rowD) sheetD.deleteRow(rowD);
      return jsonResponse({ status: "success", message: rowD ? "악취 측정 기록을 지웠습니다." : "지울 기록이 없습니다." });
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

/* ───────────── 악취 측정 기록 ───────────── */

function getOdorSheet(ss) {
  var sheet = ss.getSheetByName(ODOR_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ODOR_SHEET);
    var head = sheet.getRange(1, 1, 1, ODOR_HEADERS.length);
    head.setValues([ODOR_HEADERS]);
    head.setBackground("#2e4a2b").setFontColor("#ffffff").setFontWeight("bold");
    sheet.setFrozenRows(1);
    // 날짜가 자동 변환되지 않도록 글자로 둔다
    sheet.getRange("A:A").setNumberFormat("@");
  }
  return sheet;
}

function findOdorRow(sheet, key) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var keys = sheet.getRange(2, 12, last - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === key) return i + 2;
  }
  return 0;
}

function gasCodeOf(label) {
  for (var code in ODOR_GASES) {
    if (ODOR_GASES.hasOwnProperty(code) && ODOR_GASES[code].label === label) return code;
  }
  return "";
}

function readOdorRows(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var rows = sheet.getRange(2, 1, last - 1, ODOR_HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var date = toDateTimeString(r[0]).slice(0, 10);
    var gas = gasCodeOf(String(r[3]));
    var before = Number(r[5]);
    var after = Number(r[6]);
    if (!DATE_RE.test(date) || !gas || !isFinite(before) || before <= 0 || !isFinite(after) || after < 0) continue;
    out.push({
      id: String(r[11] || ""),
      date: date,
      ranchName: String(r[1] || ""),
      location: String(r[2] || ""),
      gas: gas,
      before: before,
      after: after,
      bedding: String(r[8] || ""),
      method: String(r[9] || ""),
      notes: String(r[10] || "")
    });
  }
  return out;
}

/** 앱이 보낸 측정 기록을 검사한다. 저감률은 여기서 다시 셈한다 (보낸 값을 믿지 않는다) */
function cleanOdor(m) {
  if (!m || typeof m !== "object") return { error: "측정 기록이 없습니다." };
  var date = String(m.date || "");
  var key = String(m.id || "");
  var gas = String(m.gas || "");
  var before = Number(m.before);
  var after = Number(m.after);
  if (!DATE_RE.test(date)) return { error: "측정일 형식이 올바르지 않습니다." };
  if (!ODOR_KEY_RE.test(key)) return { error: "기록 키가 올바르지 않습니다." };
  if (!ODOR_GASES.hasOwnProperty(gas)) return { error: "측정 항목이 올바르지 않습니다." };
  if (!isFinite(before) || before <= 0 || before > 1000000) return { error: "사용 전 값을 확인해주세요." };
  if (!isFinite(after) || after < 0 || after > 1000000) return { error: "사용 후 값을 확인해주세요." };
  var ranch = String(m.ranchName || "").trim();
  if (!ranch) return { error: "목장을 골라주세요." };
  var cut = function (v) { return safeText(String(v === null || v === undefined ? "" : v).slice(0, MAX_TEXT)); };
  return {
    key: key,
    date: date,
    ranch: cut(ranch),
    location: cut(m.location),
    gas: gas,
    before: before,
    after: after,
    reduction: Math.round(((before - after) / before) * 1000) / 10,
    bedding: cut(m.bedding),
    method: cut(m.method),
    notes: cut(m.notes)
  };
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

/**
 * 예전 탭을 최신 모양으로 맞춘다. 읽기 전에도 부르므로 값이 밀려 읽히는 일이 없다.
 * - v9(17열): "비고" 뒤에 3지점 칸 두 개를 끼워 넣는다 (기존 값은 오른쪽으로 밀린다)
 * - v12(19열): 뒤에 7칸을 덧붙이기만 한다 — 기존 값은 제자리에 그대로 있다
 */
function upgradeSheetShape(sheet) {
  if (sheet.getLastColumn() === V9_COLUMN_COUNT &&
      String(sheet.getRange(1, V9_COLUMN_COUNT).getValue()) === "레코드 키") {
    sheet.insertColumnsBefore(POINTS_COL, 2);
    ensureHeaders(sheet);
    return;
  }
  if (sheet.getLastColumn() >= V12_COLUMN_COUNT && sheet.getLastColumn() < HEADERS.length) {
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

/** 값이 없으면 빈 칸으로 둔다 — 적지 않은 것과 0 을 구별하기 위해서다 */
function optionalNumber(v) {
  if (v === "" || v === null || v === undefined) return "";
  var n = Number(v);
  return isFinite(n) && n >= 0 ? n : "";
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

/* ─────────────────── AI 문장 만들기 (리포트 · 설명) ─────────────────── */

/**
 * 앱이 계산해 보낸 숫자로 문장만 만든다.
 * 숫자를 새로 만들지 않도록 프롬프트에서 못을 박는다.
 * 실패하면 code 로 종류를 알려 준다: no_key / rate_limited / daily_limit
 */

/** 키·열쇠·자료 크기·하루 횟수를 확인한다. 통과하면 { ok: true, ... } */
function prepareAiCall(data, maxChars) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = String(props.getProperty("GEMINI_API_KEY") || "").trim();
  if (!apiKey) {
    return {
      ok: false,
      response: {
        status: "error",
        code: "no_key",
        message: "AI 설명 기능이 설정되지 않았습니다. Apps Script [프로젝트 설정 > 스크립트 속성]에 GEMINI_API_KEY 를 넣어주세요."
      }
    };
  }

  var token = String(props.getProperty("AI_TOKEN") || "").trim();
  if (token && String(data.token || "") !== token) {
    return { ok: false, response: { status: "error", message: "AI 호출 열쇠가 맞지 않습니다." } };
  }

  var facts = data.facts;
  if (!facts || typeof facts !== "object") {
    return { ok: false, response: { status: "error", message: "설명에 쓸 자료가 없습니다." } };
  }

  var factsText = JSON.stringify(facts);
  if (factsText.length > maxChars) {
    return { ok: false, response: { status: "error", message: "보낸 자료가 너무 큽니다. 범위를 좁혀서 다시 시도해주세요." } };
  }

  var quota = checkAiQuota(props);
  if (!quota.allowed) {
    return {
      ok: false,
      response: {
        status: "error",
        code: "daily_limit",
        message: "오늘 AI 설명 사용 횟수(" + quota.limit + "회)를 모두 사용했습니다.",
        usedToday: quota.used,
        dailyLimit: quota.limit
      }
    };
  }

  var model = currentAiModel(props);
  return { ok: true, props: props, apiKey: apiKey, model: model, factsText: factsText, quota: quota };
}

function generateImpactReport(data) {
  var prep = prepareAiCall(data, AI_MAX_FACTS_CHARS);
  if (!prep.ok) return prep.response;

  var called = callGemini(
    prep,
    reportSystemPrompt(String(data.audience || "farm")),
    "아래는 앱이 계산한 자료입니다.\\n\\n" + prep.factsText,
    AI_REPORT_MAX_TOKENS
  );
  if (!called.ok) return aiFailure(called, prep.quota);

  var sections = called.json;
  if (!sections.summary || !sections.meaning || !sections.recommendation) {
    return { status: "error", message: "AI 응답에 빠진 항목이 있습니다. 다시 시도해주세요." };
  }
  if (Object.prototype.toString.call(sections.actions) !== "[object Array]") sections.actions = [];

  return {
    status: "success",
    sections: sections,
    model: prep.model,
    usedToday: prep.quota.used,
    dailyLimit: prep.quota.limit
  };
}

function generateStandardImpactReport(data) {
  var prep = prepareAiCall(data, AI_MAX_FACTS_CHARS);
  if (!prep.ok) return prep.response;

  var called = callGemini(
    prep,
    standardReportSystemPrompt(),
    "아래는 제주도 커피박 수거 사업 월간 현황 데이터(코드 계산 완료)입니다.\\n\\n" + prep.factsText,
    AI_REPORT_MAX_TOKENS
  );
  if (!called.ok) return aiFailure(called, prep.quota);

  var sections = called.json;
  if (!sections || typeof sections !== "object") {
    return { status: "error", message: "AI 응답 형식이 올바르지 않습니다." };
  }

  return {
    status: "success",
    sections: sections,
    model: prep.model,
    usedToday: prep.quota.used,
    dailyLimit: prep.quota.limit
  };
}

function standardReportSystemPrompt() {
  return [
    "당신은 제주도 커피박 수거 사업의 월간 현황 보고서를 작성하는 공공 행정 실무 담당자입니다.",
    "",
    "핵심 원칙: 숫자는 코드, 해석 문장은 AI",
    "1. 주어진 데이터(facts)에 이미 계산된 숫자만 그대로 인용하십시오.",
    "2. 합계, 평균, 비율, 순위, 전월 대비 증감, 일평균 등의 숫자를 AI가 직접 계산하거나 수정하지 마십시오.",
    "3. 데이터에 없는 사실(임의의 휴가철, 날씨, 검증되지 않은 CO2/탄소 감축량 등)을 추측하여 지어내지 마십시오.",
    "4. 문체는 정중하고 간결한 행정 보고서체(~했습니다, ~확인되었습니다, ~계획입니다)로 작성하십시오.",
    "5. 과장된 표현('매우 성공적', '놀라운 성과', '극적인 반등')은 금지하며 객관적 사실 위주로 기술하십시오.",
    "",
    "반드시 아래 JSON 형식으로만 응답하십시오:",
    "{",
    '  "executiveSummary": "핵심 KPI 요약문 (2~3문장 이내)",',
    '  "trendCommentary": "주차별 수거량 추이 및 일평균 편차에 대한 분석 (1~2문장)",',
    '  "issues": [',
    '    { "title": "이슈 제목", "description": "데이터에 근거한 사실", "action": "실행 가능한 구체적 조치" }',
    "  ],",
    '  "nextActions": [',
    '    "구체적 실행 행동 1",',
    '    "구체적 실행 행동 2",',
    '    "구체적 실행 행동 3"',
    "  ]",
    "}"
  ].join("\\n");
}

/** 카드의 코드 판정을 짧게 풀어 쓴다 — 사람이 [AI 설명 보기]를 눌렀을 때만 온다 */
function generateExplanation(data) {
  var kind = String(data.kind || "");
  if (kind !== "field" && kind !== "farm") {
    return { status: "error", message: "알 수 없는 설명 종류입니다." };
  }

  var prep = prepareAiCall(data, AI_MAX_EXPLAIN_CHARS);
  if (!prep.ok) return prep.response;

  var called = callGemini(
    prep,
    explainSystemPrompt(kind),
    "아래는 앱이 코드로 계산한 결과입니다.\\n\\n" + prep.factsText,
    AI_EXPLAIN_MAX_TOKENS
  );
  if (!called.ok) return aiFailure(called, prep.quota);

  var reply = called.json;
  if (!reply.summary) return { status: "error", message: "AI 가 보낸 설명이 비어 있습니다." };
  var actions = Object.prototype.toString.call(reply.actions) === "[object Array]" ? reply.actions.slice(0, 3) : [];

  return {
    status: "success",
    explanation: { summary: String(reply.summary), actions: actions },
    model: prep.model,
    usedToday: prep.quota.used,
    dailyLimit: prep.quota.limit
  };
}

/** 목장 내부용 보고서의 [AI 설명 보기] — 판정은 앱이 정한 그대로, 문장만 만든다 */
function generateFarmReportExplanation(data) {
  var prep = prepareAiCall(data, AI_MAX_EXPLAIN_CHARS);
  if (!prep.ok) return prep.response;

  var called = callGemini(
    prep,
    explainSystemPrompt("farmReport"),
    "아래는 앱이 코드로 계산한 목장 보고서 자료입니다.\\n\\n" + prep.factsText,
    AI_EXPLAIN_MAX_TOKENS
  );
  if (!called.ok) return aiFailure(called, prep.quota);

  var summary = String((called.json && called.json.summary) || "").trim();
  if (!summary) return { status: "error", message: "AI 가 보낸 설명이 비어 있습니다." };

  return {
    status: "success",
    explanation: summary,
    model: prep.model,
    usedToday: prep.quota.used,
    dailyLimit: prep.quota.limit
  };
}

/* ─────────────────── 구글 문서(Docs) & 구글 슬라이드(Slides) 내보내기 (v23) ─────────────────── */

/**
 * 구글 문서(Google Docs) 리포트 자동 생성
 * 지소행 시그니처 에코 그린 스타일이 적용된 A4 규격 공식 문서
 */
function createGoogleDocReport(data) {
  var title = String(data.title || "커피박 자원순환 운영 보고서").trim();
  var audience = String(data.audience || "official");
  var doc = DocumentApp.create(title);
  var body = doc.getBody();

  // A4 여백 설정 (pt 단위: 36pt = 0.5인치)
  body.setMarginTop(36);
  body.setMarginBottom(36);
  body.setMarginLeft(40);
  body.setMarginRight(40);

  // 상단 헤더 / 브랜드 배지
  var brandPara = body.appendParagraph("지소행 자원순환 AI 운영 관리 시스템");
  brandPara.setFontFamily("Malgun Gothic");
  brandPara.setFontSize(10);
  brandPara.setForegroundColor("#52B788");
  brandPara.setBold(true);

  // 문서 제목
  var titlePara = body.appendParagraph(title);
  titlePara.setFontFamily("Malgun Gothic");
  titlePara.setFontSize(22);
  titlePara.setForegroundColor("#1B4332");
  titlePara.setBold(true);
  titlePara.setSpacingAfter(4);

  // 부제목
  var sub = String(data.subtitle || (audience === "farm" ? "목장 내부용 현장 상태 및 작업 가이드" : "제주도 커피박 수거 실적 및 자원순환 임팩트 현황"));
  var subPara = body.appendParagraph(sub);
  subPara.setFontFamily("Malgun Gothic");
  subPara.setFontSize(12);
  subPara.setForegroundColor("#4B5563");
  subPara.setSpacingAfter(14);

  // 개요 메타데이터 테이블 (2열)
  var metaRows = [];
  var exportedTime = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm");
  if (audience === "farm" && data.farmData) {
    var fd = data.farmData;
    metaRows = [
      ["보고 목장", String((fd.farm && fd.farm.name) || "건준목장"), "분석 대상 기간", String((fd.period && fd.period.label) || "최근 기록")],
      ["작성 일시", exportedTime, "보고서 성격", "현장 내부 관리 및 행동 지침"]
    ];
  } else {
    var facts = data.facts || {};
    var pr = facts.period || {};
    metaRows = [
      ["보고 기관", "제주 자원순환 사업단", "분석 대상 기간", String(pr.dateRange || "해당 월")],
      ["작성 일시", exportedTime, "데이터 출처", "제주도 커피박 수거대장 실측 원본"]
    ];
  }

  var metaTable = body.appendTable(metaRows);
  metaTable.setBorderColor("#E5E7EB");
  for (var r = 0; r < metaRows.length; r++) {
    var row = metaTable.getRow(r);
    for (var c = 0; c < 4; c++) {
      var cell = row.getCell(c);
      cell.setPaddingTop(4);
      cell.setPaddingBottom(4);
      cell.setPaddingLeft(6);
      cell.setPaddingRight(6);
      if (c % 2 === 0) {
        cell.setBackgroundColor("#F3F4F6");
        cell.editAsText().setBold(true).setForegroundColor("#374151").setFontSize(10).setFontFamily("Malgun Gothic");
      } else {
        cell.setBackgroundColor("#FFFFFF");
        cell.editAsText().setForegroundColor("#1F2937").setFontSize(10).setFontFamily("Malgun Gothic");
      }
    }
  }
  body.appendParagraph("").setSpacingAfter(10);

  if (audience === "farm" && data.farmData) {
    // 목장 내부용 리포트 내용 구성
    var farm = data.farmData;

    // 섹션 1: 현재 더미 핵심 상태
    appendDocHeading(body, "1. 현재 부숙 더미 핵심 지표");
    var kpiRows = [
      ["현재 더미량", "심부 온도", "심부 함수율", "깔개 사용 판단"],
      [
        (farm.pile ? farm.pile.currentKg.toLocaleString() + " kg" : "-"),
        (farm.condition && farm.condition.temperature != null ? farm.condition.temperature + " ℃" : "기록 없음"),
        (farm.condition && farm.condition.moisture != null ? farm.condition.moisture + " %" : "기록 없음"),
        (farm.bedding ? farm.bedding.statusLabel : "-")
      ]
    ];
    appendDocKpiTable(body, kpiRows);

    // 섹션 2: 깔개 판정 및 근거
    appendDocHeading(body, "2. 깔개 사용 판단 상세");
    var beddingReason = (farm.bedding && farm.bedding.notice) || "현재 부숙 데이터 관리 중입니다.";
    appendDocCallout(body, "판정 결과: " + (farm.bedding ? farm.bedding.statusLabel : "-"), beddingReason);

    // 섹션 3: 지금 해야 할 일 TOP 3
    if (farm.actions && farm.actions.length > 0) {
      appendDocHeading(body, "3. 지금 해야 할 일 (우선순위 조치)");
      for (var a = 0; a < farm.actions.length; a++) {
        var act = farm.actions[a];
        var itemPara = body.appendParagraph("[" + exportPriorityLabel(act.priority) + "] " + String(act.title || ""));
        itemPara.setHeading(DocumentApp.ParagraphHeading.HEADING3).setForegroundColor("#1B4332").setFontSize(11);
        var actBody = body.appendParagraph("근거: " + String(act.reason || "-"));
        actBody.setFontSize(10).setForegroundColor("#374151").setSpacingAfter(6);
      }
    }

    // 섹션 4: 다음 방문 체크리스트
    if (farm.nextVisitChecklist && farm.nextVisitChecklist.length > 0) {
      appendDocHeading(body, "4. 다음 방문 현장 점검 체크리스트");
      for (var ch = 0; ch < farm.nextVisitChecklist.length; ch++) {
        var chk = farm.nextVisitChecklist[ch];
        var p = body.appendParagraph("□  [" + (chk.priority === "high" ? "필수" : "권장") + "] " + String(chk.text || ""));
        p.setFontSize(10).setForegroundColor("#1F2937").setFontFamily("Malgun Gothic");
      }
    }
  } else {
    // 대외 보고용 (수거 실적 & 임팩트)
    var stFacts = data.facts || {};
    var coll = stFacts.collection || {};
    var aiSec = data.standardSections || {};
    var impact = data.impact || {};

    // 섹션 1: 월간 핵심 실적 요약
    appendDocHeading(body, "1. 월간 핵심 실적 지표");
    var stdKpi = [
      ["총 수거량", "실수거 매장", "소각 배출 회피 (참고 추정)", "톱밥 구매비 절감 (추정)"],
      [
        (coll.totalKg ? coll.totalKg.toLocaleString() + " kg" : "0 kg"),
        (coll.activeStoreCount ? coll.activeStoreCount + " 개소" : "0 개소"),
        exportCo2Text(impact.co2AvoidedKg),
        exportWonText(impact.sawdustSavingKrw)
      ]
    ];
    appendDocKpiTable(body, stdKpi);
    var impactNote = body.appendParagraph(exportImpactNote());
    impactNote.setFontSize(9).setForegroundColor("#6B7280").setFontFamily("Malgun Gothic").setSpacingAfter(8);

    // 총평 AI 해설
    if (aiSec.executiveSummary) {
      appendDocCallout(body, "월간 총괄 요약", aiSec.executiveSummary);
    }

    // 섹션 2: 주차별 수거 추이
    if (stFacts.weekly && stFacts.weekly.length > 0) {
      appendDocHeading(body, "2. 주차별 수거 실적 현황");
      var wkTable = [["주차", "기간", "수거량(kg)", "비율(%)"]];
      for (var w = 0; w < stFacts.weekly.length; w++) {
        var item = stFacts.weekly[w];
        wkTable.push([
          item.weekLabel || (w + 1) + "주차",
          item.dateRange || "-",
          (item.totalKg || 0).toLocaleString() + " kg",
          Number(item.sharePercent || 0).toFixed(1) + "%"
        ]);
      }
      appendDocDataTable(body, wkTable);
    }

    // 섹션 3: 향후 계획 및 권고사항
    if (aiSec.nextActions && aiSec.nextActions.length > 0) {
      appendDocHeading(body, "3. 향후 중점 추진 과제");
      for (var na = 0; na < aiSec.nextActions.length; na++) {
        var np = body.appendParagraph("•  " + aiSec.nextActions[na]);
        np.setFontSize(11).setForegroundColor("#1F2937").setFontFamily("Malgun Gothic");
      }
    }
  }

  doc.saveAndClose();
  return {
    status: "success",
    url: doc.getUrl(),
    fileId: doc.getId(),
    title: title
  };
}

/**
 * 구글 슬라이드(Google Slides) 프레젠테이션 자동 생성
 * 지소행 시그니처 에코 그린(#2D6A4F) & 카드형 16:9 발표자료 테마
 */
function createGoogleSlidesReport(data) {
  var title = String(data.title || "커피박 자원순환 발표 리포트").trim();
  var audience = String(data.audience || "official");
  var pres = SlidesApp.create(title);
  var slides = pres.getSlides();

  // 기본 슬라이드 1장 확보 또는 생성
  var slide1 = slides.length > 0 ? slides[0] : pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  // 기존 기본 요소들 비우기
  var pageElements = slide1.getPageElements();
  for (var i = 0; i < pageElements.length; i++) {
    pageElements[i].remove();
  }

  var BRAND_DARK = "#1B4332";
  var BRAND_GREEN = "#2D6A4F";
  var BRAND_LIGHT = "#52B788";
  var BG_CARD = "#F4FBF7";
  var TEXT_MUTED = "#6B7280";

  // ──────────────────────────────────────────
  // SLIDE 1: 표지 (Cover Slide)
  // ──────────────────────────────────────────
  var topBar = slide1.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, 0, 720, 14);
  topBar.getFill().setSolidFill(BRAND_GREEN);
  topBar.getBorder().setTransparent();

  var leftBar = slide1.insertShape(SlidesApp.ShapeType.RECTANGLE, 50, 70, 6, 80);
  leftBar.getFill().setSolidFill(BRAND_LIGHT);
  leftBar.getBorder().setTransparent();

  var tagBox = slide1.insertTextBox("지소행 자원순환 AI 운영 관리 시스템", 65, 70, 500, 24);
  tagBox.getText().getTextStyle().setFontSize(13).setForegroundColor(BRAND_GREEN).setBold(true);

  var titleBox = slide1.insertTextBox(title, 65, 95, 600, 60);
  titleBox.getText().getTextStyle().setFontSize(26).setForegroundColor(BRAND_DARK).setBold(true);

  var sub = String(data.subtitle || (audience === "farm" ? "목장 현장 부숙 상태 요약 및 우선순위 행동 지침" : "제주도 커피박 수거 실적 및 자원순환 임팩트"));
  var subBox = slide1.insertTextBox(sub, 65, 160, 600, 30);
  subBox.getText().getTextStyle().setFontSize(14).setForegroundColor(TEXT_MUTED);

  var metaCard = slide1.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, 50, 220, 620, 120);
  metaCard.getFill().setSolidFill("#F8FAFC");
  metaCard.getBorder().getLineFill().setSolidFill("#E2E8F0");
  metaCard.getBorder().setWeight(1);

  var metaText = "";
  var exportedTime = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
  if (audience === "farm" && data.farmData) {
    var fd = data.farmData;
    metaText = "• 보고 대상: " + ((fd.farm && fd.farm.name) || "건준목장") + "  |  보고 구분: 현장 내부용\\n" +
               "• 분석 기간: " + ((fd.period && fd.period.label) || "최근 기록") + "\\n" +
               "• 작성 일시: " + exportedTime + "  |  엔진: 지소행 AI 어시스턴트";
  } else {
    var facts = data.facts || {};
    var pr = facts.period || {};
    metaText = "• 발행 기관: 제주 자원순환 사업단  |  보고 구분: 대외 보고용\\n" +
               "• 분석 기간: " + (pr.dateRange || "해당 월") + " (경과 " + (pr.elapsedDays || "-") + "일)\\n" +
               "• 작성 일시: " + exportedTime + "  |  자료 출처: 제주도 커피박 수거대장 실측 원본";
  }
  var metaContent = slide1.insertTextBox(metaText, 70, 235, 580, 90);
  metaContent.getText().getTextStyle().setFontSize(12).setForegroundColor("#374151");

  // ──────────────────────────────────────────
  // SLIDE 2: 핵심 지표 KPI 카드 (3 Big Number Cards + AI 총평)
  // ──────────────────────────────────────────
  var slide2 = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  addSlideHeader(slide2, "01. 핵심 운영 성과 지표", "핵심 수치 요약 및 종합 분석", BRAND_GREEN);

  var kpiCards = [];
  var summaryDesc = "";

  if (audience === "farm" && data.farmData) {
    var fd2 = data.farmData;
    kpiCards = [
      { label: "현재 더미량", value: (fd2.pile ? fd2.pile.currentKg.toLocaleString() + " kg" : "-"), sub: "누적 투입 - 깔개 사용" },
      { label: "심부 환경", value: (fd2.condition && fd2.condition.temperature != null ? fd2.condition.temperature + "℃" : "기록 없음"), sub: "함수율 " + (fd2.condition && fd2.condition.moisture != null ? fd2.condition.moisture + "%" : "기록 없음") },
      { label: "깔개 판정", value: (fd2.bedding ? fd2.bedding.statusLabel : "-"), sub: (fd2.management ? "최근 7일 혼합 " + fd2.management.mixingCountLast7Days + "회" : "-") }
    ];
    summaryDesc = (fd2.bedding && fd2.bedding.notice) || "현재 현장 부숙 상태 지표가 관리되고 있습니다.";
  } else {
    var f2 = data.facts || {};
    var c2 = f2.collection || {};
    var sec2 = data.standardSections || {};
    var imp2 = data.impact || {};
    kpiCards = [
      { label: "총 수거량", value: (c2.totalKg ? c2.totalKg.toLocaleString() + " kg" : "0 kg"), sub: "일평균 " + (c2.dailyAverageKg ? c2.dailyAverageKg.toLocaleString() + " kg" : "-") },
      { label: "참여 매장", value: (c2.activeStoreCount ? c2.activeStoreCount + " 개소" : "0"), sub: "전체 " + (c2.registeredStoreCount || 0) + "개 매장 중" },
      { label: "소각 배출 회피", value: exportCo2Text(imp2.co2AvoidedKg), sub: "참고 추정 · 커피박 0.338kgCO₂/kg" }
    ];
    summaryDesc = sec2.executiveSummary || "월간 커피박 수거 실적이 안정적으로 유지되고 있으며 지속적인 자원화가 추진 중입니다.";
  }

  for (var k = 0; k < 3; k++) {
    var cardX = 50 + k * 210;
    var card = slide2.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, cardX, 95, 200, 115);
    card.getFill().setSolidFill(BG_CARD);
    card.getBorder().getLineFill().setSolidFill(BRAND_LIGHT);
    card.getBorder().setWeight(1.5);

    var lblBox = slide2.insertTextBox(kpiCards[k].label, cardX + 12, 103, 176, 22);
    lblBox.getText().getTextStyle().setFontSize(11).setForegroundColor(BRAND_GREEN).setBold(true);

    var valBox = slide2.insertTextBox(kpiCards[k].value, cardX + 12, 128, 176, 40);
    valBox.getText().getTextStyle().setFontSize(22).setForegroundColor(BRAND_DARK).setBold(true);

    var sBox = slide2.insertTextBox(kpiCards[k].sub, cardX + 12, 172, 176, 26);
    sBox.getText().getTextStyle().setFontSize(11).setForegroundColor(TEXT_MUTED);
  }

  var summaryBox = slide2.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, 50, 230, 620, 130);
  summaryBox.getFill().setSolidFill("#F8FAFC");
  summaryBox.getBorder().getLineFill().setSolidFill("#CBD5E1");
  summaryBox.getBorder().setWeight(1);

  var sumTitle = slide2.insertTextBox("💡 AI 총괄 해설 & 현장 진단", 65, 240, 590, 24);
  sumTitle.getText().getTextStyle().setFontSize(12).setForegroundColor(BRAND_GREEN).setBold(true);

  var sumBody = slide2.insertTextBox(summaryDesc, 65, 268, 590, 80);
  sumBody.getText().getTextStyle().setFontSize(12).setForegroundColor("#1F2937");

  // ──────────────────────────────────────────
  // SLIDE 3: 상세 세부 지표 / 주차별 실적 테이블
  // ──────────────────────────────────────────
  var slide3 = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  addSlideHeader(slide3, "02. 세부 현황 및 상세 분석", "주차별 추이 및 현장 세부 지표", BRAND_GREEN);

  if (audience === "farm" && data.farmData) {
    var recs = data.farmData.recentRecords || [];
    var rowCount = Math.min(recs.length, 5) + 1;
    if (rowCount > 1) {
      var fTable = slide3.insertTable(rowCount, 5, 50, 100, 620, 240);
      var fHeaders = ["방문 일시", "작업 유형", "심부온도", "함수율", "혼합·곰팡이"];
      for (var hc = 0; hc < 5; hc++) {
        var hcell = fTable.getCell(0, hc);
        hcell.getText().setText(fHeaders[hc]).getTextStyle().setFontSize(11).setForegroundColor("#FFFFFF").setBold(true);
        hcell.getFill().setSolidFill(BRAND_GREEN);
      }
      for (var fr = 0; fr < rowCount - 1; fr++) {
        var rItem = recs[fr];
        var rowData = [
          String(rItem.date || "-").slice(0, 10),
          String(rItem.workType || "-"),
          (rItem.coreTemp != null ? rItem.coreTemp + "℃" : "-"),
          (rItem.moisture != null ? rItem.moisture + "%" : "-"),
          String(rItem.mixedLabel || "기록 없음") + " / " + String(rItem.moldLabel || "기록 없음")
        ];
        for (var fc = 0; fc < 5; fc++) {
          var cellF = fTable.getCell(fr + 1, fc);
          cellF.getText().setText(rowData[fc]).getTextStyle().setFontSize(11).setForegroundColor("#1F2937");
          if (fr % 2 === 1) cellF.getFill().setSolidFill("#F8FAFC");
        }
      }
    }
  } else {
    var wks = (data.facts && data.facts.weekly) || [];
    var wCount = Math.min(wks.length, 5) + 1;
    if (wCount > 1) {
      var sTable = slide3.insertTable(wCount, 4, 50, 100, 620, 240);
      var sHeaders = ["주차 구분", "대상 기간", "수거량 (kg)", "점유율 (%)"];
      for (var sc = 0; sc < 4; sc++) {
        var scell = sTable.getCell(0, sc);
        scell.getText().setText(sHeaders[sc]).getTextStyle().setFontSize(11).setForegroundColor("#FFFFFF").setBold(true);
        scell.getFill().setSolidFill(BRAND_GREEN);
      }
      for (var sw = 0; sw < wCount - 1; sw++) {
        var wItem = wks[sw];
        var wRow = [
          wItem.weekLabel || (sw + 1) + "주차",
          wItem.dateRange || "-",
          (wItem.totalKg || 0).toLocaleString() + " kg",
          Number(wItem.sharePercent || 0).toFixed(1) + "%"
        ];
        for (var cIdx = 0; cIdx < 4; cIdx++) {
          var sCell = sTable.getCell(sw + 1, cIdx);
          sCell.getText().setText(wRow[cIdx]).getTextStyle().setFontSize(11).setForegroundColor("#1F2937");
          if (sw % 2 === 1) sCell.getFill().setSolidFill("#F8FAFC");
        }
      }
    }
  }

  // ──────────────────────────────────────────
  // SLIDE 4: 향후 계획 & 현장 체크리스트
  // ──────────────────────────────────────────
  var slide4 = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  addSlideHeader(slide4, "03. 현장 액션 플랜 & 권고사항", "개선 조치 및 다음 단계 실행 계획", BRAND_GREEN);

  var actionList = [];
  if (audience === "farm" && data.farmData) {
    var fActions = data.farmData.actions || [];
    for (var fa = 0; fa < Math.min(fActions.length, 3); fa++) {
      actionList.push({
        title: "[" + exportPriorityLabel(fActions[fa].priority) + "] " + String(fActions[fa].title || ""),
        desc: "근거: " + String(fActions[fa].reason || "-")
      });
    }
    if (actionList.length === 0 && data.farmData.nextVisitChecklist) {
      var nchk = data.farmData.nextVisitChecklist;
      for (var nc = 0; nc < Math.min(nchk.length, 3); nc++) {
        actionList.push({
          title: "점검: " + String(nchk[nc].text || ""),
          desc: nchk[nc].priority === "high" ? "다음 방문 때 꼭 확인" : "다음 방문 때 확인 권장"
        });
      }
    }
  } else {
    var stdActions = (data.standardSections && data.standardSections.nextActions) || [];
    var noteBox = slide4.insertTextBox(exportImpactNote(), 50, 360, 620, 30);
    noteBox.getText().getTextStyle().setFontSize(9).setForegroundColor(TEXT_MUTED);
    for (var sa = 0; sa < Math.min(stdActions.length, 3); sa++) {
      actionList.push({
        title: "중점 추진 과제 0" + (sa + 1),
        desc: stdActions[sa]
      });
    }
  }

  if (actionList.length === 0) {
    actionList.push({ title: "정기 모니터링 유지", desc: "기존 수거 체계 및 부숙 상태를 지속 점검합니다." });
  }

  for (var actIdx = 0; actIdx < actionList.length; actIdx++) {
    var boxY = 100 + actIdx * 82;
    var aBox = slide4.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, 50, boxY, 620, 70);
    aBox.getFill().setSolidFill("#FFFFFF");
    aBox.getBorder().getLineFill().setSolidFill("#E2E8F0");
    aBox.getBorder().setWeight(1);

    var tagShape = slide4.insertShape(SlidesApp.ShapeType.RECTANGLE, 50, boxY, 6, 70);
    tagShape.getFill().setSolidFill(BRAND_GREEN);
    tagShape.getBorder().setTransparent();

    var aTitle = slide4.insertTextBox(actionList[actIdx].title, 70, boxY + 8, 580, 24);
    aTitle.getText().getTextStyle().setFontSize(13).setForegroundColor(BRAND_DARK).setBold(true);

    var aDesc = slide4.insertTextBox(actionList[actIdx].desc, 70, boxY + 34, 580, 28);
    aDesc.getText().getTextStyle().setFontSize(11).setForegroundColor("#4B5563");
  }

  pres.saveAndClose();
  return {
    status: "success",
    url: pres.getUrl(),
    fileId: pres.getId(),
    title: title
  };
}

/** 할 일 우선순위 → 문서에 찍을 말 */
function exportPriorityLabel(priority) {
  return priority === "high" ? "우선" : "권장";
}

/** 소각 배출 회피 추정치 (kgCO₂) → 글자 */
function exportCo2Text(kg) {
  var n = Number(kg);
  if (!isFinite(n) || n <= 0) return "-";
  return n >= 1000 ? (Math.round(n / 10) / 100) + " tCO₂" : Math.round(n) + " kgCO₂";
}

/** 톱밥 절감 추정치 (원) → 글자. 월 톱밥 소요량이 없으면 null 이 온다 */
function exportWonText(won) {
  if (won === null || won === undefined || won === "") return "소요량 미입력";
  var n = Number(won);
  if (!isFinite(n)) return "-";
  return n >= 10000 ? (Math.round(n / 1000) / 10) + "만 원" : Math.round(n) + "원";
}

/** 추정치의 근거 — 공식 감축량으로 읽히지 않게 문서마다 밝힌다 */
function exportImpactNote() {
  return "※ 소각 배출 회피 = 수거량 × 0.338kgCO₂/kg (외부 참고 계수, 국가 승인 배출계수·공식 감축 인증 아님). " +
    "톱밥 절감 = min(목장 월 톱밥 소요량 × 50%, 수거량) × 톱밥 단가 (운송·처리비 미반영 추정).";
}

/** 슬라이드 헤더 도우미 */
function addSlideHeader(slide, title, subtitle, brandColor) {
  var topAccent = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, 0, 720, 8);
  topAccent.getFill().setSolidFill(brandColor);
  topAccent.getBorder().setTransparent();

  var tBox = slide.insertTextBox(title, 50, 24, 620, 36);
  tBox.getText().getTextStyle().setFontSize(18).setForegroundColor("#1B4332").setBold(true);

  var sBox = slide.insertTextBox(subtitle, 50, 58, 620, 24);
  sBox.getText().getTextStyle().setFontSize(11).setForegroundColor("#6B7280");
}

/** 문서 헤딩 추가 도우미 */
function appendDocHeading(body, text) {
  var h = body.appendParagraph(text);
  h.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  h.setFontFamily("Malgun Gothic");
  h.setFontSize(13);
  h.setForegroundColor("#1B4332");
  h.setSpacingBefore(12);
  h.setSpacingAfter(6);
  return h;
}

/** 문서 KPI 카드 테이블 도우미 */
function appendDocKpiTable(body, matrix) {
  var table = body.appendTable(matrix);
  table.setBorderColor("#E5E7EB");
  var colCount = matrix[0].length;
  for (var r = 0; r < 2; r++) {
    var row = table.getRow(r);
    for (var c = 0; c < colCount; c++) {
      var cell = row.getCell(c);
      cell.setPaddingTop(6);
      cell.setPaddingBottom(6);
      cell.setPaddingLeft(8);
      cell.setPaddingRight(8);
      if (r === 0) {
        cell.setBackgroundColor("#F4FBF7");
        cell.editAsText().setBold(true).setForegroundColor("#2D6A4F").setFontSize(10).setFontFamily("Malgun Gothic");
      } else {
        cell.setBackgroundColor("#FFFFFF");
        cell.editAsText().setBold(true).setForegroundColor("#111827").setFontSize(14).setFontFamily("Malgun Gothic");
      }
    }
  }
  body.appendParagraph("").setSpacingAfter(8);
}

/** 문서 하이라이트 콜아웃 도우미 */
function appendDocCallout(body, title, content) {
  var table = body.appendTable([[title + "\\n" + content]]);
  table.setBorderColor("#2D6A4F");
  var cell = table.getCell(0, 0);
  cell.setBackgroundColor("#F4FBF7");
  cell.setPaddingTop(8);
  cell.setPaddingBottom(8);
  cell.setPaddingLeft(12);
  cell.setPaddingRight(12);
  var txt = cell.editAsText();
  txt.setFontFamily("Malgun Gothic");
  txt.setFontSize(11);
  txt.setForegroundColor("#1F2937");
  body.appendParagraph("").setSpacingAfter(8);
}

/** 문서 데이터 테이블 도우미 */
function appendDocDataTable(body, matrix) {
  var table = body.appendTable(matrix);
  table.setBorderColor("#CBD5E1");
  var rowCount = matrix.length;
  var colCount = matrix[0].length;
  for (var r = 0; r < rowCount; r++) {
    var row = table.getRow(r);
    for (var c = 0; c < colCount; c++) {
      var cell = row.getCell(c);
      cell.setPaddingTop(5);
      cell.setPaddingBottom(5);
      cell.setPaddingLeft(8);
      cell.setPaddingRight(8);
      if (r === 0) {
        cell.setBackgroundColor("#2D6A4F");
        cell.editAsText().setBold(true).setForegroundColor("#FFFFFF").setFontSize(10).setFontFamily("Malgun Gothic");
      } else {
        cell.setBackgroundColor(r % 2 === 1 ? "#FFFFFF" : "#F8FAFC");
        cell.editAsText().setForegroundColor("#1F2937").setFontSize(10).setFontFamily("Malgun Gothic");
      }
    }
  }
  body.appendParagraph("").setSpacingAfter(8);
}

function aiFailure(called, quota) {
  var out = { status: "error", message: called.message, usedToday: quota.used, dailyLimit: quota.limit };
  if (called.code) out.code = called.code;
  return out;
}

/** 관리 화면에서 오늘 사용량을 본다 — AI 를 부르지 않고, 횟수도 늘리지 않는다 */
function readAiUsage() {
  var props = PropertiesService.getScriptProperties();
  var limit = aiDailyLimit(props);
  var today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
  var used = String(props.getProperty("AI_USED_DAY") || "") === today ? Number(props.getProperty("AI_USED_COUNT") || 0) : 0;
  return {
    status: "success",
    usedToday: used,
    dailyLimit: limit,
    model: currentAiModel(props),
    keyConfigured: Boolean(String(props.getProperty("GEMINI_API_KEY") || "").trim())
  };
}

function aiDailyLimit(props) {
  var limit = Number(props.getProperty("AI_DAILY_LIMIT") || AI_DAILY_LIMIT_DEFAULT);
  return !limit || limit < 1 ? AI_DAILY_LIMIT_DEFAULT : limit;
}

/** 오늘 남은 횟수 확인 — 날짜가 바뀌면 자동으로 0 부터 (여기서는 세지 않는다) */
function checkAiQuota(props) {
  var limit = aiDailyLimit(props);
  var today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
  var used = String(props.getProperty("AI_USED_DAY") || "") === today ? Number(props.getProperty("AI_USED_COUNT") || 0) : 0;
  return { allowed: used < limit, used: used, limit: limit, today: today };
}

/** Gemini 가 요청을 받았을 때만 한 번 센다 (권한·네트워크 실패는 세지 않는다) */
function countAiQuota(props, quota) {
  quota.used = quota.used + 1;
  props.setProperty("AI_USED_DAY", quota.today);
  props.setProperty("AI_USED_COUNT", String(quota.used));
}

function reportSystemPrompt(audience) {
  var common = [
    "지켜야 할 규칙",
    "1. 주어진 자료에 있는 숫자만 씁니다. 새 숫자를 만들거나 직접 계산하지 마세요.",
    "2. 자료에 없는 사실(환경 효과, 인증, 다른 사례, 예측치)을 지어내지 마세요.",
    "3. collection 은 매장에서 걷은 양, compost 는 목장에 하역해 부숙 중인 양입니다.",
    "   서로 다른 숫자이므로 하나를 다른 하나로 바꿔 말하거나 더하지 마세요.",
    "4. 목장은 한 구역에 커피박을 계속 모으고 기존 커피박과 섞습니다.",
    "   앞뒤 기록을 같은 커피박 한 묶음의 부숙 변화라고 설명하지 마세요.",
    "5. field 의 판정(beddingStatus)과 추세는 앱이 코드로 계산한 값입니다. 바꾸지 말고 그대로 쓰세요.",
    "6. 과장하지 말고, 자료가 없는 항목(null)은 자료가 없다고 쓰거나 언급하지 마세요."
  ];

  if (audience === "official") {
    return [
      "당신은 지자체·커피 공급처·협력 기관에 내는 '커피박 자원순환 사업 실적 보고서'를 쓰는 담당자입니다.",
      "읽는 사람은 현장을 모르는 외부 기관입니다. 사업 성과와 의의를 공식 보고서 문체로 정리합니다.",
      ""
    ].concat(common, [
      "7. 문장은 개조식 보고서체로 끝냅니다 (예: '~함', '~임', '~할 계획임'). '~습니다' 같은 존댓말은 쓰지 않습니다.",
      "8. 혼합 횟수, 곰팡이, 방문 간격, 함수율 같은 현장 작업 세부는 쓰지 않습니다.",
      "9. 절감액(savings)은 가정에 따른 추정치임을 밝힙니다. 수거량 출처가 현장 하역 기록이면 그렇게 밝힙니다.",
      "",
      "답은 아래 JSON 형식만 씁니다. 다른 말은 붙이지 마세요.",
      '{"headline":"...","summary":"...","meaning":"...","recommendation":"...","actions":["...","...","..."]}',
      "- headline: 보고서 제목 (예: 'OOOO년 O월 커피박 자원순환 추진 실적'), 30자 이내",
      "- summary: 추진 실적 — 수거량, 참여 매장 수, 전월 대비, 목장 자원화(부숙) 현황 (2~3문장)",
      "- meaning: 성과와 의의 — 톱밥 대체 절감 추정, 폐자원의 축산 자원화 (2~3문장)",
      "- recommendation: 향후 계획 (2문장)",
      "- actions: 향후 추진 과제 3가지, 명사형으로 끝냄 (예: '참여 매장 확대 검토'), 각 30자 이내"
    ]).join("\\n");
  }

  return [
    "당신은 목장 관리자에게 이번 달 커피박 더미 관리 상황을 알려 주는 현장 담당자입니다.",
    "읽는 사람은 현장에서 일하는 사람입니다. 더미 상태와 다음에 할 일을 쉽게 정리합니다.",
    ""
  ].concat(common, [
    "7. 짧고 쉬운 존댓말로 씁니다. 어려운 용어는 풀어 씁니다.",
    "8. 혼합은 기존 커피박을 삽으로 한 번씩 뒤집어 주는 작업입니다.",
    "9. 매장 수거량·절감액 같은 사업 성과는 쓰지 않거나 한 문장 이내로만 씁니다.",
    "",
    "답은 아래 JSON 형식만 씁니다. 다른 말은 붙이지 마세요.",
    '{"headline":"...","summary":"...","meaning":"...","recommendation":"...","actions":["...","...","..."]}',
    "- headline: 지금 더미 상태를 한 줄로 (예: '함수율이 내려가며 깔개 사용 준비 중'), 25자 이내",
    "- summary: 이번 달 현장 상황 — 투입량, 현재 더미량, 함수율·온도 추세 (2~3문장)",
    "- meaning: 관리 포인트 — 깔개 사용 판단과 그 이유, 혼합·곰팡이 상태 (2~3문장)",
    "- recommendation: 다음 방문 때 할 일 (2문장)",
    "- actions: 현장 작업 3가지, '~하기'로 끝냄 (예: '기존 커피박을 삽으로 뒤집기'), 각 25자 이내"
  ]).join("\\n");
}

function explainSystemPrompt(kind) {
  var topic = {
    field: "커피박 더미를 소 깔개로 쓸 수 있는지에 대한 앱의 판정(status)과, 앱이 찾아낸 이상 신호(signals)",
    farm: "새 목장에 커피박 부숙 관리를 적용할 때 앱이 정한 운영 유형·관리 수준·부족한 조건",
    farmReport: "목장 내부용 보고서의 더미 상태·깔개 사용 판정(beddingStatus)·혼합·곰팡이 관리 현황"
  }[kind];

  return [
    "당신은 목장 현장 관리자에게 " + topic + "을 짧게 풀어 설명하는 도우미입니다.",
    "",
    "지켜야 할 규칙",
    "1. 판정·상태·숫자는 앱이 코드로 정한 값입니다. 바꾸거나 새로 계산하지 말고 그대로 설명만 하세요.",
    "2. 자료에 없는 숫자나 사실을 만들지 마세요. 자료가 부족하면 부족하다고 쓰세요.",
    "3. 혼합은 기존 커피박을 삽으로 한 번씩 뒤집어 주는 작업입니다.",
    "4. 목장은 한 구역에 커피박을 계속 모아 섞으므로, 측정값은 그 시점의 전체 더미 상태입니다.",
    "5. 과거 기록을 하나하나 다시 읊지 말고, 핵심만 쓰세요.",
    "6. 한국어 존댓말, 쉬운 말로 씁니다.",
    "7. 값이 null 이거나 unknown 이면 기록이 없다는 뜻입니다. 0 이나 '없음'으로 바꿔 말하지 마세요.",
    "",
    "답은 아래 JSON 형식만 씁니다. 다른 말은 붙이지 마세요.",
    '{"summary":"...","actions":["...","..."]}',
    "- summary: 2~4문장",
    "- actions: 현장에서 할 일 1~3개, 각 35자 이내"
  ].join("\\n");
}

/** 스크립트 속성의 모델 → 자동으로 찾아 둔 모델 → 기본값 */
function currentAiModel(props) {
  var model = props.getProperty("AI_MODEL") || props.getProperty("AI_MODEL_RESOLVED") || AI_MODEL_DEFAULT;
  return String(model).trim() || AI_MODEL_DEFAULT;
}

/**
 * 이 키로 쓸 수 있는 최신 Flash 모델을 찾는다 (모델 목록 조회는 요금이 없다).
 * 미리보기·실험·이미지·음성 모델과 Lite 는 뺀다.
 */
function findFlashModel(apiKey) {
  var res = UrlFetchApp.fetch(AI_ENDPOINT.replace(/\\/$/, "") + "?pageSize=1000", {
    muteHttpExceptions: true,
    headers: { "x-goog-api-key": apiKey }
  });
  if (res.getResponseCode() !== 200) return null;

  var models = JSON.parse(res.getContentText()).models || [];
  var best = null;
  var bestVersion = -1;
  for (var i = 0; i < models.length; i++) {
    var name = String(models[i].name || "").replace(/^models\\//, "");
    var methods = models[i].supportedGenerationMethods || [];
    var matched = /^gemini-(\\d+(?:\\.\\d+)?)-flash$/.exec(name);
    if (!matched || methods.indexOf("generateContent") < 0) continue;
    var version = Number(matched[1]);
    if (version > bestVersion) {
      best = name;
      bestVersion = version;
    }
  }
  return best;
}

function geminiOptions(apiKey, model, systemText, userText, maxTokens, thinkingOff) {
  var generationConfig = {
    temperature: 0.3,
    maxOutputTokens: maxTokens,
    responseMimeType: "application/json"
  };
  // flash 계열은 생각(thinking) 토큰도 출력 요금이라 끈다 — 짧은 설명에는 필요 없다
  if (thinkingOff) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  return {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: generationConfig
    }),
    muteHttpExceptions: true,
    headers: { "x-goog-api-key": apiKey }
  };
}

/**
 * Gemini 를 부른다. 성공하면 { ok: true, json }
 * - 모델이 없어졌으면(404) 쓸 수 있는 최신 Flash 모델을 찾아 저장하고 한 번 더 부른다
 * - 모델이 thinking 끄기를 받지 않으면(400) 그 설정을 빼고 한 번 더 부른다
 * - 서버 오류(5xx)는 잠시 뒤 한 번 더 부른다
 */
function callGemini(prep, systemText, userText, maxTokens) {
  var model = prep.model;
  var thinkingOff = /flash/.test(model);
  var modelSearched = false;
  var serverRetried = false;

  for (var attempt = 0; attempt < 4; attempt++) {
    var response;
    try {
      response = UrlFetchApp.fetch(
        AI_ENDPOINT + encodeURIComponent(model) + ":generateContent",
        geminiOptions(prep.apiKey, model, systemText, userText, maxTokens, thinkingOff)
      );
    } catch (err) {
      // 예외를 그대로 던지면 웹 앱이 CORS 없는 오류 화면을 돌려줘 앱에서는 '통신 실패'로만 보인다
      if (/권한|permission|external_request/i.test(String(err))) {
        return {
          ok: false,
          code: "no_permission",
          message: "Apps Script 에 외부 서비스 연결 권한이 없습니다. 편집기에서 setupAiAccess 를 한 번 실행해 허용한 뒤 새 버전으로 배포해주세요."
        };
      }
      return { ok: false, message: "AI 서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해주세요." };
    }
    var code = response.getResponseCode();

    if (code === 404) {
      // 없는 모델은 요금이 없으므로 사용 횟수에 세지 않는다
      var found = null;
      if (!modelSearched) {
        modelSearched = true;
        try {
          found = findFlashModel(prep.apiKey);
        } catch (searchErr) {
          found = null;
        }
      }
      if (found && found !== model) {
        if (prep.props.getProperty("AI_MODEL") === model) prep.props.deleteProperty("AI_MODEL");
        prep.props.setProperty("AI_MODEL_RESOLVED", found);
        model = found;
        prep.model = found;
        thinkingOff = /flash/.test(found);
        continue;
      }
      return {
        ok: false,
        message: "AI 모델(" + model + ")을 찾을 수 없습니다. 스크립트 속성 AI_MODEL 에 쓸 수 있는 모델 이름을 넣어주세요."
      };
    }

    countAiQuota(prep.props, prep.quota);
    var body = response.getContentText();

    if (code === 200) return readGeminiReply(body);
    if (code === 400 && thinkingOff && /thinking/i.test(body)) {
      thinkingOff = false;
      continue;
    }
    if (code === 429) {
      return { ok: false, code: "rate_limited", message: "AI 서버가 혼잡합니다. 잠시 뒤 다시 시도해주세요." };
    }
    if (code >= 500) {
      if (!serverRetried) {
        serverRetried = true;
        Utilities.sleep(1500);
        continue;
      }
      return { ok: false, code: "rate_limited", message: "AI 서버가 혼잡합니다. 잠시 뒤 다시 시도해주세요." };
    }
    if (code === 400 || code === 403) {
      return { ok: false, message: "AI 키 또는 모델(" + model + ") 설정을 확인해주세요. (오류 " + code + ")" };
    }
    return { ok: false, message: "AI 요청이 실패했습니다. (오류 " + code + ")" };
  }
  return { ok: false, message: "AI 요청이 실패했습니다." };
}

/** Gemini 응답에서 JSON 한 덩어리를 꺼낸다 */
function readGeminiReply(body) {
  var parsed;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    return { ok: false, message: "AI 응답을 해석하지 못했습니다." };
  }

  if (parsed.promptFeedback && parsed.promptFeedback.blockReason) {
    return { ok: false, message: "AI 가 요청을 거절했습니다 (" + parsed.promptFeedback.blockReason + ")." };
  }

  var candidates = parsed.candidates || [];
  if (!candidates.length) return { ok: false, message: "AI 가 빈 응답을 보냈습니다." };

  var parts = (candidates[0].content && candidates[0].content.parts) || [];
  var text = "";
  for (var i = 0; i < parts.length; i++) text += String(parts[i].text || "");
  text = text.trim();
  if (!text) return { ok: false, message: "AI 가 빈 응답을 보냈습니다." };

  // 형식이 어긋나 앞뒤에 다른 글자가 붙어 오는 경우까지 받아 준다
  var start = text.indexOf("{");
  var end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, message: "AI 응답 형식이 올바르지 않습니다." };

  try {
    return { ok: true, json: JSON.parse(text.slice(start, end + 1)) };
  } catch (err2) {
    return { ok: false, message: "AI 응답 형식이 올바르지 않습니다. (응답이 길어 잘렸을 수 있습니다)" };
  }
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
      recordKey: String(r[KEY_COL - 1] || ""),
      // 예전 행은 이 칸들이 비어 있다. 빈 값을 그대로 넘겨 앱이 "기록 없음"으로 보이게 한다.
      workType: String(r[WORK_COL - 1] || ""),
      addedKg: String(r[ADDED_COL - 1] === 0 ? "0" : (r[ADDED_COL - 1] || "")),
      mixed: String(r[MIXED_COL - 1] || ""),
      moldStatus: String(r[MOLD_COL - 1] || ""),
      odor: String(r[ODOR_COL - 1] || ""),
      beddingUsedKg: String(r[BEDDING_COL - 1] === 0 ? "0" : (r[BEDDING_COL - 1] || "")),
      cycleId: String(r[CYCLE_COL - 1] || "")
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
      if (row.keepMeasured) {
        var earlier = pending[pendingIndex[key]].values;
        for (var m = 0; m < MEASURED_COLS.length; m++) {
          row.values[MEASURED_COLS[m] - 1] = earlier[MEASURED_COLS[m] - 1];
        }
      }
      pending[pendingIndex[key]] = row;
      continue;
    }

    var existing = keyMap[key];
    if (existing) {
      // 같은 날 회사가 잰 측정값을 현장 점검 저장이 빈칸으로 지우지 않게 한다
      if (row.keepMeasured) {
        var current = sheet.getRange(existing, 1, 1, HEADERS.length).getValues()[0];
        for (var c = 0; c < MEASURED_COLS.length; c++) {
          row.values[MEASURED_COLS[c] - 1] = current[MEASURED_COLS[c] - 1];
        }
      }
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

  // 현장 점검(inspection) 타입이면 측정 콜럼(D~K, M~N)은 빈 칸으로 남긴다
  // — 수거량, 심부온도, 함수율, 외기온도, 외기습도, 판정, 3지점에 0 이 기록되지 않도록
  var isInspection = String(data.recordType || "") === "inspection";

  // 외부에서 온 글자는 모두 safeText 로, 숫자는 optionalNumber/safeNumber 로 넣는다 (수식 주입 방지)
  return {
    values: [
      DATETIME_RE.test(String(data.dateTime || "")) ? data.dateTime : fieldNow(),
      safeText(data.ranchName || "-"),
      safeText(data.location || "-"),
      isInspection ? "" : optionalNumber(data.collectedKg),   // D 수거량
      isInspection ? "" : optionalNumber(data.coreTemp),      // E 심부 온도
      isInspection ? "" : optionalNumber(data.moisture),      // F 심부 함수율
      isInspection ? "" : optionalNumber(data.ambientTemp),   // G 외기 온도
      isInspection ? "" : optionalNumber(data.ambientHum),    // H 외기 습도
      isInspection ? "" : delta(data.coreTempDelta),          // I 직전 대비 심부온도
      isInspection ? "" : delta(data.moistureDelta),          // J 직전 대비 함수율
      isInspection ? "" : safeText(data.verdictTitle || ""),  // K 판정
      safeText(data.notes || ""),                             // L 비고
      isInspection ? "" : safeText(data.coreTempPoints || ""), // M 심부온도 3지점
      isInspection ? "" : safeText(data.moisturePoints || ""), // N 심부함수율 3지점
      "", "", "",
      links.join("\\n"),
      safeText(data.recordKey),
      // v13 칸 — 앱이 값을 보내지 않으면 빈 칸으로 남긴다 (0 이나 '없음'으로 채우지 않는다)
      safeText(data.workType || ""),                          // T 작업 유형
      isInspection ? "" : optionalNumber(data.addedKg),      // U 신규 투입량
      safeText(data.mixed || ""),                             // V 혼합 여부
      safeText(data.moldStatus || ""),                        // W 곰팡이 상태
      safeText(data.odor || ""),                              // X 이상 냄새
      optionalNumber(data.beddingUsedKg),                     // Y 깔개 사용량
      safeText(data.cycleId || "")                            // Z 운영 사이클 ID
    ],
    formulas: formulas,
    // 기존 행을 갱신할 때 측정 칸을 시트 값 그대로 둔다
    keepMeasured: isInspection
  };
}

function verdictStyle(text) {
  text = String(text || "");
  if (text.indexOf("사용 후보") !== -1 || text.indexOf("사용 가능") !== -1) return ["#e6f4ea", "#137333", "bold"];
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
    title: "사진·AI 권한 허용 (처음 한 번)",
    desc: "편집기 위쪽 함수 선택 칸에서 'setupPhotoFolder'를 고르고 [실행] → [권한 검토] → 계정 선택 → '확인되지 않은 앱' 경고가 나오면 [고급] → [이동] → [허용]을 누릅니다. 이어서 'setupAiAccess'도 같은 방법으로 실행해 외부 서비스 연결(AI) 권한을 허용합니다. 이미 허용했다면 건너뜁니다.",
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
