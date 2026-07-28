const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
const JWT = process.env.JWT_SECRET || 'PayPeERP@2026#SecretKey';
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ─────────────────────────────────────────
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','PATCH'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '10mb' }));

// ── DATABASE ───────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
});

const db = (text, params) => pool.query(text, params);

// ── AUTH MIDDLEWARE ────────────────────────────────────
async function auth(req, res, next) {
  try {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'No token' });
    const d = jwt.verify(h.split(' ')[1], JWT);
    const r = await db('SELECT u.*, c.name AS company_name FROM erp_users u LEFT JOIN erp_companies c ON c.id=u.company_id WHERE u.id=$1 AND u.is_active=true', [d.userId]);
    if (!r.rows.length) return res.status(401).json({ success: false, message: 'Unauthorized' });
    req.user = r.rows[0];
    next();
  } catch(e) { return res.status(401).json({ success: false, message: 'Invalid token' }); }
}

function canAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
  next();
}

// ── HEALTH & MIGRATIONS ────────────────────────────────
app.get('/api/health', async (req, res) => {
  let dbStatus = 'not configured';
  if (process.env.DATABASE_URL) {
    try {
      await db('SELECT 1');
      dbStatus = 'connected ✅';

      // Auto-migrate all tables
      const migrations = [
        // Companies (multi-tenant)
        `CREATE TABLE IF NOT EXISTS erp_companies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(200) NOT NULL,
          gstin VARCHAR(20), pan VARCHAR(15), tan VARCHAR(10),
          address TEXT, state VARCHAR(50), email VARCHAR(200),
          mobile VARCHAR(15), website VARCHAR(200),
          financial_year VARCHAR(10) DEFAULT '2026-27',
          logo_url TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        // Users
        `CREATE TABLE IF NOT EXISTS erp_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID REFERENCES erp_companies(id) ON DELETE CASCADE,
          name VARCHAR(200) NOT NULL,
          email VARCHAR(200) UNIQUE NOT NULL,
          password VARCHAR(200) NOT NULL,
          role VARCHAR(30) DEFAULT 'user',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        // Chart of Accounts
        `CREATE TABLE IF NOT EXISTS coa (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID REFERENCES erp_companies(id) ON DELETE CASCADE,
          code VARCHAR(20) NOT NULL,
          name VARCHAR(200) NOT NULL,
          type VARCHAR(30) NOT NULL,
          subtype VARCHAR(50),
          balance_type VARCHAR(10) DEFAULT 'Debit',
          opening_balance NUMERIC(15,2) DEFAULT 0,
          current_balance NUMERIC(15,2) DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          description TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        // Parties (customers + vendors)
        `CREATE TABLE IF NOT EXISTS parties (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID REFERENCES erp_companies(id) ON DELETE CASCADE,
          type VARCHAR(20) NOT NULL,
          name VARCHAR(200) NOT NULL,
          gstin VARCHAR(20), pan VARCHAR(15),
          email VARCHAR(200), mobile VARCHAR(15),
          address TEXT, state VARCHAR(50),
          opening_balance NUMERIC(15,2) DEFAULT 0,
          current_balance NUMERIC(15,2) DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        // Journal Entries
        `CREATE TABLE IF NOT EXISTS journal_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID REFERENCES erp_companies(id) ON DELETE CASCADE,
          entry_no VARCHAR(50),
          date DATE NOT NULL,
          reference VARCHAR(100),
          description TEXT NOT NULL,
          type VARCHAR(30) DEFAULT 'General',
          status VARCHAR(20) DEFAULT 'Posted',
          total_debit NUMERIC(15,2) DEFAULT 0,
          total_credit NUMERIC(15,2) DEFAULT 0,
          created_by UUID REFERENCES erp_users(id),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        // Journal Lines
        `CREATE TABLE IF NOT EXISTS journal_lines (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
          account_id UUID REFERENCES coa(id),
          debit NUMERIC(15,2) DEFAULT 0,
          credit NUMERIC(15,2) DEFAULT 0,
          narration TEXT
        )`,
        // Invoices (sales + purchase)
        `CREATE TABLE IF NOT EXISTS invoices (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID REFERENCES erp_companies(id) ON DELETE CASCADE,
          invoice_no VARCHAR(50),
          type VARCHAR(20) NOT NULL,
          party_id UUID REFERENCES parties(id),
          party_name VARCHAR(200),
          date DATE NOT NULL,
          due_date DATE,
          subtotal NUMERIC(15,2) DEFAULT 0,
          cgst NUMERIC(15,2) DEFAULT 0,
          sgst NUMERIC(15,2) DEFAULT 0,
          igst NUMERIC(15,2) DEFAULT 0,
          total NUMERIC(15,2) DEFAULT 0,
          paid NUMERIC(15,2) DEFAULT 0,
          status VARCHAR(20) DEFAULT 'Unpaid',
          notes TEXT,
          created_by UUID REFERENCES erp_users(id),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        // Invoice Lines
        `CREATE TABLE IF NOT EXISTS invoice_lines (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
          description TEXT,
          hsn_sac VARCHAR(20),
          qty NUMERIC(10,2) DEFAULT 1,
          rate NUMERIC(15,2) DEFAULT 0,
          amount NUMERIC(15,2) DEFAULT 0,
          gst_rate NUMERIC(5,2) DEFAULT 18,
          gst_amount NUMERIC(15,2) DEFAULT 0,
          total NUMERIC(15,2) DEFAULT 0
        )`,
        // Payments
        `CREATE TABLE IF NOT EXISTS erp_payments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID REFERENCES erp_companies(id) ON DELETE CASCADE,
          invoice_id UUID REFERENCES invoices(id),
          party_id UUID REFERENCES parties(id),
          type VARCHAR(20),
          date DATE NOT NULL,
          amount NUMERIC(15,2) NOT NULL,
          mode VARCHAR(30),
          reference VARCHAR(100),
          bank_account VARCHAR(100),
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        // Bank Accounts
        `CREATE TABLE IF NOT EXISTS bank_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID REFERENCES erp_companies(id) ON DELETE CASCADE,
          name VARCHAR(200) NOT NULL,
          bank_name VARCHAR(100),
          account_no VARCHAR(50),
          ifsc VARCHAR(20),
          swift VARCHAR(20),
          branch VARCHAR(100),
          balance NUMERIC(15,2) DEFAULT 0,
          type VARCHAR(20) DEFAULT 'Current',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        // Bank Transactions
        `CREATE TABLE IF NOT EXISTS bank_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE,
          date DATE NOT NULL,
          description TEXT,
          debit NUMERIC(15,2) DEFAULT 0,
          credit NUMERIC(15,2) DEFAULT 0,
          balance NUMERIC(15,2) DEFAULT 0,
          reference VARCHAR(100),
          is_reconciled BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        // TDS
        `CREATE TABLE IF NOT EXISTS tds_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID REFERENCES erp_companies(id) ON DELETE CASCADE,
          party_id UUID REFERENCES parties(id),
          section VARCHAR(10),
          payment_amount NUMERIC(15,2),
          tds_rate NUMERIC(5,2),
          tds_amount NUMERIC(15,2),
          date DATE,
          description TEXT,
          status VARCHAR(20) DEFAULT 'Deducted',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        // Fixed Assets
        `CREATE TABLE IF NOT EXISTS fixed_assets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID REFERENCES erp_companies(id) ON DELETE CASCADE,
          name VARCHAR(200) NOT NULL,
          category VARCHAR(100),
          purchase_date DATE,
          cost NUMERIC(15,2),
          depreciation_rate NUMERIC(5,2),
          current_value NUMERIC(15,2),
          serial_no VARCHAR(100),
          location VARCHAR(200),
          status VARCHAR(20) DEFAULT 'Active',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        // Audit Log
        `CREATE TABLE IF NOT EXISTS audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID REFERENCES erp_companies(id) ON DELETE CASCADE,
          user_id UUID REFERENCES erp_users(id),
          action VARCHAR(100),
          detail TEXT,
          ip VARCHAR(50),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
      ];

      for (const sql of migrations) {
        try { await db(sql); } catch(e2) { console.log('Migration warning:', e2.message.slice(0,80)); }
      }

      // Seed default company if none exists
      const co = await db('SELECT id FROM erp_companies LIMIT 1');
      if (!co.rows.length) {
        const newCo = await db(`INSERT INTO erp_companies (name,gstin,pan,tan,email,state,financial_year)
          VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          ['PayPe Technologies Pvt. Ltd.','33AAMCP7960K1ZU','AAMCP7960K','CHEP24000E','accounts@paype.co.in','Tamil Nadu','2026-27']);
        const coId = newCo.rows[0].id;

        // Seed default users
        const hash = await bcrypt.hash('Admin@PayPe2026', 10);
        const hashMgr = await bcrypt.hash('Manager@PayPe2026', 10);
        const hashEmp = await bcrypt.hash('Employee@PayPe2026', 10);
        await db(`INSERT INTO erp_users (company_id,name,email,password,role) VALUES ($1,$2,$3,$4,$5)`,
          [coId,'Ramesh Muthuvel','admin@paype.co.in',hash,'admin']);
        await db(`INSERT INTO erp_users (company_id,name,email,password,role) VALUES ($1,$2,$3,$4,$5)`,
          [coId,'Accounts Manager','accounts@paype.co.in',hashMgr,'manager']);
        await db(`INSERT INTO erp_users (company_id,name,email,password,role) VALUES ($1,$2,$3,$4,$5)`,
          [coId,'Employee','employee@paype.co.in',hashEmp,'employee']);

        // Seed default Chart of Accounts
        const accounts = [
          ['1001','Cash in Hand','Asset','Current Asset','Debit',250000],
          ['1002','Yes Bank - Current Account','Asset','Current Asset','Debit',4850000],
          ['1101','Accounts Receivable','Asset','Current Asset','Debit',1250000],
          ['1201','GST Input Credit (ITC)','Asset','Current Asset','Debit',85000],
          ['1301','Prepaid Expenses','Asset','Current Asset','Debit',0],
          ['1501','Computer & IT Equipment','Asset','Fixed Asset','Debit',85000],
          ['1502','Furniture & Fixtures','Asset','Fixed Asset','Debit',120000],
          ['2001','Accounts Payable','Liability','Current Liability','Credit',450000],
          ['2101','CGST Payable','Liability','Current Liability','Credit',95000],
          ['2102','SGST Payable','Liability','Current Liability','Credit',95000],
          ['2103','IGST Payable','Liability','Current Liability','Credit',0],
          ['2201','TDS Payable','Liability','Current Liability','Credit',25000],
          ['2301','Salary Payable','Liability','Current Liability','Credit',0],
          ['3001','Share Capital','Equity','Capital','Credit',1000000],
          ['3101','Retained Earnings','Equity','Capital','Credit',850000],
          ['4001','Software Services Revenue','Revenue','Income','Credit',3500000],
          ['4002','Consulting Revenue','Revenue','Income','Credit',850000],
          ['4003','Subscription Revenue','Revenue','Income','Credit',0],
          ['5001','Salaries & Wages','Expense','Direct Expense','Debit',1200000],
          ['5101','Office Rent','Expense','Indirect Expense','Debit',180000],
          ['5102','Internet & Utilities','Expense','Indirect Expense','Debit',45000],
          ['5103','Travel & Conveyance','Expense','Indirect Expense','Debit',0],
          ['5201','Professional Fees','Expense','Indirect Expense','Debit',120000],
          ['5202','Depreciation','Expense','Indirect Expense','Debit',7826],
        ];
        for (const [code,name,type,subtype,bt,bal] of accounts) {
          await db(`INSERT INTO coa (company_id,code,name,type,subtype,balance_type,opening_balance,current_balance)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`, [coId,code,name,type,subtype,bt,bal]);
        }

        // Seed default parties
        const pts = [
          ['customer','MSBS Energy Pvt Ltd','22AABCM1234A1Z5','AABCM1234A','accounts@msbsenergy.com','9876543210','Tamil Nadu',5675000],
          ['vendor','AWS India','27AAAAA1234A1Z5','AAAAA1234A','billing@aws.com','1800123456','Maharashtra',85000],
          ['vendor','Yes Bank','33YESB0001367A1Z','YESBA1234A','accounts@yesbank.in','1800200000','Tamil Nadu',0],
        ];
        for (const [type,name,gstin,pan,email,mobile,state,bal] of pts) {
          await db(`INSERT INTO parties (company_id,type,name,gstin,pan,email,mobile,state,opening_balance,current_balance)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`, [coId,type,name,gstin,pan,email,mobile,state,bal]);
        }

        // Seed bank account
        await db(`INSERT INTO bank_accounts (company_id,name,bank_name,account_no,ifsc,swift,branch,balance,type)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [coId,'Yes Bank - Current Account','Yes Bank','136727000000112','YESB0001367','YESBINBB','Vadavalli, Coimbatore',4850000,'Current']);

        console.log('✅ Default company, user and data seeded!');
      }
    } catch(e) {
      dbStatus = 'error: ' + e.message;
      console.error('DB error:', e.message);
    }
  }
  res.json({ success: true, status: 'healthy', service: 'PayPe ERP API', version: '1.0.0', domain: 'erpapi.paype.co.in', db: dbStatus, time: new Date().toISOString() });
});

// ── AUTH ───────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    const r = await db('SELECT u.*, c.name AS company_name, c.gstin, c.financial_year FROM erp_users u LEFT JOIN erp_companies c ON c.id=u.company_id WHERE u.email=$1 AND u.is_active=true', [email.toLowerCase()]);
    if (!r.rows.length) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const user = r.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id, companyId: user.company_id, role: user.role }, JWT, { expiresIn: '8h' });
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role, company: user.company_name, companyId: user.company_id, gstin: user.gstin, fy: user.financial_year }});
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── DASHBOARD ──────────────────────────────────────────
app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const cid = req.user.company_id;
    const [invStats, balances, recentInv] = await Promise.all([
      db(`SELECT 
        SUM(CASE WHEN type='sales' THEN total ELSE 0 END) AS total_revenue,
        SUM(CASE WHEN type='sales' AND status='Unpaid' THEN total ELSE 0 END) AS receivable,
        SUM(CASE WHEN type='purchase' AND status='Unpaid' THEN total ELSE 0 END) AS payable,
        COUNT(CASE WHEN type='sales' AND status='Unpaid' THEN 1 END) AS ar_count,
        COUNT(CASE WHEN type='purchase' AND status='Unpaid' THEN 1 END) AS ap_count
        FROM invoices WHERE company_id=$1`, [cid]),
      db(`SELECT type, SUM(current_balance) AS total FROM coa WHERE company_id=$1 GROUP BY type`, [cid]),
      db(`SELECT * FROM invoices WHERE company_id=$1 AND type='sales' ORDER BY created_at DESC LIMIT 5`, [cid]),
    ]);
    const balMap = {};
    balances.rows.forEach(function(b){ balMap[b.type] = parseFloat(b.total)||0; });
    res.json({ success: true, data: {
      revenue: parseFloat(invStats.rows[0].total_revenue)||0,
      receivable: parseFloat(invStats.rows[0].receivable)||0,
      payable: parseFloat(invStats.rows[0].payable)||0,
      ar_count: parseInt(invStats.rows[0].ar_count)||0,
      ap_count: parseInt(invStats.rows[0].ap_count)||0,
      balances: balMap,
      recentInvoices: recentInv.rows,
    }});
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── CHART OF ACCOUNTS ──────────────────────────────────
app.get('/api/accounts', auth, async (req, res) => {
  try {
    const r = await db('SELECT * FROM coa WHERE company_id=$1 AND is_active=true ORDER BY code', [req.user.company_id]);
    res.json({ success: true, data: r.rows });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/accounts', auth, async (req, res) => {
  try {
    const { code, name, type, subtype, balanceType, openingBalance, description } = req.body;
    if (!code || !name || !type) return res.status(400).json({ success: false, message: 'Code, name and type required' });
    const ob = parseFloat(openingBalance)||0;
    const r = await db(`INSERT INTO coa (company_id,code,name,type,subtype,balance_type,opening_balance,current_balance,description)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8) RETURNING *`,
      [req.user.company_id, code, name, type, subtype||null, balanceType||'Debit', ob, description||null]);
    res.status(201).json({ success: true, data: r.rows[0], message: 'Account created!' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/accounts/:id', auth, async (req, res) => {
  try {
    const { name, subtype, description } = req.body;
    await db('UPDATE coa SET name=$1,subtype=$2,description=$3 WHERE id=$4 AND company_id=$5',
      [name, subtype, description, req.params.id, req.user.company_id]);
    res.json({ success: true, message: 'Account updated!' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── PARTIES ────────────────────────────────────────────
app.get('/api/parties', auth, async (req, res) => {
  try {
    const { type } = req.query;
    let q = 'SELECT * FROM parties WHERE company_id=$1 AND is_active=true';
    const params = [req.user.company_id];
    if (type) { params.push(type); q += ' AND (type=$2 OR type=\'both\')'; }
    q += ' ORDER BY name';
    const r = await db(q, params);
    res.json({ success: true, data: r.rows });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/parties', auth, async (req, res) => {
  try {
    const { type, name, gstin, pan, email, mobile, address, state, openingBalance } = req.body;
    if (!type || !name) return res.status(400).json({ success: false, message: 'Type and name required' });
    const ob = parseFloat(openingBalance)||0;
    const r = await db(`INSERT INTO parties (company_id,type,name,gstin,pan,email,mobile,address,state,opening_balance,current_balance)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *`,
      [req.user.company_id, type, name, gstin||null, pan||null, email||null, mobile||null, address||null, state||null, ob]);
    res.status(201).json({ success: true, data: r.rows[0], message: 'Party added!' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── INVOICES ───────────────────────────────────────────
app.get('/api/invoices', auth, async (req, res) => {
  try {
    const { type, status, limit=50 } = req.query;
    let q = 'SELECT i.*, p.name AS party_name_full, p.gstin AS party_gstin FROM invoices i LEFT JOIN parties p ON p.id=i.party_id WHERE i.company_id=$1';
    const params = [req.user.company_id];
    if (type) { params.push(type); q += ' AND i.type=$' + params.length; }
    if (status) { params.push(status); q += ' AND i.status=$' + params.length; }
    params.push(parseInt(limit));
    q += ' ORDER BY i.created_at DESC LIMIT $' + params.length;
    const r = await db(q, params);
    res.json({ success: true, data: r.rows });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/invoices/:id', auth, async (req, res) => {
  try {
    const inv = await db('SELECT i.*, p.name AS party_name_full, p.gstin AS party_gstin, p.email AS party_email FROM invoices i LEFT JOIN parties p ON p.id=i.party_id WHERE i.id=$1 AND i.company_id=$2', [req.params.id, req.user.company_id]);
    if (!inv.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const lines = await db('SELECT * FROM invoice_lines WHERE invoice_id=$1', [req.params.id]);
    res.json({ success: true, data: { ...inv.rows[0], lines: lines.rows }});
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/invoices', auth, async (req, res) => {
  try {
    const { partyId, type, date, dueDate, lines, notes, status } = req.body;
    if (!partyId || !date || !lines || !lines.length) return res.status(400).json({ success: false, message: 'Party, date and lines required' });

    // Calculate totals
    let subtotal=0, totalGST=0;
    lines.forEach(function(l) {
      const amt = (parseFloat(l.qty)||1) * (parseFloat(l.rate)||0);
      const gst = amt * (parseFloat(l.gstRate)||18) / 100;
      subtotal += amt; totalGST += gst;
    });
    const cgst = totalGST/2, sgst = totalGST/2, total = subtotal+totalGST;

    // Generate invoice number
    const count = await db('SELECT COUNT(*) FROM invoices WHERE company_id=$1 AND type=$2', [req.user.company_id, type]);
    const no = type === 'sales'
      ? `PAYPE/2026-27/${String(parseInt(count.rows[0].count)+1).padStart(3,'0')}`
      : `BILL/2026-27/${String(parseInt(count.rows[0].count)+1).padStart(3,'0')}`;

    const party = await db('SELECT name FROM parties WHERE id=$1', [partyId]);
    const r = await db(`INSERT INTO invoices (company_id,invoice_no,type,party_id,party_name,date,due_date,subtotal,cgst,sgst,total,status,notes,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [req.user.company_id, no, type, partyId, party.rows[0]?.name, date, dueDate||null, subtotal, cgst, sgst, total, status||'Unpaid', notes||null, req.user.id]);
    const inv = r.rows[0];

    // Insert lines
    for (const l of lines) {
      const amt = (parseFloat(l.qty)||1) * (parseFloat(l.rate)||0);
      const gstAmt = amt * (parseFloat(l.gstRate)||18) / 100;
      await db(`INSERT INTO invoice_lines (invoice_id,description,hsn_sac,qty,rate,amount,gst_rate,gst_amount,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [inv.id, l.description, l.hsnSac||null, parseFloat(l.qty)||1, parseFloat(l.rate)||0, amt, parseFloat(l.gstRate)||18, gstAmt, amt+gstAmt]);
    }
    res.status(201).json({ success: true, data: inv, message: 'Invoice ' + no + ' created!' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/invoices/:id/status', auth, async (req, res) => {
  try {
    const { status, paid } = req.body;
    await db('UPDATE invoices SET status=$1, paid=COALESCE($2,paid) WHERE id=$3 AND company_id=$4',
      [status, paid||null, req.params.id, req.user.company_id]);
    res.json({ success: true, message: 'Invoice updated!' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── JOURNAL ENTRIES ────────────────────────────────────
app.get('/api/journal', auth, async (req, res) => {
  try {
    const r = await db('SELECT j.*, u.name AS created_by_name FROM journal_entries j LEFT JOIN erp_users u ON u.id=j.created_by WHERE j.company_id=$1 ORDER BY j.date DESC, j.created_at DESC LIMIT 100', [req.user.company_id]);
    res.json({ success: true, data: r.rows });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/journal', auth, async (req, res) => {
  try {
    const { date, reference, description, type, lines } = req.body;
    if (!date || !description || !lines || lines.length < 2) return res.status(400).json({ success: false, message: 'Date, description and at least 2 lines required' });
    let totalDr=0, totalCr=0;
    lines.forEach(function(l){ totalDr+=parseFloat(l.debit)||0; totalCr+=parseFloat(l.credit)||0; });
    if (Math.abs(totalDr-totalCr) > 0.01) return res.status(400).json({ success: false, message: 'Entry not balanced! Debit must equal Credit' });
    const count = await db('SELECT COUNT(*) FROM journal_entries WHERE company_id=$1', [req.user.company_id]);
    const entryNo = 'JE-' + String(parseInt(count.rows[0].count)+1).padStart(4,'0');
    const r = await db(`INSERT INTO journal_entries (company_id,entry_no,date,reference,description,type,total_debit,total_credit,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.company_id, entryNo, date, reference||null, description, type||'General', totalDr, totalCr, req.user.id]);
    const entry = r.rows[0];
    for (const l of lines) {
      if (!l.accountId) continue;
      await db('INSERT INTO journal_lines (entry_id,account_id,debit,credit,narration) VALUES ($1,$2,$3,$4,$5)',
        [entry.id, l.accountId, parseFloat(l.debit)||0, parseFloat(l.credit)||0, l.narration||null]);
      // Update account balance
      const dr = parseFloat(l.debit)||0, cr = parseFloat(l.credit)||0;
      await db('UPDATE coa SET current_balance = current_balance + $1 WHERE id=$2', [dr-cr, l.accountId]);
    }
    res.status(201).json({ success: true, data: entry, message: 'Journal entry ' + entryNo + ' posted!' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── BANK ACCOUNTS ──────────────────────────────────────
app.get('/api/bank', auth, async (req, res) => {
  try {
    const r = await db('SELECT * FROM bank_accounts WHERE company_id=$1 AND is_active=true ORDER BY name', [req.user.company_id]);
    res.json({ success: true, data: r.rows });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/bank', auth, async (req, res) => {
  try {
    const { name, bankName, accountNo, ifsc, swift, branch, balance, type } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Account name required' });
    const r = await db(`INSERT INTO bank_accounts (company_id,name,bank_name,account_no,ifsc,swift,branch,balance,type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.company_id, name, bankName||null, accountNo||null, ifsc||null, swift||null, branch||null, parseFloat(balance)||0, type||'Current']);
    res.status(201).json({ success: true, data: r.rows[0], message: 'Bank account added!' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/bank/:id/transactions', auth, async (req, res) => {
  try {
    const r = await db('SELECT * FROM bank_transactions WHERE bank_account_id=$1 ORDER BY date DESC LIMIT 100', [req.params.id]);
    res.json({ success: true, data: r.rows });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── GST ────────────────────────────────────────────────
app.get('/api/gst/summary', auth, async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth()+1;
    const y = parseInt(year) || new Date().getFullYear();
    const r = await db(`SELECT
      SUM(CASE WHEN type='sales' THEN cgst+sgst+igst ELSE 0 END) AS output_tax,
      SUM(CASE WHEN type='purchase' THEN cgst+sgst+igst ELSE 0 END) AS input_tax,
      SUM(CASE WHEN type='sales' THEN subtotal ELSE 0 END) AS taxable_sales,
      SUM(CASE WHEN type='purchase' THEN subtotal ELSE 0 END) AS taxable_purchases
      FROM invoices WHERE company_id=$1 AND EXTRACT(MONTH FROM date)=$2 AND EXTRACT(YEAR FROM date)=$3`,
      [req.user.company_id, m, y]);
    const d = r.rows[0];
    const outputTax = parseFloat(d.output_tax)||0;
    const inputTax = parseFloat(d.input_tax)||0;
    res.json({ success: true, data: {
      month: m, year: y,
      outputTax, inputTax,
      netPayable: Math.max(0, outputTax-inputTax),
      taxableSales: parseFloat(d.taxable_sales)||0,
      taxablePurchases: parseFloat(d.taxable_purchases)||0,
    }});
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/gst/gstr1', auth, async (req, res) => {
  try {
    const r = await db(`SELECT i.*, p.gstin AS party_gstin, p.state AS party_state FROM invoices i LEFT JOIN parties p ON p.id=i.party_id WHERE i.company_id=$1 AND i.type='sales' ORDER BY i.date DESC`, [req.user.company_id]);
    res.json({ success: true, data: r.rows });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── TDS ────────────────────────────────────────────────
app.get('/api/tds', auth, async (req, res) => {
  try {
    const r = await db('SELECT t.*, p.name AS party_name FROM tds_entries t LEFT JOIN parties p ON p.id=t.party_id WHERE t.company_id=$1 ORDER BY t.date DESC', [req.user.company_id]);
    res.json({ success: true, data: r.rows });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/tds', auth, async (req, res) => {
  try {
    const { partyId, section, paymentAmount, tdsRate, tdsAmount, date, description } = req.body;
    if (!partyId || !section || !paymentAmount) return res.status(400).json({ success: false, message: 'Party, section and amount required' });
    const r = await db(`INSERT INTO tds_entries (company_id,party_id,section,payment_amount,tds_rate,tds_amount,date,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.company_id, partyId, section, parseFloat(paymentAmount), parseFloat(tdsRate)||10, parseFloat(tdsAmount), date, description||null]);
    res.status(201).json({ success: true, data: r.rows[0], message: 'TDS recorded!' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── FIXED ASSETS ───────────────────────────────────────
app.get('/api/assets', auth, async (req, res) => {
  try {
    const r = await db('SELECT * FROM fixed_assets WHERE company_id=$1 AND status!=\'Disposed\' ORDER BY name', [req.user.company_id]);
    res.json({ success: true, data: r.rows });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/assets', auth, async (req, res) => {
  try {
    const { name, category, purchaseDate, cost, depreciationRate, serialNo, location } = req.body;
    if (!name || !cost) return res.status(400).json({ success: false, message: 'Name and cost required' });
    const months = purchaseDate ? (new Date()-new Date(purchaseDate))/(1000*60*60*24*30.44) : 0;
    const depAmt = parseFloat(cost) * (parseFloat(depreciationRate)||33.33)/100 * months/12;
    const currentValue = Math.max(0, parseFloat(cost)-depAmt);
    const r = await db(`INSERT INTO fixed_assets (company_id,name,category,purchase_date,cost,depreciation_rate,current_value,serial_no,location) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.company_id, name, category||null, purchaseDate||null, parseFloat(cost), parseFloat(depreciationRate)||33.33, currentValue, serialNo||null, location||null]);
    res.status(201).json({ success: true, data: r.rows[0], message: 'Asset added!' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── REPORTS ────────────────────────────────────────────
app.get('/api/reports/pl', auth, async (req, res) => {
  try {
    const r = await db('SELECT type, name, current_balance, balance_type FROM coa WHERE company_id=$1 AND type IN (\'Revenue\',\'Expense\') AND is_active=true ORDER BY type, code', [req.user.company_id]);
    const revenue = r.rows.filter(function(a){return a.type==='Revenue';});
    const expenses = r.rows.filter(function(a){return a.type==='Expense';});
    const totalRevenue = revenue.reduce(function(s,a){return s+parseFloat(a.current_balance);},0);
    const totalExpenses = expenses.reduce(function(s,a){return s+parseFloat(a.current_balance);},0);
    res.json({ success: true, data: { revenue, expenses, totalRevenue, totalExpenses, netProfit: totalRevenue-totalExpenses }});
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/reports/bs', auth, async (req, res) => {
  try {
    const r = await db('SELECT type, subtype, name, current_balance, balance_type FROM coa WHERE company_id=$1 AND is_active=true ORDER BY type, code', [req.user.company_id]);
    const assets = r.rows.filter(function(a){return a.type==='Asset';});
    const liabilities = r.rows.filter(function(a){return a.type==='Liability';});
    const equity = r.rows.filter(function(a){return a.type==='Equity';});
    res.json({ success: true, data: { assets, liabilities, equity,
      totalAssets: assets.reduce(function(s,a){return s+parseFloat(a.current_balance);},0),
      totalLiabilities: liabilities.reduce(function(s,a){return s+parseFloat(a.current_balance);},0),
      totalEquity: equity.reduce(function(s,a){return s+parseFloat(a.current_balance);},0),
    }});
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/reports/trial-balance', auth, async (req, res) => {
  try {
    const r = await db('SELECT code, name, type, balance_type, current_balance FROM coa WHERE company_id=$1 AND is_active=true ORDER BY code', [req.user.company_id]);
    res.json({ success: true, data: r.rows });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── AUDIT LOG ──────────────────────────────────────────
app.get('/api/audit', auth, async (req, res) => {
  try {
    const r = await db('SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN erp_users u ON u.id=a.user_id WHERE a.company_id=$1 ORDER BY a.created_at DESC LIMIT 100', [req.user.company_id]);
    res.json({ success: true, data: r.rows });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/audit', auth, async (req, res) => {
  try {
    const { action, detail } = req.body;
    await db('INSERT INTO audit_log (company_id,user_id,action,detail) VALUES ($1,$2,$3,$4)',
      [req.user.company_id, req.user.id, action, detail]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});


// ── BANK TRANSACTIONS POST ─────────────────────────────
app.post('/api/bank/:id/transactions', auth, async (req, res) => {
  try {
    const { date, description, amount, type, reference, mode } = req.body;
    if (!date || !description || !amount) return res.status(400).json({ success: false, message: 'Date, description and amount required' });
    const debit  = type === 'debit'  ? parseFloat(amount) : 0;
    const credit = type === 'credit' ? parseFloat(amount) : 0;
    // Get current balance
    const bankRes = await db('SELECT balance FROM bank_accounts WHERE id=$1 AND company_id=$2', [req.params.id, req.user.company_id]);
    if (!bankRes.rows.length) return res.status(404).json({ success: false, message: 'Bank account not found' });
    const prevBal = parseFloat(bankRes.rows[0].balance);
    const newBal = prevBal + credit - debit;
    // Insert transaction
    const r = await db(`INSERT INTO bank_transactions (bank_account_id,date,description,debit,credit,balance,reference,mode)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, date, description, debit, credit, newBal, reference||null, mode||null]);
    // Update account balance
    await db('UPDATE bank_accounts SET balance=$1 WHERE id=$2', [newBal, req.params.id]);
    res.status(201).json({ success: true, data: r.rows[0], message: 'Transaction added!' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});



// ── USER REGISTRATION (Admin only) ────────────────────
app.post('/api/auth/register', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Name, email and password required' });
    const hash = await bcrypt.hash(password, 10);
    const r = await db(
      'INSERT INTO erp_users (company_id,name,email,password,role) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,role',
      [req.user.company_id, name, email.toLowerCase(), hash, role||'employee']
    );
    res.status(201).json({ success: true, data: r.rows[0], message: 'User created!' });
  } catch(e) {
    if (e.code === '23505') return res.status(400).json({ success: false, message: 'Email already exists' });
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── GET ALL USERS ──────────────────────────────────────
app.get('/api/users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const r = await db('SELECT id,name,email,role,is_active,created_at FROM erp_users WHERE company_id=$1 ORDER BY created_at', [req.user.company_id]);
    res.json({ success: true, data: r.rows });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});



// ── SETUP — Create missing default users ──────────────
app.get('/api/setup', async (req, res) => {
  try {
    const co = await db('SELECT id FROM erp_companies LIMIT 1');
    if (!co.rows.length) return res.json({ success: false, message: 'No company found' });
    const coId = co.rows[0].id;

    const users = [
      { name: 'Accounts Manager', email: 'accounts@paype.co.in', password: 'Manager@PayPe2026', role: 'manager' },
      { name: 'Employee', email: 'employee@paype.co.in', password: 'Employee@PayPe2026', role: 'employee' },
    ];

    const results = [];
    for (const u of users) {
      const existing = await db('SELECT id FROM erp_users WHERE email=$1', [u.email]);
      if (existing.rows.length) {
        results.push({ email: u.email, status: 'already exists' });
      } else {
        const hash = await bcrypt.hash(u.password, 10);
        await db('INSERT INTO erp_users (company_id,name,email,password,role) VALUES ($1,$2,$3,$4,$5)',
          [coId, u.name, u.email, hash, u.role]);
        results.push({ email: u.email, status: 'created ✅' });
      }
    }
    res.json({ success: true, results });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});


// ── 404 & ERROR ────────────────────────────────────────
app.use(function(req, res) { res.status(404).json({ success: false, message: 'Endpoint not found' }); });
app.use(function(err, req, res, next) { res.status(500).json({ success: false, message: err.message }); });

app.listen(PORT, function() { console.log('PayPe ERP API running on port ' + PORT); });
module.exports = app;
