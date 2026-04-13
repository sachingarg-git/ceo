const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const { query } = require('./db');

const TOKEN = '8607668575:AAGgDYBg0SwKIWTfGdqT-FJm_L3AIbncm4s';
const WEBHOOK_URL = 'https://ea.wizone.ai/webhook/telegram';

// No internal server — Express handles /webhook/telegram and calls bot.processUpdate()
const bot = new TelegramBot(TOKEN);

// Pending Task State (for interactive /add)
const pendingTasks = {}; // chatId -> { step, description, timeFrom, timeTo, priority, sendTo, companyId }

// Pending verification choices (multi-company same phone)
const pendingVerifications = {}; // chatId -> [{ id, name }]

// DB Init
async function initBotDB() {
  await query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TelegramSessions' AND xtype='U')
    CREATE TABLE TelegramSessions (
      ID INT IDENTITY PRIMARY KEY,
      ChatID BIGINT UNIQUE NOT NULL,
      CompanyID INT NOT NULL,
      PhoneNumber NVARCHAR(20),
      CompanyName NVARCHAR(200),
      VerifiedAt DATETIME DEFAULT GETDATE()
    )
  `);
  console.log('TelegramSessions table ready.');
}

// Helpers
async function getSession(chatId) {
  const r = await query('SELECT * FROM TelegramSessions WHERE ChatID = @chatId', { chatId });
  if (!r.recordset.length) return null;
  const session = r.recordset[0];
  // Validate the company still exists — if deleted, kill the stale session
  const companyCheck = await query('SELECT ID FROM Companies WHERE ID = @id', { id: session.CompanyID });
  if (!companyCheck.recordset.length) {
    await query('DELETE FROM TelegramSessions WHERE ChatID = @chatId', { chatId });
    return null; // force re-verification
  }
  return session;
}

async function getTodayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function fmtTask(t, i) {
  // SchedDate is stored as nvarchar string, not Date object
  const date = t.SchedDate ? (typeof t.SchedDate === 'string' ? t.SchedDate : t.SchedDate.toISOString().split('T')[0]) : '';
  const timeFrom = t.SchedTimeFrom || '';
  const timeTo = t.SchedTimeTo || '';
  const pri  = t.Priority || '';
  const timeStr = timeFrom ? (timeTo ? `${timeFrom} - ${timeTo}` : timeFrom) : '';
  return `${i+1}. *${t.Task || t.Description || ''}*\n   📅 ${date || 'No date'} ${timeStr ? '⏰ '+timeStr : ''} ${pri ? '| '+pri : ''}`;
}

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const session = await getSession(chatId);
  if (session) {
    bot.sendMessage(chatId, `✅ Already verified as *${session.CompanyName}*!\n\nCommands:\n/today - Today's tasks\n/upcoming - Upcoming tasks\n/overdue - Overdue tasks\n/add - Add new task\n/edit - Edit task status\n/done - Mark task done\n/mycompany - Check linked company\n/unlink - Disconnect bot\n/help - All commands`, { parse_mode: 'Markdown' });
    return;
  }
  bot.sendMessage(chatId, `👋 Welcome to *EA to M.D Bot*!\n\nPlease share your phone number to verify your company identity.`, {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [[{ text: '📱 Share Phone Number', request_contact: true }]],
      one_time_keyboard: true,
      resize_keyboard: true,
    }
  });
});

// Phone Verification
bot.on('contact', async (msg) => {
  const chatId = msg.chat.id;
  const phone = msg.contact.phone_number.replace(/\D/g, '');
  const last10 = phone.slice(-10);

  // Collect all matching companies from both tables
  const matchedMap = {}; // companyId -> name (deduplicate)

  // 1. Companies.RegisteredMobile (primary owner — can be multiple companies with same number)
  const companyResult = await query(`
    SELECT ID, LegalName FROM Companies
    WHERE RIGHT(REPLACE(REPLACE(REPLACE(RegisteredMobile, '+', ''), ' ', ''), '-', ''), 10) = @last10
      AND ApprovalStatus = 'Approved'
  `, { last10 });
  for (const row of companyResult.recordset) {
    matchedMap[row.ID] = row.LegalName;
  }

  // 2. CompanyUsers.Mobile (sub-users)
  const userResult = await query(`
    SELECT cu.CompanyID, c.LegalName
    FROM CompanyUsers cu
    INNER JOIN Companies c ON c.ID = cu.CompanyID
    WHERE RIGHT(REPLACE(REPLACE(REPLACE(cu.Mobile, '+', ''), ' ', ''), '-', ''), 10) = @last10
      AND cu.IsActive = 1
  `, { last10 });
  for (const row of userResult.recordset) {
    matchedMap[row.CompanyID] = matchedMap[row.CompanyID] || row.LegalName;
  }

  const matches = Object.entries(matchedMap).map(([id, name]) => ({ id: parseInt(id), name }));

  if (matches.length === 0) {
    bot.sendMessage(chatId, `❌ *Phone number not found.*\n\nPlease register your company at https://ea.wizone.ai or ask your admin to add this number as a sub-user.`, {
      parse_mode: 'Markdown',
      reply_markup: { remove_keyboard: true }
    });
    return;
  }

  // Single match — verify immediately
  if (matches.length === 1) {
    await linkSession(chatId, matches[0].id, matches[0].name, phone);
    return;
  }

  // Multiple matches — ask user to pick
  delete pendingVerifications[chatId];
  pendingVerifications[chatId] = { matches, phone };
  const buttons = matches.map(m => ([{ text: `🏢 ${m.name}`, callback_data: `verify_company_${m.id}` }]));
  buttons.push([{ text: '❌ Cancel', callback_data: 'verify_cancel' }]);

  bot.sendMessage(chatId, `📱 *Multiple companies found for this number.*\n\nPlease select which company you want to link:`, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons, remove_keyboard: true }
  });
});

