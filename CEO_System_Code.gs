// ============================================================================
// CEO PRODUCTIVITY SYSTEM - Google Apps Script Backend API
// ============================================================================
// Deploy as Web App: Execute as ME, Access: Anyone
// Replace SPREADSHEET_ID with your actual Google Sheet ID.
// Run init() once to create all tabs with headers.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. CONFIGURATION
// ---------------------------------------------------------------------------

var SPREADSHEET_ID = '1h8bpJaYeezAi-rGduUYEQh5VLB2V7giIMUp6mDns9rQ';

var SHEETS = {
  MASTERS: 'Masters',
  QC: 'Quick Capture',
  SL: 'Someday List',
  IS: 'Information System',
  RT: 'Recurring Tasks',
  DS: 'Daily Schedule',
  DR: 'Daily Report',
  WS: 'Weekly Scorecard',
  NWP: 'Next Week Plan',
  DASHBOARD: 'Dashboard'
};

var TIME_SLOTS = [
  '7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM',
  '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM',
  '4:00 PM','4:30 PM','5:00 PM','5:30 PM','6:00 PM','6:30 PM','7:00 PM'
];

var MASTERS_DATA = {
  priority: ['High','Medium','Low'],
  batchType: ['Communication','Deep Work','Admin','Meeting','Sales Call','Planning'],
  taskStatus: ['Not Started','In Progress','Done','Blocked','Cancelled','Deferred'],
  schedStatus: ['Scheduled','Waiting','Completed','Skipped'],
  infoCategory: ['Sales & BD','Client Delivery','Product Strategy','Finance','HR & Team','Operations','Marketing','AI / Tech R&D','Admin','Learning','Personal'],
  dayRating: ['Excellent','Good','Average','Poor','Bad'],
  timeSlots: TIME_SLOTS,
  frequency: ['Daily','Weekly','Monthly','Yearly','Fixed Date'],
  weekday: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
  weekPosition: ['First','Second','Third','Fourth','Last'],
  recurringStatus: ['Active','Paused','Stopped']
};

// ---------------------------------------------------------------------------
// 2. doGet HANDLER
// ---------------------------------------------------------------------------

function doGet(e) {
  var params = e ? e.parameter : {};
  var action = params.action || '';
  var callback = params.callback || '';
  var result;

  try {
    // Check if this is a POST-via-GET request (JSONP can only do GET)
    var payload = params.payload ? JSON.parse(decodeURIComponent(params.payload)) : null;

    if (payload) {
      // Route write actions via payload parameter
      var body = payload;
      body.action = action;
      switch (action) {
        case 'addTask':
          result = handleAddTask(body);
          break;
        case 'updateTask':
          result = handleUpdateTask(body);
          break;
        case 'deleteTask':
          result = handleDeleteTask(body);
          break;
        case 'addRecurring':
          result = handleAddRecurring(body);
          break;
        case 'updateRecurring':
          result = handleUpdateRecurring(body);
          break;
        case 'deleteRecurring':
          result = handleDeleteRecurring(body);
          break;
        case 'markDone':
          result = handleMarkDone(body);
          break;
        case 'setDayRating':
          result = handleSetDayRating(body);
          break;
        case 'updateDailyReport':
          result = handleUpdateDailyReport(body);
          break;
        case 'updateWeeklyScorecard':
          result = handleUpdateWeeklyScorecard(body);
          break;
        case 'updateInfoSystem':
          result = handleUpdateInfoSystem(body);
          break;
        case 'updateMasters':
          result = handleUpdateMasters(body);
          break;
        case 'saveDSNotes':
          result = handleSaveDSNotes(body);
          break;
        case 'exportAll':
          result = handleExportAll();
          break;
        case 'importAll':
          result = handleImportAll(body);
          break;
        default:
          result = { success: false, error: 'Unknown write action: ' + action };
      }
    } else {
      // Standard GET read actions
      switch (action) {
        case 'getMasters':
          result = handleGetMasters();
          break;
        case 'getQuickCapture':
          result = handleGetQuickCapture();
          break;
        case 'getSomedayList':
          result = handleGetSomedayList();
          break;
        case 'getInformationSystem':
          result = handleGetInformationSystem();
          break;
        case 'getRecurringTasks':
          result = handleGetRecurringTasks();
          break;
        case 'getDailySchedule':
          result = handleGetDailySchedule(params.date || formatDate(new Date()));
          break;
        case 'getDailyReport':
          result = handleGetDailyReport();
          break;
        case 'getWeeklyScorecard':
          result = handleGetWeeklyScorecard();
          break;
        case 'getNextWeekPlan':
          result = handleGetNextWeekPlan();
          break;
        case 'getDashboard':
          result = handleGetDashboard();
          break;
        case 'init':
          result = init();
          break;
        case 'getAllData':
          result = handleGetAllData();
          break;
        default:
          result = { success: false, error: 'Unknown action: ' + action };
      }
    }
  } catch (err) {
    result = { success: false, error: err.toString(), stack: err.stack };
  }

  var jsonStr = JSON.stringify(result);

  // JSONP support for CORS
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonStr + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// 3. doPost HANDLER
// ---------------------------------------------------------------------------

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, error: 'Invalid JSON body' });
  }

  var action = body.action || '';
  var result;

  try {
    switch (action) {
      case 'addTask':
        result = handleAddTask(body);
        break;
      case 'updateTask':
        result = handleUpdateTask(body);
        break;
      case 'deleteTask':
        result = handleDeleteTask(body);
        break;
      case 'addRecurring':
        result = handleAddRecurring(body);
        break;
      case 'updateRecurring':
        result = handleUpdateRecurring(body);
        break;
      case 'deleteRecurring':
        result = handleDeleteRecurring(body);
        break;
      case 'markDone':
        result = handleMarkDone(body);
        break;
      case 'setDayRating':
        result = handleSetDayRating(body);
        break;
      case 'updateDailyReport':
        result = handleUpdateDailyReport(body);
        break;
      case 'updateWeeklyScorecard':
        result = handleUpdateWeeklyScorecard(body);
        break;
      case 'updateInfoSystem':
        result = handleUpdateInfoSystem(body);
        break;
      case 'updateMasters':
        result = handleUpdateMasters(body);
        break;
      case 'saveDSNotes':
        result = handleSaveDSNotes(body);
        break;
      case 'exportAll':
        result = handleExportAll();
        break;
      case 'importAll':
        result = handleImportAll(body);
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { success: false, error: err.toString(), stack: err.stack };
  }

  return jsonResponse(result);
}

// ---------------------------------------------------------------------------
// 6. HELPER FUNCTIONS
// ---------------------------------------------------------------------------

function getSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss;
}

function getSheet(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }
  return sheet;
}

function getSheetData(sheetName) {
  var sheet = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return [];
  return sheet.getRange(1, 1, lastRow, lastCol).getValues();
}

