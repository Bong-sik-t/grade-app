// ============================================================
// Firebase 연동
// ============================================================

var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDMUa0ot2GiOjyl3srznHpwrjR1-Er6idY",
  authDomain:        "first-grade-app-75b91.firebaseapp.com",
  databaseURL:       "https://first-grade-app-75b91-default-rtdb.firebaseio.com",
  projectId:         "first-grade-app-75b91",
  storageBucket:     "first-grade-app-75b91.firebasestorage.app",
  messagingSenderId: "639317143626",
  appId:             "1:639317143626:web:a4ba28c6df201ab2ce76b3"
};

// ============================================================
// Firebase 데이터 구조
// /1학년앱/
//   yajaData/{month}/{cls}/{studentIdx}/{dow}/{p8|y1|y2}
//   seoksiData/{month}/{cls}/{studentIdx}/{dow}
//   attendCheck/{month}/{dateStr}/{cls}/{p8|y1|y2}/{studentIdx}
//   absentReasons/{month}/{dateStr}/{key}
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

var _db = null;
var _fbListeners = [];  // 실시간 리스너 목록

function fbInit() {
  if (_db) return;
  firebase.initializeApp(FIREBASE_CONFIG);
  _db = firebase.database();
}

function fbRef(path) {
  if (path === '') return _db.ref('/1학년앱');
  return _db.ref('/1학년앱/' + path);
}

// ── 전체 로드 (초기 1회) ──
function fbLoadAll(callback) {
  fbRef('').once('value').then(function(snap) {
    var d = snap.val() || {};
    callback(d);
  });
}

// ── 일반 데이터 저장 (출석/불참사유 제외) ──
// updates: { 'yajaData': ..., 'seoksiData': ..., ... }
function fbSaveData(updates) {
  return fbRef('').update(updates);
}

// ── 출석 체크 단건 저장 (동시 입력 충돌 방지 핵심) ──
function fbSaveAttendOne(month, dateStr, cls, period, idx, val) {
  var path = 'attendCheck/' + month + '/' + dateStr + '/' + cls + '/' + period + '/' + idx;
  if (val) {
    return fbRef(path).set(true);
  } else {
    return fbRef(path).remove();
  }
}

// ── 불참사유 단건 저장 ──
function fbSaveAbsentReason(month, dateStr, key, reason) {
  var safeKey = key.replace(/\|/g, '__');
  var ref = fbRef('absentReasons/' + month + '/' + dateStr + '/' + safeKey);
  if (reason) return ref.set(reason);
  else return ref.remove();
}

// ── 야자 신청 단건 저장 (학생별-요일별) ──
function fbSaveYajaOne(month, cls, idx, dow, val) {
  return fbRef('yajaData/' + month + '/' + cls + '/' + idx + '/' + dow).set(val);
}

// ── 석식 신청 단건 저장 ──
function fbSaveSeoksiOne(month, cls, idx, dow, val) {
  return fbRef('seoksiData/' + month + '/' + cls + '/' + idx + '/' + dow).set(val);
}

// ── 감독표 단건 저장 ──
function fbSaveSvOne(month, key, val) {
  return fbRef('svData/' + month + '/' + key).set(val);
}

// ── 실시간 출석 구독 (날짜별) ──
function fbSubscribeAttend(month, dateStr, onUpdate) {
  var ref = fbRef('attendCheck/' + month + '/' + dateStr);
  var listener = ref.on('value', function(snap) {
    onUpdate(snap.val() || {});
  });
  _fbListeners.push({ ref: ref, listener: listener, type: 'attend' });
}

// ── 실시간 불참사유 구독 (월별) ──
function fbSubscribeAbsentReasons(month, onUpdate) {
  var ref = fbRef('absentReasons/' + month);
  var listener = ref.on('value', function(snap) {
    // Firebase key: __ → | 복원
    var raw = snap.val() || {};
    var result = {};
    Object.keys(raw).forEach(function(dateStr) {
      result[dateStr] = {};
      Object.keys(raw[dateStr] || {}).forEach(function(safeKey) {
        var key = safeKey.replace(/__/g, '|');
        result[dateStr][key] = raw[dateStr][safeKey];
      });
    });
    onUpdate(result);
  });
  _fbListeners.push({ ref: ref, listener: listener, type: 'absent' });
}

// ── 특정 타입 리스너만 해제 ──
function fbUnsubscribeByType(type) {
  _fbListeners = _fbListeners.filter(function(l) {
    if (l.type === type) { l.ref.off('value', l.listener); return false; }
    return true;
  });
}

// ── 전체 리스너 해제 ──
function fbUnsubscribeAll() {
  _fbListeners.forEach(function(l) { l.ref.off('value', l.listener); });
  _fbListeners = [];
}
