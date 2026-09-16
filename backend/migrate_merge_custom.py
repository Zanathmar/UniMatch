"""
One-time migration: merge custom_universities → universities, custom_scholarships → scholarships.

For custom entries: user_id is already set correctly in the source collections.
For scholarships: university_slug (list) is migrated to university_slugs (list),
                 university_slug (singular) is set to None.

Run once: python3 migrate_merge_custom.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient


async def migrate():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["unimatch"]

    print("=== Step 1: Migrate custom_universities → universities ===")
    custom_unis = await db.custom_universities.find({}).to_list(1000)
    print(f"  Found {len(custom_unis)} custom universities to migrate")

    for u in custom_unis:
        slug = u["slug"]
        # Check if already exists in universities (shouldn't happen, but safety check)
        existing = await db.universities.find_one({"slug": slug})
        if existing:
            print(f"  SKIP {slug}: already in universities")
            continue

        # Strip _id, keep everything else including user_id
        doc = {k: v for k, v in u.items() if k != "_id"}
        await db.universities.insert_one(doc)
        print(f"  MIGRATED {slug} ({u.get('name')})")

    print(f"\n=== Step 2: Migrate custom_scholarships → scholarships ===")
    custom_schs = await db.custom_scholarships.find({}).to_list(1000)
    print(f"  Found {len(custom_schs)} custom scholarships to migrate")

    for s in custom_schs:
        slug = s["slug"]
        existing = await db.scholarships.find_one({"slug": slug})
        if existing:
            print(f"  SKIP {slug}: already in scholarships")
            continue

        # Migrate university_slug (list) → university_slugs (list)
        old_univ_slug = s.get("university_slug", [])
        if isinstance(old_univ_slug, list):
            university_slugs = old_univ_slug
        else:
            university_slugs = []

        doc = {k: v for k, v in s.items() if k != "_id"}
        doc["university_slugs"] = university_slugs   # new list field
        doc["university_slug"] = None               # singular compat field (always None for custom)

        await db.scholarships.insert_one(doc)
        print(f"  MIGRATED {slug} ({s.get('name')})")
        print(f"    university_slugs = {university_slugs}")

    print(f"\n=== Step 3: Verify universities collection ===")
    total_unis = await db.universities.count_documents({})
    curated_unis = await db.universities.count_documents({"source": "curated"})
    custom_unis_in_main = await db.universities.count_documents({"source": "custom"})
    print(f"  Total universities: {total_unis}")
    print(f"  Curated: {curated_unis}, Custom (user-owned): {custom_unis_in_main}")

    print(f"\n=== Step 4: Verify scholarships collection ===")
    total_schs = await db.scholarships.count_documents({})
    curated_schs = await db.scholarships.count_documents({"source": "curated"})
    custom_schs_in_main = await db.scholarships.count_documents({"source": "custom"})
    print(f"  Total scholarships: {total_schs}")
    print(f"  Curated: {curated_schs}, Custom (user-owned): {custom_schs_in_main}")

    print(f"\n=== Step 5: Drop old collections ===")
    await db.custom_universities.drop()
    print("  Dropped custom_universities")
    await db.custom_scholarships.drop()
    print("  Dropped custom_scholarships")

    print(f"\n=== Migration complete ===")
    print(f"Universities: {curated_unis} curated + {custom_unis_in_main} user-owned = {total_unis} total")
    print(f"Scholarships: {curated_schs} curated + {custom_schs_in_main} user-owned = {total_schs} total")

    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
