import fs from 'node:fs';

const path = 'src/FarmApp.tsx';
let source = fs.readFileSync(path, 'utf8');
const marker = '/* v4.14.1 refresh session restore splash */';
if (source.includes(marker)) process.exit(0);

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  source = source.replace(from, to);
}

replaceOnce(
  `  const [mobileMenu, setMobileMenu] = useState(false);\n  const [companySelected, setCompanySelected] = useState(false);`,
  `  const [mobileMenu, setMobileMenu] = useState(false);\n  const [companySelected, setCompanySelected] = useState(false);\n  const [restoringSession, setRestoringSession] = useState(true);`,
  'session restoring state',
);

replaceOnce(
  `      } finally {\n        setLoading(false);\n      }\n    };\n    void init();\n  }, []);`,
  `      } finally {\n        setRestoringSession(false);\n        setLoading(false);\n      }\n    };\n    void init();\n  }, []);`,
  'initial session restore completion',
);

replaceOnce(
  `  if (loading && !user) return <Splash />;\n  if (!user) return <Login onLogin={signIn} error={errorMessage} />;`,
  `  if (restoringSession || (loading && !user)) return <Splash />;\n  if (!user) return <Login onLogin={signIn} error={errorMessage} />;`,
  'render splash while restoring session',
);

if (source.includes('Perkebunan · v4.14.0')) {
  source = source.replace('Perkebunan · v4.14.0', 'Perkebunan · v4.14.1');
} else if (!source.includes('Perkebunan · v4.14.1')) {
  throw new Error('App version anchor v4.14.0 not found');
}

source += `\n\n${marker}\n`;
fs.writeFileSync(path, source);
