const express = require('express');
const router = express.Router();
const { query } = require('../db');

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

// POST /api/companies/signup - Complete registration
router.post('/signup', async (req, res) => {
  try {
    const { gstin, registeredMobile, username, password, gstData } = req.body;

    if (!gstin || !username || !password) {
      return res.json({ success: false, error: 'GSTIN, username and password are required' });
    }

    // Check duplicates
    const existingGst = await query('SELECT ID FROM Companies WHERE GSTIN = @gstin', { gstin });
    if (existingGst.recordset.length > 0) {
      return res.json({ success: false, error: 'This GSTIN is already registered' });
    }

    const existingUser = await query('SELECT ID FROM Companies WHERE Username = @username', { username });
    if (existingUser.recordset.length > 0) {
      return res.json({ success: false, error: 'Username already taken' });
    }

    const result = await query(
      `INSERT INTO Companies (GSTIN, LegalName, TradeName, BusinessType, RegistrationDate, GSTStatus,
        StateJurisdiction, CentralJurisdiction, Address, Pincode, ContactName, ContactMobile, ContactEmail,
        RegisteredMobile, Username, Password, GSTRawResponse)
       OUTPUT INSERTED.ID
       VALUES (@gstin, @legalName, @tradeName, @businessType, @regDate, @gstStatus,
        @stateJur, @centralJur, @address, @pincode, @contactName, @contactMobile, @contactEmail,
        @regMobile, @username, @password, @rawResponse)`,
      {
        gstin,
        legalName: gstData?.legalName || '',
        tradeName: gstData?.tradeName || '',
        businessType: gstData?.businessType || '',
        regDate: gstData?.registrationDate || '',
        gstStatus: gstData?.gstStatus || '',
        stateJur: gstData?.stateJurisdiction || '',
        centralJur: gstData?.centralJurisdiction || '',
        address: gstData?.address || '',
        pincode: gstData?.pincode || '',
        contactName: gstData?.contactName || '',
        contactMobile: gstData?.contactMobile || '',
        contactEmail: gstData?.contactEmail || '',
        regMobile: registeredMobile || '',
        username,
        password,
        rawResponse: JSON.stringify(gstData || {}),
      }
    );

    res.json({ success: true, id: result.recordset[0].ID, message: 'Registration submitted. Awaiting admin approval.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/companies/login - Company login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await query(
      'SELECT * FROM Companies WHERE Username = @username AND Password = @password',
      { username, password }
    );

    if (result.recordset.length === 0) {
      return res.json({ success: false, error: 'Invalid credentials' });
    }

    const c = result.recordset[0];

    if (c.ApprovalStatus !== 'Approved') {
      return res.json({ success: false, error: `Account is ${c.ApprovalStatus}. Please wait for admin approval.` });
    }

    // Update last login
    await query('UPDATE Companies SET LastLogin = GETDATE() WHERE ID = @id', { id: c.ID });

    res.json({
      success: true,
      user: {
        id: c.ID,
        type: 'company',
        username: c.Username,
        name: c.TradeName || c.LegalName,
        gstin: c.GSTIN,
        role: 'Company',
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
    const result = await query('SELECT ID, GSTIN, LegalName, TradeName, BusinessType, GSTStatus, Address, Pincode, RegisteredMobile, Username, ApprovalStatus, CreatedAt, LastLogin FROM Companies ORDER BY CreatedAt DESC');
    res.json({ success: true, companies: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/companies/:id/approve - Approve company
router.put('/:id/approve', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await query(
      'UPDATE Companies SET ApprovalStatus = @status, ApprovedAt = GETDATE() WHERE ID = @id',
      { status: 'Approved', id }
    );
    res.json({ success: true, message: 'Company approved' });
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

// DELETE /api/companies/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await query('DELETE FROM Companies WHERE ID = @id', { id });
    res.json({ success: true, message: 'Company deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
