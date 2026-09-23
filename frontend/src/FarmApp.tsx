import { useEffect, useMemo, useState } from 'react';
import { api, auth } from './lib/client';
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  BookOpen,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Copy,
  ClipboardList,
  FileText,
  Landmark,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PackageMinus,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sprout,
  Trash2,
  Upload,
  UsersRound,
  Wallet,
  Banknote,
  Truck,
  X,
} from 'lucide-react';
import './farm.css';
import TbsModule from './TbsModule';
import TbsMasters from './TbsMasters';
import PayrollModule from './PayrollModule';
import WorkModule from './WorkModule';
import EmployeeReceivables from './EmployeeReceivables';
import PurchaseInvoices from './PurchaseInvoices';
import AccountingModule, { type AccountingAccount } from './AccountingModule';
import FinancialStatements from './FinancialStatements';
import AccountingReports, { type AccountingReportMode } from './AccountingReports';
import InventoryMasters from './InventoryMasters';
import InventoryUsage from './InventoryUsage';
import FixedAssets from './FixedAssets';
import { readStoredChoice, storeChoice } from './navigationState';
import { formatMoneyInput } from './moneyInput';

type Role = 'OWNER' | 'ADMIN_PUSAT' | 'FINANCE' | 'ADMIN_KEBUN' | 'VIEWER';
type User = { userId: string; email?: string; name?: string; picture?: string };
type Kebun = {
  id: string;
  code: string;
  name: string;
  owner?: string;
  location: string;
  areaHa: number;
  treeCount?: number;
  status: 'AKTIF' | 'NONAKTIF';
};
type Account = {
  id: string;
  name: string;
  type: 'KAS' | 'BANK';
  openingBalance: number;
  bankName: string;
  accountNumber: string;
};
type Transaction = {
  id: string;
  transactionNumber?: string;
  kind?: 'NORMAL' | 'TRANSFER';
  transferId?: string;
  sourceType?: 'TBS_PAYMENT' | 'TBS_COST_PAYMENT' | 'SUPPLIER_PAYMENT' | 'PAYROLL_PAYMENT' | 'EMPLOYEE_RECEIVABLE_DISBURSEMENT' | 'PURCHASE_INVOICE';
  date: string;
  kebunId: string;
  accountId: string;
  direction: 'IN' | 'OUT';
  category: string;
  description: string;
  amount: number;
  reference: string;
  allocations?: Array<{ accountId: string; kebunId?: string; amount: number; memo: string }>;
  restrictedProjection?: boolean;
  receiptPath?: string;
  receiptName?: string;
  createdAt: string;
};
type Mill = { id: string; name: string; location: string };
type Harvester = { id: string; name: string; phone: string };
type Vehicle = { id: string; plateNumber: string; name: string; owner: string; ownershipType?: 'OWN' | 'VENDOR'; supplierId?: string; rentMode: 'TRIP' | 'KG_LAPANGAN' | 'KG_PABRIK'; defaultRate: number };
type TbsRate = { id: string; kebunId: string; effectiveDate: string; harvestRatePerKg: number; harvestWeightBasis: 'LAPANGAN' | 'PABRIK'; weighingEnabled?: boolean; weighingRatePerKg?: number; langsirEnabled: boolean; langsirRatePerKg: number; langsirWeightBasis: 'LAPANGAN' | 'PABRIK' };
type TbsRecord = { id: string; date: string; factoryDate: string; doNumber: string; kebunId: string; millId: string; harvesterId: string; langsirWorkerId?: string; vehicleId: string; fieldWeightKg: number; factoryWeightKg: number; factoryBrutoWeightKg?: number; factoryTareWeightKg?: number; factoryNet1WeightKg?: number; factoryGrossWeightKg?: number; factoryDeductionKg?: number; factoryDeductionPct?: number; deductionAmount?: number; factoryTicketNumber: string; pricePerKg: number; deductions: number; harvestRatePerKg: number; harvestWeightBasis: 'LAPANGAN' | 'PABRIK'; weighingRatePerKg?: number; weighingWeightBasis?: 'LAPANGAN' | 'PABRIK'; weighingCost?: number; langsirRatePerKg: number; langsirWeightBasis: 'LAPANGAN' | 'PABRIK'; transportMode: 'TRIP' | 'KG_LAPANGAN' | 'KG_PABRIK'; transportRate: number; harvestCost: number; langsirCost: number; transportCost: number; grossRevenue: number; netRevenue: number; directCost: number; margin: number; weightDifferenceKg: number; weightDifferencePct: number; status: 'LAPANGAN' | 'PABRIK' | 'SELESAI'; note: string; createdAt: string };
type TbsPayment = { id: string; paymentNumber: string; date: string; millId: string; accountId: string; amount: number; reference: string; note: string; allocations: Array<{ tbsId: string; kebunId: string; doNumber: string; amount: number }>; transactionIds: string[]; createdAt: string };
type Supplier = { id: string; code: string; name: string; contact: string; phone: string; address: string; active: boolean };
type SupplierBill = { id: string; sourceType?: 'TBS_ARMADA' | 'PURCHASE_INVOICE'; sourceId?: string; accountingDebitAccountId?: string; date: string; dueDate: string; supplierId: string; kebunId: string; invoiceNumber: string; category: string; description: string; amount: number; createdAt: string };
type SupplierPayment = { id: string; paymentNumber: string; date: string; supplierId: string; accountId: string; amount: number; reference: string; note: string; allocations: Array<{ billId: string; kebunId: string; invoiceNumber: string; amount: number }>; transactionIds: string[]; createdAt: string };
type WorkType = { id: string; name: string; unit: string; active: boolean; createdAt: string };
type WorkRate = { id: string; workTypeId: string; kebunId: string; effectiveDate: string; rate: number; createdAt: string };
type WorkEntry = { id: string; date: string; kebunId: string; workerId: string; workTypeId: string; workName: string; unit: string; quantity: number; rate: number; amount: number; note: string; createdAt: string };
type PayrollManual = { id: string; date: string; workerId: string; kebunId: string; kind: 'EARNING' | 'DEDUCTION'; category: string; amount: number; note: string; createdAt: string };
type EmployeeReceivable = { id: string; date: string; workerId: string; accountId?: string; transactionId?: string; description: string; totalAmount: number; installmentCount: number; note: string; createdAt: string };
type PayrollLine = { sourceKey: string; sourceType: 'TBS_PANEN' | 'TBS_TIMBANG' | 'TBS_LANGSIR' | 'KEBUN_WORK' | 'MANUAL' | 'EMPLOYEE_RECEIVABLE'; sourceId: string; kebunId: string; date: string; kind: 'EARNING' | 'DEDUCTION'; label: string; amount: number; doNumber?: string };
type PayrollRun = { id: string; payrollNumber: string; periodStart: string; periodEnd: string; workerId: string; workerName: string; lines: PayrollLine[]; grossEarnings: number; deductions: number; netPay: number; status: 'OPEN' | 'PAID'; paymentDate: string; accountId: string; reference: string; note: string; transactionIds: string[]; createdAt: string };
type Workspace = {
  id: string;
  name: string;
  role: Role;
  assignedKebunIds: string[];
  restrictedBalances?: boolean;
};
type WorkspaceMember = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: Role;
  assignedKebunIds: string[];
};
type WorkspaceInvite = {
  id: string;
  code: string;
  email: string;
  role: Role;
  assignedKebunIds: string[];
  status: 'OPEN' | 'USED';
};
type CompanyProfile = {
  name: string;
  shortName: string;
  businessType: string;
  npwp: string;
  nib: string;
  address: string;
  village: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  picName: string;
  picPosition: string;
  fiscalYearStartMonth: number;
  currency: string;
  reportName: string;
  logoUrl: string;
};
type Bootstrap = {
  workspace: Workspace;
  workspaces: Workspace[];
  members: WorkspaceMember[];
  invites: WorkspaceInvite[];
  kebun: Kebun[];
  accounts: Account[];
  transactions: Transaction[];
  transactionsNextToken?: string;
  accountingCutoffDate?: string;
  accountingOpeningPosted?: boolean;
  mills: Mill[];
  harvesters: Harvester[];
  vehicles: Vehicle[];
  tbsRates: TbsRate[];
  tbs: TbsRecord[];
  tbsPayments: TbsPayment[];
  suppliers: Supplier[];
  supplierBills: SupplierBill[];
  supplierPayments: SupplierPayment[];
  workTypes: WorkType[];
  workRates: WorkRate[];
  workEntries: WorkEntry[];
  employeeReceivables: EmployeeReceivable[];
  payrollManual: PayrollManual[];
  payrollRuns: PayrollRun[];
};
type Tab = 'dashboard' | 'tbs' | 'work' | 'purchases' | 'inventory' | 'payroll' | 'employeeReceivables' | 'transactions' | 'accounting' | 'reports' | 'master' | 'access';
const mainTabStorageKey = 'perkebunan.navigation.tab';
const mainTabOptions: readonly Tab[] = ['dashboard', 'tbs', 'work', 'purchases', 'inventory', 'payroll', 'employeeReceivables', 'transactions', 'accounting', 'reports', 'master', 'access'];
const companySessionKey = 'perkebunan.company.selected';
const tabPathMap: Record<Tab, string> = {
  dashboard: '/dashboard',
  tbs: '/tbs',
  work: '/work',
  purchases: '/purchase',
  inventory: '/inventory',
  payroll: '/payroll',
  employeeReceivables: '/employee-receivables',
  transactions: '/cash-bank',
  accounting: '/accounting',
  reports: '/reports',
  master: '/master',
  access: '/company',
};
const pathTabMap: Record<string, Tab> = {
  dashboard: 'dashboard',
  tbs: 'tbs',
  work: 'work',
  purchase: 'purchases',
  purchases: 'purchases',
  inventory: 'inventory',
  payroll: 'payroll',
  'employee-receivables': 'employeeReceivables',
  receivables: 'employeeReceivables',
  'cash-bank': 'transactions',
  transactions: 'transactions',
  accounting: 'accounting',
  reports: 'reports',
  master: 'master',
  company: 'access',
};
function tabFromPath(pathname: string): Tab | null {
  const segment = pathname.replace(/^\/+|\/+$/g, '').split('/')[0]?.toLowerCase() || '';
  return segment ? pathTabMap[segment] || null : null;
}
function pathForTab(tab: Tab) { return tabPathMap[tab] || '/dashboard'; }
function readCompanySession() {
  if (typeof window === 'undefined') return '';
  try { return window.sessionStorage.getItem(companySessionKey) || ''; } catch { return ''; }
}
function storeCompanySession(workspaceId: string) {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(companySessionKey, workspaceId); } catch { /* no-op */ }
}
function clearCompanySession() {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(companySessionKey); } catch { /* no-op */ }
}

type CashAllocationForm = { accountId: string; kebunId: string; amount: string; memo: string; search: string };
type TransactionForm = {
  date: string;
  kebunId: string;
  accountId: string;
  direction: 'IN' | 'OUT';
  description: string;
  reference: string;
  allocations: CashAllocationForm[];
};
const roles: Array<{ value: Exclude<Role, 'OWNER'>; label: string }> = [
  { value: 'ADMIN_PUSAT', label: 'Admin Pusat' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'ADMIN_KEBUN', label: 'Admin Kebun' },
  { value: 'VIEWER', label: 'Viewer' },
];
const emptyWorkspace: Workspace = {
  id: '',
  name: 'Administrasi Perkebunan',
  role: 'OWNER',
  assignedKebunIds: [],
};
const emptyData: Bootstrap = {
  workspace: emptyWorkspace,
  workspaces: [],
  members: [],
  invites: [],
  kebun: [],
  accounts: [],
  transactions: [],
  transactionsNextToken: '',
  accountingCutoffDate: '',
  accountingOpeningPosted: false,
  mills: [],
  harvesters: [],
  vehicles: [],
  tbsRates: [],
  tbs: [],
  tbsPayments: [],
  suppliers: [],
  supplierBills: [],
  supplierPayments: [],
  workTypes: [],
  workRates: [],
  workEntries: [],
  employeeReceivables: [],
  payrollManual: [],
  payrollRuns: [],
};
const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}
function blankTransactionForm(): TransactionForm {
  return {
    date: today(),
    kebunId: '',
    accountId: '',
    direction: 'OUT',
    description: '',
    reference: '',
    allocations: [{ accountId: '', kebunId: '', amount: '', memo: '', search: '' }],
  };
}
function roleLabel(value: Role) {
  return {
    OWNER: 'Owner',
    ADMIN_PUSAT: 'Admin Pusat',
    FINANCE: 'Finance',
    ADMIN_KEBUN: 'Admin Kebun',
    VIEWER: 'Viewer',
  }[value];
}
function canManageMaster(value: Role) {
  return value === 'OWNER' || value === 'ADMIN_PUSAT';
}
function canTransact(value: Role) {
  return value !== 'VIEWER';
}
function canTransfer(value: Role) {
  return value === 'OWNER' || value === 'ADMIN_PUSAT' || value === 'FINANCE';
}
function canManagePayroll(value: Role) {
  return value === 'OWNER' || value === 'ADMIN_PUSAT' || value === 'FINANCE';
}
function canManageAccounting(value: Role) {
  return value === 'OWNER' || value === 'ADMIN_PUSAT' || value === 'FINANCE';
}
function canOpenTab(tab: Tab, role: Role) {
  if (tab === 'master') return canManageMaster(role);
  if (tab === 'employeeReceivables') return canManagePayroll(role);
  if (tab === 'purchases' || tab === 'accounting') return canManageAccounting(role);
  return true;
}

function FarmApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Bootstrap>(emptyData);
  const [tab, setTab] = useState<Tab>(() => {
    const routed = typeof window !== 'undefined' ? tabFromPath(window.location.pathname) : null;
    if (routed) return routed;
    const stored = readStoredChoice(mainTabStorageKey, mainTabOptions, 'dashboard');
    return stored === 'payables' ? 'purchases' : stored;
  }); 
  const [mobileMenu, setMobileMenu] = useState(false);
  const [companySelected, setCompanySelected] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = async () => {
    try {
      let res = await api.get('/api/bootstrap');
      let nextData = res.data as Bootstrap;
      // Self-host: legacy one-time AppDeploy reset routines are intentionally disabled.
      const allTransactions = [...nextData.transactions];
      let nextToken = nextData.transactionsNextToken || '';
      const seenTokens = new Set<string>();
      while (nextToken && !seenTokens.has(nextToken)) {
        seenTokens.add(nextToken);
        const pageRes = await api.get(`/api/transactions-page?nextToken=${encodeURIComponent(nextToken)}`);
        const page = pageRes.data as { transactions?: Transaction[]; nextToken?: string };
        allTransactions.push(...(page.transactions || []));
        nextToken = page.nextToken || '';
      }
      const completeData: Bootstrap = { ...nextData, transactions: allTransactions, transactionsNextToken: '' };
      setData(completeData);
      const routedTab = typeof window !== 'undefined' ? tabFromPath(window.location.pathname) : null;
      const storedTab = routedTab || readStoredChoice(mainTabStorageKey, mainTabOptions, 'dashboard');
      const nextTab = canOpenTab(storedTab, completeData.workspace.role) ? storedTab : 'dashboard';
      setTab(nextTab);
      storeChoice(mainTabStorageKey, nextTab);
      setErrorMessage('');
      return completeData;
    } catch (err) {
      setErrorMessage(apiError(err, 'Data belum bisa dimuat. Silakan coba lagi.'));
      return null;
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const current = await auth.getUser();
        if (current) {
          setUser(current as User);
          let loaded = await loadData();
          const selectedWorkspaceId = readCompanySession();
          if (loaded && selectedWorkspaceId && loaded.workspaces.some(item => item.id === selectedWorkspaceId)) {
            if (loaded.workspace.id !== selectedWorkspaceId) {
              await api.post('/api/workspace/switch', { workspaceId: selectedWorkspaceId });
              loaded = await loadData();
            }
            if (loaded) setCompanySelected(true);
          } else {
            clearCompanySession();
          }
        }
      } finally {
        setRestoringSession(false);
        setLoading(false);
      }
    };
    void init();
  }, []);

  const signIn = async (credentials: { email: string; password: string }) => {
    try {
      setLoading(true);
      setErrorMessage('');
      clearCompanySession();
      setCompanySelected(false);
      const result = await auth.signIn(credentials);
      setUser(result.user as User);
      await loadData();
    } catch (err) {
      setErrorMessage(apiError(err, 'Email atau password belum sesuai.'));
    } finally {
      setLoading(false);
    }
  };

  const navigate = (nextTab: Tab, options?: { replace?: boolean }) => {
    const allowedTab = canOpenTab(nextTab, data.workspace.role) ? nextTab : 'dashboard';
    setTab(allowedTab);
    storeChoice(mainTabStorageKey, allowedTab);
    if (typeof window !== 'undefined') {
      const nextPath = pathForTab(allowedTab);
      if (window.location.pathname !== nextPath) {
        if (options?.replace) window.history.replaceState({ tab: allowedTab }, '', nextPath);
        else window.history.pushState({ tab: allowedTab }, '', nextPath);
      }
    }
  };

  const selectCompany = async (workspaceId: string) => {
    try {
      setLoading(true);
      setErrorMessage('');
      if (workspaceId !== data.workspace.id) await api.post('/api/workspace/switch', { workspaceId });
      const loaded = await loadData();
      if (!loaded) return;
      storeCompanySession(workspaceId);
      setCompanySelected(true);
      const requestedTab = typeof window !== 'undefined' ? tabFromPath(window.location.pathname) : null;
      const targetTab = requestedTab && canOpenTab(requestedTab, loaded.workspace.role) ? requestedTab : 'dashboard';
      navigate(targetTab, { replace: !requestedTab });
    } catch (err) {
      setErrorMessage(apiError(err, 'Perusahaan belum dapat dibuka.'));
    } finally {
      setLoading(false);
    }
  };

  const createCompanyFromSelector = async (name: string) => {
    try {
      setLoading(true);
      setErrorMessage('');
      await api.post('/api/workspace/create', { name });
      const loaded = await loadData();
      if (!loaded) return;
      storeCompanySession(loaded.workspace.id);
      setCompanySelected(true);
      navigate('dashboard', { replace: true });
    } catch (err) {
      setErrorMessage(apiError(err, 'Perusahaan baru belum dapat dibuat.'));
    } finally {
      setLoading(false);
    }
  };

  const joinCompanyFromSelector = async (code: string) => {
    const inviteCode = code.trim();
    if (!inviteCode) return;
    try {
      setLoading(true);
      setErrorMessage('');
      await api.post('/api/workspace/join', { code: inviteCode });
      const loaded = await loadData();
      if (!loaded) return;
      storeCompanySession(loaded.workspace.id);
      setCompanySelected(true);
      navigate('dashboard', { replace: true });
    } catch (err) {
      setErrorMessage(apiError(err, 'Kode undangan perusahaan belum dapat digunakan.'));
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await auth.signOut();
    clearCompanySession();
    setUser(null);
    setData(emptyData);
    setCompanySelected(false);
    setTab('dashboard');
    storeChoice(mainTabStorageKey, 'dashboard');
    if (typeof window !== 'undefined') window.history.replaceState({}, '', '/');
  };

  useEffect(() => {
    if (!user || !companySelected || typeof window === 'undefined') return;
    const routed = tabFromPath(window.location.pathname);
    const nextTab = routed && canOpenTab(routed, data.workspace.role) ? routed : tab;
    const safeTab = canOpenTab(nextTab, data.workspace.role) ? nextTab : 'dashboard';
    if (tab !== safeTab) setTab(safeTab);
    storeChoice(mainTabStorageKey, safeTab);
    const canonicalPath = pathForTab(safeTab);
    if (window.location.pathname !== canonicalPath) window.history.replaceState({ tab: safeTab }, '', canonicalPath);
  }, [user, companySelected, data.workspace.role]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      if (!user || !companySelected) return;
      const routed = tabFromPath(window.location.pathname) || 'dashboard';
      const safeTab = canOpenTab(routed, data.workspace.role) ? routed : 'dashboard';
      setTab(safeTab);
      storeChoice(mainTabStorageKey, safeTab);
      const canonicalPath = pathForTab(safeTab);
      if (window.location.pathname !== canonicalPath) window.history.replaceState({ tab: safeTab }, '', canonicalPath);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user, companySelected, data.workspace.role]);

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2800);
  };

  if (restoringSession || (loading && !user)) return <Splash />;
  if (!user) return <Login onLogin={signIn} error={errorMessage} />;
  if (!companySelected) return (
    <CompanySelector
      user={user}
      data={data}
      loading={loading}
      error={errorMessage}
      onSelect={selectCompany}
      onCreate={createCompanyFromSelector}
      onJoin={joinCompanyFromSelector}
      onLogout={signOut}
    />
  );

  const navItems: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tbs', label: 'Panen & TBS', icon: Truck },
    { id: 'work', label: 'Pekerjaan Kebun', icon: ClipboardList },
    ...(canManageAccounting(data.workspace.role) ? [{ id: 'purchases' as Tab, label: 'Pembelian', icon: ShoppingCart }] : []),
    { id: 'inventory', label: 'Persediaan Barang', icon: PackageMinus },
    { id: 'payroll', label: 'Payroll Kebun', icon: Banknote },
    ...(canManagePayroll(data.workspace.role) ? [{ id: 'employeeReceivables' as Tab, label: 'Piutang Karyawan', icon: Wallet }] : []),
    { id: 'transactions', label: 'Kas & Bank', icon: CircleDollarSign },
    ...(canManageAccounting(data.workspace.role) ? [{ id: 'accounting' as Tab, label: 'Akuntansi', icon: BookOpen }] : []),
    { id: 'reports', label: 'Laporan', icon: FileText },
    ...(canManageMaster(data.workspace.role)
      ? [{ id: 'master' as Tab, label: 'Master Data', icon: Building2 }]
      : []),
    { id: 'access', label: 'Perusahaan', icon: Building2 },
  ];

  return (
    <div className="shell">
      <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Sprout size={24} /></div>
            <div><strong>Administrasi</strong><span>Perkebunan · v4.15.0</span></div>
        </div>
        <button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Tutup menu">
          <X size={20} />
        </button>
        <div className="workspace-mini">
          <span>Perusahaan aktif</span>
          <strong>{data.workspace.name}</strong>
          <b>{roleLabel(data.workspace.role)}</b>
        </div>
        <nav>
          {navItems.map(item => (
            <button
              key={item.id}
              className={tab === item.id ? 'active' : ''}
              onClick={() => {
                navigate(item.id);
                setMobileMenu(false);
              }}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              <ChevronRight className="chev" size={16} />
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">{(user.name || user.email || 'U').slice(0, 1).toUpperCase()}</div>
          <div className="user-meta"><strong>{user.name || 'Pengguna'}</strong><span>{user.email || ''}</span></div>
          <button className="icon-btn" onClick={signOut} title="Keluar"><LogOut size={18} /></button>
        </div>
      </aside>
      {mobileMenu && <div className="scrim" onClick={() => setMobileMenu(false)} />}
      <main className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setMobileMenu(true)}><Menu size={22} /></button>
          <div>
            <h1>{navItems.find(item => item.id === tab)?.label || 'Administrasi Perkebunan'}</h1>
            <p>{data.workspace.name} · {roleLabel(data.workspace.role)}</p>
          </div>
          <div className="topbar-actions"><button className="company-switch-btn" onClick={() => { clearCompanySession(); setCompanySelected(false); }}><Building2 size={16} /> <span>Ganti Perusahaan</span></button><button className="refresh-btn" onClick={loadData}><RefreshCw size={16} /> <span>Refresh</span></button></div>
        </header>
        {message && <div className="toast success">{message}</div>}
        {errorMessage && (
          <div className="toast error">
            {errorMessage}
            <button onClick={() => setErrorMessage('')}><X size={15} /></button>
          </div>
        )}
        <div className="content">
          {tab === 'dashboard' && <Dashboard data={data} onNavigate={navigate} />}
          {tab === 'tbs' && (
            <TbsModule data={data} reload={loadData} flash={flash} showError={setErrorMessage} />
          )}
          {tab === 'work' && (
            <WorkModule data={data} reload={loadData} flash={flash} showError={setErrorMessage} />
          )}
          {tab === 'purchases' && canManageAccounting(data.workspace.role) && (
            <PurchaseInvoices data={data} reload={loadData} flash={flash} showError={setErrorMessage} />
          )}
          {tab === 'inventory' && (
            <InventoryUsage workspaceId={data.workspace.id} role={data.workspace.role} kebun={data.kebun} flash={flash} showError={setErrorMessage} />
          )}
          {tab === 'payroll' && (
            <PayrollModule data={data} reload={loadData} flash={flash} showError={setErrorMessage} />
          )}
          {tab === 'employeeReceivables' && canManagePayroll(data.workspace.role) && (
            <EmployeeReceivables data={data} reload={loadData} flash={flash} showError={setErrorMessage} />
          )}
          {tab === 'transactions' && (
            <Transactions data={data} reload={loadData} flash={flash} showError={setErrorMessage} />
          )}
          {tab === 'accounting' && canManageAccounting(data.workspace.role) && (
            <AccountingModule data={data} flash={flash} showError={setErrorMessage} />
          )}
          {tab === 'reports' && <Reports data={data} />}
          {tab === 'master' && canManageMaster(data.workspace.role) && (
            <MasterData data={data} reload={loadData} flash={flash} showError={setErrorMessage} />
          )}
          {tab === 'access' && (
            <CompanyPanel
              user={user}
              data={data}
              reload={loadData}
              flash={flash}
              showError={setErrorMessage}
              onCompanyDeleted={() => {
                clearCompanySession();
                setCompanySelected(false);
                setTab('dashboard');
                storeChoice(mainTabStorageKey, 'dashboard');
                if (typeof window !== 'undefined') window.history.replaceState({}, '', '/');
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function Splash() {
  return (
    <div className="splash">
      <div className="brand-mark large"><Sprout size={34} /></div>
      <strong>Administrasi Perkebunan</strong>
      <span>Menyiapkan aplikasi...</span>
    </div>
  );
}

function Login({ onLogin, error }: { onLogin: (credentials: { email: string; password: string }) => void; error: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div className="login-page">
      <div className="login-visual">
        <div className="visual-copy">
          <span className="eyebrow">Administrasi Kebun Kelapa Sawit</span>
          <h1>Data kebun rapi.<br />Keputusan lebih cepat.</h1>
          <p>Kelola kas, bank, biaya, dan transaksi setiap kebun dari satu aplikasi.</p>
          <div className="visual-stats">
            <div><strong>15</strong><span>Kebun siap dikelola</span></div>
            <div><strong>1</strong><span>Dashboard terpusat</span></div>
          </div>
        </div>
      </div>
      <div className="login-panel">
        <form className="login-card" onSubmit={event => { event.preventDefault(); onLogin({ email, password }); }}>
          <div className="brand login-brand">
            <div className="brand-mark"><Sprout size={24} /></div>
            <div><strong>Administrasi</strong><span>Perkebunan</span></div>
          </div>
          <h2>Selamat datang</h2>
          <p>Masuk, lalu pilih perusahaan yang akan dikerjakan.</p>
          {error && <div className="inline-error">{error}</div>}
          <label className="field"><span>Email</span><input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required /></label>
          <label className="field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
          <button className="primary wide" type="submit"><LogIn size={19} /> Masuk ke Aplikasi</button>
          <small>Setiap perusahaan memiliki data terpisah. Hak akses mengikuti perusahaan dan role pengguna.</small>
        </form>
      </div>
    </div>
  );
}

function CompanySelector({
  user, data, loading, error, onSelect, onCreate, onJoin, onLogout,
}: {
  user: User;
  data: Bootstrap;
  loading: boolean;
  error: string;
  onSelect: (workspaceId: string) => Promise<void>;
  onCreate: (name: string) => Promise<void>;
  onJoin: (code: string) => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [companyName, setCompanyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  return (
    <div className="company-select-page">
      <div className="company-select-shell">
        <div className="company-select-head">
          <div className="brand">
            <div className="brand-mark"><Sprout size={24} /></div>
            <div><strong>Administrasi</strong><span>Perkebunan</span></div>
          </div>
          <button className="secondary" onClick={() => void onLogout()}><LogOut size={16} /> Keluar</button>
        </div>
        <div className="company-select-copy">
          <span className="eyebrow dark">Pilih Perusahaan</span>
          <h1>Perusahaan mana yang akan dikerjakan?</h1>
          <p>Setelah perusahaan dipilih, seluruh master, transaksi, persediaan, akuntansi, dan laporan hanya memakai data perusahaan tersebut.</p>
        </div>
        {error && <div className="inline-error">{error}</div>}
        <div className="company-choice-grid">
          {data.workspaces.map(item => (
            <button key={item.id} className="company-choice-card" disabled={loading} onClick={() => void onSelect(item.id)}>
              <span className="company-choice-icon"><Building2 size={25} /></span>
              <span className="company-choice-copy"><strong>{item.name}</strong><small>{roleLabel(item.role)}</small></span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
        <form className="company-create-card" onSubmit={event => { event.preventDefault(); const name = companyName.trim(); if (name.length >= 2) void onCreate(name); }}>
          <div><strong>Tambah perusahaan baru</strong><span>Buat ruang data perusahaan yang benar-benar terpisah.</span></div>
          <div className="company-create-row"><input placeholder="Contoh: PT Sawit Makmur" value={companyName} onChange={event => setCompanyName(event.target.value)} maxLength={120} /><button className="primary" disabled={loading || companyName.trim().length < 2}><Plus size={17} /> Buat Perusahaan</button></div>
        </form>
        <form className="company-create-card company-join-card" onSubmit={event => { event.preventDefault(); const code = joinCode.trim(); if (code) void onJoin(code); }}>
          <div><strong>Punya kode undangan?</strong><span>Gabung ke perusahaan yang sudah dibuat oleh Owner.</span></div>
          <div className="company-create-row"><input placeholder="Tempel kode undangan" value={joinCode} onChange={event => setJoinCode(event.target.value)} /><button className="secondary" disabled={loading || !joinCode.trim()}><UsersRound size={17} /> Gabung Perusahaan</button></div>
        </form>
        <div className="company-user-note">Login sebagai <strong>{user.name || user.email || 'Pengguna'}</strong></div>
      </div>
    </div>
  );
}

function Dashboard({ data, onNavigate }: { data: Bootstrap; onNavigate: (tab: Tab) => void }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [kebunId, setKebunId] = useState('');
  const [extraLoading, setExtraLoading] = useState(false);
  const [extra, setExtra] = useState<{
    purchaseInvoices: Array<{ id: string; date: string; kebunId: string; amount: number; lines?: Array<{ kebunId?: string; lineTotal?: number; netTotal?: number }> }>;
    inventoryItems: Array<{ id: string; name: string; currentQuantity: number; stockValue: number; active: boolean }>;
    inventoryWarehouses: Array<{ id: string; kebunId: string; active: boolean }>;
    inventoryBalances: Array<{ warehouseId: string; itemId: string; quantity: number; stockValue: number; averageCost: number }>;
    inventoryUsages: Array<{ id: string; date: string; totalAmount: number; lines?: Array<{ kebunId: string; amount: number }> }>;
    fixedAssets: Array<{ id: string; kebunId: string; acquisitionCost: number; status: 'ACTIVE' | 'DISPOSED' | 'WRITTEN_OFF' }>;
  }>({
    purchaseInvoices: [],
    inventoryItems: [],
    inventoryWarehouses: [],
    inventoryBalances: [],
    inventoryUsages: [],
    fixedAssets: [],
  });

  useEffect(() => {
    let active = true;
    const loadDashboardExtras = async () => {
      try {
        setExtraLoading(true);
        const [purchaseResult, inventoryResult, usageResult, fixedAssetResult] = await Promise.allSettled([
          api.get('/api/purchase-invoices'),
          api.get('/api/inventory/master'),
          api.get('/api/inventory-usages'),
          api.get('/api/fixed-assets/master'),
        ]);
        if (!active) return;

        const purchaseRes = purchaseResult.status === 'fulfilled' ? purchaseResult.value : null;
        const inventoryRes = inventoryResult.status === 'fulfilled' ? inventoryResult.value : null;
        const usageRes = usageResult.status === 'fulfilled' ? usageResult.value : null;
        const fixedAssetRes = fixedAssetResult.status === 'fulfilled' ? fixedAssetResult.value : null;
        const inventory = (inventoryRes?.data || {}) as {
          items?: Array<{ id: string; name: string; currentQuantity: number; stockValue: number; active: boolean }>;
          warehouses?: Array<{ id: string; kebunId: string; active: boolean }>;
          balances?: Array<{ warehouseId: string; itemId: string; quantity: number; stockValue: number; averageCost: number }>;
        };

        setExtra({
          purchaseInvoices: purchaseRes ? (purchaseRes.data as { invoices?: Array<{ id: string; date: string; kebunId: string; amount: number; lines?: Array<{ kebunId?: string; lineTotal?: number; netTotal?: number }> }> }).invoices || [] : [],
          inventoryItems: inventory.items || [],
          inventoryWarehouses: inventory.warehouses || [],
          inventoryBalances: inventory.balances || [],
          inventoryUsages: usageRes ? (usageRes.data as { usages?: Array<{ id: string; date: string; totalAmount: number; lines?: Array<{ kebunId: string; amount: number }> }> }).usages || [] : [],
          fixedAssets: fixedAssetRes ? (fixedAssetRes.data as { assets?: Array<{ id: string; kebunId: string; acquisitionCost: number; status: 'ACTIVE' | 'DISPOSED' | 'WRITTEN_OFF' }> }).assets || [] : [],
        });
      } finally {
        if (active) setExtraLoading(false);
      }
    };
    void loadDashboardExtras();
    return () => { active = false; };
  }, [data.workspace.id]);

  const monthLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00`));
  const kgFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

  const txAmountForKebun = (tx: Transaction, targetKebunId: string) => {
    if (!targetKebunId) return tx.amount;
    if (tx.kind === 'TRANSFER') return 0;
    if (tx.allocations?.length) {
      return tx.allocations.reduce((sum, line) => {
        const lineKebunId = line.kebunId === undefined ? tx.kebunId : line.kebunId;
        return lineKebunId === targetKebunId ? sum + Number(line.amount || 0) : sum;
      }, 0);
    }
    return tx.kebunId === targetKebunId ? tx.amount : 0;
  };

  const accountBalances = useMemo(
    () => data.accounts.map(account => ({ ...account, balance: balanceForAccount(account, data.transactions, data.accountingCutoffDate) })),
    [data]
  );
  const totalBalance = accountBalances.reduce((sum, item) => sum + item.balance, 0);

  const monthTx = data.transactions.filter(tx =>
    isAfterAccountingCutoff(tx, data.accountingCutoffDate) &&
    tx.kind !== 'TRANSFER' &&
    tx.date.startsWith(month)
  );
  const income = monthTx.filter(tx => tx.direction === 'IN').reduce((sum, tx) => sum + txAmountForKebun(tx, kebunId), 0);
  const expense = monthTx.filter(tx => tx.direction === 'OUT').reduce((sum, tx) => sum + txAmountForKebun(tx, kebunId), 0);

  const paidByBill = new Map<string, number>();
  data.supplierPayments.forEach(payment => {
    payment.allocations.forEach(line => {
      paidByBill.set(line.billId, (paidByBill.get(line.billId) || 0) + Number(line.amount || 0));
    });
  });
  const relevantBills = data.supplierBills.filter(bill => !kebunId || bill.kebunId === kebunId);
  const payable = relevantBills.reduce((sum, bill) => sum + Math.max(0, Number(bill.amount || 0) - (paidByBill.get(bill.id) || 0)), 0);
  const overdueBills = relevantBills.filter(bill => bill.dueDate && bill.dueDate < today() && Number(bill.amount || 0) - (paidByBill.get(bill.id) || 0) > 0);

  const tbsMonth = data.tbs.filter(row => row.date.startsWith(month) && (!kebunId || row.kebunId === kebunId));
  const tbsKg = tbsMonth.reduce((sum, row) => sum + Number(row.factoryWeightKg || row.fieldWeightKg || 0), 0);
  const tbsRevenue = tbsMonth.reduce((sum, row) => sum + Number(row.netRevenue || 0), 0);

  const invoiceAmountForKebun = (invoice: (typeof extra.purchaseInvoices)[number], targetKebunId: string) => {
    if (!targetKebunId) return Number(invoice.amount || 0);
    if (invoice.lines?.length) {
      return invoice.lines.reduce((sum, line) => {
        const lineKebunId = line.kebunId || invoice.kebunId;
        return lineKebunId === targetKebunId ? sum + Number(line.netTotal ?? line.lineTotal ?? 0) : sum;
      }, 0);
    }
    return invoice.kebunId === targetKebunId ? Number(invoice.amount || 0) : 0;
  };
  const purchasesMonth = extra.purchaseInvoices
    .filter(invoice => invoice.date.startsWith(month))
    .reduce((sum, invoice) => sum + invoiceAmountForKebun(invoice, kebunId), 0);

  const usageAmountForKebun = (usage: (typeof extra.inventoryUsages)[number], targetKebunId: string) => {
    if (!targetKebunId) return Number(usage.totalAmount || 0);
    return (usage.lines || []).reduce((sum, line) => line.kebunId === targetKebunId ? sum + Number(line.amount || 0) : sum, 0);
  };
  const inventoryUsageMonth = extra.inventoryUsages
    .filter(usage => usage.date.startsWith(month))
    .reduce((sum, usage) => sum + usageAmountForKebun(usage, kebunId), 0);

  const activeWarehouseIds = new Set(
    extra.inventoryWarehouses
      .filter(warehouse => warehouse.active !== false && (!kebunId || warehouse.kebunId === kebunId))
      .map(warehouse => warehouse.id)
  );
  const relevantBalances = extra.inventoryBalances.filter(balance => activeWarehouseIds.has(balance.warehouseId));
  const inventoryValue = relevantBalances.reduce((sum, balance) => sum + Number(balance.stockValue || 0), 0);
  const itemQty = new Map<string, number>();
  relevantBalances.forEach(balance => itemQty.set(balance.itemId, (itemQty.get(balance.itemId) || 0) + Number(balance.quantity || 0)));
  const zeroStockItems = extra.inventoryItems.filter(item => item.active !== false && (itemQty.get(item.id) || 0) <= 0);

  const activeAssets = extra.fixedAssets.filter(asset => asset.status === 'ACTIVE' && (!kebunId || asset.kebunId === kebunId));
  const fixedAssetValue = activeAssets.reduce((sum, asset) => sum + Number(asset.acquisitionCost || 0), 0);

  const paidReceivableById = new Map<string, number>();
  data.payrollRuns
    .filter(run => run.status === 'PAID')
    .forEach(run => run.lines
      .filter(line => line.sourceType === 'EMPLOYEE_RECEIVABLE' && line.kind === 'DEDUCTION')
      .forEach(line => paidReceivableById.set(line.sourceId, (paidReceivableById.get(line.sourceId) || 0) + Number(line.amount || 0))));
  const relevantReceivables = data.employeeReceivables;
  const employeeReceivableBalance = relevantReceivables.reduce(
    (sum, item) => sum + Math.max(0, Number(item.totalAmount || 0) - (paidReceivableById.get(item.id) || 0)),
    0
  );

  const payrollMonth = data.payrollRuns
    .filter(run => (run.paymentDate?.startsWith(month) || run.periodEnd?.startsWith(month)) && (!kebunId || run.lines.some(line => line.kebunId === kebunId)))
    .reduce((sum, run) => {
      if (!kebunId) return sum + Number(run.netPay || 0);
      const earnings = run.lines.filter(line => line.kebunId === kebunId && line.kind === 'EARNING').reduce((s, line) => s + Number(line.amount || 0), 0);
      const deductions = run.lines.filter(line => line.kebunId === kebunId && line.kind === 'DEDUCTION').reduce((s, line) => s + Number(line.amount || 0), 0);
      return sum + Math.max(0, earnings - deductions);
    }, 0);

  const missingCostCenter = monthTx.filter(tx => {
    if (tx.allocations?.length) {
      return tx.allocations.some(line => (line.kebunId === undefined ? tx.kebunId : line.kebunId) === '');
    }
    return !tx.kebunId;
  });
  const openPayroll = data.payrollRuns.filter(run => run.status === 'OPEN' && (!kebunId || run.lines.some(line => line.kebunId === kebunId)));

  const recent = [...data.transactions]
    .filter(tx => tx.date.startsWith(month) && (!kebunId || txAmountForKebun(tx, kebunId) > 0))
    .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`))
    .slice(0, 6);

  const kebunRows = data.kebun
    .filter(item => item.status === 'AKTIF' && (!kebunId || item.id === kebunId))
    .map(item => ({
      ...item,
      tbsKg: data.tbs.filter(record => record.date.startsWith(month) && record.kebunId === item.id).reduce((sum, record) => sum + Number(record.factoryWeightKg || record.fieldWeightKg || 0), 0),
      expense: monthTx.filter(tx => tx.direction === 'OUT').reduce((sum, tx) => sum + txAmountForKebun(tx, item.id), 0),
      purchases: extra.purchaseInvoices.filter(invoice => invoice.date.startsWith(month)).reduce((sum, invoice) => sum + invoiceAmountForKebun(invoice, item.id), 0),
      inventoryUsage: extra.inventoryUsages.filter(usage => usage.date.startsWith(month)).reduce((sum, usage) => sum + usageAmountForKebun(usage, item.id), 0),
    }));

  const alerts = [
    { key: 'overdue', title: 'Invoice Jatuh Tempo', count: overdueBills.length, detail: overdueBills.length ? `${idr.format(overdueBills.reduce((sum, bill) => sum + Math.max(0, bill.amount - (paidByBill.get(bill.id) || 0)), 0))} belum dibayar` : 'Tidak ada tagihan jatuh tempo', tab: 'purchases' as Tab },
    { key: 'stock', title: 'Stok Kosong', count: zeroStockItems.length, detail: zeroStockItems.length ? 'Barang aktif dengan stok 0 atau kurang' : 'Tidak ada stok kosong', tab: 'inventory' as Tab },
    { key: 'costcenter', title: 'Tanpa Cost Center', count: missingCostCenter.length, detail: missingCostCenter.length ? `Transaksi ${monthLabel} perlu dilengkapi` : 'Semua transaksi bulan ini sudah terarah', tab: 'transactions' as Tab },
    { key: 'payroll', title: 'Payroll Belum Dibayar', count: openPayroll.length, detail: openPayroll.length ? `${idr.format(openPayroll.reduce((sum, run) => sum + Number(run.netPay || 0), 0))} masih terbuka` : 'Tidak ada payroll terbuka', tab: 'payroll' as Tab },
    { key: 'opening', title: 'Saldo Awal', count: data.accountingOpeningPosted ? 0 : 1, detail: data.accountingOpeningPosted ? `Sudah diposting${data.accountingCutoffDate ? ` per ${formatDate(data.accountingCutoffDate)}` : ''}` : 'Belum diposting ke akuntansi', tab: 'accounting' as Tab },
  ];

  return (
    <div className="stack dashboard-control">
      <section className="panel dashboard-toolbar">
        <div>
          <span className="eyebrow dashboard-eyebrow">Panel Kontrol Kebun</span>
          <h2>Ringkasan {kebunId ? findKebun(data, kebunId)?.name || 'Kebun' : 'Semua Kebun'}</h2>
          <p>Keuangan, operasional, dan perhatian utama dalam satu tampilan.</p>
        </div>
        <div className="dashboard-filters">
          <label>
            <span>Periode</span>
            <input type="month" value={month} onChange={event => setMonth(event.target.value || today().slice(0, 7))} />
          </label>
          <label>
            <span>Kebun / Cost Center</span>
            <select value={kebunId} onChange={event => setKebunId(event.target.value)}>
              <option value="">Semua Kebun</option>
              {data.kebun.filter(item => item.status === 'AKTIF').map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="dashboard-section-head">
        <div><strong>Keuangan</strong><span>{monthLabel}</span></div>
        {kebunId && <small>Saldo Kas & Bank tetap global karena saldo melekat pada rekening, bukan Cost Center.</small>}
      </div>
      <section className="metrics">
        <Metric icon={Wallet} label="Total Saldo Kas & Bank" value={data.workspace.restrictedBalances ? 'Akses terbatas' : idr.format(totalBalance)} note={data.workspace.restrictedBalances ? 'Saldo penuh hanya untuk pusat/finance' : `${data.accounts.length} akun aktif · global`} />
        <Metric icon={ArrowUpCircle} label="Pemasukan" value={idr.format(income)} note={`${monthTx.filter(tx => tx.direction === 'IN' && txAmountForKebun(tx, kebunId) > 0).length} transaksi`} />
        <Metric icon={ArrowDownCircle} label="Pengeluaran" value={idr.format(expense)} note={`${monthTx.filter(tx => tx.direction === 'OUT' && txAmountForKebun(tx, kebunId) > 0).length} transaksi`} />
        <Metric icon={CircleDollarSign} label="Hutang Supplier" value={idr.format(payable)} note={`${relevantBills.filter(bill => bill.amount - (paidByBill.get(bill.id) || 0) > 0).length} tagihan terbuka`} />
      </section>

      <div className="dashboard-section-head">
        <div><strong>Operasional</strong><span>Aktivitas bulan berjalan sesuai filter</span></div>
        {extraLoading && <small>Memuat data pembelian, persediaan, dan aset…</small>}
      </div>
      <section className="metrics">
        <Metric icon={Truck} label="Produksi TBS" value={`${kgFormat.format(tbsKg)} kg`} note={`${tbsMonth.length} transaksi · net ${idr.format(tbsRevenue)}`} />
        <Metric icon={ShoppingCart} label="Pembelian" value={idr.format(purchasesMonth)} note={`${extra.purchaseInvoices.filter(invoice => invoice.date.startsWith(month) && invoiceAmountForKebun(invoice, kebunId) > 0).length} invoice`} />
        <Metric icon={PackageMinus} label="Nilai Persediaan" value={idr.format(inventoryValue)} note={inventoryUsageMonth ? `${idr.format(inventoryUsageMonth)} dipakai bulan ini` : 'Belum ada pemakaian bulan ini'} />
        <Metric icon={UsersRound} label="Payroll" value={idr.format(payrollMonth)} note={`${openPayroll.length} payroll masih terbuka`} />
      </section>

      <section className="grid-2 dashboard-middle">
        <div className="panel">
          <div className="panel-head"><div><h3>Perlu Perhatian</h3><p>Prioritas yang perlu ditindaklanjuti admin/owner.</p></div></div>
          <div className="dashboard-alert-list">
            {alerts.map(alert => (
              <button key={alert.key} className={`dashboard-alert ${alert.count > 0 ? 'warning' : 'ok'}`} onClick={() => onNavigate(alert.tab)}>
                <div className="dashboard-alert-count">{alert.count}</div>
                <div><strong>{alert.title}</strong><span>{alert.detail}</span></div>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><div><h3>Posisi Lainnya</h3><p>Nilai yang perlu dipantau di luar arus kas.</p></div></div>
          <div className="dashboard-position-grid">
            <button onClick={() => onNavigate('employeeReceivables')}><span>Piutang Karyawan</span><strong>{idr.format(employeeReceivableBalance)}</strong><small>{relevantReceivables.length} pencatatan · global</small></button>
            <button onClick={() => onNavigate('inventory')}><span>Pemakaian Barang</span><strong>{idr.format(inventoryUsageMonth)}</strong><small>{monthLabel}</small></button>
            <button onClick={() => onNavigate('accounting')}><span>Aset Tetap</span><strong>{idr.format(fixedAssetValue)}</strong><small>{activeAssets.length} aset aktif · nilai perolehan</small></button>
            <button onClick={() => onNavigate('tbs')}><span>Net Revenue TBS</span><strong>{idr.format(tbsRevenue)}</strong><small>{kgFormat.format(tbsKg)} kg</small></button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h3>Ringkasan per Kebun</h3><p>Perbandingan aktivitas {monthLabel} berdasarkan Cost Center.</p></div></div>
        {kebunRows.length === 0 ? <Empty text="Belum ada kebun aktif." /> : (
          <div className="table-wrap">
            <table className="dashboard-kebun-table">
              <thead><tr><th>Kebun</th><th className="right">Produksi TBS</th><th className="right">Pengeluaran</th><th className="right">Pembelian</th><th className="right">Pemakaian Barang</th></tr></thead>
              <tbody>
                {kebunRows.map(row => (
                  <tr key={row.id}>
                    <td><strong>{row.code} · {row.name}</strong><small>{row.location || 'Lokasi belum diisi'}</small></td>
                    <td className="right money">{kgFormat.format(row.tbsKg)} kg</td>
                    <td className="right money">{idr.format(row.expense)}</td>
                    <td className="right money">{idr.format(row.purchases)}</td>
                    <td className="right money">{idr.format(row.inventoryUsage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-head"><div><h3>Saldo Kas & Bank</h3><p>Saldo terkini berdasarkan seluruh mutasi.</p></div></div>
          {data.workspace.restrictedBalances ? (
            <div className="notice">Role Admin Kebun tidak menampilkan saldo total agar tidak memberi angka yang parsial atau menyesatkan.</div>
          ) : accountBalances.length === 0 ? (
            <Empty text="Belum ada akun kas atau bank." />
          ) : (
            <div className="account-list">
              {accountBalances.map(item => (
                <div className="account-row" key={item.id}>
                  <div className={`account-icon ${item.type.toLowerCase()}`}>{item.type === 'BANK' ? <Landmark size={18} /> : <Wallet size={18} />}</div>
                  <div><strong>{item.name}</strong><span>{item.type === 'BANK' ? item.bankName || 'Bank' : 'Kas'}</span></div>
                  <b>{idr.format(item.balance)}</b>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel">
          <div className="panel-head">
            <div><h3>Transaksi Terbaru</h3><p>Sesuai periode dan kebun yang dipilih.</p></div>
            <button className="text-btn" onClick={() => onNavigate('transactions')}>Lihat semua</button>
          </div>
          {recent.length === 0 ? <Empty text="Belum ada transaksi pada filter ini." /> : (
            <div className="recent-list">{recent.map(tx => <TransactionLine key={tx.id} tx={tx} data={data} />)}</div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, note }: { icon: typeof Wallet; label: string; value: string; note: string }) {
  return (
    <div className="metric">
      <div className="metric-icon"><Icon size={20} /></div>
      <span>{label}</span><strong>{value}</strong><small>{note}</small>
    </div>
  );
}

function Transactions({
  data,
  reload,
  flash,
  showError,
}: {
  data: Bootstrap;
  reload: () => Promise<void>;
  flash: (text: string) => void;
  showError: (text: string) => void;
}) {
  const allowedToTransact = canTransact(data.workspace.role);
  const allowedToTransfer = canTransfer(data.workspace.role);
  const transactionModeStorageKey = 'perkebunan.navigation.transactions.hub';
  const transactionModes = ['hub', 'transaction', 'transfer', 'ledger'] as const;
  type TransactionMode = (typeof transactionModes)[number];
  const storedTransactionMode = readStoredChoice(transactionModeStorageKey, transactionModes, 'hub');
  const [mode, setMode] = useState<TransactionMode>(() => storedTransactionMode === 'transfer' && !allowedToTransfer ? 'hub' : storedTransactionMode);
  const changeMode = (nextMode: TransactionMode) => {
    const safeMode: TransactionMode = nextMode === 'transfer' && !allowedToTransfer ? 'hub' : nextMode;
    setMode(safeMode);
    storeChoice(transactionModeStorageKey, safeMode);
  };
  const cashBankModeLabel = mode === 'transaction' ? 'Transaksi Lainnya' : mode === 'transfer' ? 'Transfer Antar Kas/Bank' : mode === 'ledger' ? 'Buku Kas & Bank' : 'Kas & Bank';
  const [form, setForm] = useState<TransactionForm>(blankTransactionForm());
  const [editId, setEditId] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transfer, setTransfer] = useState({
    date: today(),
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    description: '',
    reference: '',
  });
  const [filters, setFilters] = useState({
    search: '',
    kebunId: '',
    accountId: '',
    direction: '',
    category: '',
    dateFrom: '',
    dateTo: '',
  });
  const [postingAccounts, setPostingAccounts] = useState<AccountingAccount[]>([]);
  const [loadingPostingAccounts, setLoadingPostingAccounts] = useState(false);
  const [activeAccountPicker, setActiveAccountPicker] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const loadPostingAccounts = async () => {
      try {
        setLoadingPostingAccounts(true);
        const response = await api.get('/api/accounting/accounts');
        if (!active) return;
        setPostingAccounts((response.data as { accounts?: AccountingAccount[] }).accounts || []);
      } catch (err) {
        if (active) showError(apiError(err, 'Daftar akun COA belum dapat dimuat.'));
      } finally {
        if (active) setLoadingPostingAccounts(false);
      }
    };
    void loadPostingAccounts();
    return () => { active = false; };
  }, [data.workspace.id]);

  const postingOptions = postingAccounts
    .filter(item => (item.level ?? 4) === 4 && item.posting !== false && item.active !== false && !item.systemKey.startsWith('CASH:'))
    .sort((a, b) => a.code.localeCompare(b.code));
  const postingAccountMap = new Map(postingAccounts.map(item => [item.id, item]));
  const accountLabel = (account: AccountingAccount) => `${account.code} · ${account.name}`;
  const accountOptionsFor = (query: string, selectedId: string) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return postingOptions;
    return postingOptions.filter(account => account.id === selectedId || `${account.code} ${account.name}`.toLowerCase().includes(needle));
  };
  const transactionTotal = form.allocations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const allocationKebunId = (tx: Transaction, item: NonNullable<Transaction['allocations']>[number]) => item.kebunId === undefined ? tx.kebunId : item.kebunId;
  const transactionCostCenterIds = (tx: Transaction) => Array.from(new Set(tx.allocations?.length ? tx.allocations.map(item => allocationKebunId(tx, item)) : [tx.kebunId]));
  const transactionCostCenterLabel = (tx: Transaction) => {
    if (tx.kind === 'TRANSFER') return 'Transfer';
    const labels = transactionCostCenterIds(tx).map(id => id ? findKebun(data, id)?.name || '-' : 'Pusat / Umum');
    return labels.length > 1 ? `Multi Cost Center (${labels.length})` : labels[0] || 'Pusat / Umum';
  };
  const editing = editId ? data.transactions.find(tx => tx.id === editId) : undefined;
  const allCategories = Array.from(new Set(data.transactions.map(tx => tx.category).filter(Boolean))).sort();
  const search = filters.search.trim().toLowerCase();
  const rows = [...data.transactions]
    .filter(tx => {
      const haystack = [
        tx.transactionNumber || '',
        tx.category,
        tx.description,
        tx.reference,
        findKebun(data, tx.kebunId)?.name || '',
        findAccount(data, tx.accountId)?.name || '',
        ...(tx.allocations || []).flatMap(item => [item.memo, postingAccountMap.get(item.accountId)?.name || '', postingAccountMap.get(item.accountId)?.code || '', allocationKebunId(tx, item) ? findKebun(data, allocationKebunId(tx, item))?.name || '' : 'Pusat Umum']),
      ].join(' ').toLowerCase();
      return (
        (!search || haystack.includes(search)) &&
        (!filters.kebunId || (tx.allocations?.length ? tx.allocations.some(item => allocationKebunId(tx, item) === filters.kebunId) : tx.kebunId === filters.kebunId)) &&
        (!filters.accountId || tx.accountId === filters.accountId) &&
        (!filters.direction || tx.direction === filters.direction) &&
        (!filters.category || tx.category === filters.category) &&
        (!filters.dateFrom || tx.date >= filters.dateFrom) &&
        (!filters.dateTo || tx.date <= filters.dateTo)
      );
    })
    .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));

  const resetForm = () => {
    setForm(blankTransactionForm());
    setEditId('');
    setReceipt(null);
    setRemoveReceipt(false);
    setActiveAccountPicker(null);
  };

  const updateAllocation = (index: number, patch: Partial<CashAllocationForm>) => {
    setForm(current => ({ ...current, allocations: current.allocations.map((item, rowIndex) => rowIndex === index ? { ...item, ...patch } : item) }));
  };
  const addAllocation = () => setForm(current => ({ ...current, allocations: [...current.allocations, { accountId: '', kebunId: current.kebunId, amount: '', memo: '', search: '' }] }));
  const removeAllocation = (index: number) => setForm(current => ({ ...current, allocations: current.allocations.length === 1 ? current.allocations : current.allocations.filter((_, rowIndex) => rowIndex !== index) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allocations = form.allocations.map(item => ({ accountId: item.accountId, kebunId: item.kebunId, amount: Number(item.amount || 0), memo: item.memo.trim() }));
    const adminKebunMissingCostCenter = data.workspace.role === 'ADMIN_KEBUN' && allocations.some(item => !item.kebunId);
    if (!form.accountId || !form.date || allocations.length === 0 || allocations.some(item => !item.accountId || item.amount <= 0) || adminKebunMissingCostCenter || transactionTotal <= 0) {
      showError('Lengkapi tanggal, Kas/Bank, serta akun, Kebun/Cost Center dan nominal setiap rincian. Pusat/Umum dapat dipakai selain oleh Admin Kebun.');
      return;
    }
    if (receipt && receipt.size > 3 * 1024 * 1024) {
      showError('Ukuran bukti maksimal 3 MB.');
      return;
    }
    try {
      setSaving(true);
      const fileData = receipt ? await filePayload(receipt) : {};
      const payload = { ...form, allocations, amount: transactionTotal, removeReceipt, ...fileData };
      if (editId) await api.put(`/api/transactions/${editId}`, payload);
      else await api.post('/api/transactions', payload);
      resetForm();
      await reload();
      flash(editId ? 'Transaksi multi-akun berhasil diperbarui.' : 'Transaksi multi-akun berhasil disimpan.');
    } catch (err) {
      showError(apiError(err, editId ? 'Transaksi gagal diperbarui.' : 'Transaksi gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };

  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transfer.date || !transfer.fromAccountId || !transfer.toAccountId || Number(transfer.amount) <= 0) {
      showError('Lengkapi tanggal, akun asal, akun tujuan, dan nominal transfer.');
      return;
    }
    if (transfer.fromAccountId === transfer.toAccountId) {
      showError('Akun asal dan tujuan harus berbeda.');
      return;
    }
    try {
      setSaving(true);
      await api.post('/api/transfers', { ...transfer, amount: Number(transfer.amount) });
      setTransfer({ date: today(), fromAccountId: '', toAccountId: '', amount: '', description: '', reference: '' });
      await reload();
      flash('Transfer antar akun berhasil disimpan.');
    } catch (err) {
      showError(apiError(err, 'Transfer gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (tx: Transaction) => {
    if (tx.kind === 'TRANSFER') return;
    changeMode('transaction');
    setEditId(tx.id);
    setForm({
      date: tx.date,
      kebunId: tx.kebunId,
      accountId: tx.accountId,
      direction: tx.direction,
      description: tx.description || '',
      reference: tx.reference || '',
      allocations: tx.allocations?.length
        ? tx.allocations.map(item => ({ accountId: item.accountId, kebunId: item.kebunId === undefined ? tx.kebunId : item.kebunId, amount: String(item.amount), memo: item.memo || '', search: '' }))
        : [{ accountId: '', kebunId: tx.kebunId, amount: String(tx.amount), memo: tx.description || tx.category || '', search: '' }],
    });
    setReceipt(null);
    setRemoveReceipt(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (tx: Transaction) => {
    const isTransfer = tx.kind === 'TRANSFER' && tx.transferId;
    const question = isTransfer
      ? 'Hapus transfer ini? Mutasi keluar dan masuk akan dihapus bersamaan.'
      : 'Hapus transaksi ini? Saldo akan dihitung ulang otomatis.';
    if (!window.confirm(question)) return;
    try {
      if (isTransfer) await api.delete(`/api/transfers/${tx.transferId}`);
      else await api.delete(`/api/transactions/${tx.id}`);
      if (tx.id === editId) resetForm();
      await reload();
      flash(isTransfer ? 'Transfer berhasil dihapus.' : 'Transaksi berhasil dihapus.');
    } catch (err) {
      showError(apiError(err, 'Data gagal dihapus.'));
    }
  };

  const openReceipt = async (tx: Transaction) => {
    try {
      const res = await api.get(`/api/transactions/${tx.id}/receipt`);
      const url = (res.data as { url: string }).url;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      showError(apiError(err, 'Bukti transaksi belum dapat dibuka.'));
    }
  };

  const formPanel = allowedToTransact ? (
    <section className="panel form-panel">
      {mode === 'transaction' ? (
        <>
          <div className="panel-head">
            <div>
              <h3>{editId ? 'Edit Transaksi Lainnya' : 'Transaksi Kas/Bank Lainnya'}</h3>
              <p>{editId ? 'Perbarui transaksi tanpa membuat catatan baru.' : 'Hanya untuk transaksi kas/bank yang belum memiliki modul sumber. TBS, Pembelian, Payroll, Piutang dan Hutang dicatat dari modul masing-masing.'}</p>
            </div>
            {editId && <button className="text-btn" onClick={resetForm}>Batal edit</button>}
          </div>
          {data.accounts.length === 0 || (data.workspace.role === 'ADMIN_KEBUN' && data.kebun.length === 0) ? (
            <div className="notice">Tambahkan minimal 1 akun Kas/Bank{data.workspace.role === 'ADMIN_KEBUN' ? ' dan kebun yang dapat diakses' : ''} di Master Data sebelum mencatat transaksi.</div>
          ) : loadingPostingAccounts ? (
            <div className="notice">Memuat akun posting COA...</div>
          ) : postingOptions.length === 0 ? (
            <div className="notice">Belum ada akun posting Level 4 yang dapat dipilih. Terapkan atau lengkapi COA dari Akuntansi → COA & Setup terlebih dahulu.</div>
          ) : (
            <form className="form cash-entry-form" onSubmit={submit}>
              <div className="cash-entry-top">
                <div className="cash-entry-direction">
                  <div className="segmented">
                    <button type="button" className={form.direction === 'OUT' ? 'selected out' : ''} onClick={() => setForm(v => ({ ...v, direction: 'OUT' }))}>
                      <ArrowDownCircle size={17} /> Uang Keluar
                    </button>
                    <button type="button" className={form.direction === 'IN' ? 'selected in' : ''} onClick={() => setForm(v => ({ ...v, direction: 'IN' }))}>
                      <ArrowUpCircle size={17} /> Uang Masuk
                    </button>
                  </div>
                </div>
                <div className="cash-entry-main">
                  <Field label={form.direction === 'OUT' ? 'Kas / Bank Sumber Dana' : 'Kas / Bank Penerima'}>
                    <select value={form.accountId} onChange={e => setForm(v => ({ ...v, accountId: e.target.value }))}>
                      <option value="">Pilih akun Kas / Bank</option>
                      {data.accounts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Default Kebun / Cost Center">
                    <select value={form.kebunId} onChange={e => { const next = e.target.value; setForm(v => ({ ...v, kebunId: next, allocations: v.allocations.map(item => item.kebunId === v.kebunId ? { ...item, kebunId: next } : item) })); }}>
                      {data.workspace.role !== 'ADMIN_KEBUN' && <option value="">Pusat / Umum</option>}
                      {data.workspace.role === 'ADMIN_KEBUN' && <option value="">Pilih default kebun</option>}
                      {data.kebun.filter(item => item.status === 'AKTIF').map(item => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="cash-entry-meta">
                  <Field label="Tanggal"><input type="date" value={form.date} onChange={e => setForm(v => ({ ...v, date: e.target.value }))} /></Field>
                  <Field label="No. Referensi (opsional)"><input placeholder="Nota / invoice / transfer" value={form.reference} onChange={e => setForm(v => ({ ...v, reference: e.target.value }))} /></Field>
                  <Field label="Deskripsi"><input placeholder="Keterangan transaksi" value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} /></Field>
                </div>
              </div>
              <div className="cash-entry-lines">
                <div className="cash-entry-lines-title">
                  <div><strong>Rincian Akun Lawan</strong><span>{form.direction === 'OUT' ? 'Akun lawan didebit; Kas/Bank dikredit sebesar total.' : 'Kas/Bank didebit sebesar total; akun lawan dikredit.'}</span></div>
                </div>
                <div className="cash-entry-table-head">
                  <span>#</span><span>Akun</span><span>Kebun / Cost Center</span><span>Keterangan</span><span>Nominal</span><span></span>
                </div>
                <div className="cash-entry-rows">
                  {form.allocations.map((item, index) => {
                    const selectedAccount = postingAccountMap.get(item.accountId);
                    const selectedLabel = selectedAccount ? accountLabel(selectedAccount) : '';
                    const pickerValue = item.search || selectedLabel;
                    const matches = accountOptionsFor(item.search, item.accountId).slice(0, 40);
                    return (
                      <div className="cash-entry-row" key={index}>
                        <span className="cash-entry-row-index">{index + 1}</span>
                        <div className="cash-account-picker">
                          <input
                            type="text"
                            value={pickerValue}
                            placeholder="Ketik kode atau nama akun..."
                            autoComplete="off"
                            onFocus={event => { setActiveAccountPicker(index); event.currentTarget.select(); }}
                            onBlur={() => window.setTimeout(() => setActiveAccountPicker(current => current === index ? null : current), 120)}
                            onChange={event => {
                              const next = event.target.value;
                              updateAllocation(index, { search: next, accountId: next === selectedLabel ? item.accountId : '' });
                              setActiveAccountPicker(index);
                            }}
                            onKeyDown={event => {
                              if (event.key === 'Escape') setActiveAccountPicker(null);
                              if (event.key === 'Enter' && activeAccountPicker === index && matches[0]) {
                                event.preventDefault();
                                updateAllocation(index, { accountId: matches[0].id, search: accountLabel(matches[0]) });
                                setActiveAccountPicker(null);
                              }
                            }}
                          />
                          {activeAccountPicker === index && (
                            <div className="cash-account-options">
                              {matches.length === 0 ? <div className="cash-account-empty">Akun Level 4 tidak ditemukan.</div> : matches.map(account => (
                                <button
                                  type="button"
                                  key={account.id}
                                  onMouseDown={event => event.preventDefault()}
                                  onClick={() => {
                                    updateAllocation(index, { accountId: account.id, search: accountLabel(account) });
                                    setActiveAccountPicker(null);
                                  }}
                                >
                                  <strong>{account.code}</strong><span>{account.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <select className="cash-entry-cost-center" value={item.kebunId} onChange={e => updateAllocation(index, { kebunId: e.target.value })}>
                          {data.workspace.role !== 'ADMIN_KEBUN' && <option value="">Pusat / Umum</option>}
                          {data.workspace.role === 'ADMIN_KEBUN' && <option value="">Pilih kebun</option>}
                          {data.kebun.filter(kebun => kebun.status === 'AKTIF').map(kebun => <option key={kebun.id} value={kebun.id}>{kebun.code} - {kebun.name}</option>)}
                        </select>
                        <input className="cash-entry-cell-input" value={item.memo} onChange={e => updateAllocation(index, { memo: e.target.value })} placeholder="Keterangan akun" />
                        <input className="cash-entry-cell-input cash-entry-money" inputMode="numeric" value={formatMoneyInput(item.amount)} onChange={e => updateAllocation(index, { amount: e.target.value.replace(/[^0-9]/g, '') })} placeholder="0" />
                        <button type="button" className="icon-btn danger cash-entry-delete" disabled={form.allocations.length === 1} onClick={() => removeAllocation(index)} title="Hapus baris"><Trash2 size={15} /></button>
                      </div>
                    );
                  })}
                </div>
                <button type="button" className="cash-entry-add-row" onClick={addAllocation}><Plus size={15} /> Tambah Baris Baru</button>
                <div className="cash-entry-total"><span>Total {form.direction === 'OUT' ? 'Uang Keluar' : 'Uang Masuk'}</span><strong>{idr.format(transactionTotal)}</strong></div>
              </div>
              <label className="upload-box">
                <Upload size={18} />
                <div><strong>{receipt ? receipt.name : 'Upload bukti transaksi'}</strong><span>JPG, PNG, atau PDF · maks. 3 MB</span></div>
                <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={e => { setReceipt(e.target.files?.[0] || null); setRemoveReceipt(false); }} />
              </label>
              {editing?.receiptPath && !receipt && (
                <div className="receipt-meta">
                  <Paperclip size={15} />
                  <span>{removeReceipt ? 'Bukti lama akan dihapus saat disimpan.' : editing.receiptName || 'Bukti transaksi tersimpan'}</span>
                  <button type="button" className="text-btn" onClick={() => setRemoveReceipt(v => !v)}>{removeReceipt ? 'Batalkan' : 'Hapus bukti'}</button>
                </div>
              )}
              <button className="primary wide" disabled={saving}><Save size={18} /> {saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Simpan Transaksi'}</button>
            </form>
          )}
        </>
      ) : (
        <>
          <div className="panel-head"><div><h3>Transfer Kas / Bank</h3><p>Input sekali, mutasi keluar dan masuk dibuat otomatis.</p></div></div>
          {data.accounts.length < 2 ? (
            <div className="notice">Transfer membutuhkan minimal dua akun kas/bank.</div>
          ) : (
            <form className="form" onSubmit={submitTransfer}>
              <Field label="Tanggal"><input type="date" value={transfer.date} onChange={e => setTransfer(v => ({ ...v, date: e.target.value }))} /></Field>
              <Field label="Dari Akun">
                <select value={transfer.fromAccountId} onChange={e => setTransfer(v => ({ ...v, fromAccountId: e.target.value }))}>
                  <option value="">Pilih akun asal</option>
                  {data.accounts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Ke Akun">
                <select value={transfer.toAccountId} onChange={e => setTransfer(v => ({ ...v, toAccountId: e.target.value }))}>
                  <option value="">Pilih akun tujuan</option>
                  {data.accounts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Nominal">
                <input inputMode="numeric" placeholder="0" value={formatMoneyInput(transfer.amount)} onChange={e => setTransfer(v => ({ ...v, amount: e.target.value.replace(/[^0-9]/g, '') }))} />
              </Field>
              <Field label="Keterangan"><textarea rows={3} placeholder="Contoh: Pemindahan dana operasional" value={transfer.description} onChange={e => setTransfer(v => ({ ...v, description: e.target.value }))} /></Field>
              <Field label="No. Referensi (opsional)"><input value={transfer.reference} onChange={e => setTransfer(v => ({ ...v, reference: e.target.value }))} /></Field>
              <button className="primary wide" disabled={saving}><ArrowLeftRight size={18} /> {saving ? 'Menyimpan...' : 'Simpan Transfer'}</button>
            </form>
          )}
        </>
      )}
    </section>
  ) : (
    <section className="panel form-panel read-only-box">
      <ShieldCheck size={24} />
      <h3>Mode lihat saja</h3>
      <p>Role Viewer dapat melihat transaksi dan laporan, tetapi tidak dapat menambah, mengubah, atau menghapus data.</p>
    </section>
  );

  return (
    <div className="stack">
      {mode === 'hub' ? <>
        <section className="panel tbs-header">
          <div><span className="eyebrow dark">Kas & Bank</span><h2>Kas & Bank</h2><p>Pilih aktivitas Kas & Bank yang ingin dibuka. Transaksi dari modul lain tetap hanya tampil sebagai mutasi.</p></div>
        </section>
        <div className="master-hub"><section className="master-hub-group"><div className="master-hub-group-head"><div><strong>Kas & Bank</strong><span>Input transaksi lain, transfer internal, dan periksa buku kas/bank.</span></div></div><div className="master-hub-grid">
          <button type="button" className="master-hub-card" onClick={() => changeMode('transaction')}><span className="master-hub-card-icon"><CircleDollarSign size={24} /></span><span className="master-hub-card-copy"><strong>Transaksi Lainnya</strong><small>Kas masuk/keluar multi akun yang belum memiliki modul sumber.</small></span><ChevronRight size={18} /></button>
          {allowedToTransfer && <button type="button" className="master-hub-card" onClick={() => { changeMode('transfer'); resetForm(); }}><span className="master-hub-card-icon"><ArrowLeftRight size={24} /></span><span className="master-hub-card-copy"><strong>Transfer Antar Kas/Bank</strong><small>Pindahkan dana antar akun tanpa mencatat pendapatan atau beban.</small></span><ChevronRight size={18} /></button>}
          <button type="button" className="master-hub-card" onClick={() => changeMode('ledger')}><span className="master-hub-card-icon"><Landmark size={24} /></span><span className="master-hub-card-copy"><strong>Buku Kas & Bank</strong><small>Mutasi dan saldo berjalan untuk setiap akun Kas/Bank.</small></span><ChevronRight size={18} /></button>
        </div></section></div>
      </> : <section className="master-detail-nav"><div><span>Kas & Bank</span><ChevronRight size={14} /><strong>{cashBankModeLabel}</strong></div><button type="button" className="secondary small-btn" onClick={() => changeMode('hub')}>← Kembali ke Kas & Bank</button></section>}
      {mode !== 'hub' && (mode === 'ledger' ? <CashBankLedger data={data} /> : <div className={`grid-form-list ${allowedToTransact ? '' : 'readonly'}`}>
      {formPanel}
      <section className="panel list-panel">
        <div className="panel-head wrap">
          <div><h3>Riwayat Mutasi Kas & Bank</h3><p>{rows.length} mutasi sesuai filter, termasuk transaksi otomatis dari modul lain.</p></div>
          <button className="secondary small-btn" type="button" onClick={() => setFilters({ search: '', kebunId: '', accountId: '', direction: '', category: '', dateFrom: '', dateTo: '' })}>Reset Filter</button>
        </div>
        <div className="transaction-filters">
          <label className="search-input"><Search size={15} /><input placeholder="Cari nomor, keterangan, referensi..." value={filters.search} onChange={e => setFilters(v => ({ ...v, search: e.target.value }))} /></label>
          <select value={filters.kebunId} onChange={e => setFilters(v => ({ ...v, kebunId: e.target.value }))}>
            <option value="">Semua kebun</option>{data.kebun.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={filters.accountId} onChange={e => setFilters(v => ({ ...v, accountId: e.target.value }))}>
            <option value="">Semua akun</option>{data.accounts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={filters.direction} onChange={e => setFilters(v => ({ ...v, direction: e.target.value }))}>
            <option value="">Masuk & keluar</option><option value="IN">Uang masuk</option><option value="OUT">Uang keluar</option>
          </select>
          <select value={filters.category} onChange={e => setFilters(v => ({ ...v, category: e.target.value }))}>
            <option value="">Semua kategori</option>{allCategories.map(item => <option key={item}>{item}</option>)}
          </select>
          <input type="date" title="Dari tanggal" value={filters.dateFrom} onChange={e => setFilters(v => ({ ...v, dateFrom: e.target.value }))} />
          <input type="date" title="Sampai tanggal" value={filters.dateTo} onChange={e => setFilters(v => ({ ...v, dateTo: e.target.value }))} />
        </div>
        {rows.length === 0 ? <Empty text="Belum ada transaksi pada filter ini." /> : (
          <div className="table-wrap">
            <table className="transactions-table">
              <thead><tr><th>No. Transaksi</th><th>Tanggal</th><th>Kebun</th><th>Kategori</th><th>Akun</th><th className="right">Nominal</th><th>Bukti</th><th></th></tr></thead>
              <tbody>
                {rows.map(tx => (
                  <tr key={tx.id}>
                    <td><strong>{tx.transactionNumber || `LEGACY-${tx.id.slice(0, 6).toUpperCase()}`}</strong><small className="table-note">{tx.reference || '-'}</small></td>
                    <td>{formatDate(tx.date)}</td>
                    <td>{tx.kind === 'TRANSFER' ? <span className="muted">Transfer</span> : transactionCostCenterLabel(tx)}</td>
                    <td><span className={`pill ${tx.kind === 'TRANSFER' ? 'transfer' : tx.direction.toLowerCase()}`}>{tx.category}</span><small className="table-note">{tx.allocations?.length ? `${tx.allocations.map(item => postingAccountMap.get(item.accountId)?.name || 'Akun COA').join(' · ')}${tx.description ? ` · ${tx.description}` : ''}` : tx.description || '-'}</small></td>
                    <td>{findAccount(data, tx.accountId)?.name || '-'}</td>
                    <td className={`right money ${tx.direction.toLowerCase()}`}>{tx.direction === 'IN' ? '+' : '-'} {idr.format(tx.amount)}</td>
                    <td>
                      {tx.receiptPath && !tx.restrictedProjection ? <button className="icon-btn" onClick={() => openReceipt(tx)} title="Lihat bukti"><Paperclip size={16} /></button> : <span className="muted">-</span>}
                    </td>
                    <td>
                      {allowedToTransact && (
                        <div className="action-group">
                          {tx.kind !== 'TRANSFER' && !tx.sourceType && !tx.restrictedProjection && <button className="icon-btn" onClick={() => startEdit(tx)} title="Edit"><Pencil size={16} /></button>}
                          {!tx.sourceType && !tx.restrictedProjection && (tx.kind !== 'TRANSFER' || allowedToTransfer) && <button className="icon-btn danger" onClick={() => remove(tx)} title="Hapus"><Trash2 size={16} /></button>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </div>)}
    </div>
  );
}

function CashBankLedger({ data }: { data: Bootstrap }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [accountId, setAccountId] = useState(data.accounts[0]?.id || '');
  const account = data.accounts.find(item => item.id === accountId) || data.accounts[0];
  const transactions = account ? data.transactions.filter(tx => tx.accountId === account.id && isAfterAccountingCutoff(tx, data.accountingCutoffDate)).sort((a, b) => `${a.date}${a.createdAt}${a.id}`.localeCompare(`${b.date}${b.createdAt}${b.id}`)) : [];
  const beforeCutoff = Boolean(data.accountingCutoffDate && month && month < data.accountingCutoffDate.slice(0, 7));
  const periodStart = month ? `${month}-01` : '';
  const openingBalance = account ? account.openingBalance + transactions.filter(tx => periodStart && tx.date < periodStart).reduce((sum, tx) => sum + (tx.direction === 'IN' ? tx.amount : -tx.amount), 0) : 0;
  let runningBalance = openingBalance;
  const rows = transactions.filter(tx => !month || tx.date.startsWith(month)).map(tx => {
    runningBalance += tx.direction === 'IN' ? tx.amount : -tx.amount;
    return { tx, balance: runningBalance };
  });
  const income = rows.filter(row => row.tx.direction === 'IN').reduce((sum, row) => sum + row.tx.amount, 0);
  const expense = rows.filter(row => row.tx.direction === 'OUT').reduce((sum, row) => sum + row.tx.amount, 0);
  const closingBalance = rows.length ? rows[rows.length - 1].balance : openingBalance;
  const sourceLabel = (tx: Transaction) => {
    if (tx.kind === 'TRANSFER') return 'Transfer Antar Akun';
    if (tx.sourceType === 'EMPLOYEE_RECEIVABLE_DISBURSEMENT') return 'Piutang Karyawan';
    const ids = Array.from(new Set(tx.allocations?.length ? tx.allocations.map(item => item.kebunId === undefined ? tx.kebunId : item.kebunId) : [tx.kebunId]));
    if (ids.length > 1) return `Multi Cost Center (${ids.length})`;
    const kebun = data.kebun.find(item => item.id === ids[0]);
    return kebun ? `${kebun.code} - ${kebun.name}` : 'Pusat / Umum';
  };
  return <section className="panel">
    <div className="panel-head wrap"><div><h3>Buku Kas & Bank</h3><p>Subledger per akun Kas/Bank. Buku Besar Umum tetap tersedia di menu Akuntansi.</p></div><div className="filters"><input type="month" value={month} onChange={e => setMonth(e.target.value)} /><select value={account?.id || ''} onChange={e => setAccountId(e.target.value)}><option value="">Pilih Kas / Bank</option>{data.accounts.map(item => <option key={item.id} value={item.id}>{item.name} · {item.type}</option>)}</select></div></div>
    {!account ? <Empty text="Belum ada akun Kas/Bank." /> : beforeCutoff ? <div className="notice">Periode ini berada sebelum cut-off {data.accountingCutoffDate}. Buku Kas/Bank pascamigrasi dimulai dari Saldo Awal.</div> : <><div className="report-summary"><div><span>Saldo Awal Periode</span><strong>{idr.format(openingBalance)}</strong></div><div><span>Uang Masuk</span><strong className="in">{idr.format(income)}</strong></div><div><span>Uang Keluar</span><strong className="out">{idr.format(expense)}</strong></div><div><span>Saldo Akhir</span><strong>{idr.format(closingBalance)}</strong></div></div><div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>No. Transaksi</th><th>Keterangan</th><th>Sumber / Kebun</th><th className="right">Masuk</th><th className="right">Keluar</th><th className="right">Saldo</th></tr></thead><tbody><tr><td>{data.accountingCutoffDate && month === data.accountingCutoffDate.slice(0, 7) ? data.accountingCutoffDate : month ? `${month}-01` : data.accountingCutoffDate || '-'}</td><td>-</td><td><strong>{data.accountingOpeningPosted ? 'Saldo Awal / Cut-off' : 'Saldo Awal'}</strong></td><td>{account.name}</td><td className="right">-</td><td className="right">-</td><td className="right money"><strong>{idr.format(openingBalance)}</strong></td></tr>{rows.map(({ tx, balance }) => <tr key={tx.id}><td>{formatDate(tx.date)}</td><td><strong>{tx.transactionNumber || `LEGACY-${tx.id.slice(0, 6).toUpperCase()}`}</strong><small className="table-note">{tx.reference || '-'}</small></td><td><strong>{tx.category}</strong><small className="table-note">{tx.description || '-'}</small></td><td>{sourceLabel(tx)}</td><td className="right money in">{tx.direction === 'IN' ? idr.format(tx.amount) : '-'}</td><td className="right money out">{tx.direction === 'OUT' ? idr.format(tx.amount) : '-'}</td><td className="right money"><strong>{idr.format(balance)}</strong></td></tr>)}</tbody></table></div></>}
  </section>;
}

function Reports({ data }: { data: Bootstrap }) {
  // v89-report-grouping
  const reportPageStorageKey = 'perkebunan.navigation.reports.page';
  const reportPages = ['hub', 'financial', 'accounting', 'tbs', 'purchases', 'receivables', 'inventory', 'assets'] as const;
  type ReportPage = (typeof reportPages)[number];
  const [reportPage, setReportPage] = useState<ReportPage>('hub');
  const changeReportPage = (nextPage: ReportPage) => {
    setReportPage(nextPage);
    storeChoice(reportPageStorageKey, nextPage);
  };

  const reportModeStorageKey = 'perkebunan.navigation.reports.financial';
  const reportModeOptions = ['income', 'balance'] as const;
  const [reportMode, setReportMode] = useState<(typeof reportModeOptions)[number]>(() => readStoredChoice(reportModeStorageKey, reportModeOptions, 'income'));
  const changeReportMode = (nextMode: (typeof reportModeOptions)[number]) => {
    setReportMode(nextMode);
    storeChoice(reportModeStorageKey, nextMode);
  };

  // v85-report-card-submenu
  const [expandedReportCard, setExpandedReportCard] = useState<ReportPage | null>(null);
  const openFinancialReport = (nextMode: (typeof reportModeOptions)[number]) => {
    changeReportMode(nextMode);
    changeReportPage('financial');
  };

  // v88-move-accounting-reports
  const accountingReportModeStorageKey = 'perkebunan.navigation.reports.accounting';
  const accountingReportModeOptions = ['journals', 'ledger', 'trial'] as const;
  const [accountingReportMode, setAccountingReportMode] = useState<AccountingReportMode>(() => readStoredChoice(accountingReportModeStorageKey, accountingReportModeOptions, 'journals'));
  const openAccountingReport = (nextMode: AccountingReportMode) => {
    setAccountingReportMode(nextMode);
    storeChoice(accountingReportModeStorageKey, nextMode);
    changeReportPage('accounting');
  };

  type InventoryReportGroup = { id: string; code: string; name: string };
  type InventoryReportUnit = { id: string; code: string; name: string };
  type InventoryReportItem = { id: string; code: string; name: string; groupId: string; unitId: string; currentQuantity: number; averageCost: number; stockValue: number; active: boolean };
  type InventoryReportWarehouse = { id: string; code: string; name: string; active: boolean };
  type FixedAssetReportGroup = { id: string; code: string; name: string };
  type FixedAssetReportItem = { id: string; code: string; name: string; groupId: string; kebunId: string; location: string; acquisitionDate: string; availableForUseDate: string; acquisitionCost: number; residualValue: number; usefulLifeMonths: number; depreciationMethod: string; openingAccumulatedDepreciation: number; status: 'ACTIVE' | 'DISPOSED' | 'WRITTEN_OFF' };

  const [inventoryReport, setInventoryReport] = useState<{ groups: InventoryReportGroup[]; units: InventoryReportUnit[]; items: InventoryReportItem[]; warehouses: InventoryReportWarehouse[] } | null>(null);
  const [assetReport, setAssetReport] = useState<{ groups: FixedAssetReportGroup[]; assets: FixedAssetReportItem[]; openingDepreciationThroughDate?: string } | null>(null);
  const [reportDataLoading, setReportDataLoading] = useState(false);
  const [reportDataError, setReportDataError] = useState('');

  useEffect(() => {
    if (reportPage !== 'inventory' || inventoryReport) return;
    let active = true;
    setReportDataLoading(true);
    setReportDataError('');
    api.get('/api/inventory/master')
      .then(response => {
        if (!active) return;
        const payload = response.data as { groups?: InventoryReportGroup[]; units?: InventoryReportUnit[]; items?: InventoryReportItem[]; warehouses?: InventoryReportWarehouse[] };
        setInventoryReport({ groups: payload.groups || [], units: payload.units || [], items: payload.items || [], warehouses: payload.warehouses || [] });
      })
      .catch(() => { if (active) setReportDataError('Laporan Persediaan belum dapat dimuat. Coba Refresh lalu buka kembali.'); })
      .finally(() => { if (active) setReportDataLoading(false); });
    return () => { active = false; };
  }, [reportPage, inventoryReport]);

  useEffect(() => {
    if (reportPage !== 'assets' || assetReport) return;
    let active = true;
    setReportDataLoading(true);
    setReportDataError('');
    api.get('/api/fixed-assets/master')
      .then(response => {
        if (!active) return;
        const payload = response.data as { groups?: FixedAssetReportGroup[]; assets?: FixedAssetReportItem[]; openingDepreciationThroughDate?: string };
        setAssetReport({ groups: payload.groups || [], assets: payload.assets || [], openingDepreciationThroughDate: payload.openingDepreciationThroughDate || '' });
      })
      .catch(() => { if (active) setReportDataError('Laporan Aset Tetap belum dapat dimuat. Coba Refresh lalu buka kembali.'); })
      .finally(() => { if (active) setReportDataLoading(false); });
    return () => { active = false; };
  }, [reportPage, assetReport]);

  const [kebunId, setKebunId] = useState('');
  const [month, setMonth] = useState(today().slice(0, 7));
  const tbsRows = data.tbs.filter(item => (!kebunId || item.kebunId === kebunId) && (!month || item.date.startsWith(month)));
  const tbsRevenue = tbsRows.reduce((sum, item) => sum + item.netRevenue, 0);
  const tbsHarvestCost = tbsRows.reduce((sum, item) => sum + item.harvestCost, 0);
  const tbsLangsirCost = tbsRows.reduce((sum, item) => sum + item.langsirCost, 0);
  const tbsTransportCost = tbsRows.reduce((sum, item) => sum + item.transportCost, 0);
  const tbsDirectCost = tbsRows.reduce((sum, item) => sum + item.directCost, 0);
  const workRows = data.workEntries.filter(item => (!kebunId || item.kebunId === kebunId) && (!month || item.date.startsWith(month)));
  const workCost = workRows.reduce((sum, item) => sum + item.amount, 0);
  const tbsMargin = tbsRevenue - tbsDirectCost;
  const marginAfterWork = tbsMargin - workCost;
  const fieldKg = tbsRows.reduce((sum, item) => sum + item.fieldWeightKg, 0);
  const net1For = (item: TbsRecord) => item.factoryNet1WeightKg ?? item.factoryGrossWeightKg ?? (item.factoryWeightKg + (item.factoryDeductionKg ?? 0));
  const factoryNet1Kg = tbsRows.reduce((sum, item) => sum + net1For(item), 0);
  const factoryDeductionKg = tbsRows.reduce((sum, item) => sum + (item.factoryDeductionKg ?? 0), 0);
  const factoryKg = tbsRows.reduce((sum, item) => sum + item.factoryWeightKg, 0);
  const tbsDoCount = new Set(tbsRows.map(item => `${item.millId}:${item.doNumber.trim().toUpperCase()}`)).size;
  const tbsByKebun = data.kebun.map(kebun => {
    const items = tbsRows.filter(item => item.kebunId === kebun.id);
    return {
      kebun,
      revenue: items.reduce((sum, item) => sum + item.netRevenue, 0),
      harvest: items.reduce((sum, item) => sum + item.harvestCost, 0),
      langsir: items.reduce((sum, item) => sum + item.langsirCost, 0),
      transport: items.reduce((sum, item) => sum + item.transportCost, 0),
      work: workRows.filter(row => row.kebunId === kebun.id).reduce((sum, row) => sum + row.amount, 0),
      margin: items.reduce((sum, item) => sum + item.margin, 0) - workRows.filter(row => row.kebunId === kebun.id).reduce((sum, row) => sum + row.amount, 0),
      factoryNet1Kg: items.reduce((sum, item) => sum + net1For(item), 0),
      factoryDeductionKg: items.reduce((sum, item) => sum + (item.factoryDeductionKg ?? 0), 0),
      factoryKg: items.reduce((sum, item) => sum + item.factoryWeightKg, 0),
      count: items.length,
    };
  }).filter(item => item.count > 0 || !kebunId);

  const supplierMap = useMemo(() => new Map(data.suppliers.map(item => [item.id, item])), [data.suppliers]);
  const kebunMap = useMemo(() => new Map(data.kebun.map(item => [item.id, item])), [data.kebun]);
  const workerMap = useMemo(() => new Map(data.harvesters.map(item => [item.id, item])), [data.harvesters]);

  const purchaseBills = data.supplierBills.filter(item => item.sourceType === 'PURCHASE_INVOICE' && (!month || item.date.startsWith(month)) && (!kebunId || item.kebunId === kebunId));
  const purchasePaidByBill = new Map<string, number>();
  for (const payment of data.supplierPayments) {
    for (const allocation of payment.allocations || []) purchasePaidByBill.set(allocation.billId, (purchasePaidByBill.get(allocation.billId) || 0) + allocation.amount);
  }
  const purchaseAmount = purchaseBills.reduce((sum, item) => sum + item.amount, 0);
  const purchasePaid = purchaseBills.reduce((sum, item) => sum + Math.min(item.amount, purchasePaidByBill.get(item.id) || 0), 0);
  const purchaseOutstanding = purchaseAmount - purchasePaid;

  const receivableRows = data.employeeReceivables
    .filter(item => (!month || item.date.startsWith(month)))
    .map(item => {
      const deducted = data.payrollRuns.filter(run => run.status === 'PAID').flatMap(run => run.lines || []).filter(line => line.sourceType === 'EMPLOYEE_RECEIVABLE' && line.sourceId === item.id).reduce((sum, line) => sum + line.amount, 0);
      return { ...item, deducted: Math.min(item.totalAmount, deducted), outstanding: Math.max(0, item.totalAmount - deducted) };
    });
  const receivableAmount = receivableRows.reduce((sum, item) => sum + item.totalAmount, 0);
  const receivableDeducted = receivableRows.reduce((sum, item) => sum + item.deducted, 0);
  const receivableOutstanding = receivableRows.reduce((sum, item) => sum + item.outstanding, 0);

  const reportCards = [
    { id: 'financial' as const, title: 'Laporan Keuangan', description: 'Laba Rugi, Neraca dan Neraca Saldo berdasarkan COA dan jurnal.', icon: Landmark },
    { id: 'accounting' as const, title: 'Laporan Buku Besar', description: 'Daftar jurnal dan buku besar per akun.', icon: BookOpen },
    { id: 'tbs' as const, title: 'Laporan Panen dan TBS', description: 'Tonase, pendapatan, biaya langsung dan margin per kebun.', icon: Sprout },
    { id: 'purchases' as const, title: 'Laporan Pembelian', description: 'Invoice supplier, pembayaran dan saldo hutang pembelian.', icon: ShoppingCart },
    { id: 'receivables' as const, title: 'Laporan Piutang Karyawan', description: 'Nilai piutang, potongan payroll dan saldo tersisa.', icon: Wallet },
    { id: 'inventory' as const, title: 'Laporan Persediaan Barang', description: 'Stok, HPP average dan nilai persediaan per barang.', icon: PackageMinus },
    { id: 'assets' as const, title: 'Laporan Aset Tetap', description: 'Register aset, nilai perolehan, akumulasi dan nilai buku awal.', icon: ClipboardList },
  ];

  const pageTitle: Record<Exclude<ReportPage, 'hub'>, string> = {
    financial: 'Laporan Keuangan',
    accounting: 'Laporan Buku Besar',
    tbs: 'Laporan Panen dan TBS',
    purchases: 'Laporan Pembelian',
    receivables: 'Laporan Piutang Karyawan',
    inventory: 'Laporan Persediaan Barang',
    assets: 'Laporan Aset Tetap',
  };

  if (reportPage === 'hub') return <div className="stack">
    <section className="panel tbs-header"><div><span className="eyebrow dark">Pelaporan</span><h2>Laporan</h2><p>Pilih kelompok laporan yang ingin dibuka. Setiap laporan dipisahkan agar tampilan lebih ringkas dan mudah digunakan di laptop maupun HP.</p></div></section>
    <div className="master-hub">
      <section className="master-hub-group">
        <div className="master-hub-group-head"><div><strong>Daftar Laporan</strong><span>Laporan keuangan dan laporan operasional perkebunan.</span></div></div>
        <div className="master-hub-grid">
          {reportCards.map(item => {
            const Icon = item.icon;
            if (item.id !== 'financial' && item.id !== 'accounting') return <button key={item.id} type="button" className="master-hub-card" onClick={() => changeReportPage(item.id)}>
              <span className="master-hub-card-icon"><Icon size={22} /></span>
              <span className="master-hub-card-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
              <ChevronRight size={18} />
            </button>;
            const expanded = expandedReportCard === item.id;
            return <div key={item.id} className={`report-hub-card-wrap ${expanded ? 'expanded' : ''}`}>
              <button type="button" className="master-hub-card report-hub-card-toggle" aria-expanded={expanded} onClick={() => setExpandedReportCard(current => current === item.id ? null : item.id)}>
                <span className="master-hub-card-icon"><Icon size={22} /></span>
                <span className="master-hub-card-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
                <ChevronRight size={18} className={`report-hub-chevron ${expanded ? 'open' : ''}`} />
              </button>
              {expanded && <div className="report-submenu">
                {item.id === 'financial' ? <>
                  <button type="button" onClick={() => openFinancialReport('income')}><span className="report-submenu-mark">•</span><span>Laba Rugi Standar</span><ChevronRight size={16} /></button>
                  <button type="button" onClick={() => openFinancialReport('balance')}><span className="report-submenu-mark">•</span><span>Neraca</span><ChevronRight size={16} /></button>
                  <button type="button" onClick={() => openAccountingReport('trial')}><span className="report-submenu-mark">•</span><span>Neraca Saldo</span><ChevronRight size={16} /></button>
                </> : <>
                  <button type="button" onClick={() => openAccountingReport('journals')}><span className="report-submenu-mark">•</span><span>Daftar Jurnal</span><ChevronRight size={16} /></button>
                  <button type="button" onClick={() => openAccountingReport('ledger')}><span className="report-submenu-mark">•</span><span>Buku Besar</span><ChevronRight size={16} /></button>
                </>}
              </div>}
            </div>;
          })}
        </div>
      </section>
    </div>
  </div>;

  const detailNav = <section className="master-detail-nav"><div><span>Laporan</span><ChevronRight size={14} /><strong>{pageTitle[reportPage]}</strong></div><button type="button" className="secondary small-btn" onClick={() => changeReportPage('hub')}>← Kembali ke Laporan</button></section>;

  // v86-report-detail-cleanup
  if (reportPage === 'financial') return <div className="stack">
    <section className="master-detail-nav">
      <div><span>Laporan</span><ChevronRight size={14} /><span>Laporan Keuangan</span><ChevronRight size={14} /><strong>{reportMode === 'income' ? 'Laba Rugi Standar' : 'Neraca'}</strong></div>
      <button type="button" className="secondary small-btn" onClick={() => changeReportPage('hub')}>← Kembali ke Laporan</button>
    </section>
    <FinancialStatements data={data} mode={reportMode} />
  </div>;

  if (reportPage === 'accounting') return <div className="stack">
    <section className="master-detail-nav">
      <div><span>Laporan</span><ChevronRight size={14} /><span>{accountingReportMode === 'trial' ? 'Laporan Keuangan' : 'Laporan Buku Besar'}</span><ChevronRight size={14} /><strong>{accountingReportMode === 'journals' ? 'Daftar Jurnal' : accountingReportMode === 'ledger' ? 'Buku Besar' : 'Neraca Saldo'}</strong></div>
      <button type="button" className="secondary small-btn" onClick={() => changeReportPage('hub')}>← Kembali ke Laporan</button>
    </section>
    <AccountingReports data={data} mode={accountingReportMode} />
  </div>;

  if (reportPage === 'tbs') return <div className="stack">
    {detailNav}
    <section className="panel">
      <div className="panel-head wrap">
        <div><span className="eyebrow dark">Panen & TBS</span><h3>Pendapatan & Biaya Langsung TBS</h3><p>Pengakuan pendapatan berdasarkan timbangan pabrik. Laporan ini bersifat operasional/akrual dan dipisahkan dari arus kas.</p></div>
        <div className="filters">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
          <select value={kebunId} onChange={e => setKebunId(e.target.value)}><option value="">Semua kebun</option>{data.kebun.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </div>
      </div>
      <div className="report-summary">
        <div><span>Pendapatan TBS Bersih</span><strong className="in">{idr.format(tbsRevenue)}</strong></div>
        <div><span>Biaya Langsung TBS</span><strong className="out">{idr.format(tbsDirectCost)}</strong></div>
        <div><span>Pekerjaan Kebun</span><strong className="out">{idr.format(workCost)}</strong></div>
        <div><span>Margin Setelah Pekerjaan</span><strong>{idr.format(marginAfterWork)}</strong></div>
        <div><span>Berat Pabrik Netto 2</span><strong>{formatKg(factoryKg)}</strong><small>Netto 1 {formatKg(factoryNet1Kg)} · Potongan {formatKg(factoryDeductionKg)} · Lapangan {formatKg(fieldKg)}</small></div>
      </div>
      <div className="cost-strip"><span>Panen <b>{idr.format(tbsHarvestCost)}</b></span><span>Langsir <b>{idr.format(tbsLangsirCost)}</b></span><span>Armada <b>{idr.format(tbsTransportCost)}</b></span><span>Pekerjaan <b>{idr.format(workCost)}</b></span><span>DO <b>{tbsDoCount}</b></span></div>
      {tbsByKebun.length === 0 ? <Empty text="Belum ada data TBS pada periode/filter ini." /> : <div className="table-wrap"><table className="tbs-report-table"><thead><tr><th>Kebun</th><th className="right">Kg Netto 1</th><th className="right">Potongan Kg</th><th className="right">Kg Netto 2</th><th className="right">Pendapatan</th><th className="right">Panen</th><th className="right">Langsir</th><th className="right">Armada</th><th className="right">Pekerjaan</th><th className="right">Margin</th></tr></thead><tbody>{tbsByKebun.map(item => <tr key={item.kebun.id}><td><strong>{item.kebun.name}</strong><small className="table-note">{item.kebun.code}</small></td><td className="right">{formatKg(item.factoryNet1Kg)}</td><td className="right">{formatKg(item.factoryDeductionKg)}</td><td className="right">{formatKg(item.factoryKg)}</td><td className="right money in">{idr.format(item.revenue)}</td><td className="right">{idr.format(item.harvest)}</td><td className="right">{idr.format(item.langsir)}</td><td className="right">{idr.format(item.transport)}</td><td className="right">{idr.format(item.work)}</td><td className="right money">{idr.format(item.margin)}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;

  if (reportPage === 'purchases') return <div className="stack">
    {detailNav}
    <section className="panel">
      <div className="panel-head wrap"><div><span className="eyebrow dark">Pembelian</span><h3>Laporan Pembelian</h3><p>Rekap invoice pembelian dan pembayaran supplier berdasarkan periode transaksi.</p></div><div className="filters"><input type="month" value={month} onChange={e => setMonth(e.target.value)} /><select value={kebunId} onChange={e => setKebunId(e.target.value)}><option value="">Semua kebun</option>{data.kebun.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
      <div className="report-summary"><div><span>Jumlah Invoice</span><strong>{purchaseBills.length}</strong></div><div><span>Total Pembelian</span><strong>{idr.format(purchaseAmount)}</strong></div><div><span>Sudah Dibayar</span><strong className="in">{idr.format(purchasePaid)}</strong></div><div><span>Outstanding</span><strong className="out">{idr.format(purchaseOutstanding)}</strong></div></div>
      {purchaseBills.length === 0 ? <Empty text="Belum ada invoice pembelian pada periode/filter ini." /> : <div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Invoice</th><th>Supplier</th><th>Kebun / Cost Center</th><th className="right">Nilai</th><th className="right">Dibayar</th><th className="right">Outstanding</th></tr></thead><tbody>{purchaseBills.map(item => { const paid = Math.min(item.amount, purchasePaidByBill.get(item.id) || 0); const outstanding = Math.max(0, item.amount - paid); return <tr key={item.id}><td>{formatDate(item.date)}</td><td><strong>{item.invoiceNumber || '-'}</strong><small className="table-note">Jatuh tempo {formatDate(item.dueDate)}</small></td><td>{supplierMap.get(item.supplierId)?.name || '-'}</td><td>{kebunMap.get(item.kebunId)?.name || 'Pusat / Umum'}</td><td className="right money">{idr.format(item.amount)}</td><td className="right money in">{idr.format(paid)}</td><td className="right money out">{idr.format(outstanding)}</td></tr>; })}</tbody></table></div>}
    </section>
  </div>;

  if (reportPage === 'receivables') return <div className="stack">
    {detailNav}
    <section className="panel">
      <div className="panel-head wrap"><div><span className="eyebrow dark">Piutang Karyawan</span><h3>Laporan Piutang Karyawan</h3><p>Rekap pencairan piutang dan potongan payroll yang sudah dibayar.</p></div><div className="filters"><input type="month" value={month} onChange={e => setMonth(e.target.value)} /></div></div>
      <div className="report-summary"><div><span>Jumlah Piutang</span><strong>{receivableRows.length}</strong></div><div><span>Nilai Piutang</span><strong>{idr.format(receivableAmount)}</strong></div><div><span>Potongan Payroll</span><strong className="in">{idr.format(receivableDeducted)}</strong></div><div><span>Sisa Piutang</span><strong className="out">{idr.format(receivableOutstanding)}</strong></div></div>
      {receivableRows.length === 0 ? <Empty text="Belum ada piutang karyawan pada periode ini." /> : <div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Karyawan</th><th>Keterangan</th><th>Angsuran</th><th className="right">Nilai Piutang</th><th className="right">Terpotong</th><th className="right">Sisa</th></tr></thead><tbody>{receivableRows.map(item => <tr key={item.id}><td>{formatDate(item.date)}</td><td><strong>{workerMap.get(item.workerId)?.name || '-'}</strong></td><td>{item.description || item.note || '-'}</td><td>{item.installmentCount || '-'}x</td><td className="right money">{idr.format(item.totalAmount)}</td><td className="right money in">{idr.format(item.deducted)}</td><td className="right money out">{idr.format(item.outstanding)}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;

  if (reportPage === 'inventory') {
    const groups = inventoryReport?.groups || [];
    const units = inventoryReport?.units || [];
    const items = (inventoryReport?.items || []).filter(item => item.active !== false);
    const groupMap = new Map<string, InventoryReportGroup>(groups.map(item => [item.id, item] as const));
    const unitMap = new Map<string, InventoryReportUnit>(units.map(item => [item.id, item] as const));
    const totalStockValue = items.reduce((sum, item) => sum + Number(item.stockValue || 0), 0);
    const positiveStockItems = items.filter(item => Number(item.currentQuantity || 0) !== 0).length;
    return <div className="stack">
      {detailNav}
      <section className="panel">
        <div className="panel-head"><div><span className="eyebrow dark">Persediaan Barang</span><h3>Laporan Persediaan Barang</h3><p>Posisi stok, HPP average dan nilai persediaan berdasarkan master persediaan saat ini.</p></div></div>
        {reportDataError && <div className="notice">{reportDataError}</div>}
        {reportDataLoading && !inventoryReport ? <div className="empty"><span>Memuat laporan persediaan...</span></div> : <>
          <div className="report-summary"><div><span>Barang Aktif</span><strong>{items.length}</strong></div><div><span>Barang Ada Saldo</span><strong>{positiveStockItems}</strong></div><div><span>Gudang Aktif</span><strong>{(inventoryReport?.warehouses || []).filter(item => item.active !== false).length}</strong></div><div><span>Nilai Persediaan</span><strong>{idr.format(totalStockValue)}</strong></div></div>
          {items.length === 0 ? <Empty text="Belum ada master barang persediaan." /> : <div className="table-wrap"><table><thead><tr><th>Kode / Barang</th><th>Kelompok</th><th>Satuan</th><th className="right">Stok</th><th className="right">HPP Average</th><th className="right">Nilai Persediaan</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><strong>{item.code}</strong><small className="table-note">{item.name}</small></td><td>{groupMap.get(item.groupId)?.name || '-'}</td><td>{unitMap.get(item.unitId)?.code || unitMap.get(item.unitId)?.name || '-'}</td><td className="right">{Number(item.currentQuantity || 0).toLocaleString('id-ID', { maximumFractionDigits: 4 })}</td><td className="right money">{idr.format(Number(item.averageCost || 0))}</td><td className="right money">{idr.format(Number(item.stockValue || 0))}</td></tr>)}</tbody></table></div>}
        </>}
      </section>
    </div>;
  }

  const assetGroups = assetReport?.groups || [];
  const assets = (assetReport?.assets || []).filter(item => !kebunId || item.kebunId === kebunId);
  const assetGroupMap = new Map<string, FixedAssetReportGroup>(assetGroups.map(item => [item.id, item] as const));
  const assetAcquisition = assets.reduce((sum, item) => sum + Number(item.acquisitionCost || 0), 0);
  const assetAccumulated = assets.reduce((sum, item) => sum + Number(item.openingAccumulatedDepreciation || 0), 0);
  const assetBookValue = assetAcquisition - assetAccumulated;
  return <div className="stack">
    {detailNav}
    <section className="panel">
      <div className="panel-head wrap"><div><span className="eyebrow dark">Aset Tetap</span><h3>Laporan Aset Tetap</h3><p>Register aset dan nilai buku awal berdasarkan master Aset Tetap.</p></div><div className="filters"><select value={kebunId} onChange={e => setKebunId(e.target.value)}><option value="">Semua kebun / pusat</option>{data.kebun.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
      {reportDataError && <div className="notice">{reportDataError}</div>}
      {reportDataLoading && !assetReport ? <div className="empty"><span>Memuat laporan aset tetap...</span></div> : <>
        <div className="report-summary"><div><span>Jumlah Aset</span><strong>{assets.length}</strong></div><div><span>Harga Perolehan</span><strong>{idr.format(assetAcquisition)}</strong></div><div><span>Akumulasi Penyusutan Awal</span><strong className="out">{idr.format(assetAccumulated)}</strong><small>{assetReport?.openingDepreciationThroughDate ? `s.d. ${formatDate(assetReport.openingDepreciationThroughDate)}` : 'berdasarkan saldo awal'}</small></div><div><span>Nilai Buku Awal</span><strong>{idr.format(assetBookValue)}</strong></div></div>
        {assets.length === 0 ? <Empty text="Belum ada Aset Tetap pada filter ini." /> : <div className="table-wrap"><table><thead><tr><th>Kode / Aset</th><th>Kelompok</th><th>Kebun / Lokasi</th><th>Tanggal Siap Digunakan</th><th>Metode</th><th className="right">Perolehan</th><th className="right">Akumulasi Awal</th><th className="right">Nilai Buku Awal</th><th>Status</th></tr></thead><tbody>{assets.map(item => <tr key={item.id}><td><strong>{item.code}</strong><small className="table-note">{item.name}</small></td><td>{assetGroupMap.get(item.groupId)?.name || '-'}</td><td>{kebunMap.get(item.kebunId)?.name || 'Pusat / Umum'}<small className="table-note">{item.location || '-'}</small></td><td>{formatDate(item.availableForUseDate)}</td><td>{item.depreciationMethod === 'STRAIGHT_LINE' ? 'Garis Lurus' : item.depreciationMethod === 'NONE' ? 'Tidak Disusutkan' : item.depreciationMethod === 'DECLINING_BALANCE' ? 'Saldo Menurun' : 'Unit Produksi'}</td><td className="right money">{idr.format(item.acquisitionCost)}</td><td className="right money out">{idr.format(item.openingAccumulatedDepreciation || 0)}</td><td className="right money">{idr.format(Math.max(0, item.acquisitionCost - (item.openingAccumulatedDepreciation || 0)))}</td><td><span className={`status ${item.status === 'ACTIVE' ? 'active' : ''}`}>{item.status === 'ACTIVE' ? 'AKTIF' : item.status === 'DISPOSED' ? 'DILEPAS' : 'DIHAPUSKAN'}</span></td></tr>)}</tbody></table></div>}
      </>}
    </section>
  </div>;
}

function MasterData({ data, reload, flash, showError }: { data: Bootstrap; reload: () => Promise<void>; flash: (text: string) => void; showError: (text: string) => void }) {
  const masterStorageKey = 'perkebunan.navigation.master';
  const masterPages = ['hub', 'kebun', 'cashBank', 'pks', 'vehicles', 'tbsRates', 'workers', 'workTypes', 'workRates', 'inventoryGroups', 'inventoryUnits', 'inventoryItems', 'inventoryWarehouses', 'fixedAssetGroups', 'fixedAssets'] as const;
  type MasterPage = (typeof masterPages)[number];
  const [masterPage, setMasterPage] = useState<MasterPage>(() => readStoredChoice(masterStorageKey, masterPages, 'hub'));
  const changeMasterPage = (next: MasterPage) => { setMasterPage(next); storeChoice(masterStorageKey, next); };
  const masterGroups = [
    { label: 'Umum', description: 'Identitas kebun dan sumber dana.', items: [
      { id: 'kebun' as const, title: 'Data Kebun', description: 'Kode, pemilik, lokasi, luas dan jumlah pohon.', icon: Building2 },
      { id: 'cashBank' as const, title: 'Kas & Bank', description: 'Master rekening bank dan kas operasional.', icon: Landmark },
    ] },
    { label: 'TBS', description: 'Master yang dipakai proses panen dan penjualan TBS.', items: [
      { id: 'pks' as const, title: 'Data PKS', description: 'Pabrik tujuan penjualan TBS.', icon: Sprout },
      { id: 'vehicles' as const, title: 'Data Armada', description: 'Armada sendiri maupun vendor angkutan.', icon: Truck },
      { id: 'tbsRates' as const, title: 'Tarif TBS', description: 'Tarif panen, timbang dan langsir per kebun.', icon: CircleDollarSign },
    ] },
    { label: 'SDM', description: 'Master pekerja yang digunakan lintas modul.', items: [
      { id: 'workers' as const, title: 'Tenaga Kerja', description: 'Pemanen, pekerja kebun dan Payroll.', icon: UsersRound },
    ] },
    { label: 'Pekerjaan Kebun', description: 'Jenis pekerjaan dan tarif efektifnya.', items: [
      { id: 'workTypes' as const, title: 'Master Pekerjaan', description: 'Nama pekerjaan dan satuan yang fleksibel.', icon: ClipboardList },
      { id: 'workRates' as const, title: 'Tarif Pekerjaan', description: 'Tarif per kebun dan tanggal berlaku.', icon: Banknote },
    ] },
    { label: 'Persediaan', description: 'Struktur barang yang digunakan pada Pembelian dan stok.', items: [
      { id: 'inventoryGroups' as const, title: 'Kelompok Barang', description: 'Sifat Dibeli/Disimpan/Dijual dan mapping akun.', icon: ShoppingCart },
      { id: 'inventoryUnits' as const, title: 'Satuan Barang', description: 'Kg, liter, sak, pcs, unit dan satuan lain.', icon: CircleDollarSign },
      { id: 'inventoryItems' as const, title: 'Master Barang', description: 'Kode, nama, kelompok, satuan dan saldo stok.', icon: Sprout },
      { id: 'inventoryWarehouses' as const, title: 'Gudang', description: 'Lokasi stok, gudang utama, PIC dan kebun terkait.', icon: Building2 },
    ] },
    { label: 'Aset Tetap', description: 'Kebijakan penyusutan, mapping akun dan register aset.', items: [
      { id: 'fixedAssetGroups' as const, title: 'Kelompok Aset Tetap', description: 'Metode, umur manfaat, nilai residu dan mapping COA.', icon: Building2 },
      { id: 'fixedAssets' as const, title: 'Daftar Aset Tetap', description: 'Register aset per cost center dan nilai buku awal.', icon: ClipboardList },
    ] },
  ];
  const activeMasterLabel = masterGroups.flatMap(group => group.items).find(item => item.id === masterPage)?.title || 'Master Data';
  const [kebunForm, setKebunForm] = useState({ id: '', code: '', name: '', owner: '', location: '', areaHa: '', treeCount: '', status: 'AKTIF' as 'AKTIF' | 'NONAKTIF' });
  const [accountForm, setAccountForm] = useState({ id: '', name: '', type: 'KAS' as 'KAS' | 'BANK', openingBalance: '', bankName: '', accountNumber: '' });
  const saveKebun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kebunForm.code.trim() || !kebunForm.name.trim()) return showError('Kode dan nama kebun wajib diisi.');
    try {
      const body = { ...kebunForm, areaHa: Number(kebunForm.areaHa || 0), treeCount: Math.max(0, Math.floor(Number(kebunForm.treeCount || 0))) };
      if (kebunForm.id) await api.put(`/api/kebun/${kebunForm.id}`, body); else await api.post('/api/kebun', body);
      setKebunForm({ id: '', code: '', name: '', owner: '', location: '', areaHa: '', treeCount: '', status: 'AKTIF' });
      await reload();
      flash(kebunForm.id ? 'Data kebun diperbarui.' : 'Kebun berhasil ditambahkan.');
    } catch (err) { showError(apiError(err, 'Data kebun gagal disimpan.')); }
  };
  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.name.trim()) return showError('Nama akun kas/bank wajib diisi.');
    try {
      const body = { ...accountForm, openingBalance: Number(accountForm.openingBalance || 0) };
      if (accountForm.id) await api.put(`/api/accounts/${accountForm.id}`, body); else await api.post('/api/accounts', body);
      setAccountForm({ id: '', name: '', type: 'KAS', openingBalance: '', bankName: '', accountNumber: '' });
      await reload();
      flash(accountForm.id ? 'Akun diperbarui.' : 'Akun berhasil ditambahkan.');
    } catch (err) { showError(apiError(err, 'Akun gagal disimpan.')); }
  };
  const remove = async (kind: 'kebun' | 'accounts', id: string) => {
    if (!window.confirm('Hapus data ini?')) return;
    try { await api.delete(`/api/${kind}/${id}`); await reload(); flash('Data berhasil dihapus.'); }
    catch (err) { showError(apiError(err, 'Data tidak dapat dihapus.')); }
  };
  return (
    <div className="stack">
      {masterPage === 'hub' ? <>
        <section className="panel tbs-header">
          <div><span className="eyebrow dark">Master Data</span><h2>Master Data</h2><p>Pilih master yang ingin dikelola. Form hanya dibuka setelah kartu dipilih.</p></div>
        </section>
        <div className="master-hub">
          {masterGroups.map(group => <section className="master-hub-group" key={group.label}>
            <div className="master-hub-group-head"><div><strong>{group.label}</strong><span>{group.description}</span></div></div>
            <div className="master-hub-grid">
              {group.items.map(item => { const Icon = item.icon; return <button type="button" className="master-hub-card" key={item.id} onClick={() => changeMasterPage(item.id)}><span className="master-hub-card-icon"><Icon size={24} /></span><span className="master-hub-card-copy"><strong>{item.title}</strong><small>{item.description}</small></span><ChevronRight size={18} /></button>; })}
            </div>
          </section>)}
        </div>
      </> : <section className="master-detail-nav"><div><span>Master Data</span><ChevronRight size={14} /><strong>{activeMasterLabel}</strong></div><button type="button" className="secondary small-btn" onClick={() => changeMasterPage('hub')}>← Kembali ke Master Data</button></section>}
      {masterPage === 'kebun' && <section className="panel">
          <div className="panel-head"><div><h3>Master Kebun</h3><p>Nama, pemilik, kode, lokasi, luas, dan jumlah pohon.</p></div></div>
          <form className="mini-form" onSubmit={saveKebun}>
            <div className="row-2">
              <Field label="Kode Kebun"><input placeholder="KB-01" value={kebunForm.code} onChange={e => setKebunForm(v => ({ ...v, code: e.target.value }))} /></Field>
              <Field label="Nama Kebun"><input placeholder="Kebun A" value={kebunForm.name} onChange={e => setKebunForm(v => ({ ...v, name: e.target.value }))} /></Field>
            </div>
            <Field label="Pemilik"><input placeholder="Nama pemilik kebun" value={kebunForm.owner} onChange={e => setKebunForm(v => ({ ...v, owner: e.target.value }))} /></Field>
            <Field label="Lokasi"><input placeholder="Kecamatan / Kabupaten" value={kebunForm.location} onChange={e => setKebunForm(v => ({ ...v, location: e.target.value }))} /></Field>
            <div className="row-2">
              <Field label="Luas (Ha)"><input inputMode="decimal" placeholder="0" value={kebunForm.areaHa} onChange={e => setKebunForm(v => ({ ...v, areaHa: e.target.value }))} /></Field>
              <Field label="Jumlah Pohon"><input inputMode="numeric" placeholder="0" value={kebunForm.treeCount} onChange={e => setKebunForm(v => ({ ...v, treeCount: e.target.value.replace(/[^0-9]/g, '') }))} /></Field>
            </div>
            <Field label="Status"><select value={kebunForm.status} onChange={e => setKebunForm(v => ({ ...v, status: e.target.value as 'AKTIF' | 'NONAKTIF' }))}><option value="AKTIF">Aktif</option><option value="NONAKTIF">Nonaktif</option></select></Field>
            <div className="form-actions">
              {kebunForm.id && <button type="button" className="secondary" onClick={() => setKebunForm({ id: '', code: '', name: '', owner: '', location: '', areaHa: '', treeCount: '', status: 'AKTIF' })}>Batal</button>}
              <button className="primary"><Save size={17} /> {kebunForm.id ? 'Simpan Perubahan' : 'Tambah Kebun'}</button>
            </div>
          </form>
          <div className="master-list">{data.kebun.length === 0 ? <Empty text="Belum ada kebun." /> : data.kebun.map(item => (
            <div className="master-row" key={item.id}>
              <div><strong>{item.name}</strong><span>{item.code} · Pemilik: {item.owner || 'Belum diisi'} · {item.location || 'Lokasi belum diisi'} · {item.areaHa || 0} Ha · {item.treeCount || 0} pohon</span></div>
              <span className={`status ${item.status === 'AKTIF' ? 'active' : ''}`}>{item.status}</span>
              <button className="icon-btn" onClick={() => setKebunForm({ id: item.id, code: item.code, name: item.name, owner: item.owner || '', location: item.location, areaHa: String(item.areaHa || ''), treeCount: String(item.treeCount || ''), status: item.status })}><Pencil size={15} /></button>
              <button className="icon-btn danger" onClick={() => remove('kebun', item.id)}><Trash2 size={15} /></button>
            </div>
          ))}</div>
        </section>}
      {masterPage === 'cashBank' && <section className="panel">
          <div className="panel-head"><div><h3>Master Kas & Bank</h3><p>Pisahkan setiap sumber dana agar saldo mudah dipantau.</p></div></div>
          <form className="mini-form" onSubmit={saveAccount}>
            <Field label="Nama Akun"><input placeholder="Kas Kebun / BRI Operasional" value={accountForm.name} onChange={e => setAccountForm(v => ({ ...v, name: e.target.value }))} /></Field>
            <Field label="Jenis"><select value={accountForm.type} onChange={e => setAccountForm(v => ({ ...v, type: e.target.value as 'KAS' | 'BANK' }))}><option value="KAS">Kas</option><option value="BANK">Bank</option></select></Field>
            <div className="notice">Saldo awal tidak diinput dari Master Kas & Bank. Gunakan Akuntansi → COA & Setup → Saldo Awal agar Debit/Kredit tetap terkontrol.</div>
            {accountForm.type === 'BANK' && <div className="row-2"><Field label="Nama Bank"><input placeholder="BRI" value={accountForm.bankName} onChange={e => setAccountForm(v => ({ ...v, bankName: e.target.value }))} /></Field><Field label="No. Rekening"><input placeholder="Nomor rekening" value={accountForm.accountNumber} onChange={e => setAccountForm(v => ({ ...v, accountNumber: e.target.value }))} /></Field></div>}
            <div className="form-actions">
              {accountForm.id && <button type="button" className="secondary" onClick={() => setAccountForm({ id: '', name: '', type: 'KAS', openingBalance: '', bankName: '', accountNumber: '' })}>Batal</button>}
              <button className="primary"><Save size={17} /> {accountForm.id ? 'Simpan Perubahan' : 'Tambah Akun'}</button>
            </div>
          </form>
          <div className="master-list">{data.accounts.length === 0 ? <Empty text="Belum ada akun kas/bank." /> : data.accounts.map(item => (
            <div className="master-row" key={item.id}>
              <div><strong>{item.name}</strong><span>{item.type}{item.bankName ? ` · ${item.bankName}` : ''}{item.accountNumber ? ` · ${item.accountNumber}` : ''}</span></div>
              <b>{idr.format(balanceForAccount(item, data.transactions, data.accountingCutoffDate))}</b>
              <button className="icon-btn" onClick={() => setAccountForm({ id: item.id, name: item.name, type: item.type, openingBalance: String(item.openingBalance || ''), bankName: item.bankName, accountNumber: item.accountNumber })}><Pencil size={15} /></button>
              <button className="icon-btn danger" onClick={() => remove('accounts', item.id)}><Trash2 size={15} /></button>
            </div>
          ))}</div>
        </section>}
      {masterPage === 'pks' && <TbsMasters data={data} reload={reload} flash={flash} showError={showError} includeWorkers={false} section="mills" />}
      {masterPage === 'vehicles' && <TbsMasters data={data} reload={reload} flash={flash} showError={showError} includeWorkers={false} section="vehicles" />}
      {masterPage === 'tbsRates' && <TbsMasters data={data} reload={reload} flash={flash} showError={showError} includeWorkers={false} section="rates" />}
      {masterPage === 'workers' && <PayrollModule data={data} reload={reload} flash={flash} showError={showError} workersOnly />}
      {masterPage === 'workTypes' && <WorkModule data={data} reload={reload} flash={flash} showError={showError} mastersOnly masterSection="types" />}
      {masterPage === 'workRates' && <WorkModule data={data} reload={reload} flash={flash} showError={showError} mastersOnly masterSection="rates" />}
      {masterPage === 'inventoryGroups' && <InventoryMasters workspaceId={data.workspace.id} kebun={data.kebun} flash={flash} showError={showError} section="groups" />}
      {masterPage === 'inventoryUnits' && <InventoryMasters workspaceId={data.workspace.id} kebun={data.kebun} flash={flash} showError={showError} section="units" />}
      {masterPage === 'inventoryItems' && <InventoryMasters workspaceId={data.workspace.id} kebun={data.kebun} flash={flash} showError={showError} section="items" />}
      {masterPage === 'inventoryWarehouses' && <InventoryMasters workspaceId={data.workspace.id} kebun={data.kebun} flash={flash} showError={showError} section="warehouses" />}
      {masterPage === 'fixedAssetGroups' && <FixedAssets workspaceId={data.workspace.id} kebun={data.kebun} openingPosted={data.accountingOpeningPosted} cutoffDate={data.accountingCutoffDate} flash={flash} showError={showError} section="groups" />}
      {masterPage === 'fixedAssets' && <FixedAssets workspaceId={data.workspace.id} kebun={data.kebun} openingPosted={data.accountingOpeningPosted} cutoffDate={data.accountingCutoffDate} flash={flash} showError={showError} section="assets" />}
    </div>
  );
}

function CompanyPanel({
  user, data, reload, flash, showError, onCompanyDeleted,
}: {
  user: User;
  data: Bootstrap;
  reload: () => Promise<void>;
  flash: (text: string) => void;
  showError: (text: string) => void;
  onCompanyDeleted: () => void;
}) {
  const defaultProfile: CompanyProfile = {
    name: data.workspace.name, shortName: '', businessType: '', npwp: '', nib: '', address: '', village: '', district: '', city: '', province: '', postalCode: '', phone: '', email: '', website: '', picName: '', picPosition: '', fiscalYearStartMonth: 1, currency: 'IDR', reportName: data.workspace.name, logoUrl: '',
  };
  const [profile, setProfile] = useState<CompanyProfile>(defaultProfile);
  const [canEditProfile, setCanEditProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingCompany, setDeletingCompany] = useState(false);
  const [coaStatus, setCoaStatus] = useState({ accounts: 0, mappings: 0 });

  const loadProfile = async () => {
    try {
      setProfileLoading(true);
      const [profileResult, coaResult] = await Promise.allSettled([api.get('/api/workspace/profile'), api.get('/api/accounting/accounts')]);
      if (profileResult.status === 'fulfilled') {
        const payload = profileResult.value.data as { profile?: CompanyProfile; canEdit?: boolean };
        if (payload.profile) setProfile({ ...defaultProfile, ...payload.profile });
        setCanEditProfile(Boolean(payload.canEdit));
      }
      if (coaResult.status === 'fulfilled') {
        const payload = coaResult.value.data as { accounts?: unknown[]; systemMappings?: Record<string, string> };
        setCoaStatus({ accounts: payload.accounts?.length || 0, mappings: Object.values(payload.systemMappings || {}).filter(Boolean).length });
      }
    } catch (err) {
      showError(apiError(err, 'Profil Perusahaan belum dapat dimuat.'));
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => { void loadProfile(); }, [data.workspace.id]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEditProfile) return;
    if (profile.name.trim().length < 2) return showError('Nama perusahaan minimal 2 karakter.');
    try {
      setProfileSaving(true);
      await api.put('/api/workspace/profile', profile);
      await reload();
      await loadProfile();
      flash('Profil Perusahaan berhasil diperbarui.');
    } catch (err) {
      showError(apiError(err, 'Profil Perusahaan belum dapat disimpan.'));
    } finally {
      setProfileSaving(false);
    }
  };

  const deleteCompany = async () => {
    if (data.workspace.role !== 'OWNER') return showError('Hanya Owner yang dapat menghapus perusahaan.');
    const expectedName = (profile.name || data.workspace.name).trim();
    if (data.workspaces.length <= 1) return showError('Buat atau gabung ke perusahaan lain terlebih dahulu sebelum menghapus perusahaan ini.');
    if (deleteConfirmation.trim() !== expectedName) return showError('Ketik nama perusahaan persis seperti yang tampil untuk melanjutkan.');
    try {
      setDeletingCompany(true);
      await api.post('/api/workspace/delete', { confirmationName: deleteConfirmation.trim() });
      await reload();
      setDeleteConfirmation('');
      setDeleteOpen(false);
      flash('Perusahaan berhasil dihapus.');
      onCompanyDeleted();
    } catch (err) {
      showError(apiError(err, 'Perusahaan belum dapat dihapus.'));
    } finally {
      setDeletingCompany(false);
    }
  };

  const profileReady = Boolean(profile.name.trim() && profile.businessType.trim() && profile.address.trim());
  const setupItems = [
    { label: 'Profil Perusahaan', ready: profileReady, detail: profileReady ? 'Identitas utama terisi' : 'Lengkapi bentuk usaha dan alamat' },
    { label: 'Chart of Accounts', ready: coaStatus.accounts > 0, detail: coaStatus.accounts > 0 ? coaStatus.accounts + ' akun tersedia' : 'Belum tersedia' },
    { label: 'Akun Penting', ready: coaStatus.mappings > 0, detail: coaStatus.mappings > 0 ? coaStatus.mappings + ' mapping terhubung' : 'Belum diatur' },
    { label: 'Kebun / Cost Center', ready: data.kebun.length > 0, detail: data.kebun.length > 0 ? data.kebun.length + ' kebun tersedia' : 'Belum ada kebun' },
    { label: 'Kas & Bank', ready: data.accounts.length > 0, detail: data.accounts.length > 0 ? data.accounts.length + ' rekening tersedia' : 'Belum ada rekening' },
    { label: 'Saldo Awal', ready: Boolean(data.accountingOpeningPosted), detail: data.accountingOpeningPosted ? 'Sudah diposting' : 'Belum diposting' },
  ];
  const readyCount = setupItems.filter(item => item.ready).length;
  const progress = Math.round((readyCount / setupItems.length) * 100);

  return (
    <div className="stack">
      <section className="company-profile-hero">
        <div><span className="eyebrow">Perusahaan Aktif</span><h2>{profile.name || data.workspace.name}</h2><p>{profile.address || 'Alamat perusahaan belum dilengkapi.'}</p></div>
        <div className="company-setup-score"><strong>{progress}%</strong><span>Setup awal</span></div>
      </section>

      <section className="access-grid">
        <form className="panel company-profile-form" onSubmit={saveProfile}>
          <div className="panel-head"><div><h3>Profil Perusahaan</h3><p>Identitas ini menjadi sumber nama dan informasi perusahaan pada laporan.</p></div>{canEditProfile && <button className="primary small-btn" disabled={profileSaving || profileLoading}><Save size={15} /> {profileSaving ? 'Menyimpan...' : 'Simpan Profil'}</button>}</div>
          <div className="company-form-grid">
            <Field label="Nama Perusahaan"><input value={profile.name} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, name: e.target.value }))} /></Field>
            <Field label="Nama Singkat / Brand"><input value={profile.shortName} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, shortName: e.target.value }))} /></Field>
            <Field label="Bentuk Usaha"><select value={profile.businessType} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, businessType: e.target.value }))}><option value="">Pilih bentuk usaha</option><option>PT</option><option>CV</option><option>UD</option><option>Koperasi</option><option>Perorangan</option><option>Yayasan</option><option>Lainnya</option></select></Field>
            <Field label="NPWP"><input value={profile.npwp} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, npwp: e.target.value }))} /></Field>
            <Field label="NIB"><input value={profile.nib} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, nib: e.target.value }))} /></Field>
            <Field label="Nama pada Laporan"><input value={profile.reportName} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, reportName: e.target.value }))} /></Field>
            <Field label="Alamat Lengkap"><textarea rows={3} value={profile.address} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, address: e.target.value }))} /></Field>
            <div className="company-form-grid nested">
              <Field label="Kelurahan / Desa"><input value={profile.village} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, village: e.target.value }))} /></Field>
              <Field label="Kecamatan"><input value={profile.district} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, district: e.target.value }))} /></Field>
              <Field label="Kota / Kabupaten"><input value={profile.city} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, city: e.target.value }))} /></Field>
              <Field label="Provinsi"><input value={profile.province} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, province: e.target.value }))} /></Field>
              <Field label="Kode Pos"><input value={profile.postalCode} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, postalCode: e.target.value }))} /></Field>
            </div>
            <Field label="Telepon / WhatsApp"><input value={profile.phone} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, phone: e.target.value }))} /></Field>
            <Field label="Email"><input type="email" value={profile.email} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, email: e.target.value }))} /></Field>
            <Field label="Website"><input value={profile.website} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, website: e.target.value }))} /></Field>
            <Field label="PIC / Penanggung Jawab"><input value={profile.picName} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, picName: e.target.value }))} /></Field>
            <Field label="Jabatan PIC"><input value={profile.picPosition} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, picPosition: e.target.value }))} /></Field>
            <Field label="Awal Tahun Buku"><select value={profile.fiscalYearStartMonth} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, fiscalYearStartMonth: Number(e.target.value) }))}>{['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></Field>
            <Field label="Mata Uang"><select value={profile.currency} disabled={!canEditProfile} onChange={e => setProfile(v => ({ ...v, currency: e.target.value }))}><option value="IDR">IDR - Rupiah</option></select></Field>
            <Field label="URL Logo (opsional)"><input value={profile.logoUrl} disabled={!canEditProfile} placeholder="https://..." onChange={e => setProfile(v => ({ ...v, logoUrl: e.target.value }))} /></Field>
          </div>
        </form>

        <section className="panel">
          <div className="panel-head"><div><h3>Status Setup Awal</h3><p>Indikator kesiapan perusahaan sebelum transaksi rutin.</p></div><span className="role-badge">{readyCount}/{setupItems.length}</span></div>
          <div className="setup-progress"><span style={{ width: progress + '%' }} /></div>
          <div className="setup-checklist">{setupItems.map(item => <div key={item.label} className={item.ready ? 'ready' : ''}><span className="setup-dot">{item.ready ? '✓' : '!'}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div></div>)}</div>
          <div className="notice">Status ini membantu screening awal. Kesiapan final tetap mengikuti validasi COA, Akun Penting, subledger, periode, dan Saldo Awal.</div>
        </section>
      </section>

      {data.workspace.role === 'OWNER' && (
        <section className="panel company-danger-zone">
          <div className="panel-head">
            <div><h3>Hapus Perusahaan</h3><p>Menghapus perusahaan aktif beserta seluruh master, transaksi, persediaan, jurnal, laporan, akses user, dan data terkait. Perusahaan lain tidak terpengaruh.</p></div>
            {!deleteOpen && <button type="button" className="danger-button" disabled={data.workspaces.length <= 1} onClick={() => { setDeleteConfirmation(''); setDeleteOpen(true); }}><Trash2 size={16} /> Hapus Perusahaan</button>}
          </div>
          {data.workspaces.length <= 1 && <div className="notice danger-note">Perusahaan terakhir tidak dapat dihapus. Buat atau gabung ke perusahaan lain terlebih dahulu.</div>}
          {deleteOpen && data.workspaces.length > 1 && (
            <div className="company-delete-confirmation">
              <div className="inline-error"><strong>Tindakan ini permanen.</strong> Backup internal dibuat sebelum data dihapus. Untuk konfirmasi, ketik nama perusahaan berikut: <strong>{profile.name || data.workspace.name}</strong></div>
              <Field label="Ketik nama perusahaan"><input autoFocus value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} placeholder={profile.name || data.workspace.name} /></Field>
              <div className="company-delete-actions">
                <button type="button" className="secondary" disabled={deletingCompany} onClick={() => { setDeleteOpen(false); setDeleteConfirmation(''); }}>Batal</button>
                <button type="button" className="danger-button" disabled={deletingCompany || deleteConfirmation.trim() !== (profile.name || data.workspace.name).trim()} onClick={() => void deleteCompany()}><Trash2 size={16} /> {deletingCompany ? 'Menghapus...' : 'Ya, Hapus Permanen'}</button>
              </div>
            </div>
          )}
        </section>
      )}

      <AccessPanel user={user} data={data} reload={reload} flash={flash} showError={showError} />
    </div>
  );
}