function getSheetHeaders(sheetName) {
  var sheet = getSheet(sheetName);
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

function appendRow(sheetName, rowData) {
  var sheet = getSheet(sheetName);
  sheet.appendRow(rowData);
  return sheet.getLastRow();
}

function updateRow(sheetName, rowNum, rowData) {
  var sheet = getSheet(sheetName);
  if (rowNum < 1 || rowNum > sheet.getLastRow()) {
    throw new Error('Row ' + rowNum + ' out of range in ' + sheetName);
  }
  var cols = rowData.length;
  if (cols > 0) {
    sheet.getRange(rowNum, 1, 1, cols).setValues([rowData]);
  }
}

function deleteRow(sheetName, rowNum) {
  var sheet = getSheet(sheetName);
  if (rowNum < 2 || rowNum > sheet.getLastRow()) {
    throw new Error('Row ' + rowNum + ' out of range in ' + sheetName);
  }
  sheet.deleteRow(rowNum);
}

function findRows(sheetName, colIndex, value) {
  var data = getSheetData(sheetName);
  var results = [];
  for (var i = 1; i < data.length; i++) { // skip header
    if (String(data[i][colIndex]).trim() === String(value).trim()) {
      results.push({ rowNum: i + 1, data: data[i] });
    }
  }
  return results;
}

function formatDate(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  var dd = ('0' + date.getDate()).slice(-2);
  var mm = ('0' + (date.getMonth() + 1)).slice(-2);
  var yyyy = date.getFullYear();
  return dd + '-' + mm + '-' + yyyy;
}

function formatDateISO(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  var dd = ('0' + date.getDate()).slice(-2);
  var mm = ('0' + (date.getMonth() + 1)).slice(-2);
  var yyyy = date.getFullYear();
  return yyyy + '-' + mm + '-' + dd;
}

function formatTime(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return hours + ':' + ('0' + minutes).slice(-2) + ' ' + ampm;
}

function formatCellTime(val) {
  if (!val) return '';
  if (val instanceof Date) return formatTime(val);
  var s = String(val);
  // If it looks like a Date string (e.g. "Sat Dec 30 1899..."), parse and format
  if (s.indexOf('1899') > -1 || s.indexOf('GMT') > -1) {
    try { return formatTime(new Date(s)); } catch(e) { return ''; }
  }
  return s;
}

function parseDate(str) {
  if (!str) return null;
  str = String(str).trim();
  if (str instanceof Date) return str;
  // Try DD-MM-YYYY
  var parts = str.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
      // DD-MM-YYYY
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
  }
  // Try Date object from sheet
  var d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function todayDate() {
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(msg) {
  return jsonResponse({ success: false, error: msg });
}

function rowToObj(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    obj[headers[i]] = i < row.length ? row[i] : '';
  }
  return obj;
}

function dateDiffDays(d1, d2) {
  var t1 = new Date(d1); t1.setHours(0,0,0,0);
  var t2 = new Date(d2); t2.setHours(0,0,0,0);
  return Math.round((t2 - t1) / 86400000);
}

function sameDay(d1, d2) {
  if (!d1 || !d2) return false;
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function dateInRange(d, start, end) {
  if (!d || !start || !end) return false;
  var t = d.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

// ---------------------------------------------------------------------------
// 4. CORE COMPUTATION FUNCTIONS
// ---------------------------------------------------------------------------

// --- computeNextOccurrence ---

function computeNextOccurrence(freq, weekday, weekPos, fixedDate) {
  var today = todayDate();

  if (freq === 'Daily') return new Date(today);

  if (freq === 'Weekly') {
    var days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    var targetDay = days.indexOf(weekday);
    if (targetDay < 0) return null;
    var currentDay = (today.getDay() + 6) % 7; // Mon=0 ... Sun=6
    var diff = (targetDay - currentDay + 7) % 7;
    var result = new Date(today);
    result.setDate(result.getDate() + diff);
    return result;
  }

  if (freq === 'Monthly') {
    var dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    var targetDayIdx = dayNames.indexOf(weekday);
    if (targetDayIdx < 0) return null;
    var jsDayTarget = (targetDayIdx + 1) % 7; // Convert Mon=0 to JS Sun=0

    var posMap = { 'First': 1, 'Second': 2, 'Third': 3, 'Fourth': 4, 'Last': 99 };
    var posNum = posMap[weekPos] || 1;

    // Try current month first, then next month
    for (var mOff = 0; mOff <= 1; mOff++) {
      var year = today.getFullYear();
      var month = today.getMonth() + mOff;
      if (month > 11) { month -= 12; year++; }

      var candidate = findNthWeekdayInMonth(year, month, jsDayTarget, posNum);
      if (candidate && candidate >= today) return candidate;
    }
    // Fallback to two months ahead
    var year2 = today.getFullYear();
    var month2 = today.getMonth() + 2;
    if (month2 > 11) { month2 -= 12; year2++; }
    return findNthWeekdayInMonth(year2, month2, jsDayTarget, posNum);
  }

  if (freq === 'Yearly') {
    var fd = parseDate(fixedDate);
    if (!fd) return null;
    var thisYear = new Date(today.getFullYear(), fd.getMonth(), fd.getDate());
    thisYear.setHours(0,0,0,0);
    if (thisYear >= today) return thisYear;
    return new Date(today.getFullYear() + 1, fd.getMonth(), fd.getDate());
  }

  if (freq === 'Fixed Date') {
    var fd2 = parseDate(fixedDate);
    return fd2 || null;
  }

  return null;
}

function findNthWeekdayInMonth(year, month, jsDayTarget, posNum) {
  if (posNum === 99) {
    // Last occurrence
    var lastDay = new Date(year, month + 1, 0); // last day of month
    var diff = (lastDay.getDay() - jsDayTarget + 7) % 7;
    var result = new Date(year, month, lastDay.getDate() - diff);
    result.setHours(0,0,0,0);
    return result;
  }

  // Find first occurrence of jsDayTarget in month
  var first = new Date(year, month, 1);
  var firstDayOfWeek = first.getDay();
  var offset = (jsDayTarget - firstDayOfWeek + 7) % 7;
  var firstOccurrence = 1 + offset;
  var nthDate = firstOccurrence + (posNum - 1) * 7;

  // Check if still in same month
  var candidate = new Date(year, month, nthDate);
  candidate.setHours(0,0,0,0);
  if (candidate.getMonth() !== month) return null;
  return candidate;
}

// --- computeSomedayList ---

function computeSomedayList() {
  var today = todayDate();
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 1. Read QC data where SendTo = "Someday List"
  var qcData = getSheetData(SHEETS.QC);
  var qcHeaders = qcData.length > 0 ? qcData[0] : [];
  var qcColMap = buildColMap(qcHeaders);

  var qcTasks = [];
  for (var i = 1; i < qcData.length; i++) {
    var row = qcData[i];
    var sendTo = String(row[qcColMap['SendTo']] || '').trim();
    if (sendTo === 'Someday List') {
      qcTasks.push({
        source: 'QC',
        rowNum: i + 1,
        task: String(row[qcColMap['Task']] || ''),
        priority: String(row[qcColMap['Priority']] || ''),
        batchType: String(row[qcColMap['BatchType']] || ''),
        slStatus: String(row[qcColMap['SLStatus']] || 'Not Started'),
        schedDate: row[qcColMap['SchedDate']] || '',
        schedTime: String(row[qcColMap['SchedTime']] || ''),
        sdNum: parseInt(row[qcColMap['SD#']] || '0') || i,
        dateAdded: row[qcColMap['Date']] || '',
        notes: String(row[qcColMap['Notes']] || ''),
        isNum: parseInt(row[qcColMap['IS#']] || '0') || 0,
        sortVal: parseInt(row[qcColMap['Sort']] || '0') || i
      });
    }
  }

  // 2. Read RT data where Status = "Active"
  var rtData = getSheetData(SHEETS.RT);
  var rtHeaders = rtData.length > 0 ? rtData[0] : [];
  var rtColMap = buildColMap(rtHeaders);

  var rtTasks = [];
  for (var j = 1; j < rtData.length; j++) {
    var rRow = rtData[j];
    var status = String(rRow[rtColMap['Status']] || '').trim();
    if (status !== 'Active') continue;

    var freq = String(rRow[rtColMap['Frequency']] || '');
    var weekday = String(rRow[rtColMap['Weekday']] || '');
    var weekPos = String(rRow[rtColMap['WeekPosition']] || '');
    var fixedDate = rRow[rtColMap['FixedDate']] || '';
    var nextOcc = computeNextOccurrence(freq, weekday, weekPos, fixedDate);

    var isDue = false;
    if (nextOcc) {
      isDue = sameDay(nextOcc, today) || sameDay(nextOcc, tomorrow);
    }

    rtTasks.push({
      source: 'RT',
      rowNum: j + 1,
      task: String(rRow[rtColMap['Task']] || ''),
      priority: String(rRow[rtColMap['Priority']] || ''),
      batchType: String(rRow[rtColMap['BatchType']] || ''),
      slStatus: String(rRow[rtColMap['SLStatus']] || 'Not Started'),
      frequency: freq,
      weekday: weekday,
      weekPosition: weekPos,
      fixedDate: fixedDate,
      nextOccurrence: nextOcc ? formatDate(nextOcc) : '',
      nextOccurrenceISO: nextOcc ? formatDateISO(nextOcc) : '',
      isDue: isDue,
      dueRank: isDue ? (sameDay(nextOcc, today) ? 0 : 1) : 99,
      notes: String(rRow[rtColMap['Notes']] || '')
    });
  }

  // 3. ARC = count of due recurring tasks
  var dueRecurring = rtTasks.filter(function(t) { return t.isDue; });
  var arc = dueRecurring.length;

  // 4. Sort due recurring by dueRank then task name
  dueRecurring.sort(function(a, b) {
    if (a.dueRank !== b.dueRank) return a.dueRank - b.dueRank;
    return a.task.localeCompare(b.task);
  });

  // 5. Sort QC tasks by SD#
  qcTasks.sort(function(a, b) { return a.sdNum - b.sdNum; });

  // 6. Build unified list: due recurring first, then QC
  var unified = [];
  var schNum = 0;
  var waitNum = 0;
  var seq = 0;

  // Read DS done flags for today
  var dsData = getDSDoneFlags(formatDateISO(today));

  // Process due recurring tasks
  for (var r = 0; r < dueRecurring.length; r++) {
    seq++;
    var rt = dueRecurring[r];
    var baseStatus = rt.slStatus;
    var isScheduled = (baseStatus === 'Scheduled');
    var isWaiting = (baseStatus === 'Waiting');

    if (isScheduled) schNum++;
    if (isWaiting) waitNum++;

    var schedDateStr = rt.nextOccurrenceISO || '';
    var schedTimeStr = '';
    var timeKey = schedDateStr ? (schedDateStr + '|' + schedTimeStr) : '';

    // Check if done in DS
    var finalStatus = baseStatus;
    var doneKey = rt.source + '|' + rt.rowNum;
    if (dsData[doneKey] === 'Yes') {
      finalStatus = 'Completed';
    }

    unified.push({
      seq: seq,
      source: 'RT',
      rowNum: rt.rowNum,
      task: rt.task,
      priority: rt.priority,
      batchType: rt.batchType,
      baseStatus: baseStatus,
      finalStatus: finalStatus,
      schNum: isScheduled ? schNum : null,
      waitNum: isWaiting ? waitNum : null,
      schedDate: schedDateStr,
      schedTime: schedTimeStr,
      timeKey: timeKey,
      frequency: rt.frequency,
      nextOccurrence: rt.nextOccurrence,
      isDue: rt.isDue,
      notes: rt.notes,
      nwRank: 0
    });
  }

  // Process QC tasks
  for (var q = 0; q < qcTasks.length; q++) {
    seq++;
    var qc = qcTasks[q];
    var qcBase = qc.slStatus;
    var qcSched = (qcBase === 'Scheduled');
    var qcWait = (qcBase === 'Waiting');

    if (qcSched) schNum++;
    if (qcWait) waitNum++;

    var qcSchedDate = '';
    if (qc.schedDate) {
      var sd = parseDate(qc.schedDate);
      qcSchedDate = sd ? formatDateISO(sd) : String(qc.schedDate);
    }
    var qcSchedTime = qc.schedTime || '';
    var qcTimeKey = qcSchedDate ? (qcSchedDate + '|' + qcSchedTime) : '';

    var qcFinal = qcBase;
    var qcDoneKey = 'QC|' + qc.rowNum;
    if (dsData[qcDoneKey] === 'Yes') {
      qcFinal = 'Completed';
    }

    unified.push({
      seq: seq,
      source: 'QC',
      rowNum: qc.rowNum,
      task: qc.task,
      priority: qc.priority,
      batchType: qc.batchType,
      baseStatus: qcBase,
      finalStatus: qcFinal,
      schNum: qcSched ? schNum : null,
      waitNum: qcWait ? waitNum : null,
      schedDate: qcSchedDate,
      schedTime: qcSchedTime,
      timeKey: qcTimeKey,
      frequency: '',
      nextOccurrence: '',
      isDue: false,
      notes: qc.notes,
      nwRank: qc.sortVal
    });
  }

  return {
    success: true,
    arc: arc,
    totalScheduled: schNum,
    totalWaiting: waitNum,
    totalTasks: unified.length,
    tasks: unified
  };
}

function getDSDoneFlags(dateISO) {
  var flags = {};
  try {
    var dsData = getSheetData(SHEETS.DS);
    if (dsData.length < 2) return flags;
    var dsHeaders = dsData[0];
    var dsColMap = buildColMap(dsHeaders);
    for (var i = 1; i < dsData.length; i++) {
      var row = dsData[i];
      var rowDate = '';
      if (row[dsColMap['Date']]) {
        var rd = parseDate(row[dsColMap['Date']]);
        rowDate = rd ? formatDateISO(rd) : String(row[dsColMap['Date']]);
      }
      if (rowDate === dateISO) {
        var src = String(row[dsColMap['Source']] || '');
        var srcRow = String(row[dsColMap['SourceRow']] || '');
        var done = String(row[dsColMap['Done']] || '');
        if (src && srcRow) {
          flags[src + '|' + srcRow] = done;
        }
      }
    }
  } catch (e) {
    // DS sheet may not exist yet
  }
  return flags;
}

function buildColMap(headers) {
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    map[String(headers[i]).trim()] = i;
  }
  return map;
}

// --- computeDailySchedule ---

function computeDailySchedule(dateStr) {
  var targetDate = parseDate(dateStr);
  if (!targetDate) {
    return { success: false, error: 'Invalid date: ' + dateStr };
  }
  var dateISO = formatDateISO(targetDate);

  // Get the Someday List
  var sl = computeSomedayList();
  var tasks = sl.tasks || [];

  // Build time grid: 25 slots
  var timeGrid = [];
  for (var s = 0; s < TIME_SLOTS.length; s++) {
    var slot = TIME_SLOTS[s];
    var slotKey = dateISO + '|' + slot;
    var matchedTask = null;

    for (var t = 0; t < tasks.length; t++) {
      if (tasks[t].timeKey === slotKey) {
        matchedTask = tasks[t];
        break;
      }
    }

    timeGrid.push({
      time: slot,
      timeKey: slotKey,
      task: matchedTask
    });
  }

  // Build task panel: scheduled for this date
  var scheduled = [];
  var waiting = [];

  for (var u = 0; u < tasks.length; u++) {
    var tk = tasks[u];
    if (tk.schedDate === dateISO) {
      if (tk.baseStatus === 'Scheduled' || tk.finalStatus === 'Completed') {
        if (scheduled.length < 8) scheduled.push(tk);
      }
      if (tk.baseStatus === 'Waiting') {
        if (waiting.length < 8) waiting.push(tk);
      }
    }
  }

  // Sort by schNum / waitNum
  scheduled.sort(function(a, b) { return (a.schNum || 0) - (b.schNum || 0); });
  waiting.sort(function(a, b) { return (a.waitNum || 0) - (b.waitNum || 0); });

  // Day rating
  var dayRating = getDayRating(dateISO);

  // Actually Done notes
  var actuallyDone = getDSNotes(dateISO);

  return {
    success: true,
    date: dateISO,
    dateFormatted: formatDate(targetDate),
    timeGrid: timeGrid,
    scheduled: scheduled,
    waiting: waiting,
    dayRating: dayRating,
    actuallyDone: actuallyDone,
    totalScheduled: scheduled.length,
    totalWaiting: waiting.length
  };
}

function getDayRating(dateISO) {
  try {
    var dsData = getSheetData(SHEETS.DS);
    if (dsData.length < 2) return '';
    var headers = dsData[0];
    var colMap = buildColMap(headers);
    for (var i = 1; i < dsData.length; i++) {
      var row = dsData[i];
      var rd = parseDate(row[colMap['Date']]);
      if (rd && formatDateISO(rd) === dateISO) {
        if (row[colMap['DayRating']]) return String(row[colMap['DayRating']]);
      }
    }
  } catch (e) {}
  return '';
}

function getDSNotes(dateISO) {
  try {
    var dsData = getSheetData(SHEETS.DS);
    if (dsData.length < 2) return '';
    var headers = dsData[0];
    var colMap = buildColMap(headers);
    for (var i = 1; i < dsData.length; i++) {
      var row = dsData[i];
      var rd = parseDate(row[colMap['Date']]);
      if (rd && formatDateISO(rd) === dateISO) {
        if (row[colMap['ActuallyDone']]) return String(row[colMap['ActuallyDone']]);
      }
    }
  } catch (e) {}
  return '';
}

// --- computeDailyReport ---

function computeDailyReport() {
  var today = todayDate();
  var days = [];

  // Read DR manual data
  var drData = getSheetData(SHEETS.DR);
  var drHeaders = drData.length > 0 ? drData[0] : [];
  var drColMap = buildColMap(drHeaders);
  var drMap = {};
  for (var d = 1; d < drData.length; d++) {
    var drRow = drData[d];
    var drDate = parseDate(drRow[drColMap['Date']]);
    if (drDate) {
      drMap[formatDateISO(drDate)] = {
        dayRating: String(drRow[drColMap['DayRating']] || ''),
        achievements: String(drRow[drColMap['Achievements']] || ''),
        notes: String(drRow[drColMap['Notes']] || ''),
        rowNum: d + 1
      };
    }
  }

  // Read QC data for task counts
  var qcData = getSheetData(SHEETS.QC);
  var qcHeaders = qcData.length > 0 ? qcData[0] : [];
  var qcColMap = buildColMap(qcHeaders);

  var totalScheduled = 0;
  var totalCompleted = 0;
  var totalDays = 0;
  var daysAbove80 = 0;
  var daysBelow50 = 0;

  for (var i = 0; i < 30; i++) {
    var d2 = new Date(today);
    d2.setDate(d2.getDate() - i);
    var dISO = formatDateISO(d2);

    // Count tasks for this date from QC
    var scheduled = 0;
    var completed = 0;
    var waitCount = 0;

    for (var q = 1; q < qcData.length; q++) {
      var qRow = qcData[q];
      var sendTo = String(qRow[qcColMap['SendTo']] || '');
      if (sendTo !== 'Someday List') continue;

      var sd = parseDate(qRow[qcColMap['SchedDate']]);
      if (!sd || formatDateISO(sd) !== dISO) continue;

      var slSt = String(qRow[qcColMap['SLStatus']] || '');
      if (slSt === 'Scheduled' || slSt === 'Completed') {
        scheduled++;
        if (slSt === 'Completed') completed++;
      }
      if (slSt === 'Waiting') waitCount++;
    }

    var pct = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;
    totalScheduled += scheduled;
    totalCompleted += completed;
    if (scheduled > 0) {
      totalDays++;
      if (pct >= 80) daysAbove80++;
      if (pct < 50) daysBelow50++;
    }

    var manual = drMap[dISO] || { dayRating: '', achievements: '', notes: '', rowNum: 0 };

    days.push({
      date: dISO,
      dateFormatted: formatDate(d2),
      scheduled: scheduled,
      completed: completed,
      completionPct: pct,
      waiting: waitCount,
      dayRating: manual.dayRating,
      achievements: manual.achievements,
      notes: manual.notes,
      rowNum: manual.rowNum
    });
  }

  var overallPct = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;
  var avgPerDay = totalDays > 0 ? Math.round(totalScheduled / totalDays * 10) / 10 : 0;

  return {
    success: true,
    days: days,
    monthlySummary: {
      totalScheduled: totalScheduled,
      totalCompleted: totalCompleted,
      overallCompletionPct: overallPct,
      avgTasksPerDay: avgPerDay,
      daysTracked: totalDays,
      daysAbove80Pct: daysAbove80,
      daysBelow50Pct: daysBelow50
    }
  };
}

// --- computeWeeklyScorecard ---

function computeWeeklyScorecard() {
  var year = new Date().getFullYear();

  // Week 1 starts on Monday of the week containing March 1
  var march1 = new Date(year, 2, 1); // March 1
  var march1Day = (march1.getDay() + 6) % 7; // Mon=0
  var week1Start = new Date(march1);
  week1Start.setDate(march1.getDate() - march1Day);
  week1Start.setHours(0,0,0,0);

  // Read WS manual data
  var wsData = getSheetData(SHEETS.WS);
  var wsHeaders = wsData.length > 0 ? wsData[0] : [];
  var wsColMap = buildColMap(wsHeaders);
  var wsMap = {};
  for (var w = 1; w < wsData.length; w++) {
    var wsRow = wsData[w];
    var weekNum = parseInt(wsRow[wsColMap['WeekNum']] || '0');
    if (weekNum > 0) {
      wsMap[weekNum] = {
        achievements: String(wsRow[wsColMap['Achievements']] || ''),
        carryForward: String(wsRow[wsColMap['CarryForward']] || ''),
        rowNum: w + 1
      };
    }
  }

  // Read QC data
  var qcData = getSheetData(SHEETS.QC);
  var qcHeaders = qcData.length > 0 ? qcData[0] : [];
  var qcColMap = buildColMap(qcHeaders);

  // Read DR data for day ratings
  var drData = getSheetData(SHEETS.DR);
  var drHeaders = drData.length > 0 ? drData[0] : [];
  var drColMap = buildColMap(drHeaders);
  var drRatingMap = {};
  for (var dr = 1; dr < drData.length; dr++) {
    var drRow = drData[dr];
    var drd = parseDate(drRow[drColMap['Date']]);
    if (drd) {
      drRatingMap[formatDateISO(drd)] = String(drRow[drColMap['DayRating']] || '');
    }
  }

  var ratingValues = { 'Excellent': 5, 'Good': 4, 'Average': 3, 'Poor': 2, 'Bad': 1 };

  var weeks = [];

  for (var wk = 1; wk <= 44; wk++) {
    var wkStart = new Date(week1Start);
    wkStart.setDate(wkStart.getDate() + (wk - 1) * 7);
    var wkEnd = new Date(wkStart);
    wkEnd.setDate(wkEnd.getDate() + 6);
    wkEnd.setHours(23, 59, 59, 999);

    var planned = 0;
    var done = 0;

    for (var qi = 1; qi < qcData.length; qi++) {
      var qr = qcData[qi];
      var sendTo = String(qr[qcColMap['SendTo']] || '');
      if (sendTo !== 'Someday List') continue;

      var sd = parseDate(qr[qcColMap['SchedDate']]);
      if (!sd) continue;

      if (dateInRange(sd, wkStart, wkEnd)) {
        var slSt = String(qr[qcColMap['SLStatus']] || '');
        if (slSt === 'Scheduled' || slSt === 'Completed') {
          planned++;
          if (slSt === 'Completed') done++;
        }
      }
    }

    var completionPct = planned > 0 ? Math.round((done / planned) * 100) : 0;

    // Avg day rating for the week
    var ratingSum = 0;
    var ratingCount = 0;
    for (var di = 0; di < 7; di++) {
      var dd = new Date(wkStart);
      dd.setDate(dd.getDate() + di);
      var ddISO = formatDateISO(dd);
      var rating = drRatingMap[ddISO];
      if (rating && ratingValues[rating]) {
        ratingSum += ratingValues[rating];
        ratingCount++;
      }
    }
    var avgRating = ratingCount > 0 ? Math.round(ratingSum / ratingCount * 10) / 10 : 0;

    var manual = wsMap[wk] || { achievements: '', carryForward: '', rowNum: 0 };

    weeks.push({
      weekNum: wk,
      startDate: formatDate(wkStart),
      startDateISO: formatDateISO(wkStart),
      endDate: formatDate(wkEnd),
      endDateISO: formatDateISO(wkEnd),
      planned: planned,
      done: done,
      completionPct: completionPct,
      avgDayRating: avgRating,
      achievements: manual.achievements,
      carryForward: manual.carryForward,
      rowNum: manual.rowNum
    });
  }

  return {
    success: true,
    year: year,
    totalWeeks: 44,
    weeks: weeks
  };
}

// --- computeNextWeekPlan ---

function computeNextWeekPlan() {
  var today = todayDate();
  // Find next Monday
  var currentDay = (today.getDay() + 6) % 7; // Mon=0
  var daysToMon = (7 - currentDay) % 7;
  if (daysToMon === 0) daysToMon = 7;
  var nextMon = new Date(today);
  nextMon.setDate(nextMon.getDate() + daysToMon);

  var weekDates = [];
  for (var d = 0; d < 6; d++) { // Mon to Sat
    var dd = new Date(nextMon);
    dd.setDate(dd.getDate() + d);
    weekDates.push({
      date: formatDate(dd),
      dateISO: formatDateISO(dd),
      dayName: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d]
    });
  }

  // Get Someday List tasks
  var sl = computeSomedayList();
  var tasks = sl.tasks || [];

  // Build calendar grid: 6 days x 25 slots
  var grid = [];
  for (var day = 0; day < 6; day++) {
    var dayGrid = [];
    var dayISO = weekDates[day].dateISO;

    for (var s = 0; s < TIME_SLOTS.length; s++) {
      var slotKey = dayISO + '|' + TIME_SLOTS[s];
      var matchedTask = null;

      for (var t = 0; t < tasks.length; t++) {
        if (tasks[t].timeKey === slotKey) {
          matchedTask = tasks[t];
          break;
        }
      }

      dayGrid.push({
        time: TIME_SLOTS[s],
        timeKey: slotKey,
        task: matchedTask
      });
    }
    grid.push(dayGrid);
  }

  // Find unscheduled tasks for next week (scheduled but no time slot, up to 15)
  var unscheduled = [];
  var nwStartISO = weekDates[0].dateISO;
  var nwEndISO = weekDates[5].dateISO;

  for (var u = 0; u < tasks.length; u++) {
    var tk = tasks[u];
    if (tk.schedDate >= nwStartISO && tk.schedDate <= nwEndISO) {
      if (!tk.schedTime || tk.schedTime === '') {
        if (unscheduled.length < 15) {
          unscheduled.push(tk);
        }
      }
    }
  }

  // Sort by nwRank
  unscheduled.sort(function(a, b) { return (a.nwRank || 0) - (b.nwRank || 0); });

  return {
    success: true,
    weekDates: weekDates,
    grid: grid,
    unscheduled: unscheduled
  };
}

// --- computeDashboard ---

function computeDashboard() {
  var today = todayDate();
  var todayISO = formatDateISO(today);

  // QC stats
  var qcData = getSheetData(SHEETS.QC);
  var qcHeaders = qcData.length > 0 ? qcData[0] : [];
  var qcColMap = buildColMap(qcHeaders);

  var qcTotal = qcData.length - 1;
  var toSomeday = 0;
  var toInfoSystem = 0;
  var highPriority = 0;
  var scheduledToday = 0;
  var waitingToday = 0;
  var completedToday = 0;
  var overdue = 0;

  for (var i = 1; i < qcData.length; i++) {
    var row = qcData[i];
    var sendTo = String(row[qcColMap['SendTo']] || '');
    var priority = String(row[qcColMap['Priority']] || '');
    var slStatus = String(row[qcColMap['SLStatus']] || '');
    var schedDate = parseDate(row[qcColMap['SchedDate']]);

    if (sendTo === 'Someday List') toSomeday++;
    if (sendTo === 'Information System') toInfoSystem++;
    if (priority === 'High') highPriority++;

    if (sendTo === 'Someday List' && schedDate) {
      var sdISO = formatDateISO(schedDate);
      if (sdISO === todayISO) {
        if (slStatus === 'Scheduled') scheduledToday++;
        if (slStatus === 'Waiting') waitingToday++;
        if (slStatus === 'Completed') completedToday++;
      }
      if (sdISO < todayISO && slStatus !== 'Completed' && slStatus !== 'Cancelled') {
        overdue++;
      }
    }
  }

  // RT stats
  var rtData = getSheetData(SHEETS.RT);
  var rtHeaders = rtData.length > 0 ? rtData[0] : [];
  var rtColMap = buildColMap(rtHeaders);

  var rtTotal = rtData.length - 1;
  var rtActive = 0;
  var rtPaused = 0;
  var rtDueToday = 0;
  var rtDueTomorrow = 0;

  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  for (var j = 1; j < rtData.length; j++) {
    var rRow = rtData[j];
    var rtStatus = String(rRow[rtColMap['Status']] || '');
    if (rtStatus === 'Active') rtActive++;
    if (rtStatus === 'Paused') rtPaused++;

    if (rtStatus === 'Active') {
      var freq = String(rRow[rtColMap['Frequency']] || '');
      var weekday = String(rRow[rtColMap['Weekday']] || '');
      var weekPos = String(rRow[rtColMap['WeekPosition']] || '');
      var fixedDate = rRow[rtColMap['FixedDate']] || '';
      var nextOcc = computeNextOccurrence(freq, weekday, weekPos, fixedDate);
      if (nextOcc && sameDay(nextOcc, today)) rtDueToday++;
      if (nextOcc && sameDay(nextOcc, tomorrow)) rtDueTomorrow++;
    }
  }

  // SL stats from computed list
  var sl = computeSomedayList();
  var slTotal = sl.totalTasks;

  // Monthly report
  var dr = computeDailyReport();
  var monthlySummary = dr.monthlySummary;

  return {
    success: true,
    quickCapture: {
      total: qcTotal,
      toSomeday: toSomeday,
      toInfoSystem: toInfoSystem,
      highPriority: highPriority
    },
    somedayList: {
      total: slTotal,
      scheduledToday: scheduledToday,
      waiting: waitingToday,
      completed: completedToday,
      overdue: overdue
    },
    today: {
      scheduled: scheduledToday,
      waiting: waitingToday
    },
    recurringTasks: {
      total: rtTotal,
      active: rtActive,
      paused: rtPaused,
      dueToday: rtDueToday,
      dueTomorrow: rtDueTomorrow
    },
    monthlyReport: {
      daysTracked: monthlySummary.daysTracked,
      avgCompletion: monthlySummary.overallCompletionPct
    }
  };
}

// ---------------------------------------------------------------------------
// GET HANDLERS
// ---------------------------------------------------------------------------

function handleGetMasters() {
  return { success: true, masters: MASTERS_DATA };
}

function handleGetQuickCapture() {
  var data = getSheetData(SHEETS.QC);
  if (data.length < 2) return { success: true, headers: [], rows: [] };

  var headers = data[0];
  var colMap = buildColMap(headers);
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = rowToObj(headers, row);
    obj._rowNum = i + 1;
    // Compute SD# (sequential among Someday List)
    obj._sdNum = i;
    // Compute IS# (sequential among Info System)
    var sendTo = String(row[colMap['SendTo']] || '');
    obj._sendTo = sendTo;
    rows.push(obj);
  }

  // Compute sequential SD# and IS#
  var sdCount = 0;
  var isCount = 0;
  for (var r = 0; r < rows.length; r++) {
    if (rows[r]._sendTo === 'Someday List') {
      sdCount++;
      rows[r]['SD#'] = sdCount;
    }
    if (rows[r]._sendTo === 'Information System') {
      isCount++;
      rows[r]['IS#'] = isCount;
    }
  }

  return { success: true, headers: headers, rows: rows, totalRows: rows.length };
}