// Helper: write session and welcome user
async function linkSession(chatId, companyId, companyName, phone) {
  await query(`
    MERGE TelegramSessions AS target
    USING (SELECT @chatId AS ChatID) AS source ON target.ChatID = source.ChatID
    WHEN MATCHED THEN UPDATE SET CompanyID=@companyId, PhoneNumber=@phone, CompanyName=@name, VerifiedAt=GETDATE()
    WHEN NOT MATCHED THEN INSERT (ChatID, CompanyID, PhoneNumber, CompanyName) VALUES (@chatId, @companyId, @phone, @name);
  `, { chatId, companyId, phone, name: companyName });

  bot.sendMessage(chatId, `✅ *Verified! Welcome, ${companyName}!*\n\nYour bot is now active. Here's what you can do:\n\n📋 /today - Today's tasks\n📅 /upcoming - Upcoming tasks\n⚠️ /overdue - Overdue tasks\n➕ /add - Add new task\n✏️ /edit - Edit task status\n✅ /done - Mark task done\n🏢 /mycompany - Check linked company\n🔓 /unlink - Disconnect this bot\n❓ /help - All commands`, {
    parse_mode: 'Markdown',
    reply_markup: { remove_keyboard: true }
  });
}

// Auth Middleware
async function requireAuth(msg, cb) {
  const session = await getSession(msg.chat.id);
  if (!session) {
    bot.sendMessage(msg.chat.id, '❌ Not verified. Send /start to verify your identity.');
    return;
  }
  cb(session);
}

// /today
bot.onText(/\/today/, async (msg) => {
  requireAuth(msg, async (session) => {
    const today = await getTodayISO();
    const r = await query(`
      SELECT TOP 10 Task, SchedDate, SchedTimeFrom, SchedTimeTo, Priority, SLStatus
      FROM QuickCapture
      WHERE CompanyID=@cid AND SchedDate=@today AND (SLStatus IS NULL OR SLStatus != 'Completed')
      ORDER BY SchedTimeFrom ASC
    `, { cid: session.CompanyID, today });

    if (!r.recordset.length) {
      bot.sendMessage(msg.chat.id, '📋 No tasks scheduled for today!');
      return;
    }
    const list = r.recordset.map((t, i) => fmtTask(t, i)).join('\n\n');
    bot.sendMessage(msg.chat.id, `📋 *Today's Tasks (${r.recordset.length}):*\n\n${list}`, { parse_mode: 'Markdown' });
  });
});

// /upcoming
bot.onText(/\/upcoming/, async (msg) => {
  requireAuth(msg, async (session) => {
    const today = await getTodayISO();
    const r = await query(`
      SELECT TOP 10 Task, SchedDate, SchedTimeFrom, SchedTimeTo, Priority, SLStatus
      FROM QuickCapture
      WHERE CompanyID=@cid AND SchedDate > @today AND (SLStatus IS NULL OR SLStatus != 'Completed')
      ORDER BY SchedDate ASC, SchedTimeFrom ASC
    `, { cid: session.CompanyID, today });

    if (!r.recordset.length) {
      bot.sendMessage(msg.chat.id, '📅 No upcoming tasks!');
      return;
    }
    const list = r.recordset.map((t, i) => fmtTask(t, i)).join('\n\n');
    bot.sendMessage(msg.chat.id, `📅 *Upcoming Tasks (${r.recordset.length}):*\n\n${list}`, { parse_mode: 'Markdown' });
  });
});

