'use strict';
import { CONFIG } from './config.js';
import { demoStore } from './store-demo.js';
import { liveStore } from './store-supabase.js';

export const api = CONFIG.mode === 'live' && CONFIG.supabaseUrl && CONFIG.supabaseKey ? liveStore : demoStore;
