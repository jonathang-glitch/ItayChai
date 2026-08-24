ALTER TYPE "ShiftSwapStatus" ADD VALUE 'SEEKING';
ALTER TYPE "ShiftSwapStatus" ADD VALUE 'MATCH_PROPOSED';
ALTER TYPE "ShiftSwapStatus" ADD VALUE 'COMMITTED';
ALTER TYPE "ShiftSwapStatus" ADD VALUE 'UNFILLED';
ALTER TYPE "ShiftSwapStatus" ADD VALUE 'CANCELLED';

CREATE TYPE "ShiftRequestKind" AS ENUM ('COVER', 'SWAP', 'EITHER');
CREATE TYPE "ShiftOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'QUEUED', 'CANCELLED');

ALTER TABLE "shift_swap_requests"
  ADD COLUMN "kind" "ShiftRequestKind" NOT NULL DEFAULT 'COVER',
  ADD COLUMN "counterpart_employee_id" UUID,
  ADD COLUMN "proposed_shift_id" UUID;

ALTER TABLE "shift_swap_requests"
  ADD CONSTRAINT "shift_swap_requests_counterpart_employee_id_fkey"
  FOREIGN KEY ("counterpart_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shift_swap_requests"
  ADD CONSTRAINT "shift_swap_requests_proposed_shift_id_fkey"
  FOREIGN KEY ("proposed_shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "shift_offers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "proposed_shift_id" UUID,
    "allow_cover" BOOLEAN NOT NULL DEFAULT false,
    "allow_swap" BOOLEAN NOT NULL DEFAULT false,
    "status" "ShiftOfferStatus" NOT NULL DEFAULT 'PENDING',
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shift_offers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shift_offers_request_id_employee_id_key" ON "shift_offers"("request_id", "employee_id");
CREATE INDEX "shift_offers_tenant_id_employee_id_status_idx" ON "shift_offers"("tenant_id", "employee_id", "status");

ALTER TABLE "shift_offers" ADD CONSTRAINT "shift_offers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shift_offers" ADD CONSTRAINT "shift_offers_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "shift_swap_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shift_offers" ADD CONSTRAINT "shift_offers_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shift_offers" ADD CONSTRAINT "shift_offers_proposed_shift_id_fkey" FOREIGN KEY ("proposed_shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "shift_offers" TO itay_chai_app;

ALTER TABLE "shift_offers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "shift_offers" USING (tenant_id::text = current_setting('app.tenant_id', true));
