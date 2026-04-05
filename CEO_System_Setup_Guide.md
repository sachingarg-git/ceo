# CEO Productivity System v5 — Setup Guide
## WIZONE IT NETWORK INDIA PVT LTD

### Files Included
1. `CEO_System_Code.gs` — Google Apps Script backend (paste into Google Sheets)
2. `CEO_Productivity_System.html` — HTML frontend (deploy to VPS)

### Step 1: Create Google Sheet
1. Go to https://sheets.google.com
2. Create a new blank spreadsheet
3. Name it "CEO Productivity System v5"
4. Copy the Spreadsheet ID from the URL (the long string between /d/ and /edit)

### Step 2: Set Up Google Apps Script
1. In your Google Sheet, go to Extensions → Apps Script
2. Delete any existing code in Code.gs
3. Open `CEO_System_Code.gs` file and copy ALL content
4. Paste into the Apps Script editor
5. Find the line: `var SPREADSHEET_ID = '1h8bpJaYeezAi-rGduUYEQh5VLB2V7giIMUp6mDns9rQ';`
6. Replace `YOUR_SPREADSHEET_ID_HERE` with your actual Spreadsheet ID
7. Click Save (Ctrl+S)
8. Click Deploy → New Deployment
9. Select type: Web App
10. Set "Execute as": Me
11. Set "Who has access": Anyone
12. Click Deploy
13. Copy the Web App URL (looks like: https://script.google.com/macros/s/xxxxx/exec)

### Step 3: Initialize Google Sheet
1. Open the Web App URL in your browser with `?action=init` appended
   Example: `https://script.google.com/macros/s/xxxxx/exec?action=init`
2. This will create all 10 sheet tabs with proper headers and default data

### Step 4: Deploy HTML to VPS
1. Upload `CEO_Productivity_System.html` to your VPS web server
2. Make it accessible via your domain (e.g., https://yourdomain.com/ceo/)

### Step 5: Connect Frontend to Backend
1. Open the CEO Productivity System in your browser
2. Login with default credentials: `ceo` / `ceo123` (or `ea` / `ea123`)
3. Go to Settings page
4. Paste the Web App URL in the "Apps Script Web App URL" field
5. Click "Save & Connect"
6. Click "Test Connection" to verify

### Step 6: Start Using
The system works in DUAL MODE:
- **Offline Mode**: Works immediately with localStorage (no Google Sheet needed)
- **Online Mode**: When API URL is configured, syncs with Google Sheets

### Default Login Credentials
| User | Username | Password | Role |
|------|----------|----------|------|
| CEO  | ceo      | ceo123   | Full Access |
| EA   | ea       | ea123    | Full Access |

Change credentials in Settings → Account Settings.

### 10 System Modules
1. **Dashboard** — KPI overview + 4 charts
2. **Quick Capture** — Fast task entry with routing
3. **Someday List** — Unified view (recurring + captured tasks)
4. **Daily Schedule** — Time grid + task panels + done tracking
5. **Recurring Tasks** — Define recurring patterns
6. **Information System** — Knowledge base
7. **Daily Report** — 30-day performance tracker
8. **Weekly Scorecard** — 44-week Mar-Dec tracker
9. **Next Week Plan** — Calendar grid Mon-Sat
10. **Settings** — Configuration + data management

### Tips
- The system auto-saves to localStorage after every change
- Use Export (Settings) to backup your data as JSON
- Browser notifications require permission (click Allow when prompted)
- Timer persists across page reloads
- Auto-refresh interval is configurable in Settings

### Troubleshooting
- **"Connection Failed"**: Check the Web App URL, ensure deployment is set to "Anyone"
- **No data showing**: Click the refresh button or clear localStorage and reimport
- **Notifications not working**: Enable in Settings + Allow browser permission
