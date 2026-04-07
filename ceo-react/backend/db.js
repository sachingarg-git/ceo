const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'ss123456',
  server: '103.122.85.118',
  port: 51440,
  database: 'CEO_ProductivityDB',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  requestTimeout: 30000,
  connectionTimeout: 15000,
};

let pool = null;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

async function query(queryStr, params) {
  const p = await getPool();
  const request = p.request();
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      request.input(key, val);
    }
  }
  return request.query(queryStr);
}

async function initDatabase() {
  const p = await getPool();

  // Create tables if they don't exist
  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='QuickCapture' AND xtype='U')
    CREATE TABLE QuickCapture (
      ID INT IDENTITY(1,1) PRIMARY KEY,
      Date NVARCHAR(20),
      Time NVARCHAR(20),
      Task NVARCHAR(500),
      Priority NVARCHAR(20) DEFAULT 'Medium',
      BatchType NVARCHAR(50),
      SendTo NVARCHAR(50) DEFAULT 'Someday List',
      SLStatus NVARCHAR(30) DEFAULT 'Scheduled',
      SchedDate NVARCHAR(20),
      SchedTimeFrom NVARCHAR(20),
      SchedTimeTo NVARCHAR(20),
      Deadline NVARCHAR(20),
      Notes NVARCHAR(MAX),
      Status NVARCHAR(30) DEFAULT 'Not Started',
      DoneDate NVARCHAR(20),
      CreatedAt DATETIME DEFAULT GETDATE()
    )
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RecurringTasks' AND xtype='U')
    CREATE TABLE RecurringTasks (
      ID INT IDENTITY(1,1) PRIMARY KEY,
      Task NVARCHAR(500),
      Priority NVARCHAR(20) DEFAULT 'Medium',
      BatchType NVARCHAR(50),
      Frequency NVARCHAR(20) DEFAULT 'Daily',
      Weekday NVARCHAR(20),
      WeekPosition NVARCHAR(20),
      FixedDate NVARCHAR(20),
      SLStatus NVARCHAR(30) DEFAULT 'Scheduled',
      Status NVARCHAR(20) DEFAULT 'Active',
      Notes NVARCHAR(MAX),
      TimeSlot NVARCHAR(20),
      DateAdded NVARCHAR(20),
      DateStopped NVARCHAR(20)
    )
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DailySchedule' AND xtype='U')
    CREATE TABLE DailySchedule (
      ID INT IDENTITY(1,1) PRIMARY KEY,
      Date NVARCHAR(20),
      Source NVARCHAR(20),
      SourceRow NVARCHAR(20),
      Done NVARCHAR(10),
      DoneTime NVARCHAR(20),
      DayRating NVARCHAR(20),
      ActuallyDone NVARCHAR(MAX)
    )
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DailyReport' AND xtype='U')
    CREATE TABLE DailyReport (
      ID INT IDENTITY(1,1) PRIMARY KEY,
      Date NVARCHAR(20),
      DayRating NVARCHAR(20),
      Scheduled INT DEFAULT 0,
      Completed INT DEFAULT 0,
      CompletionPct INT DEFAULT 0,
      Waiting INT DEFAULT 0,
      Achievements NVARCHAR(MAX),
      Notes NVARCHAR(MAX)
    )
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WeeklyScorecard' AND xtype='U')
    CREATE TABLE WeeklyScorecard (
      ID INT IDENTITY(1,1) PRIMARY KEY,
      WeekNum INT,
      StartDate NVARCHAR(20),
      EndDate NVARCHAR(20),
      Planned INT DEFAULT 0,
      Done INT DEFAULT 0,
      CompletionPct INT DEFAULT 0,
      AvgDayRating FLOAT DEFAULT 0,
      Achievements NVARCHAR(MAX),
      CarryForward NVARCHAR(MAX)
    )
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='InformationSystem' AND xtype='U')
    CREATE TABLE InformationSystem (
      ID INT IDENTITY(1,1) PRIMARY KEY,
      SourceRow INT,
      Category NVARCHAR(100),
      Title NVARCHAR(500),
      Content NVARCHAR(MAX),
      Notes NVARCHAR(MAX),
      DateAdded NVARCHAR(20)
    )
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Masters' AND xtype='U')
    CREATE TABLE Masters (
      ID INT IDENTITY(1,1) PRIMARY KEY,
      MasterType NVARCHAR(50),
      MasterValue NVARCHAR(200),
      SortOrder INT DEFAULT 0
    )
  `);

  // Roles table
  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Roles' AND xtype='U')
    CREATE TABLE Roles (
      ID INT IDENTITY(1,1) PRIMARY KEY,
      RoleName NVARCHAR(50) NOT NULL,
      Description NVARCHAR(200),
      Permissions NVARCHAR(MAX),
      CreatedAt DATETIME DEFAULT GETDATE()
    )
  `);

  // Users table
  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
    CREATE TABLE Users (
      ID INT IDENTITY(1,1) PRIMARY KEY,
      Username NVARCHAR(50) NOT NULL UNIQUE,
      Password NVARCHAR(100) NOT NULL,
      FullName NVARCHAR(100),
      Email NVARCHAR(100),
      RoleID INT,
      IsActive BIT DEFAULT 1,
      CreatedAt DATETIME DEFAULT GETDATE(),
      LastLogin DATETIME
    )
  `);

  // Seed default roles if empty
  const rolesCheck = await p.request().query('SELECT COUNT(*) as cnt FROM Roles');
  if (rolesCheck.recordset[0].cnt === 0) {
    const roles = [
      { name: 'CEO', desc: 'Full access to all features', perms: JSON.stringify(['dashboard','quick-capture','someday-list','daily-schedule','recurring-tasks','info-system','daily-report','weekly-scorecard','next-week-plan','performance-analytics','settings','user-management']) },
      { name: 'Executive Assistant', desc: 'Can manage tasks and schedules', perms: JSON.stringify(['dashboard','quick-capture','someday-list','daily-schedule','recurring-tasks','info-system','daily-report','weekly-scorecard','next-week-plan','performance-analytics']) },
      { name: 'Viewer', desc: 'Read-only access to reports', perms: JSON.stringify(['dashboard','someday-list','daily-report','weekly-scorecard','performance-analytics']) },
    ];
    for (const r of roles) {
      await p.request()
        .input('name', sql.NVarChar, r.name)
        .input('desc', sql.NVarChar, r.desc)
        .input('perms', sql.NVarChar, r.perms)
        .query('INSERT INTO Roles (RoleName, Description, Permissions) VALUES (@name, @desc, @perms)');
    }
    console.log('Default roles seeded.');
  }

  // Seed default users if empty
  const usersCheck = await p.request().query('SELECT COUNT(*) as cnt FROM Users');
  if (usersCheck.recordset[0].cnt === 0) {
    const ceoRole = await p.request().query("SELECT ID FROM Roles WHERE RoleName = 'CEO'");
    const eaRole = await p.request().query("SELECT ID FROM Roles WHERE RoleName = 'Executive Assistant'");
    const users = [
      { username: 'ceo', password: 'ceo123', fullName: 'CEO', roleId: ceoRole.recordset[0]?.ID || 1 },
      { username: 'ea', password: 'ea123', fullName: 'Executive Assistant', roleId: eaRole.recordset[0]?.ID || 2 },
    ];
    for (const u of users) {
      await p.request()
        .input('username', sql.NVarChar, u.username)
        .input('password', sql.NVarChar, u.password)
        .input('fullName', sql.NVarChar, u.fullName)
        .input('roleId', sql.Int, u.roleId)
        .query('INSERT INTO Users (Username, Password, FullName, RoleID) VALUES (@username, @password, @fullName, @roleId)');
    }
    console.log('Default users seeded.');
  }

  // Companies table (for multi-company sign-up)
  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Companies' AND xtype='U')
    CREATE TABLE Companies (
      ID INT IDENTITY(1,1) PRIMARY KEY,
      GSTIN NVARCHAR(20) NOT NULL UNIQUE,
      LegalName NVARCHAR(300),
      TradeName NVARCHAR(300),
      BusinessType NVARCHAR(100),
      RegistrationDate NVARCHAR(20),
      GSTStatus NVARCHAR(30),
      StateJurisdiction NVARCHAR(300),
      CentralJurisdiction NVARCHAR(300),
      Address NVARCHAR(500),
      Pincode NVARCHAR(10),
      ContactName NVARCHAR(100),
      ContactMobile NVARCHAR(20),
      ContactEmail NVARCHAR(100),
      RegisteredMobile NVARCHAR(20),
      Username NVARCHAR(50) UNIQUE,
      Password NVARCHAR(100),
      ApprovalStatus NVARCHAR(20) DEFAULT 'Pending',
      ApprovedBy INT,
      ApprovedAt DATETIME,
      GSTRawResponse NVARCHAR(MAX),
      CreatedAt DATETIME DEFAULT GETDATE(),
      LastLogin DATETIME
    )
  `);
  console.log('Companies table ready.');

  // Add CompanyID column to all data tables for multi-tenancy
  const dataTables = ['QuickCapture', 'RecurringTasks', 'DailySchedule', 'DailyReport', 'WeeklyScorecard', 'InformationSystem'];
  for (const tbl of dataTables) {
    try {
      await p.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${tbl}') AND name = 'CompanyID')
        ALTER TABLE ${tbl} ADD CompanyID INT DEFAULT 0
      `);
    } catch (e) { /* column may already exist */ }
  }
  // Update existing rows with NULL CompanyID to 0 (admin)
  for (const tbl of dataTables) {
    try {
      await p.request().query(`UPDATE ${tbl} SET CompanyID = 0 WHERE CompanyID IS NULL`);
    } catch (e) { /* ignore */ }
  }
  console.log('CompanyID columns ready.');

  // Seed Masters data if empty
  const mastersCheck = await p.request().query('SELECT COUNT(*) as cnt FROM Masters');
  if (mastersCheck.recordset[0].cnt === 0) {
    const seedData = {
      priority: ['High', 'Medium', 'Low'],
      batchType: ['Communication', 'Deep Work', 'Admin', 'Meeting', 'Sales Call', 'Planning'],
      taskStatus: ['Not Started', 'In Progress', 'Done', 'Blocked', 'Cancelled', 'Deferred'],
      schedStatus: ['Scheduled', 'Waiting', 'Completed', 'Skipped'],
      infoCategory: ['Sales & BD', 'Client Delivery', 'Product Strategy', 'Finance', 'HR & Team', 'Operations', 'Marketing', 'AI / Tech R&D', 'Admin', 'Learning', 'Personal'],
      dayRating: ['Excellent', 'Good', 'Average', 'Poor', 'Bad'],
      frequency: ['Daily', 'Weekly', 'Monthly', 'Yearly', 'Fixed Date'],
      weekday: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      weekPosition: ['First', 'Second', 'Third', 'Fourth', 'Last'],
      recurringStatus: ['Active', 'Paused', 'Stopped'],
    };

    for (const [type, values] of Object.entries(seedData)) {
      for (let i = 0; i < values.length; i++) {
        await p.request()
          .input('type', sql.NVarChar, type)
          .input('value', sql.NVarChar, values[i])
          .input('order', sql.Int, i)
          .query('INSERT INTO Masters (MasterType, MasterValue, SortOrder) VALUES (@type, @value, @order)');
      }
    }
    console.log('Masters data seeded.');
  }

  console.log('Database tables initialized.');
}

module.exports = { getPool, query, initDatabase, sql };
