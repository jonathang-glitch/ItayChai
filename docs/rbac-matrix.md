# Tenancy and RBAC matrix

| Role | Tenant scope | session.read | session.write | tenant.manage | ops.break_glass | ops.dlq | MFA |
|---|---|---|---|---|---|---|---|
| owner | own tenant | yes | yes | yes | no | no | no |
| stakeholder | own tenant / own thread | yes | no | no | no | no | no |
| ops_admin | selected tenant after grant | yes | yes | no | yes | yes | required |
| service | job tenantId | yes | yes | no | no | no | n/a |

Rules:

- Every tenant-owned row has `tenant_id`.
- Users cannot set `x-tenant-id` to a tenant they do not belong to.
- Workers fail if `tenantId` is missing.
- Break-glass requires an ops admin, MFA, and a written reason. The grant is audited.
- DLQ replay requires an ops admin, MFA, and a written reason. The original message stays unchanged.