// /overdue
bot.onText(/\/overdue/, async (msg) => {
  requireAuth(msg, async (session) => {
    const today = await getTodayISO();
    const r = await query(`
      SELECT TOP 10 Task, SchedDate, SchedTimeFrom, SchedTimeTo, Priority, SLStatus
      FROM QuickCapture
      WHERE CompanyID=@cid AND SchedDate < @today AND (SLStatus IS NULL OR SLStatus != 'Completed')
      ORDER BY SchedDate DESC
    `, { cid: session.CompanyID, today });

    if (!r.recordset.length) {
      bot.sendMessage(msg.chat.id, '✅ No overdue tasks! Great job!');
      return;
    }
    const list = r.recordset.map((t, i) => fmtTask(t, i)).join('\n\n');
    bot.sendMessage(msg.chat.id, `⚠️ *Overdue Tasks (${r.recordset.length}):*\n\n${list}`, { parse_mode: 'Markdown' });
  });
});

// Helper to generate date options dynamically
function getDateOptions() {
  const dates = [];
  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    let label = '';
    if (i === 0) label = '📅 Today';
    else if (i === 1) label = '📆 Tomorrow';
    else label = `📆 ${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}`;
    dates.push({ text: label, callback_data: `date_${dateStr}` });
  }
  
  // Convert to rows of 2
  const rows = [];
  for (let i = 0; i < dates.length; i += 2) {
    if (i + 1 < dates.length) {
      rows.push([dates[i], dates[i+1]]);
    } else {
      rows.push([dates[i]]);
    }
  }
  rows.push([{ text: '❌ Cancel', callback_data: 'add_cancel' }]);
  return rows;
}

// Time options for selection (AM/PM format to match frontend)
const timeOptions = [
  [{ text: '🌅 8:00 AM', callback_data: 'timefrom_8:00 AM' }, { text: '🌅 9:00 AM', callback_data: 'timefrom_9:00 AM' }],
  [{ text: '🌞 10:00 AM', callback_data: 'timefrom_10:00 AM' }, { text: '🌞 11:00 AM', callback_data: 'timefrom_11:00 AM' }],
  [{ text: '🕛 12:00 PM', callback_data: 'timefrom_12:00 PM' }, { text: '🌇 1:00 PM', callback_data: 'timefrom_1:00 PM' }],
  [{ text: '🌇 2:00 PM', callback_data: 'timefrom_2:00 PM' }, { text: '🌇 3:00 PM', callback_data: 'timefrom_3:00 PM' }],
  [{ text: '🌆 4:00 PM', callback_data: 'timefrom_4:00 PM' }, { text: '🌆 5:00 PM', callback_data: 'timefrom_5:00 PM' }],
  [{ text: '🌆 6:00 PM', callback_data: 'timefrom_6:00 PM' }, { text: '🌃 7:00 PM', callback_data: 'timefrom_7:00 PM' }],
  [{ text: '⏰ Abhi (Now)', callback_data: 'timefrom_now' }],
  [{ text: '❌ Cancel', callback_data: 'add_cancel' }]
];

const timeToOptions = [
  [{ text: '🌅 9:00 AM', callback_data: 'timeto_9:00 AM' }, { text: '🌞 10:00 AM', callback_data: 'timeto_10:00 AM' }],
  [{ text: '🌞 11:00 AM', callback_data: 'timeto_11:00 AM' }, { text: '🕛 12:00 PM', callback_data: 'timeto_12:00 PM' }],
  [{ text: '🌇 1:00 PM', callback_data: 'timeto_1:00 PM' }, { text: '🌇 2:00 PM', callback_data: 'timeto_2:00 PM' }],
  [{ text: '🌇 3:00 PM', callback_data: 'timeto_3:00 PM' }, { text: '🌆 4:00 PM', callback_data: 'timeto_4:00 PM' }],
  [{ text: '🌆 5:00 PM', callback_data: 'timeto_5:00 PM' }, { text: '🌆 6:00 PM', callback_data: 'timeto_6:00 PM' }],
  [{ text: '🌃 7:00 PM', callback_data: 'timeto_7:00 PM' }, { text: '🌃 8:00 PM', callback_data: 'timeto_8:00 PM' }],
  [{ text: '⏭️ +1 Hour', callback_data: 'timeto_plus1' }],
  [{ text: '❌ Cancel', callback_data: 'add_cancel' }]
];

// Helper to convert 24h time to AM/PM format
function to12Hour(h, m) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// /add (Interactive) - Step 1: Start - Ask for description
bot.onText(/^\/add$/, async (msg) => {
  requireAuth(msg, async (session) => {
    const chatId = msg.chat.id;
    pendingTasks[chatId] = { step: 'description', companyId: session.CompanyID };
    bot.sendMessage(chatId, '📝 *New Task*\n\nTask ka description likho:', { 
      parse_mode: 'Markdown',
      reply_markup: { 
        inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'add_cancel' }]]
      }
    });
  });
});