function AccessPanel({
  user,
  data,
  reload,
  flash,
  showError,
}: {
  user: User;
  data: Bootstrap;
  reload: () => Promise<void>;
  flash: (text: string) => void;
  showError: (text: string) => void;
}) {
  const [companyName, setCompanyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [invite, setInvite] = useState({ email: '', role: 'VIEWER' as Exclude<Role, 'OWNER'>, assignedKebunId: '' });
  const [saving, setSaving] = useState(false);

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invite.role === 'ADMIN_KEBUN' && !invite.assignedKebunId) return showError('Pilih kebun untuk Admin Kebun.');
    try {
      setSaving(true);
      const res = await api.post('/api/workspace/invites', {
        email: invite.email,
        role: invite.role,
        assignedKebunIds: invite.role === 'ADMIN_KEBUN' ? [invite.assignedKebunId] : [],
      });
      setInvite({ email: '', role: 'VIEWER', assignedKebunId: '' });
      await reload();
      const code = (res.data as { code?: string }).code;
      if (code) await copyText(code);
      flash(code ? 'Kode undangan dibuat dan disalin.' : 'Kode undangan berhasil dibuat.');
    } catch (err) { showError(apiError(err, 'Undangan gagal dibuat.')); }
    finally { setSaving(false); }
  };

  return (
    <div className="stack">
      <section className="access-grid single-access">
        <div className="panel">
          <div className="panel-head"><div><h3>Akses Saya</h3><p>Hak akses mengikuti role di perusahaan aktif.</p></div></div>
          <div className="permission-card"><div className="avatar big">{(user.name || user.email || 'U').slice(0, 1).toUpperCase()}</div><div><strong>{user.name || user.email || 'Pengguna'}</strong><span>{user.email || ''}</span><b>{roleLabel(data.workspace.role)}</b></div></div>
          <div className="permission-notes">
            {data.workspace.role === 'OWNER' && <p>Owner: akses penuh, master data, transaksi, transfer, laporan, dan undangan pengguna.</p>}
            {data.workspace.role === 'ADMIN_PUSAT' && <p>Admin Pusat: kelola master, transaksi, transfer, dan laporan.</p>}
            {data.workspace.role === 'FINANCE' && <p>Finance: transaksi, transfer kas/bank, dan laporan. Master data tidak dapat diubah.</p>}
            {data.workspace.role === 'ADMIN_KEBUN' && <p>Admin Kebun: hanya melihat dan mencatat transaksi pada kebun yang ditugaskan.</p>}
            {data.workspace.role === 'VIEWER' && <p>Viewer: hanya melihat dashboard, transaksi, dan laporan.</p>}
          </div>
        </div>
      </section>
      {data.workspace.role === 'OWNER' && (
        <section className="panel">
          <div className="panel-head"><div><h3>Undang Pengguna</h3><p>Buat kode akses. Email boleh dikunci agar kode hanya bisa dipakai akun tersebut.</p></div></div>
          <form className="invite-form" onSubmit={createInvite}>
            <Field label="Email (opsional)"><input type="email" placeholder="nama@perusahaan.com" value={invite.email} onChange={e => setInvite(v => ({ ...v, email: e.target.value }))} /></Field>
            <Field label="Role"><select value={invite.role} onChange={e => setInvite(v => ({ ...v, role: e.target.value as Exclude<Role, 'OWNER'>, assignedKebunId: '' }))}>{roles.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
            {invite.role === 'ADMIN_KEBUN' && <Field label="Kebun yang Ditugaskan"><select value={invite.assignedKebunId} onChange={e => setInvite(v => ({ ...v, assignedKebunId: e.target.value }))}><option value="">Pilih kebun</option>{data.kebun.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
            <button className="primary" disabled={saving}><UsersRound size={17} /> Buat Kode Undangan</button>
          </form>
        </section>
      )}
      {(data.workspace.role === 'OWNER' || data.workspace.role === 'ADMIN_PUSAT') && (
        <section className="access-grid">
          <div className="panel">
            <div className="panel-head"><div><h3>Pengguna Perusahaan</h3><p>{data.members.length} pengguna terdaftar pada perusahaan aktif.</p></div></div>
            <div className="member-list">{data.members.map(member => (
              <div className="member-row" key={member.id}><div className="avatar">{(member.name || member.email || 'U').slice(0, 1).toUpperCase()}</div><div><strong>{member.name || member.email || 'Pengguna'}</strong><span>{member.email || '-'}</span></div><b>{roleLabel(member.role)}</b></div>
            ))}</div>
          </div>
          {data.workspace.role === 'OWNER' && (
            <div className="panel">
              <div className="panel-head"><div><h3>Kode Undangan</h3><p>Bagikan hanya kepada pengguna yang dituju.</p></div></div>
              <div className="invite-list">{data.invites.length === 0 ? <Empty text="Belum ada kode undangan." /> : data.invites.map(item => (
                <div className="invite-row" key={item.id}><div><strong>{roleLabel(item.role)}</strong><span>{item.email || 'Tidak dikunci ke email'} · {item.status === 'OPEN' ? 'Aktif' : 'Sudah dipakai'}</span><code>{item.code}</code></div>{item.status === 'OPEN' && <button className="icon-btn" onClick={() => { void copyText(item.code); flash('Kode undangan disalin.'); }} title="Salin kode"><Copy size={16} /></button>}</div>
              ))}</div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
function Empty({ text }: { text: string }) {
  return <div className="empty"><Sprout size={26} /><span>{text}</span></div>;
}
function TransactionLine({ tx, data }: { tx: Transaction; data: Bootstrap }) {
  return (
    <div className="recent-row">
      <div className={`tx-icon ${tx.direction.toLowerCase()}`}>{tx.kind === 'TRANSFER' ? <ArrowLeftRight size={18} /> : tx.direction === 'IN' ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}</div>
      <div><strong>{tx.category}</strong><span>{tx.kind === 'TRANSFER' ? findAccount(data, tx.accountId)?.name || 'Transfer' : `${findKebun(data, tx.kebunId)?.name || '-'} · ${formatDate(tx.date)}`}</span></div>
      <b className={tx.direction.toLowerCase()}>{tx.direction === 'IN' ? '+' : '-'} {idr.format(tx.amount)}</b>
    </div>
  );
}
function findKebun(data: Bootstrap, id: string) {
  return data.kebun.find(item => item.id === id);
}
function findAccount(data: Bootstrap, id: string) {
  return data.accounts.find(item => item.id === id);
}
function isAfterAccountingCutoff(tx: Transaction, cutoffDate?: string) {
  return !cutoffDate || tx.date > cutoffDate;
}
function balanceForAccount(account: Account, transactions: Transaction[], cutoffDate?: string) {
  return account.openingBalance + transactions.filter(tx => tx.accountId === account.id && isAfterAccountingCutoff(tx, cutoffDate)).reduce((sum, tx) => sum + (tx.direction === 'IN' ? tx.amount : -tx.amount), 0);
}
function formatDate(value: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}
function formatKg(value: number) {
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)} kg`;
}
async function filePayload(file: File) {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('File gagal dibaca.'));
    reader.readAsDataURL(file);
  });
  return { receiptBase64: base64, receiptName: file.name, receiptContentType: file.type };
}
async function copyText(value: string) {
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
}
function apiError(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: { error?: string; message?: string } }; message?: string })?.response?.data;
  return data?.error || data?.message || fallback;
}

export default FarmApp;

/* v4.12.1 company access cleanup */


/* v4.12.2 fix company selector state */

/* v4.13 multi-unit inventory */


/* v4.14.0 url routing and company session */


/* v4.14.1 refresh session restore splash */

/* v4.15 company deletion */
