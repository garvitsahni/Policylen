import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL,
  },
  // Enable for local development by default
  // You can toggle this for non-local environments
});