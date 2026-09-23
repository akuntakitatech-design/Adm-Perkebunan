import fs from 'node:fs';

const path = 'src/FarmApp.tsx';
let source = fs.readFileSync(path, 'utf8');
const marker = '/* v4.14.0 url routing and company session */';
if (source.includes(marker)) process.exit(0);

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  source = source.replace(from, to);
}

const tabAnchor = `const mainTabOptions: readonly Tab[] = ['dashboard', 'tbs', 'work', 'purchases', 'inventory', 'payroll', 'employeeReceivables', 'transactions', 'accounting', 'reports', 'master', 'access'];`;
const tabRouting = `${tabAnchor}\nconst companySessionKey = 'perkebunan.company.selected';\nconst tabPathMap: Record<Tab, string> = {\n  dashboard: '/dashboard',\n  tbs: '/tbs',\n  work: '/work',\n  purchases: '/purchase',\n  inventory: '/inventory',\n  payroll: '/payroll',\n  employeeReceivables: '/employee-receivables',\n  transactions: '/cash-bank',\n  accounting: '/accounting',\n  reports: '/reports',\n  master: '/master',\n  access: '/company',\n};\nconst pathTabMap: Record<string, Tab> = {\n  dashboard: 'dashboard',\n  tbs: 'tbs',\n  work: 'work',\n  purchase: 'purchases',\n  purchases: 'purchases',\n  inventory: 'inventory',\n  payroll: 'payroll',\n  'employee-receivables': 'employeeReceivables',\n  receivables: 'employeeReceivables',\n  'cash-bank': 'transactions',\n  transactions: 'transactions',\n  accounting: 'accounting',\n  reports: 'reports',\n  master: 'master',\n  company: 'access',\n};\nfunction tabFromPath(pathname: string): Tab | null {\n  const segment = pathname.replace(/^\\/+|\\/+$/g, '').split('/')[0]?.toLowerCase() || '';\n  return segment ? pathTabMap[segment] || null : null;\n}\nfunction pathForTab(tab: Tab) { return tabPathMap[tab] || '/dashboard'; }\nfunction readCompanySession() {\n  if (typeof window === 'undefined') return '';\n  try { return window.sessionStorage.getItem(companySessionKey) || ''; } catch { return ''; }\n}\nfunction storeCompanySession(workspaceId: string) {\n  if (typeof window === 'undefined') return;\n  try { window.sessionStorage.setItem(companySessionKey, workspaceId); } catch { /* no-op */ }\n}\nfunction clearCompanySession() {\n  if (typeof window === 'undefined') return;\n  try { window.sessionStorage.removeItem(companySessionKey); } catch { /* no-op */ }\n}`;
replaceOnce(tabAnchor, tabRouting, 'tab routing constants');

const permissionAnchor = `function canManageAccounting(value: Role) {\n  return value === 'OWNER' || value === 'ADMIN_PUSAT' || value === 'FINANCE';\n}`;
const permissionReplacement = `${permissionAnchor}\nfunction canOpenTab(tab: Tab, role: Role) {\n  if (tab === 'master') return canManageMaster(role);\n  if (tab === 'employeeReceivables') return canManagePayroll(role);\n  if (tab === 'purchases' || tab === 'accounting') return canManageAccounting(role);\n  return true;\n}`;
replaceOnce(permissionAnchor, permissionReplacement, 'tab permission helper');

replaceOnce(
  `  const [tab, setTab] = useState<Tab>(() => {\n    const stored = readStoredChoice(mainTabStorageKey, mainTabOptions, 'dashboard');\n    return stored === 'payables' ? 'purchases' : stored;\n  }); `,
  `  const [tab, setTab] = useState<Tab>(() => {\n    const routed = typeof window !== 'undefined' ? tabFromPath(window.location.pathname) : null;\n    if (routed) return routed;\n    const stored = readStoredChoice(mainTabStorageKey, mainTabOptions, 'dashboard');\n    return stored === 'payables' ? 'purchases' : stored;\n  }); `,
  'initial tab from URL',
);

