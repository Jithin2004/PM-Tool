const fs = require('fs');
let content = fs.readFileSync('router.tsx', 'utf8');

const targetStr = `function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = useOperationalData();
  const [remountKey, setRemountKey] = useState(0);

  useEffect(() => {
    if (!loading) {
      // Force a remount 500ms after loading finishes, as a safety net for lost wake-ups
      const timer = setTimeout(() => {
        setRemountKey(k => k + 1);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  return <Suspense key={\`\${pathname}-\${remountKey}\`} fallback={FALLBACK}>{children}</Suspense>;
}

function RouteShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      <SuspenseWrapper>{children}</SuspenseWrapper>
    </DashboardLayout>
  );
}`;

const replacementStr = `function RouteShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  );
}`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync('router.tsx', content);

