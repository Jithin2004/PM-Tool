import re

def fix_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements:
        content = content.replace(old, new)
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

# 1. BacklogView & ProjectWorkflowSettings
fix_file("frontend/src/pages/dashboard/project/BacklogView.tsx", [
    ("const { user, currentWorkspace } = useAuth();", "const { user } = useAuth();\n  const { workspace: currentWorkspace } = useWorkspace();"),
    ("import { useAuth } from '../../context/AuthContext';", "import { useAuth } from '../../context/AuthContext';\nimport { useWorkspace } from '../../context/WorkspaceContext';")
])

fix_file("frontend/src/pages/dashboard/project/ProjectWorkflowSettings.tsx", [
    ("const { user, currentWorkspace } = useAuth();", "const { user } = useAuth();\n  const { workspace: currentWorkspace } = useWorkspace();"),
    ("import { useAuth } from '../../context/AuthContext';", "import { useAuth } from '../../context/AuthContext';\nimport { useWorkspace } from '../../context/WorkspaceContext';")
])

# 2. SprintPlanningPanel
fix_file("frontend/src/pages/dashboard/project/SprintPlanningPanel.tsx", [
    ("sprint.status === 'planning'", "sprint.status === 'planned'")
])

# 3. MissionControlPage
fix_file("frontend/src/pages/mission-control/MissionControlPage.tsx", [
    ("const riskInsights = useMemo(\n    () => analyzeExecutionRisks(\n      presence.collaborators,\n      presence.signals,\n      presence.feed,\n      coordination.vitality,\n      coordination.bottlenecks,\n    ),\n    [presence.collaborators, presence.signals, presence.feed, coordination.vitality, coordination.bottlenecks],\n  );", "")
])

# 4. activityAggregationService
fix_file("frontend/src/services/activityAggregationService.ts", [
    ("shifts.map(e => e.created_by)", "shifts.map(e => e.actor_id)")
])

# 5. documentService
fix_file("frontend/src/services/documentService.ts", [
    ("metadata?: Record<string, any>;\n  content?: string;\n  pinned?: boolean;\n  deleted_at?: string;\n  tags?: string[];\n  content?: string;", "metadata?: Record<string, any>;\n  content?: string;\n  pinned?: boolean;\n  deleted_at?: string;\n  tags?: string[];")
])

# 6. financeService
fix_file("frontend/src/services/financeService.ts", [
    ("await financeLedgerService.recordPayment({\n          workspaceId: inv.workspace_id,\n          userId: 'system',\n          paymentId: crypto.randomUUID(),\n          invoiceId: payment.invoice_id as string,\n          amount: payment.amount || 0\n        });", "await financeLedgerService.recordPayment({\n          workspaceId: inv.workspace_id,\n          userId: 'system',\n          paymentId: crypto.randomUUID(),\n          invoiceId: payment.invoice_id as string,\n          amount: payment.amount || 0,\n          description: 'Payment against invoice'\n        });"),
    ("expense.currency ||", "'USD' ||")
])

# 7. DocumentView
fix_file("frontend/src/pages/dashboard/DocumentView.tsx", [
    ("author_id:", "owner_id:")
])

# 8. DashboardLayout
fix_file("frontend/src/pages/dashboard/DashboardLayout.tsx", [
    ("import { sendNotification } from '../../services/notificationService';", "")
])
