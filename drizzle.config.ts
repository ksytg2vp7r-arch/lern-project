import { defineConfig } from 'drizzle-kit';

// Einstellungen für "npm run db:generate": erzeugt aus src/db/schema.ts
// neue Migrationsdateien im Ordner drizzle/.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
