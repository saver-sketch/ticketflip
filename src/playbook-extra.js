import { cfg } from './config.js';
import { post } from './discord.js';
import { EXTRA } from './playbook-data.js';
const url = cfg.startWebhook(); if (!url) { console.log('no start webhook'); process.exit(1); }
const only = process.argv[2] ? EXTRA.slice(Number(process.argv[2])) : EXTRA;
await post({ url, embeds: only }); console.log('posted', only.length);