function handleGetSomedayList() {
  return computeSomedayList();
}

function handleGetInformationSystem() {
  var data = getSheetData(SHEETS.IS);
  if (data.length < 2) return { success: true, headers: [], rows: [] };

  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var obj = rowToObj(headers, data[i]);
    obj._rowNum = i + 1;
    rows.push(obj);
  }

  return { success: true, headers: headers, rows: rows, totalRows: rows.length };
}

function handleGetRecurringTasks() {
  var data = getSheetData(SHEETS.RT);
  if (data.length < 2) return { success: true, headers: [], rows: [] };

  var headers = data[0];
  var colMap = buildColMap(headers);
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = rowToObj(headers, row);
    obj._rowNum = i + 1;

    // Compute NextOccurrence
    var freq = String(row[colMap['Frequency']] || '');
    var weekday = String(row[colMap['Weekday']] || '');
    var weekPos = String(row[colMap['WeekPosition']] || '');
    var fixedDate = row[colMap['FixedDate']] || '';
    var status = String(row[colMap['Status']] || '');

    if (status === 'Active') {
      var nextOcc = computeNextOccurrence(freq, weekday, weekPos, fixedDate);
      obj._nextOccurrence = nextOcc ? formatDate(nextOcc) : '';
      obj._nextOccurrenceISO = nextOcc ? formatDateISO(nextOcc) : '';
      obj._isDue = nextOcc ? (sameDay(nextOcc, todayDate()) || sameDay(nextOcc, new Date(todayDate().getTime() + 86400000))) : false;
    } else {
      obj._nextOccurrence = '';
      obj._nextOccurrenceISO = '';
      obj._isDue = false;
    }

    rows.push(obj);
  }

  return { success: true, headers: headers, rows: rows, totalRows: rows.length };
}

