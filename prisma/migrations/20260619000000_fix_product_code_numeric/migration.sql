-- Fix legacy string-based product codes by assigning each product a unique numeric code.
-- Older data may contain values such as PRO001 / PRD-123, which can no longer be cast
-- directly to an integer field in Prisma.
WITH numbered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS new_code
  FROM "products"
)
UPDATE "products" p
SET "productCode" = n.new_code
FROM numbered n
WHERE p."id" = n."id";

ALTER TABLE "products"
  ALTER COLUMN "productCode" TYPE INTEGER
  USING ("productCode"::INTEGER);

ALTER TABLE "products"
  ALTER COLUMN "productCode" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "products_productCode_key"
  ON "products"("productCode");