replaceOnce(
  `      const storedTab = readStoredChoice(mainTabStorageKey, mainTabOptions, 'dashboard');\n      const restrictedTab = (storedTab === 'master' && !canManageMaster(completeData.workspace.role)) || ((storedTab === 'employeeReceivables' || storedTab === 'purchases' || storedTab === 'accounting') && !canManageAccounting(completeData.workspace.role));\n      setTab(restrictedTab ? 'dashboard' : storedTab);\n      setErrorMessage('');`,
  `      const routedTab = typeof window !== 'undefined' ? tabFromPath(window.location.pathname) : null;\n      const storedTab = routedTab || readStoredChoice(mainTabStorageKey, mainTabOptions, 'dashboard');\n      const nextTab = canOpenTab(storedTab, completeData.workspace.role) ? storedTab : 'dashboard';\n      setTab(nextTab);\n      storeChoice(mainTabStorageKey, nextTab);\n      setErrorMessage('');\n      return completeData;`,
  'load data route selection',
);
replaceOnce(
  `    } catch (err) {\n      setErrorMessage(apiError(err, 'Data belum bisa dimuat. Silakan coba lagi.'));\n    }\n  };`,
  `    } catch (err) {\n      setErrorMessage(apiError(err, 'Data belum bisa dimuat. Silakan coba lagi.'));\n      return null;\n    }\n  };`,
  'load data null return',
);

const initOld = `  useEffect(() => {\n    const init = async () => {\n      try {\n        const current = await auth.getUser();\n        if (current) {\n          setUser(current as User);\n          await loadData();\n        }\n      } finally {\n        setLoading(false);\n      }\n    };\n    void init();\n  }, []);`;
const initNew = `  useEffect(() => {\n    const init = async () => {\n      try {\n        const current = await auth.getUser();\n        if (current) {\n          setUser(current as User);\n          let loaded = await loadData();\n          const selectedWorkspaceId = readCompanySession();\n          if (loaded && selectedWorkspaceId && loaded.workspaces.some(item => item.id === selectedWorkspaceId)) {\n            if (loaded.workspace.id !== selectedWorkspaceId) {\n              await api.post('/api/workspace/switch', { workspaceId: selectedWorkspaceId });\n              loaded = await loadData();\n            }\n            if (loaded) setCompanySelected(true);\n          } else {\n            clearCompanySession();\n          }\n        }\n      } finally {\n        setLoading(false);\n      }\n    };\n    void init();\n  }, []);`;
replaceOnce(initOld, initNew, 'restore selected company after refresh');

replaceOnce(
  `      setLoading(true);\n      setErrorMessage('');\n      const result = await auth.signIn(credentials);`,
  `      setLoading(true);\n      setErrorMessage('');\n      clearCompanySession();\n      setCompanySelected(false);\n      const result = await auth.signIn(credentials);`,
  'fresh login requires company selection',
);

replaceOnce(
  `  const navigate = (nextTab: Tab) => {\n    setTab(nextTab);\n    storeChoice(mainTabStorageKey, nextTab);\n  };`,
  `  const navigate = (nextTab: Tab, options?: { replace?: boolean }) => {\n    const allowedTab = canOpenTab(nextTab, data.workspace.role) ? nextTab : 'dashboard';\n    setTab(allowedTab);\n    storeChoice(mainTabStorageKey, allowedTab);\n    if (typeof window !== 'undefined') {\n      const nextPath = pathForTab(allowedTab);\n      if (window.location.pathname !== nextPath) {\n        if (options?.replace) window.history.replaceState({ tab: allowedTab }, '', nextPath);\n        else window.history.pushState({ tab: allowedTab }, '', nextPath);\n      }\n    }\n  };`,
  'URL based navigate',
);

replaceOnce(
  `      if (workspaceId !== data.workspace.id) await api.post('/api/workspace/switch', { workspaceId });\n      await loadData();\n      navigate('dashboard');\n      setCompanySelected(true);`,
  `      if (workspaceId !== data.workspace.id) await api.post('/api/workspace/switch', { workspaceId });\n      const loaded = await loadData();\n      if (!loaded) return;\n      storeCompanySession(workspaceId);\n      setCompanySelected(true);\n      const requestedTab = typeof window !== 'undefined' ? tabFromPath(window.location.pathname) : null;\n      const targetTab = requestedTab && canOpenTab(requestedTab, loaded.workspace.role) ? requestedTab : 'dashboard';\n      navigate(targetTab, { replace: !requestedTab });`,
  'select company persists session and route',
);