function handleGetDailySchedule(dateStr) {
  return computeDailySchedule(dateStr);
}

function handleGetDailyReport() {
  return computeDailyReport();
}

function handleGetWeeklyScorecard() {
  return computeWeeklyScorecard();
}

function handleGetNextWeekPlan() {
  return computeNextWeekPlan();
}

function handleGetDashboard() {
  return computeDashboard();
}

// ---------------------------------------------------------------------------
// FULL DATA SYNC - Returns ALL data in HTML localStorage-compatible format
// ---------------------------------------------------------------------------

function handleGetAllData() {
  try {
    // Helper: safe read sheet (returns [] if sheet doesn't exist)
    function safeGetSheetData(sheetName) {
      try {
        var ss = getSpreadsheet();
        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) return [];
        var lastRow = sheet.getLastRow();
        var lastCol = sheet.getLastColumn();
        if (lastRow < 1 || lastCol < 1) return [];
        return sheet.getRange(1, 1, lastRow, lastCol).getValues();
      } catch (e) { return []; }
    }

    // 1. Quick Capture → quickCapture array
    var quickCapture = [];
    try {
      var qcData = safeGetSheetData(SHEETS.QC);
      var qcHeaders = qcData.length > 0 ? qcData[0] : [];
      var qcColMap = buildColMap(qcHeaders);
      for (var i = 1; i < qcData.length; i++) {
        var row = qcData[i];
        // Skip completely empty rows
        var hasContent = false;
        for (var ci = 0; ci < row.length; ci++) { if (row[ci] !== '' && row[ci] !== null && row[ci] !== undefined) { hasContent = true; break; } }
        if (!hasContent) continue;
        var dateVal = row[qcColMap['Date']] || '';
        if (dateVal instanceof Date) dateVal = formatDateISO(dateVal);
        var schedDateVal = row[qcColMap['SchedDate']] || '';
        if (schedDateVal instanceof Date) schedDateVal = formatDateISO(schedDateVal);
        var deadlineVal = row[qcColMap['Deadline']] || '';
        if (deadlineVal instanceof Date) deadlineVal = formatDateISO(deadlineVal);
        quickCapture.push({
          id: i,
          _rowNum: i + 1,
          date: String(dateVal),
          time: formatCellTime(row[qcColMap['Time']] || ''),
          description: String(row[qcColMap['Task']] || ''),
          priority: String(row[qcColMap['Priority']] || 'Medium'),
          batchType: String(row[qcColMap['BatchType']] || ''),
          sendTo: String(row[qcColMap['SendTo']] || 'Someday List'),
          slStatus: String(row[qcColMap['SLStatus']] || 'Scheduled'),
          schedDate: String(schedDateVal),
          schedTimeFrom: formatCellTime(row[qcColMap['SchedTimeFrom']] || row[qcColMap['SchedTime']] || ''),
          schedTimeTo: formatCellTime(row[qcColMap['SchedTimeTo']] || ''),
          notes: String(row[qcColMap['Notes']] || ''),
          deadline: String(deadlineVal),
          status: String(row[qcColMap['Status']] || '')
        });
      }
    } catch (e) { /* QC sheet may not exist or be empty */ }

    // 2. Recurring Tasks → recurringTasks array
    var recurringTasks = [];
    try {
      var rtData = safeGetSheetData(SHEETS.RT);
      var rtHeaders = rtData.length > 0 ? rtData[0] : [];
      var rtColMap = buildColMap(rtHeaders);
      for (var j = 1; j < rtData.length; j++) {
        var rRow = rtData[j];
        var hasRtContent = false;
        for (var rci = 0; rci < rRow.length; rci++) { if (rRow[rci] !== '' && rRow[rci] !== null && rRow[rci] !== undefined) { hasRtContent = true; break; } }
        if (!hasRtContent) continue;
        var fixDateVal = rRow[rtColMap['FixedDate']] || '';
        if (fixDateVal instanceof Date) fixDateVal = formatDateISO(fixDateVal);
        recurringTasks.push({
          id: j,
          _rowNum: j + 1,
          name: String(rRow[rtColMap['Task']] || ''),
          frequency: String(rRow[rtColMap['Frequency']] || ''),
          weekday: String(rRow[rtColMap['Weekday']] || ''),
          weekPosition: String(rRow[rtColMap['WeekPosition']] || ''),
          fixedDate: String(fixDateVal),
          priority: String(rRow[rtColMap['Priority']] || 'Medium'),
          batchType: String(rRow[rtColMap['BatchType']] || ''),
          status: String(rRow[rtColMap['Status']] || 'Active'),
          slStatus: String(rRow[rtColMap['SLStatus']] || 'Scheduled'),
          timeSlot: String(rRow[rtColMap['TimeSlot']] || rRow[rtColMap['SchedTime']] || ''),
          notes: String(rRow[rtColMap['Notes']] || '')
        });
      }
    } catch (e) { /* RT sheet may not exist */ }

    // 3. Daily Schedule → dailySchedule object { dateKey: { doneFlags, notes, dayRating } }
    var dailySchedule = {};
    try {
      var dsData = safeGetSheetData(SHEETS.DS);
      var dsHeaders = dsData.length > 0 ? dsData[0] : [];
      var dsColMap = buildColMap(dsHeaders);
      for (var k = 1; k < dsData.length; k++) {
        var dsRow = dsData[k];
        var dsDateVal = dsRow[dsColMap['Date']] || '';
        if (dsDateVal instanceof Date) dsDateVal = formatDateISO(dsDateVal);
        else dsDateVal = String(dsDateVal);
        if (!dsDateVal) continue;

        if (!dailySchedule[dsDateVal]) {
          dailySchedule[dsDateVal] = { doneFlags: {}, notes: {}, dayRating: '' };
        }

        var src = String(dsRow[dsColMap['Source']] || '');
        var srcRow = String(dsRow[dsColMap['SourceRow']] || '');
        var done = String(dsRow[dsColMap['Done']] || '');
        var slot = String(dsRow[dsColMap['TimeSlot']] || dsRow[dsColMap['Slot']] || '');
        var noteText = String(dsRow[dsColMap['ActuallyDone']] || dsRow[dsColMap['Note']] || dsRow[dsColMap['Notes']] || '');
        var rating = String(dsRow[dsColMap['DayRating']] || dsRow[dsColMap['Rating']] || '');

        if (src && srcRow) {
          var doneKey = src.toLowerCase() + '_' + srcRow;
          dailySchedule[dsDateVal].doneFlags[doneKey] = (done === 'Yes' || done === 'true' || done === true);
        }
        if (slot && noteText) {
          dailySchedule[dsDateVal].notes[slot] = noteText;
        }
        if (rating) {
          dailySchedule[dsDateVal].dayRating = rating;
        }
      }
    } catch (e) { /* DS sheet may not exist */ }

    // 4. Daily Report → dailyReport object
    var dailyReport = {};
    try {
      var drData = safeGetSheetData(SHEETS.DR);
      var drHeaders = drData.length > 0 ? drData[0] : [];
      var drColMap = buildColMap(drHeaders);
      for (var m = 1; m < drData.length; m++) {
        var drRow = drData[m];
        var drDateVal = drRow[drColMap['Date']] || '';
        if (drDateVal instanceof Date) drDateVal = formatDateISO(drDateVal);
        else drDateVal = String(drDateVal);
        if (!drDateVal) continue;
        dailyReport[drDateVal] = {
          dayRating: String(drRow[drColMap['DayRating']] || drRow[drColMap['Rating']] || ''),
          achievements: String(drRow[drColMap['Achievements']] || ''),
          notes: String(drRow[drColMap['Notes']] || '')
        };
      }
    } catch (e) { /* DR sheet may not exist */ }

    // 5. Weekly Scorecard → weeklyScorecard object
    var weeklyScorecard = {};
    try {
      var wsData = safeGetSheetData(SHEETS.WS);
      var wsHeaders = wsData.length > 0 ? wsData[0] : [];
      var wsColMap = buildColMap(wsHeaders);
      for (var n = 1; n < wsData.length; n++) {
        var wsRow = wsData[n];
        var wn = parseInt(wsRow[wsColMap['WeekNum']] || wsRow[wsColMap['Week']] || n) || n;
        weeklyScorecard[wn] = {
          achievements: String(wsRow[wsColMap['Achievements']] || ''),
          carryForward: String(wsRow[wsColMap['CarryForward']] || '')
        };
      }
    } catch (e) { /* WS sheet may not exist */ }

    // 6. Information System → infoSystem array
    var infoSystem = [];
    try {
      var isData = safeGetSheetData(SHEETS.IS);
      var isHeaders = isData.length > 0 ? isData[0] : [];
      var isColMap = buildColMap(isHeaders);
      for (var p = 1; p < isData.length; p++) {
        var isRow = isData[p];
        var hasIsContent = false;
        for (var ici = 0; ici < isRow.length; ici++) { if (isRow[ici] !== '' && isRow[ici] !== null && isRow[ici] !== undefined) { hasIsContent = true; break; } }
        if (!hasIsContent) continue;
        infoSystem.push({
          id: p,
          sourceRow: parseInt(isRow[isColMap['SourceRow']] || p) || p,
          category: String(isRow[isColMap['Category']] || ''),
          notes: String(isRow[isColMap['Notes']] || '')
        });
      }
    } catch (e) { /* IS sheet may not exist */ }

    return {
      success: true,
      data: {
        quickCapture: quickCapture,
        recurringTasks: recurringTasks,
        dailySchedule: dailySchedule,
        dailyReport: dailyReport,
        weeklyScorecard: weeklyScorecard,
        infoSystem: infoSystem,
        masters: MASTERS_DATA
      },
      timestamp: new Date().toISOString(),
      source: 'google_sheets'
    };

  } catch (err) {
    return { success: false, error: err.toString(), stack: err.stack };
  }
}

