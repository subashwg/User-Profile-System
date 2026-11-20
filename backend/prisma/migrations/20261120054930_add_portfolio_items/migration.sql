-- CreateEnum
CREATE TYPE "portfolio_item_kind" AS ENUM ('video', 'article', 'course', 'project', 'product', 'other');

-- CreateEnum
CREATE TYPE "cover_source" AS ENUM ('none', 'link', 'upload');

-- CreateTable
CREATE TABLE "portfolio_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "kind" "portfolio_item_kind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "cover_url" TEXT,
    "cover_source" "cover_source" NOT NULL DEFAULT 'none',
    "source_site" TEXT,
    "published_on" TIMESTAMP(3),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_items_user_id_idx" ON "portfolio_items"("user_id");

-- CreateIndex
CREATE INDEX "portfolio_items_role_id_idx" ON "portfolio_items"("role_id");

-- AddForeignKey
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