replaceOnce(
  `      await api.post('/api/workspace/create', { name });\n      await loadData();\n      navigate('dashboard');\n      setCompanySelected(true);`,
  `      await api.post('/api/workspace/create', { name });\n      const loaded = await loadData();\n      if (!loaded) return;\n      storeCompanySession(loaded.workspace.id);\n      setCompanySelected(true);\n      navigate('dashboard', { replace: true });`,
  'create company session',
);
replaceOnce(
  `      await api.post('/api/workspace/join', { code: inviteCode });\n      await loadData();\n      navigate('dashboard');\n      setCompanySelected(true);`,
  `      await api.post('/api/workspace/join', { code: inviteCode });\n      const loaded = await loadData();\n      if (!loaded) return;\n      storeCompanySession(loaded.workspace.id);\n      setCompanySelected(true);\n      navigate('dashboard', { replace: true });`,
  'join company session',
);

replaceOnce(
  `  const signOut = async () => {\n    await auth.signOut();\n    setUser(null);\n    setData(emptyData);\n    setCompanySelected(false);\n    navigate('dashboard');\n  };`,
  `  const signOut = async () => {\n    await auth.signOut();\n    clearCompanySession();\n    setUser(null);\n    setData(emptyData);\n    setCompanySelected(false);\n    setTab('dashboard');\n    storeChoice(mainTabStorageKey, 'dashboard');\n    if (typeof window !== 'undefined') window.history.replaceState({}, '', '/');\n  };\n\n  useEffect(() => {\n    if (!user || !companySelected || typeof window === 'undefined') return;\n    const routed = tabFromPath(window.location.pathname);\n    const nextTab = routed && canOpenTab(routed, data.workspace.role) ? routed : tab;\n    const safeTab = canOpenTab(nextTab, data.workspace.role) ? nextTab : 'dashboard';\n    if (tab !== safeTab) setTab(safeTab);\n    storeChoice(mainTabStorageKey, safeTab);\n    const canonicalPath = pathForTab(safeTab);\n    if (window.location.pathname !== canonicalPath) window.history.replaceState({ tab: safeTab }, '', canonicalPath);\n  }, [user, companySelected, data.workspace.role]);\n\n  useEffect(() => {\n    if (typeof window === 'undefined') return;\n    const handlePopState = () => {\n      if (!user || !companySelected) return;\n      const routed = tabFromPath(window.location.pathname) || 'dashboard';\n      const safeTab = canOpenTab(routed, data.workspace.role) ? routed : 'dashboard';\n      setTab(safeTab);\n      storeChoice(mainTabStorageKey, safeTab);\n      const canonicalPath = pathForTab(safeTab);\n      if (window.location.pathname !== canonicalPath) window.history.replaceState({ tab: safeTab }, '', canonicalPath);\n    };\n    window.addEventListener('popstate', handlePopState);\n    return () => window.removeEventListener('popstate', handlePopState);\n  }, [user, companySelected, data.workspace.role]);`,
  'logout and browser history effects',
);

replaceOnce(
  `<div className="topbar-actions"><button className="company-switch-btn" onClick={() => setCompanySelected(false)}><Building2 size={16} /> <span>Ganti Perusahaan</span></button><button className="refresh-btn" onClick={loadData}><RefreshCw size={16} /> <span>Refresh</span></button></div>`,
  `<div className="topbar-actions"><button className="company-switch-btn" onClick={() => { clearCompanySession(); setCompanySelected(false); }}><Building2 size={16} /> <span>Ganti Perusahaan</span></button><button className="refresh-btn" onClick={loadData}><RefreshCw size={16} /> <span>Refresh</span></button></div>`,
  'company switch clears session selection',
);

if (source.includes('Perkebunan · v4.13.2')) source = source.replace('Perkebunan · v4.13.2', 'Perkebunan · v4.14.0');
else if (source.includes('Perkebunan · v4.13.1')) source = source.replace('Perkebunan · v4.13.1', 'Perkebunan · v4.14.0');
else throw new Error('App version anchor not found');

source += `\n\n${marker}\n`;
fs.writeFileSync(path, source);