// Quick add with description in same message
bot.onText(/\/add (.+)/, async (msg, match) => {
  requireAuth(msg, async (session) => {
    const chatId = msg.chat.id;
    const description = match[1].trim();
    pendingTasks[chatId] = { step: 'selectDate', description: description, companyId: session.CompanyID };
    
    // Ask for DATE first
    bot.sendMessage(chatId, `📝 *Task:* ${description}\n\n📅 *Date select karo:*`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: getDateOptions() }
    });
  });
});

// Handle text messages for pending task flow
bot.on('message', async (msg) => {
  if (msg.text && msg.text.startsWith('/')) return; // Ignore commands
  if (!msg.text) return;
  if (msg.contact) return; // Ignore contact messages
  
  const chatId = msg.chat.id;
  const pending = pendingTasks[chatId];
  if (!pending) return;
  
  if (pending.step === 'description') {
    // Got description, now ask for DATE
    pending.description = msg.text.trim();
    pending.step = 'selectDate';
    
    bot.sendMessage(chatId, `📝 *Task:* ${pending.description}\n\n📅 *Date select karo:*`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: getDateOptions() }
    });
  }
});

// /edit - Edit task SL Status or Send To
bot.onText(/\/edit/, async (msg) => {
  requireAuth(msg, async (session) => {
    const today = await getTodayISO();
    const r = await query(`
      SELECT TOP 8 ID, Task, SLStatus, SendTo FROM QuickCapture
      WHERE CompanyID=@cid AND (SLStatus IS NULL OR SLStatus != 'Completed')
      ORDER BY SchedDate DESC, SchedTimeFrom ASC
    `, { cid: session.CompanyID, today });

    if (!r.recordset.length) {
      bot.sendMessage(msg.chat.id, '📋 No tasks to edit!');
      return;
    }

    const buttons = r.recordset.map(t => ([{ text: `✏️ ${t.Task.substring(0, 35)}`, callback_data: `edit_${t.ID}` }]));
    buttons.push([{ text: '❌ Cancel', callback_data: 'add_cancel' }]);
    bot.sendMessage(msg.chat.id, '✏️ *Select task to edit:*', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
  });
});

// /done
bot.onText(/\/done/, async (msg) => {
  requireAuth(msg, async (session) => {
    const today = await getTodayISO();
    const r = await query(`
      SELECT TOP 8 ID, Task FROM QuickCapture
      WHERE CompanyID=@cid AND SchedDate=@today AND (SLStatus IS NULL OR SLStatus != 'Completed')
      ORDER BY SchedTimeFrom ASC
    `, { cid: session.CompanyID, today });

    if (!r.recordset.length) {
      bot.sendMessage(msg.chat.id, '✅ No pending tasks for today!');
      return;
    }

    const buttons = r.recordset.map(t => ([{ text: `✅ ${t.Task.substring(0, 40)}`, callback_data: `done_${t.ID}` }]));
    bot.sendMessage(msg.chat.id, '📋 *Select task to mark done:*', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
  });
});

// Callback handler for all inline buttons
bot.on('callback_query', async (query_cb) => {
  const data = query_cb.data;
  const chatId = query_cb.message.chat.id;
  const pending = pendingTasks[chatId];

  // Company selection during phone verification (multi-company)
  if (data.startsWith('verify_company_')) {
    const selectedId = parseInt(data.replace('verify_company_', ''));
    const pending = pendingVerifications[chatId];
    if (!pending) {
      bot.answerCallbackQuery(query_cb.id, { text: 'Session expired. Please share your number again.' });
      return;
    }
    const match = pending.matches.find(m => m.id === selectedId);
    if (!match) {
      bot.answerCallbackQuery(query_cb.id, { text: 'Company not found.' });
      return;
    }
    delete pendingVerifications[chatId];
    bot.answerCallbackQuery(query_cb.id, { text: `✅ Linked to ${match.name}` });
    bot.editMessageText(`✅ *${match.name}* selected.`, {
      chat_id: chatId, message_id: query_cb.message.message_id, parse_mode: 'Markdown'
    });
    await linkSession(chatId, match.id, match.name, pending.phone);
    return;
  }

  if (data === 'verify_cancel') {
    delete pendingVerifications[chatId];
    bot.answerCallbackQuery(query_cb.id, { text: '❌ Cancelled' });
    bot.editMessageText('❌ Verification cancelled. Send /start to try again.', {
      chat_id: chatId, message_id: query_cb.message.message_id
    });
    return;
  }

  // Cancel task creation
  if (data === 'add_cancel') {
    delete pendingTasks[chatId];
    bot.answerCallbackQuery(query_cb.id, { text: '❌ Cancelled' });
    bot.editMessageText('❌ Cancelled.', {
      chat_id: chatId, message_id: query_cb.message.message_id
    });
    return;
  }

  // Date selection
  if (data.startsWith('date_')) {
    if (!pending || pending.step !== 'selectDate') {
      bot.answerCallbackQuery(query_cb.id, { text: 'Session expired. Use /add again.' });
      return;
    }
    
    pending.selectedDate = data.replace('date_', '');
    pending.step = 'timeFrom';
    
    // Format date for display
    const dateParts = pending.selectedDate.split('-');
    const displayDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    
    bot.answerCallbackQuery(query_cb.id);
    bot.editMessageText(`📝 *Task:* ${pending.description}\n📅 *Date:* ${displayDate}\n\n⏰ *FROM Time select karo:*`, {
      chat_id: chatId, 
      message_id: query_cb.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: timeOptions }
    });
    return;
  }

  // FROM Time selection
  if (data.startsWith('timefrom_')) {
    if (!pending || pending.step !== 'timeFrom') {
      bot.answerCallbackQuery(query_cb.id, { text: 'Session expired. Use /add again.' });
      return;
    }
    
    if (data === 'timefrom_now') {
      const now = new Date();
      pending.timeFrom = to12Hour(now.getHours(), now.getMinutes());
    } else {
      pending.timeFrom = data.replace('timefrom_', '');
    }
    pending.step = 'timeTo';
    
    bot.answerCallbackQuery(query_cb.id);
    bot.editMessageText(`📝 *Task:* ${pending.description}\n⏰ *From:* ${pending.timeFrom}\n\n⏰ *TO Time select karo:*`, {
      chat_id: chatId, 
      message_id: query_cb.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: timeToOptions }
    });
    return;
  }

  // TO Time selection
  if (data.startsWith('timeto_')) {
    if (!pending || pending.step !== 'timeTo') {
      bot.answerCallbackQuery(query_cb.id, { text: 'Session expired. Use /add again.' });
      return;
    }
    
    if (data === 'timeto_plus1') {
      // Add 1 hour to FROM time (parse AM/PM format)
      const timeMatch = pending.timeFrom.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (timeMatch) {
        let h = parseInt(timeMatch[1]);
        const m = parseInt(timeMatch[2]);
        const ampm = timeMatch[3].toUpperCase();
        // Convert to 24h
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        // Add 1 hour
        h = (h + 1) % 24;
        pending.timeTo = to12Hour(h, m);
      } else {
        pending.timeTo = pending.timeFrom; // Fallback
      }
    } else {
      pending.timeTo = data.replace('timeto_', '');
    }
    pending.step = 'priority';
    
    bot.answerCallbackQuery(query_cb.id);
    bot.editMessageText(`📝 *Task:* ${pending.description}\n⏰ *Time:* ${pending.timeFrom} - ${pending.timeTo}\n\n🎯 *Priority select karo:*`, {
      chat_id: chatId, 
      message_id: query_cb.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔴 High', callback_data: 'priority_High' }, { text: '🟡 Medium', callback_data: 'priority_Medium' }, { text: '🟢 Low', callback_data: 'priority_Low' }],
          [{ text: '❌ Cancel', callback_data: 'add_cancel' }]
        ]
      }
    });
    return;
  }

  // Priority selection
  if (data.startsWith('priority_')) {
    if (!pending || pending.step !== 'priority') {
      bot.answerCallbackQuery(query_cb.id, { text: 'Session expired. Use /add again.' });
      return;
    }
    
    pending.priority = data.replace('priority_', '');
    pending.step = 'sendTo';
    
    bot.answerCallbackQuery(query_cb.id);
    bot.editMessageText(`📝 *Task:* ${pending.description}\n⏰ *Time:* ${pending.timeFrom} - ${pending.timeTo}\n🎯 *Priority:* ${pending.priority}\n\n📍 *Kahan bhejein (Send To)?*`, {
      chat_id: chatId, 
      message_id: query_cb.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Someday List', callback_data: 'sendto_Someday List' }],
          [{ text: '📅 Scheduled', callback_data: 'sendto_Scheduled' }],
          [{ text: '👥 Meeting', callback_data: 'sendto_Meeting' }],
          [{ text: '📞 Call', callback_data: 'sendto_Call' }],
          [{ text: '❌ Cancel', callback_data: 'add_cancel' }]
        ]
      }
    });
    return;
  }

  // SendTo selection - then ask for SL Status
  if (data.startsWith('sendto_')) {
    if (!pending || pending.step !== 'sendTo') {
      bot.answerCallbackQuery(query_cb.id, { text: 'Session expired. Use /add again.' });
      return;
    }
    
    pending.sendTo = data.replace('sendto_', '');
    pending.step = 'slStatus';
    
    bot.answerCallbackQuery(query_cb.id);
    bot.editMessageText(`📝 *Task:* ${pending.description}\n⏰ *Time:* ${pending.timeFrom} - ${pending.timeTo}\n🎯 *Priority:* ${pending.priority}\n📍 *Send To:* ${pending.sendTo}\n\n📊 *SL Status select karo:*`, {
      chat_id: chatId, 
      message_id: query_cb.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📅 Schedule', callback_data: 'slstatus_Schedule' }, { text: '⏳ Pending', callback_data: 'slstatus_Pending' }],
          [{ text: '🔄 In Progress', callback_data: 'slstatus_In Progress' }],
          [{ text: '❌ Cancel', callback_data: 'add_cancel' }]
        ]
      }
    });
    return;
  }

  // SL Status selection - Final step, create task
  if (data.startsWith('slstatus_')) {
    if (!pending || pending.step !== 'slStatus') {
      bot.answerCallbackQuery(query_cb.id, { text: 'Session expired. Use /add again.' });
      return;
    }
    
    pending.slStatus = data.replace('slstatus_', '');
    // Use selected date or fallback to today
    const taskDate = pending.selectedDate || await getTodayISO();
    
    // Get current date/time for creation timestamp
    const now = new Date();
    const creationDate = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    const creationTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    // Deadline is same as scheduled date
    const deadline = taskDate;
    
    console.log('Creating task with:', {
      task: pending.description,
      date: taskDate,
      timeFrom: pending.timeFrom,
      timeTo: pending.timeTo,
      priority: pending.priority,
      sendTo: pending.sendTo,
      slStatus: pending.slStatus,
      cid: pending.companyId,
      creationDate,
      creationTime,
      deadline
    });
    
    try {
      // Get session to look up who created the task by phone number
      const session = await getSession(chatId);

      // Get CreatedBy: check if phone belongs to a sub-user
      const createdByResult = await query(`
        SELECT TOP 1 ISNULL(NULLIF(FullName,''), Username) as DisplayName
        FROM CompanyUsers
        WHERE CompanyID = @cid
          AND RIGHT(REPLACE(REPLACE(REPLACE(Mobile, '+', ''), ' ', ''), '-', ''), 10) = RIGHT(REPLACE(REPLACE(REPLACE(@phone, '+', ''), ' ', ''), '-', ''), 10)
          AND IsActive = 1
      `, { cid: pending.companyId, phone: session?.PhoneNumber || '' });

      const createdBy = createdByResult.recordset.length > 0
        ? createdByResult.recordset[0].DisplayName
        : session?.CompanyName || ''; // main company owner

      const result = await query(`
        INSERT INTO QuickCapture (Task, SchedDate, SchedTimeFrom, SchedTimeTo, Priority, SendTo, SLStatus, CompanyID, Date, Time, Deadline, CreatedBy)
        OUTPUT INSERTED.ID
        VALUES (@task, @date, @timeFrom, @timeTo, @priority, @sendTo, @slStatus, @cid, @creationDate, @creationTime, @deadline, @createdBy)
      `, {
        task: pending.description,
        date: taskDate,
        timeFrom: pending.timeFrom,
        timeTo: pending.timeTo,
        priority: pending.priority,
        sendTo: pending.sendTo,
        slStatus: pending.slStatus,
        cid: pending.companyId,
        creationDate,
        creationTime,
        deadline,
        createdBy
      });
      
      const taskId = result.recordset[0].ID;
      delete pendingTasks[chatId];
      
      // Format date for display (DD-MM-YYYY)
      const dateParts = taskDate.split('-');
      const displayDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      
      bot.answerCallbackQuery(query_cb.id, { text: '✅ Task Created!' });
      bot.editMessageText(`✅ *Task Added Successfully!*\n\n📝 *Task:* ${pending.description}\n📅 *Date:* ${displayDate}\n⏰ *Time:* ${pending.timeFrom} - ${pending.timeTo}\n🎯 *Priority:* ${pending.priority}\n📍 *Send To:* ${pending.sendTo}\n📊 *Status:* ${pending.slStatus}`, {
        chat_id: chatId, 
        message_id: query_cb.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✏️ Edit Status', callback_data: `edit_${taskId}` }],
            [{ text: '➕ Add Another Task', callback_data: 'add_new' }]
          ]
        }
      });
    } catch (err) {
      console.error('Error creating task:', err);
      bot.answerCallbackQuery(query_cb.id, { text: '❌ Error creating task' });
    }
    return;
  }

  // Add new task shortcut
  if (data === 'add_new') {
    const session = await getSession(chatId);
    if (!session) {
      bot.answerCallbackQuery(query_cb.id, { text: 'Session expired.' });
      return;
    }
    pendingTasks[chatId] = { step: 'description', companyId: session.CompanyID };
    bot.answerCallbackQuery(query_cb.id);
    bot.sendMessage(chatId, '📝 *New Task*\n\nTask ka description likho:', { 
      parse_mode: 'Markdown',
      reply_markup: { 
        inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'add_cancel' }]]
      }
    });
    return;
  }

  // Edit task - show options
  if (data.startsWith('edit_')) {
    const taskId = parseInt(data.replace('edit_', ''));
    const r = await query('SELECT ID, Task, SLStatus, SendTo FROM QuickCapture WHERE ID=@id', { id: taskId });
    
    if (!r.recordset.length) {
      bot.answerCallbackQuery(query_cb.id, { text: 'Task not found' });
      return;
    }
    
    const task = r.recordset[0];
    bot.answerCallbackQuery(query_cb.id);
    bot.editMessageText(`✏️ *Edit Task:* ${task.Task}\n\n📊 Current Status: ${task.SLStatus || 'None'}\n📍 Current Send To: ${task.SendTo || 'None'}\n\n*Kya change karna hai?*`, {
      chat_id: chatId, 
      message_id: query_cb.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Change SL Status', callback_data: `chgstatus_${taskId}` }],
          [{ text: '📍 Change Send To', callback_data: `chgsendto_${taskId}` }],
          [{ text: '✅ Mark Done', callback_data: `done_${taskId}` }],
          [{ text: '❌ Cancel', callback_data: 'add_cancel' }]
        ]
      }
    });
    return;
  }

  // Change SL Status
  if (data.startsWith('chgstatus_')) {
    const taskId = data.replace('chgstatus_', '');
    bot.answerCallbackQuery(query_cb.id);
    bot.editMessageText('📊 *New SL Status select karo:*', {
      chat_id: chatId, 
      message_id: query_cb.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📅 Schedule', callback_data: `setstatus_${taskId}_Schedule` }],
          [{ text: '⏳ Pending', callback_data: `setstatus_${taskId}_Pending` }],
          [{ text: '🔄 In Progress', callback_data: `setstatus_${taskId}_In Progress` }],
          [{ text: '✅ Completed', callback_data: `setstatus_${taskId}_Completed` }],
          [{ text: '❌ Cancel', callback_data: 'add_cancel' }]
        ]
      }
    });
    return;
  }

  // Set SL Status
  if (data.startsWith('setstatus_')) {
    const parts = data.replace('setstatus_', '').split('_');
    const taskId = parseInt(parts[0]);
    const newStatus = parts.slice(1).join('_');
    
    await query('UPDATE QuickCapture SET SLStatus=@status WHERE ID=@id', { status: newStatus, id: taskId });
    bot.answerCallbackQuery(query_cb.id, { text: '✅ Status Updated!' });
    bot.editMessageText(`✅ *Status updated to:* ${newStatus}`, {
      chat_id: chatId, message_id: query_cb.message.message_id, parse_mode: 'Markdown'
    });
    return;
  }

  // Change Send To
  if (data.startsWith('chgsendto_')) {
    const taskId = data.replace('chgsendto_', '');
    bot.answerCallbackQuery(query_cb.id);
    bot.editMessageText('📍 *New Send To select karo:*', {
      chat_id: chatId, 
      message_id: query_cb.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Someday List', callback_data: `setsendto_${taskId}_Someday List` }],
          [{ text: '📅 Scheduled', callback_data: `setsendto_${taskId}_Scheduled` }],
          [{ text: '👥 Meeting', callback_data: `setsendto_${taskId}_Meeting` }],
          [{ text: '📞 Call', callback_data: `setsendto_${taskId}_Call` }],
          [{ text: '❌ Cancel', callback_data: 'add_cancel' }]
        ]
      }
    });
    return;
  }

  // Set Send To
  if (data.startsWith('setsendto_')) {
    const parts = data.replace('setsendto_', '').split('_');
    const taskId = parseInt(parts[0]);
    const newSendTo = parts.slice(1).join('_');
    
    await query('UPDATE QuickCapture SET SendTo=@sendTo WHERE ID=@id', { sendTo: newSendTo, id: taskId });
    bot.answerCallbackQuery(query_cb.id, { text: '✅ Send To Updated!' });
    bot.editMessageText(`✅ *Send To updated to:* ${newSendTo}`, {
      chat_id: chatId, message_id: query_cb.message.message_id, parse_mode: 'Markdown'
    });
    return;
  }

  // Unlink confirm
  if (data === 'unlink_confirm') {
    const session = await getSession(chatId);
    const companyName = session ? session.CompanyName : 'your company';
    await query('DELETE FROM TelegramSessions WHERE ChatID = @chatId', { chatId });
    bot.answerCallbackQuery(query_cb.id, { text: '🔓 Unlinked!' });
    bot.editMessageText(`🔓 *Bot unlinked from ${companyName}.*\n\nTo re-connect, send /start and share your phone number again.`, {
      chat_id: chatId, message_id: query_cb.message.message_id, parse_mode: 'Markdown'
    });
    return;
  }

  // Mark done callback
  if (data.startsWith('done_')) {
    const id = parseInt(data.replace('done_', ''));
    const today = await getTodayISO();
    await query(`UPDATE QuickCapture SET SLStatus='Completed', DoneDate=@today WHERE ID=@id`, { today, id });
    bot.answerCallbackQuery(query_cb.id, { text: '✅ Marked as done!' });
    bot.editMessageText('✅ *Task marked as done!*', {
      chat_id: chatId, message_id: query_cb.message.message_id, parse_mode: 'Markdown'
    });
  }
});

