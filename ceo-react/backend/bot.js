const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const { query } = require('./db');

const TOKEN = '8607668575:AAGgDYBg0SwKIWTfGdqT-FJm_L3AIbncm4s';
const WEBHOOK_URL = 'https://ea.wizone.ai/webhook/telegram';

const bot = new TelegramBot(TOKEN, { webHook: { port: false } });

// ── DB Init ──────────────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getSession(chatId) {
  const r = await query('SELECT * FROM TelegramSessions WHERE ChatID = @chatId', { chatId });
  return r.recordset[0] || null;
}

async function getTodayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function fmtTask(t, i) {
  const date = t.SchedDate ? t.SchedDate.toISOString().split('T')[0] : '';
  const time = t.SchedTimeFrom || '';
  const pri  = t.Priority || '';
  return `${i+1}. *${t.Task || t.Description || ''}*\n   📅 ${date || 'No date'} ${time ? '⏰ '+time : ''} ${pri ? '| '+pri : ''}`;
}

// ── /start ────────────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const session = await getSession(chatId);
  if (session) {
    bot.sendMessage(chatId, `✅ Already verified as *${session.CompanyName}*!\n\nCommands:\n/today - Today's tasks\n/upcoming - Upcoming tasks\n/overdue - Overdue tasks\n/add [task] - Add new task\n/done - Mark task done\n/help - All commands`, { parse_mode: 'Markdown' });
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

// ── Phone Verification ────────────────────────────────────────────────────────
bot.on('contact', async (msg) => {
  const chatId = msg.chat.id;
  const phone = msg.contact.phone_number.replace(/\D/g, '');

  // Try match with or without country code
  const result = await query(`
    SELECT TOP 1 ID, CompanyName, Phone FROM Companies
    WHERE REPLACE(REPLACE(Phone, '+', ''), ' ', '') LIKE '%' + @phone + '%'
       OR @phone LIKE '%' + REPLACE(REPLACE(Phone, '+', ''), ' ', '')
  `, { phone });

  if (!result.recordset.length) {
    bot.sendMessage(chatId, `❌ *Phone number not found.*\n\nPlease register your company at https://ea.wizone.ai first.`, {
      parse_mode: 'Markdown',
      reply_markup: { remove_keyboard: true }
    });
    return;
  }

  const company = result.recordset[0];
  await query(`
    MERGE TelegramSessions AS target
    USING (SELECT @chatId AS ChatID) AS source ON target.ChatID = source.ChatID
    WHEN MATCHED THEN UPDATE SET CompanyID=@companyId, PhoneNumber=@phone, CompanyName=@name, VerifiedAt=GETDATE()
    WHEN NOT MATCHED THEN INSERT (ChatID, CompanyID, PhoneNumber, CompanyName) VALUES (@chatId, @companyId, @phone, @name);
  `, { chatId, companyId: company.ID, phone, name: company.CompanyName });

  bot.sendMessage(chatId, `✅ *Verified! Welcome, ${company.CompanyName}!*\n\nYour bot is now active. Here's what you can do:\n\n📋 /today - Today's tasks\n📅 /upcoming - Upcoming tasks\n⚠️ /overdue - Overdue tasks\n➕ /add [task] - Add new task\n✅ /done - Mark task done\n❓ /help - All commands`, {
    parse_mode: 'Markdown',
    reply_markup: { remove_keyboard: true }
  });
});

// ── Auth Middleware ───────────────────────────────────────────────────────────
async function requireAuth(msg, cb) {
  const session = await getSession(msg.chat.id);
  if (!session) {
    bot.sendMessage(msg.chat.id, '❌ Not verified. Send /start to verify your identity.');
    return;
  }
  cb(session);
}

// ── /today ────────────────────────────────────────────────────────────────────
bot.onText(/\/today/, async (msg) => {
  requireAuth(msg, async (session) => {
    const today = await getTodayISO();
    const r = await query(`
      SELECT TOP 10 Task, SchedDate, SchedTimeFrom, Priority, SLStatus
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

// ── /upcoming ─────────────────────────────────────────────────────────────────
bot.onText(/\/upcoming/, async (msg) => {
  requireAuth(msg, async (session) => {
    const today = await getTodayISO();
    const r = await query(`
      SELECT TOP 10 Task, SchedDate, SchedTimeFrom, Priority, SLStatus
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

// ── /overdue ──────────────────────────────────────────────────────────────────
bot.onText(/\/overdue/, async (msg) => {
  requireAuth(msg, async (session) => {
    const today = await getTodayISO();
    const r = await query(`
      SELECT TOP 10 Task, SchedDate, SchedTimeFrom, Priority, SLStatus
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

// ── /add ──────────────────────────────────────────────────────────────────────
bot.onText(/\/add (.+)/, async (msg, match) => {
  requireAuth(msg, async (session) => {
    const description = match[1].trim();
    if (!description) { bot.sendMessage(msg.chat.id, 'Usage: /add Your task description'); return; }

    const today = await getTodayISO();
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

    await query(`
      INSERT INTO QuickCapture (Task, Date, Time, Priority, SendTo, SLStatus, CompanyID)
      VALUES (@task, @date, @time, 'Medium', 'Someday List', 'Scheduled', @cid)
    `, { task: description, date: today, time: timeStr, cid: session.CompanyID });

    bot.sendMessage(msg.chat.id, `✅ *Task Added!*\n\n📋 ${description}\n📅 ${today}\n🔵 Priority: Medium\n📁 Someday List`, { parse_mode: 'Markdown' });
  });
});

// ── /done ─────────────────────────────────────────────────────────────────────
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

// ── Callback: mark done ───────────────────────────────────────────────────────
bot.on('callback_query', async (query_cb) => {
  const data = query_cb.data;
  const chatId = query_cb.message.chat.id;
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

// ── /help ─────────────────────────────────────────────────────────────────────
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `🤖 *EA to M.D Bot - Commands:*\n\n/today - Today's tasks\n/upcoming - Upcoming tasks\n/overdue - Overdue tasks\n/add [task] - Create new task\n/done - Mark task done\n/help - Show this menu\n\n_Notifications are sent automatically every morning at 9 AM and evening at 6 PM._`, { parse_mode: 'Markdown' });
});

// ── CRON: Morning 9 AM IST ────────────────────────────────────────────────────
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

// ── CRON: Evening 6 PM IST — overdue alert ────────────────────────────────────
cron.schedule('0 12 * * *', async () => { // 6:00 PM IST = 12:30 UTC
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

// ── Webhook setup ─────────────────────────────────────────────────────────────
async function setupWebhook() {
  await bot.setWebHook(`${WEBHOOK_URL}`);
  console.log(`Telegram webhook set: ${WEBHOOK_URL}`);
}

module.exports = { bot, initBotDB, setupWebhook };
