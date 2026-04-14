const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { sendApprovalEmail } = require('../mailer');

const GST_API_URL = 'https://javabackend.idspay.in/api/v1/prod/srv2/validation/kyb/gst-advance';
const GST_API_ID = 'APID0680';
const GST_API_KEY = '93f3cf58-797e-4951-b4cd-bfd5cb10fccb';
const GST_TOKEN = 'q4SAiSeFv2NtUijZqsIEOIfwbYONGaLI';

// POST /api/companies/verify-gst
router.post('/verify-gst', async (req, res) => {
  try {
    const { gstin } = req.body;
    if (!gstin || gstin.length !== 15) {
      return res.json({ success: false, error: 'Invalid GSTIN. Must be 15 characters.' });
    }

    // Check if already registered
    const existing = await query('SELECT ID, ApprovalStatus FROM Companies WHERE GSTIN = @gstin', { gstin });
    if (existing.recordset.length > 0) {
      const status = existing.recordset[0].ApprovalStatus;
      return res.json({ success: false, error: `This GSTIN is already registered (Status: ${status})` });
    }

    // Call IDSPay GST API
    const response = await fetch(GST_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_id: GST_API_ID,
        api_key: GST_API_KEY,
        token_id: GST_TOKEN,
        gstin: gstin,
      }),
    });

    const data = await response.json();

    // Support both response formats:
    // Format 1: { result_code: 101, result: { taxpayerDetails: ... } }
    // Format 2: { status: { code: 200 }, data: { taxpayerDetails: ... } }
    const tp = data.result?.taxpayerDetails || data.data?.taxpayerDetails;

    if (!tp) {
      return res.json({ success: false, error: 'GST verification failed. Please check the GSTIN number.' });
    }

    // Build address from business_places or pradr
    let address = '';
    const bizPlaces = data.data?.business_places || data.result?.business_places;
    if (bizPlaces?.pradr?.adr) {
      address = bizPlaces.pradr.adr;
    } else if (tp.pradr?.addr) {
      const a = tp.pradr.addr;
      address = [a.bno, a.flno, a.bnm, a.st, a.loc, a.dst, a.stcd, a.pncd].filter(Boolean).join(', ');
    }

    const companyDetails = {
      gstin: tp.gstin || gstin,
      legalName: tp.lgnm || '',
      tradeName: tp.tradeNam || '',
      businessType: tp.ctb || '',
      registrationDate: tp.rgdt || '',
      gstStatus: tp.sts || '',
      stateJurisdiction: tp.stj || '',
      centralJurisdiction: tp.ctj || '',
      address: address,
      pincode: tp.pradr?.addr?.pncd || '',
      contactName: tp.contacted?.name || '',
      contactMobile: tp.contacted?.mobNum ? String(tp.contacted.mobNum) : '',
      contactEmail: tp.contacted?.email || '',
      members: tp.mbr || [],
      natureOfBusiness: tp.nba || [],
    };

    res.json({ success: true, company: companyDetails, rawResponse: data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'GST verification failed: ' + err.message });
  }
});