// ---------------------------------------------------------------------------
// POST HANDLERS
// ---------------------------------------------------------------------------

function handleAddTask(body) {
  var now = new Date();
  var taskName = body.task || body.description || '';
  var rowData = [
    formatDate(now),                           // A: Date
    formatTime(now),                           // B: Time
    taskName,                                  // C: Task
    body.priority || 'Medium',                 // D: Priority
    body.batchType || '',                      // E: BatchType
    body.sendTo || 'Someday List',             // F: SendTo
    body.slStatus || 'Scheduled',              // G: SLStatus
    body.schedDate || '',                      // H: SchedDate
    body.schedTimeFrom || body.schedTime || body.timeSlot || '',  // I: SchedTimeFrom
    body.schedTimeTo || '',                    // J: SchedTimeTo
    body.deadline || '',                       // K: Deadline
    body.notes || '',                          // L: Notes
    '',                                        // M: SD#  (computed)
    '',                                        // N: IS#  (computed)
    '',                                        // O: Sort (computed)
    body.status || 'Not Started',              // P: Status
    ''                                         // Q: DoneDate
  ];

  var newRow = appendRow(SHEETS.QC, rowData);
  return { success: true, rowNum: newRow, message: 'Task added successfully' };
}

function handleUpdateTask(body) {
  var rowNum = parseInt(body.rowNum);
  if (!rowNum || rowNum < 2) return { success: false, error: 'Invalid row number' };

  var data = getSheetData(SHEETS.QC);
  if (rowNum > data.length) return { success: false, error: 'Row does not exist' };

  var existing = data[rowNum - 1];
  var headers = data[0];
  var colMap = buildColMap(headers);

  // Update only provided fields
  var fields = ['Date','Time','Task','Priority','BatchType','SendTo','SLStatus',
                'SchedDate','SchedTimeFrom','SchedTimeTo','Deadline','Notes','SD#','IS#','Sort','Status','DoneDate'];
  // Accept both Code.gs field names and HTML field names
  if (body.description !== undefined && body.task === undefined) body.task = body.description;
  if (body.name !== undefined && body.task === undefined) body.task = body.name;
  if (body.timeSlot !== undefined && body.schedTimeFrom === undefined) body.schedTimeFrom = body.timeSlot;
  var bodyKeys = { 'Date':'date','Time':'time','Task':'task','Priority':'priority',
                   'BatchType':'batchType','SendTo':'sendTo','SLStatus':'slStatus',
                   'SchedDate':'schedDate','SchedTimeFrom':'schedTimeFrom','SchedTimeTo':'schedTimeTo',
                   'Deadline':'deadline','Notes':'notes',
                   'Status':'status','DoneDate':'doneDate' };

  var updated = existing.slice();
  for (var key in bodyKeys) {
    if (body[bodyKeys[key]] !== undefined && colMap[key] !== undefined) {
      updated[colMap[key]] = body[bodyKeys[key]];
    }
  }

  updateRow(SHEETS.QC, rowNum, updated);
  return { success: true, rowNum: rowNum, message: 'Task updated successfully' };
}

