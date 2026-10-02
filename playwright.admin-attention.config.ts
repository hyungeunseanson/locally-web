import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/ui',testMatch:['admin-attention-badges.spec.ts'],workers:1,reporter:'list',projects:[
  {name:'chromium',use:{browserName:'chromium',timezoneId:'America/Los_Angeles'}},
  {name:'webkit',use:{browserName:'webkit',timezoneId:'America/Los_Angeles'}},
]});
