-- CreateEnum
CREATE TYPE "BusinessUnitKind" AS ENUM ('STORE', 'PROPERTY', 'AGENCY');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- AlterTable
ALTER TABLE "agent_sessions" ADD COLUMN "business_unit_id" UUID;
CREATE INDEX "agent_sessions_tenant_id_id_idx" ON "agent_sessions"("tenant_id", "id");

-- CreateTable
CREATE TABLE "business_units" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kind" "BusinessUnitKind" NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "auth_subject" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'he-IL',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
    "is_ops_admin" BOOLEAN NOT NULL DEFAULT false,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" TEXT NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

CREATE TABLE "tenant_memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "business_unit_id" UUID,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "push_token" TEXT,
    "installation_id_hash" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stakeholder_identities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "channel" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    CONSTRAINT "stakeholder_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "break_glass_grants" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "break_glass_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_auth_subject_key" ON "users"("auth_subject");
CREATE UNIQUE INDEX "roles_tenant_id_name_key" ON "roles"("tenant_id", "name");
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");
CREATE UNIQUE INDEX "tenant_memberships_tenant_id_user_id_role_id_key" ON "tenant_memberships"("tenant_id", "user_id", "role_id");
CREATE INDEX "tenant_memberships_tenant_id_user_id_idx" ON "tenant_memberships"("tenant_id", "user_id");
CREATE INDEX "business_units_tenant_id_id_idx" ON "business_units"("tenant_id", "id");
CREATE UNIQUE INDEX "user_devices_push_token_key" ON "user_devices"("push_token");
CREATE UNIQUE INDEX "user_devices_installation_id_hash_key" ON "user_devices"("installation_id_hash");
CREATE INDEX "user_devices_user_id_platform_idx" ON "user_devices"("user_id", "platform");
CREATE UNIQUE INDEX "stakeholder_identities_tenant_id_channel_external_id_key" ON "stakeholder_identities"("tenant_id", "channel", "external_id");
CREATE INDEX "break_glass_grants_tenant_id_actor_user_id_idx" ON "break_glass_grants"("tenant_id", "actor_user_id");

ALTER TABLE "business_units" ADD CONSTRAINT "business_units_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stakeholder_identities" ADD CONSTRAINT "stakeholder_identities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stakeholder_identities" ADD CONSTRAINT "stakeholder_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "break_glass_grants" ADD CONSTRAINT "break_glass_grants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "domain_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'itay_chai_app') THEN
    CREATE ROLE itay_chai_app LOGIN PASSWORD 'app';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO itay_chai_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO itay_chai_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO itay_chai_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO itay_chai_app;

ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "business_units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_transitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "domain_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stakeholder_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "break_glass_grants" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "agent_sessions" USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "session_transitions" USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "domain_events" USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "outbox_messages" USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "audit_entries" USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "webhook_receipts" USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "messages" USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "business_units" USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "tenant_memberships" USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "stakeholder_identities" USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "break_glass_grants" USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "tenants" USING (id::text = current_setting('app.tenant_id', true));