function handleDeleteTask(body) {
  var rowNum = parseInt(body.rowNum);
  if (!rowNum || rowNum < 2) return { success: false, error: 'Invalid row number' };

  deleteRow(SHEETS.QC, rowNum);
  return { success: true, rowNum: rowNum, message: 'Task deleted successfully' };
}

function handleAddRecurring(body) {
  var taskName = body.task || body.name || '';
  var rowData = [
    taskName,                                  // A: Task
    body.priority || 'Medium',                 // B: Priority
    body.batchType || '',                      // C: BatchType
    body.frequency || 'Daily',                 // D: Frequency
    body.weekday || '',                        // E: Weekday
    body.weekPosition || '',                   // F: WeekPosition
    body.fixedDate || '',                      // G: FixedDate
    body.slStatus || 'Scheduled',              // H: SLStatus
    body.status || 'Active',                   // I: Status
    body.notes || '',                          // J: Notes
    body.timeSlot || body.schedTime || '',     // K: TimeSlot
    formatDate(new Date()),                    // L: DateAdded
    ''                                         // M: DateStopped
  ];

  var newRow = appendRow(SHEETS.RT, rowData);
  return { success: true, rowNum: newRow, message: 'Recurring task added successfully' };
}

function handleUpdateRecurring(body) {
  var rowNum = parseInt(body.rowNum);
  if (!rowNum || rowNum < 2) return { success: false, error: 'Invalid row number' };

  var data = getSheetData(SHEETS.RT);
  if (rowNum > data.length) return { success: false, error: 'Row does not exist' };

  var existing = data[rowNum - 1];
  var headers = data[0];
  var colMap = buildColMap(headers);

  // Accept both Code.gs field names and HTML field names
  if (body.name !== undefined && body.task === undefined) body.task = body.name;
  if (body.timeSlot !== undefined && body.schedTime === undefined) body.schedTime = body.timeSlot;
  var bodyKeys = { 'Task':'task','Priority':'priority','BatchType':'batchType',
                   'Frequency':'frequency','Weekday':'weekday','WeekPosition':'weekPosition',
                   'FixedDate':'fixedDate','SLStatus':'slStatus','Status':'status',
                   'Notes':'notes','TimeSlot':'timeSlot' };

  var updated = existing.slice();
  for (var key in bodyKeys) {
    if (body[bodyKeys[key]] !== undefined && colMap[key] !== undefined) {
      updated[colMap[key]] = body[bodyKeys[key]];
    }
  }

  // If status changed to 'Stopped', record the date
  if (body.status === 'Stopped' && colMap['DateStopped'] !== undefined) {
    updated[colMap['DateStopped']] = formatDate(new Date());
  }

  updateRow(SHEETS.RT, rowNum, updated);
  return { success: true, rowNum: rowNum, message: 'Recurring task updated successfully' };
}

