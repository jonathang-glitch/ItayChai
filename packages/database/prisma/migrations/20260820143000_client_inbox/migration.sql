ALTER TABLE "users" ADD COLUMN "name" TEXT;

ALTER TABLE "agent_sessions" ADD COLUMN "customer_user_id" UUID;
CREATE INDEX "agent_sessions_tenant_id_customer_user_id_idx" ON "agent_sessions"("tenant_id", "customer_user_id");
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
