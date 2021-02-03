# Migration `20210128074441-add-description-to-repo`

This migration has been generated by Ameer Jhan <ameerjhanprof@gmail.com> at 1/28/2021, 1:14:41 PM.
You can check out the [state of the schema](./schema.prisma) after the migration.

## Database Steps

```sql
ALTER TABLE "public"."repositories" ADD COLUMN "description" text   
```

## Changes

```diff
diff --git schema.prisma schema.prisma
migration 20210128063026-add-owner-to-repo..20210128074441-add-description-to-repo
--- datamodel.dml
+++ datamodel.dml
@@ -1,7 +1,7 @@
 datasource db {
   provider = "postgresql"
-  url = "***"
+  url = "***"
 }
 generator client {
   provider = "prisma-client-js"
@@ -37,7 +37,8 @@
   tier Tier? @relation(fields: [tierId], references: [id])
   userId Int
   user User @relation(fields: [userId], references: [id])
   ownerOrOrg String
+  description String?
   @@unique([userId, name, ownerOrOrg])
   @@index([userId, name])
 }
```