function handleDeleteRecurring(body) {
  var rowNum = parseInt(body.rowNum);
  if (!rowNum || rowNum < 2) return { success: false, error: 'Invalid row number' };

  deleteRow(SHEETS.RT, rowNum);
  return { success: true, rowNum: rowNum, message: 'Recurring task deleted successfully' };
}

function handleMarkDone(body) {
  var dateStr = body.date || formatDateISO(new Date());
  var source = body.source || ''; // 'QC' or 'RT'
  var sourceRow = body.sourceRow || '';
  var done = body.done || 'Yes';

  var sheet = getSheet(SHEETS.DS);
  var data = getSheetData(SHEETS.DS);
  var headers = data.length > 0 ? data[0] : [];
  var colMap = buildColMap(headers);

  // Find existing row for this date + source + sourceRow
  var foundRow = -1;
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rd = parseDate(row[colMap['Date']]);
    var rdISO = rd ? formatDateISO(rd) : '';
    if (rdISO === dateStr &&
        String(row[colMap['Source']] || '') === source &&
        String(row[colMap['SourceRow']] || '') === String(sourceRow)) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow > 0) {
    // Update existing
    var existing = data[foundRow - 1];
    existing[colMap['Done']] = done;
    existing[colMap['DoneTime']] = formatTime(new Date());
    updateRow(SHEETS.DS, foundRow, existing);
  } else {
    // Add new
    var newRowData = [
      dateStr,          // Date
      source,           // Source
      sourceRow,        // SourceRow
      done,             // Done
      formatTime(new Date()), // DoneTime
      '',               // DayRating
      ''                // ActuallyDone
    ];
    appendRow(SHEETS.DS, newRowData);
  }

  return { success: true, message: 'Task marked as ' + done };
}

function handleSetDayRating(body) {
  var dateStr = body.date || formatDateISO(new Date());
  var rating = body.rating || '';

  var sheet = getSheet(SHEETS.DS);
  var data = getSheetData(SHEETS.DS);
  var headers = data.length > 0 ? data[0] : [];
  var colMap = buildColMap(headers);

  // Find existing rating row (Source is empty, it's a day-level record)
  var foundRow = -1;
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rd = parseDate(row[colMap['Date']]);
    var rdISO = rd ? formatDateISO(rd) : String(row[colMap['Date']] || '');
    if (rdISO === dateStr && String(row[colMap['Source']] || '') === '_DAY') {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow > 0) {
    var existing = data[foundRow - 1];
    existing[colMap['DayRating']] = rating;
    updateRow(SHEETS.DS, foundRow, existing);
  } else {
    var newRowData = [dateStr, '_DAY', '', '', '', rating, ''];
    appendRow(SHEETS.DS, newRowData);
  }

  return { success: true, message: 'Day rating set to ' + rating };
}

function handleUpdateDailyReport(body) {
  var dateStr = body.date || formatDateISO(new Date());
  var sheet = getSheet(SHEETS.DR);
  var data = getSheetData(SHEETS.DR);
  var headers = data.length > 0 ? data[0] : [];
  var colMap = buildColMap(headers);

  // Find existing row for this date
  var foundRow = -1;
  for (var i = 1; i < data.length; i++) {
    var rd = parseDate(data[i][colMap['Date']]);
    if (rd && formatDateISO(rd) === dateStr) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow > 0) {
    var existing = data[foundRow - 1];
    if (body.dayRating !== undefined) existing[colMap['DayRating']] = body.dayRating;
    if (body.achievements !== undefined) existing[colMap['Achievements']] = body.achievements;
    if (body.notes !== undefined) existing[colMap['Notes']] = body.notes;
    if (body.scheduled !== undefined) existing[colMap['Scheduled']] = body.scheduled;
    if (body.completed !== undefined) existing[colMap['Completed']] = body.completed;
    if (body.completionPct !== undefined) existing[colMap['CompletionPct']] = body.completionPct;
    if (body.waiting !== undefined) existing[colMap['Waiting']] = body.waiting;
    updateRow(SHEETS.DR, foundRow, existing);
  } else {
    var newRow = [
      dateStr,
      body.dayRating || '',
      body.scheduled || 0,
      body.completed || 0,
      body.completionPct || 0,
      body.waiting || 0,
      body.achievements || '',
      body.notes || '',
      ''  // Extra
    ];
    appendRow(SHEETS.DR, newRow);
  }

  return { success: true, message: 'Daily report updated for ' + dateStr };
}

function handleUpdateWeeklyScorecard(body) {
  var weekNum = parseInt(body.weekNum);
  if (!weekNum) return { success: false, error: 'Invalid week number' };

  var sheet = getSheet(SHEETS.WS);
  var data = getSheetData(SHEETS.WS);
  var headers = data.length > 0 ? data[0] : [];
  var colMap = buildColMap(headers);

  var foundRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (parseInt(data[i][colMap['WeekNum']]) === weekNum) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow > 0) {
    var existing = data[foundRow - 1];
    if (body.achievements !== undefined) existing[colMap['Achievements']] = body.achievements;
    if (body.carryForward !== undefined) existing[colMap['CarryForward']] = body.carryForward;
    if (body.planned !== undefined) existing[colMap['Planned']] = body.planned;
    if (body.done !== undefined) existing[colMap['Done']] = body.done;
    if (body.completionPct !== undefined) existing[colMap['CompletionPct']] = body.completionPct;
    if (body.avgDayRating !== undefined) existing[colMap['AvgDayRating']] = body.avgDayRating;
    updateRow(SHEETS.WS, foundRow, existing);
  } else {
    var newRow = [
      weekNum,
      body.startDate || '',
      body.endDate || '',
      body.planned || 0,
      body.done || 0,
      body.completionPct || 0,
      body.avgDayRating || 0,
      body.achievements || '',
      body.carryForward || ''
    ];
    appendRow(SHEETS.WS, newRow);
  }

  return { success: true, message: 'Weekly scorecard updated for week ' + weekNum };
}

function handleUpdateInfoSystem(body) {
  var rowNum = parseInt(body.rowNum);

  if (rowNum && rowNum >= 2) {
    // Update existing
    var data = getSheetData(SHEETS.IS);
    if (rowNum > data.length) return { success: false, error: 'Row does not exist' };

    var existing = data[rowNum - 1];
    var headers = data[0];
    var colMap = buildColMap(headers);

    if (body.category !== undefined && colMap['Category'] !== undefined) existing[colMap['Category']] = body.category;
    if (body.title !== undefined && colMap['Title'] !== undefined) existing[colMap['Title']] = body.title;
    if (body.content !== undefined && colMap['Content'] !== undefined) existing[colMap['Content']] = body.content;
    if (body.notes !== undefined && colMap['Notes'] !== undefined) existing[colMap['Notes']] = body.notes;
    if (body.dateAdded !== undefined && colMap['DateAdded'] !== undefined) existing[colMap['DateAdded']] = body.dateAdded;

    updateRow(SHEETS.IS, rowNum, existing);
    return { success: true, rowNum: rowNum, message: 'Info system entry updated' };
  } else {
    // Add new
    var newRow = [
      body.category || '',
      body.title || '',
      body.content || '',
      body.notes || '',
      formatDate(new Date())
    ];
    var nr = appendRow(SHEETS.IS, newRow);
    return { success: true, rowNum: nr, message: 'Info system entry added' };
  }
}

function handleUpdateMasters(body) {
  if (!body.data) return { success: false, error: 'No data provided' };

  // Update the Masters sheet with the provided dropdown data
  var sheet = getSheet(SHEETS.MASTERS);
  sheet.clear();

  var masterKeys = ['priority','batchType','taskStatus','schedStatus','infoCategory',
                    'dayRating','timeSlots','frequency','weekday','weekPosition',
                    'recurringStatus','sendTo','slColumns'];
  var headers = masterKeys;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  var maxRows = 0;
  var data = body.data;
  for (var k = 0; k < masterKeys.length; k++) {
    var key = masterKeys[k];
    if (data[key] && data[key].length > maxRows) {
      maxRows = data[key].length;
    }
  }

  for (var r = 0; r < maxRows; r++) {
    var row = [];
    for (var c = 0; c < masterKeys.length; c++) {
      var key2 = masterKeys[c];
      row.push(data[key2] && data[key2][r] ? data[key2][r] : '');
    }
    sheet.appendRow(row);
  }

  return { success: true, message: 'Masters updated successfully' };
}

