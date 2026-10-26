import { cfg } from './config.js';
import { post } from './discord.js';
import { PLAYBOOK } from './playbook-data.js';
const url = cfg.startWebhook();
if (!url) { console.log('no DISCORD_START_WEBHOOK_URL'); process.exit(1); }
await post({ url, content: '', embeds: PLAYBOOK });
console.log('playbook posted:', PLAYBOOK.length, 'sections');