// /help
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `🤖 *EA to M.D Bot - Commands:*\n\n/today - Today's tasks\n/upcoming - Upcoming tasks\n/overdue - Overdue tasks\n/add - Create new task (interactive)\n/edit - Edit task (Status/Send To)\n/done - Mark task done\n/mycompany - Check linked company\n/unlink - Disconnect bot from company\n/help - Show this menu\n\n_Notifications are sent automatically every morning at 9 AM and evening at 6 PM._`, { parse_mode: 'Markdown' });
});

// /mycompany - Show linked company info
bot.onText(/\/mycompany/, async (msg) => {
  const chatId = msg.chat.id;
  const session = await getSession(chatId);

  if (!session) {
    bot.sendMessage(chatId, '❌ *Not verified!*\n\nSend /start to verify your identity and link your company.', { parse_mode: 'Markdown' });
    return;
  }

  // Get company details
  const r = await query('SELECT ID, LegalName, TradeName, RegisteredMobile, ContactEmail FROM Companies WHERE ID = @cid', { cid: session.CompanyID });

  if (!r.recordset.length) {
    bot.sendMessage(chatId, '❌ Company not found in database!', { parse_mode: 'Markdown' });
    return;
  }

  const company = r.recordset[0];
  bot.sendMessage(chatId, `🏢 *Your Linked Company:*\n\n📌 *Name:* ${company.LegalName || company.TradeName}\n🆔 *Company ID:* ${session.CompanyID}\n📱 *Registered Mobile:* ${company.RegisteredMobile || 'N/A'}\n📧 *Email:* ${company.ContactEmail || 'N/A'}\n✅ *Verified Phone:* ${session.PhoneNumber}\n\n_All your tasks are synced with this company._`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '🔓 Unlink this bot', callback_data: 'unlink_confirm' }]]
    }
  });
});

