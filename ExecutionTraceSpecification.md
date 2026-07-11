# Resolve PM — Execution Trace Specification

This document defines the strict, platform-wide contract for structured execution tracing, logging levels, context propagation, span lifecycles, and error classifications across all Resolve PM services.

---

## 1. Trace Context Schema (`TraceContext`)

Every layer of the application (Frontend, HTTP, Business Services, Persistence, External APIs) must accept and propagate a single `TraceContext` object.

```typescript
interface TraceContext {
  correlationId: string; // Traces complete onboarding flow across refreshes/retries
  runId: string;         // Unique for a single execution attempt
  startedAt: string;     // ISO timestamp of attempt initialization
  observabilityLevel: 'OFF' | 'ERROR' | 'INFO' | 'TRACE';
  context: {
    workspace?: {
      id?: string;
      name?: string;
    };
    user?: {
      id?: string;
      email?: string;
      role?: string;
    };
    license?: {
      productKey?: string; // Always sanitized (last 4 characters only)
      plan?: string;
      seats?: number;
    };
  };
}
```

---

## 2. Naming & Propagation Rules

1. **Correlation ID Generation**: Initialized immediately on the browser when a user clicks "Create Account" or "Register". It must be persisted across page refreshes during the session.
2. **Run ID Generation**: Generated on the client side at the beginning of each distinct submission attempt (e.g., when the user clicks submit, or during automatic retries).
3. **HTTP Headers**: Passed in the requests as `X-Correlation-ID` and `X-Run-ID` headers.
4. **Method Signatures**: All backend and frontend service functions must accept `TraceContext` as their final parameter or within a wrapping context object.

---

## 3. Stage Code & Category Conventions

### Categories
All log events must declare exactly one category to classify the domain layer:
`AUTH` | `LICENSE` | `WORKSPACE` | `BOOTSTRAP` | `RPC` | `HTTP` | `SUPABASE` | `MONGODB` | `SYSTEM` | `SECURITY` | `STORAGE`

### Stage Codes
Every checkpoint must declare a stable stage ID code to aid searchability:
- `AUTH-100` Series: Authentication checks
- `LIC-200` Series: Licensing lookups, updates, rollbacks
- `WSP-300` Series: Provisioning workflows
- `RPC-400` Series: Postgres Database RPC Transactions
- `BOOT-500` Series: Bootstrap Lifecycle classifications

---

## 4. Log Levels & Schema

### Log Levels
Every log must declare one of the following levels:
- `TRACE`: Fine-grained transactional logs (e.g., individual SQL RPC steps)
- `DEBUG`: Helpful diagnostic details for developer environments
- `INFO`: Normal operational milestones (e.g., successful transitions)
- `WARN`: Latencies `> 500ms` or soft issues
- `ERROR`: Latencies `> 2000ms`, runtime exceptions, or transactional failures
- `FATAL`: Disastrous server startup crashes
- `AUDIT`: Compliance and usage tracking (e.g., license activated)
- `SECURITY`: Authentication failures, RLS denials, invalid keys

### Log Schema
Every emitted trace must serialize into the following structured JSON:
```json
{
  "timestamp": "2026-07-11T11:20:57.000Z",
  "level": "INFO",
  "category": "WORKSPACE",
  "stage": "WSP-301",
  "status": "STARTED",
  "correlationId": "uuid-correlation",
  "runId": "uuid-run",
  "durationMs": 42,
  "build": {
    "version": "1.3.2",
    "gitRevision": "8d42af",
    "environment": "production"
  },
  "context": {
    "workspace": {},
    "user": {},
    "license": {}
  },
  "message": "Provisioning process started",
  "error": {
    "code": "RPC_EXCEPTION",
    "message": "...",
    "sqlState": "23514",
    "constraint": "workspaces_status_check"
  }
}
```

---

## 5. Span Lifecycle & Automatic Timings

Rather than manual duration tracking, loggers must support span lifecycle tracking:
- `span = logger.startSpan(category, stageId)`: Starts a span and benchmarks start time.
- `span.finish(status, meta)`: Auto-calculates elapsed duration, compares against warning thresholds, and emits the structured log.

Status values must be strictly one of: `STARTED` | `SUCCESS` | `FAILED` | `SKIPPED`.

---

## 6. Central Error Registry

A unified error registry must map error IDs to canonical HTTP codes, categories, severity, and retryable characteristics.

| Error Code | HTTP Status | Category | Severity | Retryable | Default Message |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `AUTH_INVALID_TOKEN` | 401 | `AUTH` | `SECURITY` | `false` | Invalid authentication token |
| `AUTH_USER_NOT_FOUND` | 401 | `AUTH` | `SECURITY` | `false` | Authenticated user profile not found |
| `LICENSE_NOT_FOUND` | 404 | `LICENSE` | `WARN` | `false` | Product key does not exist |
| `LICENSE_ALREADY_USED` | 409 | `LICENSE` | `WARN` | `false` | Product key is assigned to another workspace |
| `WORKSPACE_ALREADY_EXISTS` | 409 | `WORKSPACE` | `WARN` | `false` | Workspace ID or URL conflict |
| `WORKSPACE_TRANSACTION_FAILED`| 500 | `RPC` | `ERROR` | `true` | Database onboarding transaction failed |
| `DATABASE_TIMEOUT` | 504 | `SYSTEM` | `ERROR` | `true` | Database connection timed out |

---

## 7. Security Redaction

The logging library must enforce automated payload scrubbing. Values under the following keys must be replaced with `[REDACTED]`:
- `password`, `jwt`, `token`, `authorization`, `secret`, `service_role_key`, `key` (excluding last 4 characters of product keys).
