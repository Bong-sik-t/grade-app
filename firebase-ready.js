// ============================================================
// Firebase 연동 준비 파일
// 사용자가 Firebase 프로젝트를 생성하면 아래 config를 채우고
// index.html 상단의 USE_FIREBASE = false → true 로 변경
// ============================================================

// ① Firebase 콘솔(console.firebase.google.com)에서 프로젝트 생성 후
//    프로젝트 설정 > 일반 > 내 앱 > 웹앱 추가 > 여기에 붙여넣기
var FIREBASE_CONFIG = {
  apiKey:            "FILL_IN",
  authDomain:        "FILL_IN",
  databaseURL:       "FILL_IN",   // Realtime Database URL
  projectId:         "FILL_IN",
  storageBucket:     "FILL_IN",
  messagingSenderId: "FILL_IN",
  appId:             "FILL_IN"
};

// ============================================================
// Firebase SDK 로드 (index.html <head>에 추가 예정)
// ============================================================
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js"></script>

// ============================================================
// Firebase 데이터 구조
// /1학년앱/
//   yajaData/{month}/{cls}/{studentIdx}/{dow}/{p8|y1|y2}
//   seoksiData/{month}/{cls}/{studentIdx}/{dow}
//   attendCheck/{month}/{dateStr}/{cls}/{p8|y1|y2}/{studentIdx}
//   absentReasons/{month}/{dateStr}/{key}        ← 동시 입력 핵심
//   svData/{month}/{key}/{name|isFri|skip|...}
//   svTeachersByMonth/{month}/{idx}
//   svFridayTeachersByMonth/{month}/{idx}
//   dormStudents/{cls}/{idx}
//   dormExceptions/{month}/{cls}/{num}/{dow}
//   afterSchoolExceptions/{cls}/{num}/{dow}
//   afterSchoolP8Off/{cls}/{num}/{dow}
//   studentRoster/{idx}/{cls|num|name|status|...}
//   scheduleData/{idx}/{date|title|type|target}
//   jumperData/{idx}/{...}
//   appPeriod/{start|end}
//   volunteerData/{idx}/{...}
// ============================================================

// ============================================================
// 기존 callApi() 대체 함수들
// ============================================================

var _db = null;
var _fbListeners = [];  // 실시간 리스너 목록

function fbInit() {
  if (_db) return;
  firebase.initializeApp(FIREBASE_CONFIG);
  _db = firebase.database();
}

function fbRef(path) {
  return _db.ref('/1학년앱/' + path);
}

// ── 전체 로드 (초기 1회) ──
function fbLoadAll(callback) {
  fbRef('').once('value').then(function(snap) {
    var d = snap.val() || {};
    callback(d);
  });
}

// ── 전체 저장 (기존 saveAllData 대체, 하위 호환용) ──
function fbSaveAll(data) {
  fbRef('').update(data);
}

// ── 출석 체크 단건 저장 (동시 입력 충돌 방지 핵심) ──
// 기존: scheduleSave() → 전체 덮어쓰기
// 변경: 해당 경로만 set → 다른 사람 데이터에 영향 없음
function fbSaveAttendOne(month, dateStr, cls, period, idx, val) {
  fbRef('attendCheck/' + month + '/' + dateStr + '/' + cls + '/' + period + '/' + idx).set(val);
}

// ── 불참사유 단건 저장 ──
function fbSaveAbsentReason(month, dateStr, key, reason) {
  var ref = fbRef('absentReasons/' + month + '/' + dateStr + '/' + key.replace(/\|/g, '__'));
  if (reason) ref.set(reason);
  else ref.remove();
}

// ── 실시간 출석/불참사유 구독 (폴링 대체) ──
function fbSubscribeAttend(month, dateStr, onUpdate) {
  var ref = fbRef('attendCheck/' + month + '/' + dateStr);
  var listener = ref.on('value', function(snap) {
    onUpdate(snap.val() || {});
  });
  _fbListeners.push({ ref: ref, listener: listener });
}

function fbSubscribeAbsentReasons(month, onUpdate) {
  var ref = fbRef('absentReasons/' + month);
  var listener = ref.on('value', function(snap) {
    onUpdate(snap.val() || {});
  });
  _fbListeners.push({ ref: ref, listener: listener });
}

function fbUnsubscribeAll() {
  _fbListeners.forEach(function(l) { l.ref.off('value', l.listener); });
  _fbListeners = [];
}

// ── 야자 신청 단건 저장 ──
function fbSaveYajaOne(month, cls, idx, dow, val) {
  fbRef('yajaData/' + month + '/' + cls + '/' + idx + '/' + dow).set(val);
}

// ── 감독표 단건 저장 ──
function fbSaveSvOne(month, key, val) {
  fbRef('svData/' + month + '/' + key).set(val);
}

// ============================================================
// index.html 전환 시 변경 포인트 요약
// ============================================================
// 1. <head>에 Firebase SDK 스크립트 2개 추가
// 2. USE_FIREBASE = true 설정
// 3. window.onload 에서 loadFromSheet() → fbLoadAll(restoreAll) 변경
// 4. toggleChk() 안의 scheduleSave() → fbSaveAttendOne() 변경
// 5. saveAbsentReason() → fbSaveAbsentReason() 변경
// 6. startAbsentPolling() → fbSubscribeAbsentReasons() 변경
// 7. 나머지 scheduleSave() → fbSaveAll(collectSaveData()) 변경
//    (야자신청, 석식 등은 동시입력 거의 없어서 기존 방식 유지 가능)
// ============================================================
