# Location dataset

The seed script (`src/scripts/seed-locations.ts`) reads the **India Post All
India Pincode Directory** CSV. It is public and free.

## Download

1. Get the CSV from the Open Government Data platform:
   https://www.data.gov.in/catalog/all-india-pincode-directory
   (mirrors such as the Kaggle "All India Pincode Directory" also work — the
   parser tolerates the common column-name variants).
2. Save it here as `data/pincodes.csv` (or anywhere, and pass the path).

## Seed

```bash
# uses data/pincodes.csv by default
npm run seed:locations

# or an explicit path
npx tsx src/scripts/seed-locations.ts /path/to/pincodes.csv
```

Requires `MONGODB_URI` in `.env.local`. The script is idempotent — safe to
re-run; it never changes an assigned slug or undoes an admin activation.

> The CSV itself is git-ignored (large, and its licence restricts
> redistribution). Only this README is tracked.