// /unlink - Disconnect bot from company
bot.onText(/\/unlink/, async (msg) => {
  const chatId = msg.chat.id;
  const session = await getSession(chatId);
  if (!session) {
    bot.sendMessage(chatId, '❌ You are not linked to any company.', { parse_mode: 'Markdown' });
    return;
  }
  bot.sendMessage(chatId, `⚠️ *Unlink confirmation*\n\nThis will disconnect the bot from *${session.CompanyName}*.\n\nYou can re-link anytime by sending /start and sharing your phone number.`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔓 Yes, Unlink', callback_data: 'unlink_confirm' }, { text: '❌ Cancel', callback_data: 'add_cancel' }]
      ]
    }
  });
});

// CRON: Morning 9 AM IST
cron.schedule('30 3 * * *', async () => { // 9:00 AM IST = 3:30 UTC
  const sessions = await query('SELECT * FROM TelegramSessions');
  const today = await getTodayISO();
  for (const s of sessions.recordset) {
    const r = await query(`
      SELECT COUNT(*) AS cnt FROM QuickCapture
      WHERE CompanyID=@cid AND SchedDate=@today AND (SLStatus IS NULL OR SLStatus != 'Completed')
    `, { cid: s.CompanyID, today });
    const cnt = r.recordset[0].cnt;
    if (cnt > 0) {
      bot.sendMessage(s.ChatID, `☀️ *Good Morning, ${s.CompanyName}!*\n\nYou have *${cnt} task(s)* scheduled for today.\n\n👉 /today to view them`, { parse_mode: 'Markdown' });
    }
  }
}, { timezone: 'Asia/Kolkata' });

// CRON: Evening 6 PM IST
cron.schedule('30 12 * * *', async () => { // 6:00 PM IST = 12:30 UTC
  const sessions = await query('SELECT * FROM TelegramSessions');
  const today = await getTodayISO();
  for (const s of sessions.recordset) {
    const r = await query(`
      SELECT COUNT(*) AS cnt FROM QuickCapture
      WHERE CompanyID=@cid AND SchedDate < @today AND (SLStatus IS NULL OR SLStatus != 'Completed')
    `, { cid: s.CompanyID, today });
    const cnt = r.recordset[0].cnt;
    if (cnt > 0) {
      bot.sendMessage(s.ChatID, `⚠️ *${s.CompanyName}* — You have *${cnt} overdue task(s)*!\n\n👉 /overdue to view and resolve`, { parse_mode: 'Markdown' });
    }
  }
}, { timezone: 'Asia/Kolkata' });

// Webhook setup
async function setupWebhook() {
  await bot.setWebHook(`${WEBHOOK_URL}`);
  console.log(`Telegram webhook set: ${WEBHOOK_URL}`);
}

module.exports = { bot, initBotDB, setupWebhook };