// POST /api/companies/signup - Complete registration (with GST or without GST)
// Supports: { gstin, gstData, ... } for GST flow
// Supports: { noGst: true, manualData: {...}, ... } for no-GST manual flow
router.post('/signup', async (req, res) => {
  try {
    const { gstin, registeredMobile, username, password, userEmail, gstData, noGst, manualData } = req.body;

    if (!username || !password) {
      return res.json({ success: false, error: 'Username and password are required' });
    }
    if (!userEmail || !userEmail.includes('@')) {
      return res.json({ success: false, error: 'A valid email address is required' });
    }

    // Determine GSTIN and company data based on mode
    let finalGstin, companyInfo, rawResponse;
    if (noGst) {
      // No-GST manual flow: generate unique placeholder GSTIN
      if (!manualData?.legalName?.trim()) {
        return res.json({ success: false, error: 'Company Name is required' });
      }
      finalGstin = ('NONGST' + Date.now()).substring(0, 20);
      companyInfo = {
        legalName: (manualData.legalName || '').trim(),
        tradeName: (manualData.tradeName || '').trim(),
        businessType: (manualData.businessType || '').trim(),
        registrationDate: '',
        gstStatus: '',
        stateJurisdiction: '',
        centralJurisdiction: '',
        address: (manualData.address || '').trim(),
        pincode: (manualData.pincode || '').trim(),
        contactName: (manualData.contactName || '').trim(),
        contactMobile: '',
        contactEmail: '',
      };
      rawResponse = JSON.stringify({ source: 'manual-no-gst', ...manualData });
    } else {
      // GST flow
      if (!gstin) {
        return res.json({ success: false, error: 'GSTIN is required' });
      }
      finalGstin = gstin;
      companyInfo = {
        legalName: gstData?.legalName || '',
        tradeName: gstData?.tradeName || '',
        businessType: gstData?.businessType || '',
        registrationDate: gstData?.registrationDate || '',
        gstStatus: gstData?.gstStatus || '',
        stateJurisdiction: gstData?.stateJurisdiction || '',
        centralJurisdiction: gstData?.centralJurisdiction || '',
        address: gstData?.address || '',
        pincode: gstData?.pincode || '',
        contactName: gstData?.contactName || '',
        contactMobile: gstData?.contactMobile || '',
        contactEmail: gstData?.contactEmail || '',
      };
      rawResponse = JSON.stringify(gstData || {});
    }

    // Check duplicates
    const existingGst = await query('SELECT ID FROM Companies WHERE GSTIN = @gstin', { gstin: finalGstin });
    if (existingGst.recordset.length > 0) {
      return res.json({ success: false, error: noGst ? 'Registration conflict. Please try again.' : 'This GSTIN is already registered' });
    }

    const existingUser = await query('SELECT ID FROM Companies WHERE Username = @username', { username });
    if (existingUser.recordset.length > 0) {
      return res.json({ success: false, error: 'Username already taken' });
    }

    const result = await query(
      `INSERT INTO Companies (GSTIN, LegalName, TradeName, BusinessType, RegistrationDate, GSTStatus,
        StateJurisdiction, CentralJurisdiction, Address, Pincode, ContactName, ContactMobile, ContactEmail,
        RegisteredMobile, Username, Password, UserEmail, GSTRawResponse)
       OUTPUT INSERTED.ID
       VALUES (@gstin, @legalName, @tradeName, @businessType, @regDate, @gstStatus,
        @stateJur, @centralJur, @address, @pincode, @contactName, @contactMobile, @contactEmail,
        @regMobile, @username, @password, @userEmail, @rawResponse)`,
      {
        gstin: finalGstin,
        legalName: companyInfo.legalName,
        tradeName: companyInfo.tradeName,
        businessType: companyInfo.businessType,
        regDate: companyInfo.registrationDate,
        gstStatus: companyInfo.gstStatus,
        stateJur: companyInfo.stateJurisdiction,
        centralJur: companyInfo.centralJurisdiction,
        address: companyInfo.address,
        pincode: companyInfo.pincode,
        contactName: companyInfo.contactName,
        contactMobile: companyInfo.contactMobile,
        contactEmail: companyInfo.contactEmail,
        regMobile: registeredMobile || '',
        username,
        password,
        userEmail: userEmail.trim().toLowerCase(),
        rawResponse,
      }
    );

    res.json({ success: true, id: result.recordset[0].ID, message: 'Registration submitted. Awaiting admin approval.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/companies/signup-no-gst - Register without a GST number (manual details)
router.post('/signup-no-gst', async (req, res) => {
  try {
    const { manualData, registeredMobile, username, password, userEmail } = req.body;

    if (!manualData?.legalName?.trim() || !username?.trim() || !password) {
      return res.json({ success: false, error: 'Company Name, username and password are required' });
    }
    if (!userEmail || !userEmail.includes('@')) {
      return res.json({ success: false, error: 'A valid email address is required' });
    }

    // Check username uniqueness
    const existingUser = await query('SELECT ID FROM Companies WHERE Username = @username', { username });
    if (existingUser.recordset.length > 0) {
      return res.json({ success: false, error: 'Username already taken' });
    }

    // Generate a unique placeholder GSTIN (NONGST + 13-digit timestamp = 19 chars, fits NVARCHAR(20))
    const placeholderGstin = ('NONGST' + Date.now()).substring(0, 20);

    const result = await query(
      `INSERT INTO Companies (GSTIN, LegalName, TradeName, BusinessType, Address, Pincode,
        ContactName, ContactMobile, RegisteredMobile, Username, Password, UserEmail, GSTRawResponse)
       OUTPUT INSERTED.ID
       VALUES (@gstin, @legalName, @tradeName, @businessType, @address, @pincode,
        @contactName, @contactMobile, @regMobile, @username, @password, @userEmail, @rawResponse)`,
      {
        gstin: placeholderGstin,
        legalName: (manualData.legalName || '').trim(),
        tradeName: (manualData.tradeName || '').trim(),
        businessType: (manualData.businessType || '').trim(),
        address: (manualData.address || '').trim(),
        pincode: (manualData.pincode || '').trim(),
        contactName: (manualData.contactName || '').trim(),
        contactMobile: (manualData.contactMobile || '').trim(),
        regMobile: registeredMobile || '',
        username: username.trim(),
        password,
        userEmail: userEmail.trim().toLowerCase(),
        rawResponse: JSON.stringify({ source: 'manual-no-gst', ...manualData }),
      }
    );

    res.json({ success: true, id: result.recordset[0].ID, message: 'Registration submitted. Awaiting admin approval.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/companies/login - Company login (primary account OR sub-user)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Try primary company account first
    const result = await query(
      'SELECT * FROM Companies WHERE Username = @username AND Password = @password',
      { username, password }
    );

    if (result.recordset.length > 0) {
      const c = result.recordset[0];
      if (c.ApprovalStatus !== 'Approved') {
        return res.json({ success: false, error: `Account is ${c.ApprovalStatus}. Please wait for admin approval.` });
      }
      await query('UPDATE Companies SET LastLogin = GETDATE() WHERE ID = @id', { id: c.ID });
      return res.json({
        success: true,
        user: {
          id: c.ID,
          type: 'company',
          username: c.Username,
          name: (c.TradeName && c.TradeName !== 'NA' ? c.TradeName : c.LegalName) || c.Username,
          gstin: c.GSTIN,
          role: 'Company',
          permissions: ['dashboard', 'quick-capture', 'someday-list', 'daily-schedule', 'recurring-tasks', 'info-system', 'daily-report', 'weekly-scorecard', 'next-week-plan', 'performance-analytics', 'settings'],
        },
      });
    }

    // 2. Try CompanyUsers sub-user login
    const subResult = await query(`
      SELECT cu.*, c.LegalName, c.TradeName, c.GSTIN, c.ApprovalStatus
      FROM CompanyUsers cu
      INNER JOIN Companies c ON c.ID = cu.CompanyID
      WHERE cu.Username = @username AND cu.Password = @password AND cu.IsActive = 1
    `, { username, password });

    if (subResult.recordset.length === 0) {
      return res.json({ success: false, error: 'Invalid credentials' });
    }

    const su = subResult.recordset[0];
    if (su.ApprovalStatus !== 'Approved') {
      return res.json({ success: false, error: `Company account is ${su.ApprovalStatus}. Please wait for admin approval.` });
    }

    // Update sub-user last login
    await query('UPDATE CompanyUsers SET LastLogin = GETDATE() WHERE ID = @id', { id: su.ID });

    const companyName = (su.TradeName && su.TradeName !== 'NA' ? su.TradeName : su.LegalName) || su.Username;
    return res.json({
      success: true,
      user: {
        id: su.CompanyID,      // Use parent CompanyID so all data scoping works correctly
        subUserId: su.ID,
        type: 'company',
        username: su.Username,
        name: `${su.FullName || su.Username} (${companyName})`,
        gstin: su.GSTIN,
        role: su.Role || 'User',
        isSubUser: true,
        permissions: ['dashboard', 'quick-capture', 'someday-list', 'daily-schedule', 'recurring-tasks', 'info-system', 'daily-report', 'weekly-scorecard', 'next-week-plan', 'performance-analytics', 'settings'],
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/companies - List all companies (admin only)
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM Companies ORDER BY CreatedAt DESC');
    const companies = result.recordset.map(c => ({
      id: c.ID,
      gstin: c.GSTIN || '',
      legalName: c.LegalName || '',
      tradeName: c.TradeName || '',
      businessType: c.BusinessType || '',
      gstStatus: c.GSTStatus || '',
      address: c.Address || '',
      pincode: c.Pincode || '',
      registeredMobile: c.RegisteredMobile || '',
      contactName: c.ContactName || '',
      contactEmail: c.ContactEmail || '',
      username: c.Username || '',
      userEmail: c.UserEmail || '',
      approvalStatus: (c.ApprovalStatus || 'Pending').toLowerCase(),
      createdAt: c.CreatedAt,
      lastLogin: c.LastLogin,
      stateJurisdiction: c.StateJurisdiction || '',
      centralJurisdiction: c.CentralJurisdiction || '',
    }));
    res.json({ success: true, companies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/companies/:id/password - Reset password
router.put('/:id/password', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { password } = req.body;
    if (!password) return res.json({ success: false, error: 'Password is required' });
    await query('UPDATE Companies SET Password = @password WHERE ID = @id', { password, id });
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/companies/:id/approve - Approve company + send welcome email
router.put('/:id/approve', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Fetch company details before approving (need credentials + email)
    const compRes = await query(
      'SELECT LegalName, TradeName, Username, Password, UserEmail FROM Companies WHERE ID = @id',
      { id }
    );

    await query(
      'UPDATE Companies SET ApprovalStatus = @status, ApprovedAt = GETDATE() WHERE ID = @id',
      { status: 'Approved', id }
    );

    // Send welcome email if we have a UserEmail
    if (compRes.recordset.length > 0) {
      const c = compRes.recordset[0];
      const toEmail = c.UserEmail;
      const companyName = (c.TradeName && c.TradeName !== 'NA' ? c.TradeName : c.LegalName) || c.Username;

      if (toEmail) {
        // Fire-and-forget — don't block the approve response on email
        sendApprovalEmail({
          toEmail,
          companyName,
          username: c.Username,
          password: c.Password,
        }).then(r => {
          if (!r.success) console.error('Approval email failed:', r.error);
        });
      } else {
        console.warn(`Company ID ${id} approved but has no UserEmail — skipping email.`);
      }
    }

    res.json({ success: true, message: 'Company approved — welcome email sent!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/companies/:id/reject - Reject company
router.put('/:id/reject', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await query(
      'UPDATE Companies SET ApprovalStatus = @status WHERE ID = @id',
      { status: 'Rejected', id }
    );
    res.json({ success: true, message: 'Company rejected' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/companies/:id — full cascade wipe for clean re-registration
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // 1. Kill bot sessions so the user is forced to re-verify and gets the new CompanyID
    await query('DELETE FROM TelegramSessions WHERE CompanyID = @id', { id });

    // 2. Remove sub-users
    await query('DELETE FROM CompanyUsers WHERE CompanyID = @id', { id });

    // 3. Remove subscription plans
    await query('DELETE FROM CompanyPlans WHERE CompanyID = @id', { id });

    // 4. Wipe all task / report data so re-registration starts completely fresh
    const dataTables = [
      'QuickCapture', 'DailySchedule', 'RecurringTasks',
      'DailyReport', 'WeeklyScorecard', 'InformationSystem',
    ];
    for (const tbl of dataTables) {
      try {
        await query(`DELETE FROM ${tbl} WHERE CompanyID = @id`, { id });
      } catch (e) { /* table may not have CompanyID yet — ignore */ }
    }

    // 5. Delete the company record itself
    await query('DELETE FROM Companies WHERE ID = @id', { id });

    res.json({ success: true, message: 'Company and all associated data deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ COMPANY SUB-USERS (max 3 per company) ============

// GET /api/companies/users/my - Get users for the logged-in company
router.get('/users/my', async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.json({ success: true, users: [], limit: 3 });
    const result = await query('SELECT * FROM CompanyUsers WHERE CompanyID = @companyId ORDER BY ID ASC', { companyId });
    const users = result.recordset.map(u => ({
      id: u.ID, username: u.Username, fullName: u.FullName || '',
      email: u.Email || '', mobile: u.Mobile || '', role: u.Role || 'User',
      isActive: u.IsActive, createdAt: u.CreatedAt, lastLogin: u.LastLogin,
      taskPrivacy: u.TaskPrivacy || 'Public',
    }));
    res.json({ success: true, users, limit: 3, remaining: Math.max(0, 3 - users.length) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/companies/users/my - Create company sub-user
router.post('/users/my', async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.json({ success: false, error: 'Company login required' });

    // Check limit
    const countRes = await query('SELECT COUNT(*) as cnt FROM CompanyUsers WHERE CompanyID = @companyId', { companyId });
    if (countRes.recordset[0].cnt >= 3) {
      return res.json({ success: false, error: 'Maximum 3 users per company. Please delete an existing user first.' });
    }

    const { username, password, fullName, email, role, mobile } = req.body;
    if (!username || !password) return res.json({ success: false, error: 'Username and password required' });

    // Check unique username within company
    const existing = await query('SELECT ID FROM CompanyUsers WHERE CompanyID = @companyId AND Username = @username', { companyId, username });
    if (existing.recordset.length > 0) return res.json({ success: false, error: 'Username already exists in your company' });

    // Check unique mobile across all CompanyUsers (if provided)
    if (mobile) {
      const mobileCheck = await query('SELECT ID FROM CompanyUsers WHERE Mobile = @mobile', { mobile });
      if (mobileCheck.recordset.length > 0) return res.json({ success: false, error: 'Mobile number already linked to another user' });
    }

    const result = await query(
      `INSERT INTO CompanyUsers (CompanyID, Username, Password, FullName, Email, Role, Mobile)
       OUTPUT INSERTED.ID VALUES (@companyId, @username, @password, @fullName, @email, @role, @mobile)`,
      { companyId, username, password, fullName: fullName || '', email: email || '', role: role || 'User', mobile: mobile || '' }
    );
    res.json({ success: true, id: result.recordset[0].ID, message: 'User created' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/companies/users/my/:id - Update company sub-user
router.put('/users/my/:id', async (req, res) => {
  try {
    const companyId = req.companyId;
    const id = parseInt(req.params.id);
    const b = req.body;
    const sets = [];
    const params = { id, companyId };

    if (b.fullName !== undefined) { sets.push('FullName = @fullName'); params.fullName = b.fullName; }
    if (b.email !== undefined) { sets.push('Email = @email'); params.email = b.email; }
    if (b.role !== undefined) { sets.push('Role = @role'); params.role = b.role; }
    if (b.isActive !== undefined) { sets.push('IsActive = @isActive'); params.isActive = b.isActive ? 1 : 0; }
    if (b.password) { sets.push('Password = @password'); params.password = b.password; }
    if (b.mobile !== undefined) { sets.push('Mobile = @mobile'); params.mobile = b.mobile; }

    if (sets.length > 0) {
      await query(`UPDATE CompanyUsers SET ${sets.join(', ')} WHERE ID = @id AND CompanyID = @companyId`, params);
    }
    res.json({ success: true, message: 'User updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/companies/users/my/:id - Delete company sub-user
router.delete('/users/my/:id', async (req, res) => {
  try {
    const companyId = req.companyId;
    const id = parseInt(req.params.id);
    await query('DELETE FROM CompanyUsers WHERE ID = @id AND CompanyID = @companyId', { id, companyId });
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET task visibility setting for this company
router.get('/task-visibility', async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.json({ success: false, error: 'Not a company user' });
    const r = await query('SELECT TaskVisibilitySetting FROM Companies WHERE ID = @id', { id: companyId });
    const setting = r.recordset[0]?.TaskVisibilitySetting || 'All';
    res.json({ success: true, setting });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT task visibility setting — sub-users (x-sub-user-id header present) are blocked
router.put('/task-visibility', async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.json({ success: false, error: 'Not a company user' });
    // Block sub-users
    if (req.headers['x-sub-user-id']) {
      return res.status(403).json({ success: false, error: 'Only the company owner can change this setting' });
    }
    const { setting } = req.body;
    if (!['All', 'Restricted'].includes(setting)) {
      return res.status(400).json({ success: false, error: 'Invalid setting value' });
    }
    await query('UPDATE Companies SET TaskVisibilitySetting = @setting WHERE ID = @id', { setting, id: companyId });
    res.json({ success: true, message: 'Task visibility updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET task access grants for this company
router.get('/task-access', async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.json({ success: false, error: 'Not a company user' });
    const r = await query(
      'SELECT * FROM UserTaskAccess WHERE CompanyID = @companyId ORDER BY ID ASC',
      { companyId }
    );
    res.json({ success: true, grants: r.recordset.map(g => ({ id: g.ID, viewerUserId: g.ViewerUserID, ownerUserId: g.OwnerUserID })) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST create a task access grant (owner only)
router.post('/task-access', async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.json({ success: false, error: 'Not a company user' });
    if (req.headers['x-sub-user-id']) return res.status(403).json({ success: false, error: 'Only company owner can manage access grants' });
    const { viewerUserId, ownerUserId } = req.body;
    if (!viewerUserId || !ownerUserId) return res.status(400).json({ success: false, error: 'viewerUserId and ownerUserId required' });
    // Prevent duplicate
    const existing = await query(
      'SELECT ID FROM UserTaskAccess WHERE CompanyID=@cid AND ViewerUserID=@vid AND OwnerUserID=@oid',
      { cid: companyId, vid: viewerUserId, oid: ownerUserId }
    );
    if (existing.recordset.length) return res.json({ success: true, message: 'Grant already exists' });
    const result = await query(
      'INSERT INTO UserTaskAccess (CompanyID, ViewerUserID, OwnerUserID) OUTPUT INSERTED.ID VALUES (@cid, @vid, @oid)',
      { cid: companyId, vid: viewerUserId, oid: ownerUserId }
    );
    res.json({ success: true, id: result.recordset[0].ID, message: 'Access granted' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// DELETE revoke a task access grant (owner only)
router.delete('/task-access/:id', async (req, res) => {
  try {
    const companyId = req.companyId;
    if (req.headers['x-sub-user-id']) return res.status(403).json({ success: false, error: 'Only company owner can manage access grants' });
    const id = parseInt(req.params.id);
    await query('DELETE FROM UserTaskAccess WHERE ID=@id AND CompanyID=@cid', { id, cid: companyId });
    res.json({ success: true, message: 'Access revoked' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// PUT update a user's task privacy (owner only)
router.put('/users/my/:id/privacy', async (req, res) => {
  try {
    const companyId = req.companyId;
    if (req.headers['x-sub-user-id']) return res.status(403).json({ success: false, error: 'Only company owner can change privacy settings' });
    const id = parseInt(req.params.id);
    const { privacy } = req.body; // 'Public' | 'Private'
    if (!['Public', 'Private'].includes(privacy)) return res.status(400).json({ success: false, error: 'Invalid privacy value' });
    await query('UPDATE CompanyUsers SET TaskPrivacy=@privacy WHERE ID=@id AND CompanyID=@cid', { privacy, id, cid: companyId });
    res.json({ success: true, message: 'Privacy updated' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