function handleSaveDSNotes(body) {
  var dateStr = body.date || formatDateISO(new Date());
  var notes = body.notes || '';

  var sheet = getSheet(SHEETS.DS);
  var data = getSheetData(SHEETS.DS);
  var headers = data.length > 0 ? data[0] : [];
  var colMap = buildColMap(headers);

  // Find the _DAY row for this date
  var foundRow = -1;
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rdISO = String(row[colMap['Date']] || '');
    if (!rdISO) {
      var rd = parseDate(row[colMap['Date']]);
      rdISO = rd ? formatDateISO(rd) : '';
    }
    if (rdISO === dateStr && String(row[colMap['Source']] || '') === '_DAY') {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow > 0) {
    var existing = data[foundRow - 1];
    existing[colMap['ActuallyDone']] = notes;
    updateRow(SHEETS.DS, foundRow, existing);
  } else {
    var newRowData = [dateStr, '_DAY', '', '', '', '', notes];
    appendRow(SHEETS.DS, newRowData);
  }

  return { success: true, message: 'Notes saved for ' + dateStr };
}

function handleExportAll() {
  var result = {};
  var sheetNames = [SHEETS.QC, SHEETS.IS, SHEETS.RT, SHEETS.DS, SHEETS.DR, SHEETS.WS, SHEETS.MASTERS];

  for (var i = 0; i < sheetNames.length; i++) {
    try {
      result[sheetNames[i]] = getSheetData(sheetNames[i]);
    } catch (e) {
      result[sheetNames[i]] = [];
    }
  }

  return { success: true, data: result, exportDate: new Date().toISOString() };
}

function handleImportAll(body) {
  if (!body.data) return { success: false, error: 'No data provided' };

  var data = body.data;
  var imported = [];

  for (var sheetName in data) {
    if (!data.hasOwnProperty(sheetName)) continue;

    try {
      var sheet = getSheet(sheetName);
      sheet.clear();

      var rows = data[sheetName];
      if (rows && rows.length > 0) {
        sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
      }
      imported.push(sheetName);
    } catch (e) {
      // Skip sheets that don't exist
    }
  }

  return { success: true, imported: imported, message: 'Data imported successfully' };
}

// ---------------------------------------------------------------------------
// 5. INIT FUNCTION - Creates all sheet tabs with headers
// ---------------------------------------------------------------------------

function init() {
  var ss = getSpreadsheet();
  var created = [];
  var existing = [];

  // Quick Capture headers
  var qcHeaders = ['Date','Time','Task','Priority','BatchType','SendTo','SLStatus',
                   'SchedDate','SchedTimeFrom','SchedTimeTo','Deadline','Notes','SD#','IS#','Sort','Status','DoneDate'];

  // Information System headers
  var isHeaders = ['Category','Title','Content','Notes','DateAdded'];

  // Recurring Tasks headers
  var rtHeaders = ['Task','Priority','BatchType','Frequency','Weekday','WeekPosition',
                   'FixedDate','SLStatus','Status','Notes','DateAdded','DateStopped'];

  // Daily Schedule headers
  var dsHeaders = ['Date','Source','SourceRow','Done','DoneTime','DayRating','ActuallyDone'];

  // Daily Report headers
  var drHeaders = ['Date','DayRating','Scheduled','Completed','CompletionPct','Waiting',
                   'Achievements','Notes','Extra'];

  // Weekly Scorecard headers
  var wsHeaders = ['WeekNum','StartDate','EndDate','Planned','Done','CompletionPct',
                   'AvgDayRating','Achievements','CarryForward'];

  // Masters headers
  var mastersHeaders = ['priority','batchType','taskStatus','schedStatus','infoCategory',
                        'dayRating','timeSlots','frequency','weekday','weekPosition',
                        'recurringStatus','sendTo','slColumns'];

  var sheetDefs = [
    { name: SHEETS.MASTERS, headers: mastersHeaders, populateData: true },
    { name: SHEETS.QC, headers: qcHeaders, populateData: false },
    { name: SHEETS.SL, headers: [], populateData: false },
    { name: SHEETS.IS, headers: isHeaders, populateData: false },
    { name: SHEETS.RT, headers: rtHeaders, populateData: false },
    { name: SHEETS.DS, headers: dsHeaders, populateData: false },
    { name: SHEETS.DR, headers: drHeaders, populateData: false },
    { name: SHEETS.WS, headers: wsHeaders, populateData: false },
    { name: SHEETS.NWP, headers: [], populateData: false },
    { name: SHEETS.DASHBOARD, headers: [], populateData: false }
  ];

  for (var i = 0; i < sheetDefs.length; i++) {
    var def = sheetDefs[i];
    var sheet = ss.getSheetByName(def.name);

    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      created.push(def.name);

      if (def.headers.length > 0) {
        sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
        sheet.getRange(1, 1, 1, def.headers.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }

      // Populate Masters with default data
      if (def.populateData && def.name === SHEETS.MASTERS) {
        populateMasters(sheet, def.headers);
      }
    } else {
      existing.push(def.name);
      // Always update headers on existing sheets to keep them in sync
      if (def.headers.length > 0) {
        sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
        sheet.getRange(1, 1, 1, def.headers.length).setFontWeight('bold');
      }
    }
  }

  // Remove default "Sheet1" if it exists and we created other sheets
  if (created.length > 0) {
    var defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet && ss.getSheets().length > 1) {
      try { ss.deleteSheet(defaultSheet); } catch (e) {}
    }
  }

  return {
    success: true,
    created: created,
    existing: existing,
    message: 'Initialization complete. Created: ' + created.join(', ') + '. Existing: ' + existing.join(', ')
  };
}

function populateMasters(sheet, headers) {
  var masterData = {
    priority: MASTERS_DATA.priority,
    batchType: MASTERS_DATA.batchType,
    taskStatus: MASTERS_DATA.taskStatus,
    schedStatus: MASTERS_DATA.schedStatus,
    infoCategory: MASTERS_DATA.infoCategory,
    dayRating: MASTERS_DATA.dayRating,
    timeSlots: MASTERS_DATA.timeSlots,
    frequency: MASTERS_DATA.frequency,
    weekday: MASTERS_DATA.weekday,
    weekPosition: MASTERS_DATA.weekPosition,
    recurringStatus: MASTERS_DATA.recurringStatus,
    sendTo: ['Someday List', 'Information System', 'Archive'],
    slColumns: ['Task','Priority','BatchType','SLStatus','SchedDate','SchedTime','Notes']
  };

  // Find max length across all columns
  var maxLen = 0;
  for (var k = 0; k < headers.length; k++) {
    var key = headers[k];
    if (masterData[key] && masterData[key].length > maxLen) {
      maxLen = masterData[key].length;
    }
  }

  // Build rows
  var rows = [];
  for (var r = 0; r < maxLen; r++) {
    var row = [];
    for (var c = 0; c < headers.length; c++) {
      var colKey = headers[c];
      if (masterData[colKey] && r < masterData[colKey].length) {
        row.push(masterData[colKey][r]);
      } else {
        row.push('');
      }
    }
    rows.push(row);
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

// ---------------------------------------------------------------------------
// FIX HEADERS - Run this once to update Quick Capture headers
// ---------------------------------------------------------------------------

function fixHeaders() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.QC);
  if (!sheet) return { success: false, error: 'Quick Capture sheet not found' };

  var newHeaders = ['Date','Time','Task','Priority','BatchType','SendTo','SLStatus',
                    'SchedDate','SchedTimeFrom','SchedTimeTo','Deadline','Notes','SD#','IS#','Sort','Status','DoneDate'];

  // Read old headers
  var oldHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Write new headers
  sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
  sheet.getRange(1, 1, 1, newHeaders.length).setFontWeight('bold');

  // If old data exists with old column layout, migrate it
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var oldColMap = {};
    for (var i = 0; i < oldHeaders.length; i++) {
      oldColMap[oldHeaders[i]] = i;
    }

    // Check if migration needed (old SchedTime exists but no SchedTimeFrom)
    if (oldColMap['SchedTime'] !== undefined && oldColMap['SchedTimeFrom'] === undefined) {
      var dataRange = sheet.getRange(2, 1, lastRow - 1, oldHeaders.length);
      var data = dataRange.getValues();

      var newData = [];
      for (var r = 0; r < data.length; r++) {
        var row = data[r];
        var newRow = [];
        for (var h = 0; h < newHeaders.length; h++) {
          var header = newHeaders[h];
          if (header === 'SchedTimeFrom' && oldColMap['SchedTime'] !== undefined) {
            newRow.push(row[oldColMap['SchedTime']] || '');
          } else if (header === 'SchedTimeTo') {
            newRow.push('');
          } else if (header === 'Deadline') {
            newRow.push('');
          } else if (oldColMap[header] !== undefined) {
            newRow.push(row[oldColMap[header]]);
          } else {
            newRow.push('');
          }
        }
        newData.push(newRow);
      }

      // Clear old data and write new
      sheet.getRange(2, 1, lastRow - 1, Math.max(oldHeaders.length, newHeaders.length)).clearContent();
      sheet.getRange(2, 1, newData.length, newHeaders.length).setValues(newData);
    }
  }

  return { success: true, message: 'Headers updated! Old: ' + oldHeaders.join(',') + ' -> New: ' + newHeaders.join(',') };
}

// ---------------------------------------------------------------------------
// END OF CEO PRODUCTIVITY SYSTEM - Google Apps Script Backend API
// ---------------------------------------------------------------------------
