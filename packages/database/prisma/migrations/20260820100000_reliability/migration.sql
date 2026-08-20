CREATE TYPE "JobErrorClass" AS ENUM ('TRANSIENT', 'VALIDATION', 'AUTHORIZATION', 'PROVIDER', 'UNKNOWN');
CREATE TYPE "DlqStatus" AS ENUM ('OPEN', 'REPLAYED');

ALTER TABLE "outbox_messages" ADD COLUMN "last_error" TEXT;

CREATE TABLE "inbox_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "external_message_id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inbox_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inbox_messages_provider_external_message_id_key" ON "inbox_messages"("provider", "external_message_id");
CREATE INDEX "inbox_messages_tenant_id_idx" ON "inbox_messages"("tenant_id");
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_records_tenant_id_scope_key_key" ON "idempotency_records"("tenant_id", "scope", "key");
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "job_attempts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "job_key" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "error_class" "JobErrorClass",
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    CONSTRAINT "job_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "job_attempts_tenant_id_job_key_idx" ON "job_attempts"("tenant_id", "job_key");
ALTER TABLE "job_attempts" ADD CONSTRAINT "job_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "dlq_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "destination" TEXT NOT NULL,
    "event_id" TEXT,
    "payload" JSONB NOT NULL,
    "original_error" TEXT NOT NULL,
    "error_class" "JobErrorClass" NOT NULL,
    "status" "DlqStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dlq_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dlq_items_tenant_id_status_idx" ON "dlq_items"("tenant_id", "status");
ALTER TABLE "dlq_items" ADD CONSTRAINT "dlq_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "dlq_replays" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "dlq_item_id" UUID NOT NULL,
    "replayed_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dlq_replays_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dlq_replays_tenant_id_dlq_item_id_idx" ON "dlq_replays"("tenant_id", "dlq_item_id");
ALTER TABLE "dlq_replays" ADD CONSTRAINT "dlq_replays_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dlq_replays" ADD CONSTRAINT "dlq_replays_dlq_item_id_fkey" FOREIGN KEY ("dlq_item_id") REFERENCES "dlq_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inbox_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dlq_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dlq_replays" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "inbox_messages" USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "idempotency_records" USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "job_attempts" USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "dlq_items" USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "dlq_replays" USING (tenant_id::text = current_setting('app.tenant_id', true));
