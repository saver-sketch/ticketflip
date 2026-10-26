import { cfg } from './config.js';
import { post } from './discord.js';
import { EXTRA } from './playbook-data.js';
const url = cfg.startWebhook(); if (!url) { console.log('no start webhook'); process.exit(1); }
await post({ url, embeds: EXTRA }); console.log('posted', EXTRA.length);
