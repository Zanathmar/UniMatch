"""
Backfill scholarship_slugs and linked_university_slugs from existing data.

For each university:
  - Collect all unique scholarship_ids from all programs → set as scholarship_slugs

For each scholarship:
  - If university_slug (string) is set → linked_university_slugs = [university_slug]
  - If university_slugs (list) is set → linked_university_slugs = university_slugs

Run once: python3 migrate_backfill_linking.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient


async def migrate():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["unimatch"]

    print("=== Step 1: Backfill scholarship_slugs on universities ===")
    unis = await db.universities.find({}).to_list(1000)
    for u in unis:
        slug = u["slug"]
        # Collect all scholarship_ids from all programs
        all_slugs = []
        for p in u.get("programs", []):
            for s in p.get("scholarship_ids", []):
                if s not in all_slugs:
                    all_slugs.append(s)

        current_slugs = u.get("scholarship_slugs", [])
        if set(all_slugs) != set(current_slugs):
            await db.universities.update_one(
                {"slug": slug},
                {"$set": {"scholarship_slugs": all_slugs}}
            )
            print(f"  {slug}: scholarship_slugs = {all_slugs}")
        else:
            print(f"  {slug}: already in sync (no change)")

    print("\n=== Step 2: Backfill linked_university_slugs on scholarships ===")
    schs = await db.scholarships.find({}).to_list(1000)
    for s in schs:
        slug = s["slug"]

        # Determine linked universities from existing fields
        linked = []

        # Check university_slug (string - used by seed/curated)
        univ_slug = s.get("university_slug")
        if univ_slug:
            linked.append(univ_slug)

        # Check university_slugs (list - used by custom scholarships)
        univ_slugs_list = s.get("university_slugs", [])
        if isinstance(univ_slugs_list, list):
            for us in univ_slugs_list:
                if us not in linked:
                    linked.append(us)

        current_linked = s.get("linked_university_slugs", [])
        if set(linked) != set(current_linked):
            await db.scholarships.update_one(
                {"slug": slug},
                {"$set": {"linked_university_slugs": linked}}
            )
            print(f"  {slug}: linked_university_slugs = {linked}")
        else:
            print(f"  {slug}: already in sync (no change)")

    print("\n=== Step 3: Verify ===")
    # Check a few key ones
    checks = [
        ("universities", "tum"),
        ("universities", "custom-budapest-university-of-technology-d4ddc4"),
        ("universities", "mit"),
        ("scholarships", "daad-epos"),
        ("scholarships", "custom-stipendium-hungaricum-scholarship-d65ba4"),
        ("scholarships", "mit-need"),
    ]
    for coll, slug in checks:
        doc = await db[coll].find_one({"slug": slug})
        if doc is None:
            print(f"  {coll}.{slug}: NOT FOUND")
            continue
        if coll == "universities":
            print(f"  {coll}.{slug}: scholarship_slugs = {doc.get('scholarship_slugs', [])}")
        else:
            print(f"  {coll}.{slug}: linked_university_slugs = {doc.get('linked_university_slugs', [])}, university_slug = {doc.get('university_slug')}")

    client.close()
    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(migrate())
