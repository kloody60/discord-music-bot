import 'dotenv/config';
import {
  Client, GatewayIntentBits, SlashCommandBuilder, AttachmentBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { getQueue, queues } from './music.js';
import { startWeb } from './web.js';
import { listGuildSounds, fetchSound } from './soundboard.js';
import { listLibrary } from './library.js';

let readyResolve;
export const ready = new Promise(r => (readyResolve = r));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

const commands = [
  new SlashCommandBuilder().setName('play').setDescription('شغّل من أي رابط (يوتيوب/تيك توك/انستغرام...) أو بحث')
    .addStringOption(o => o.setName('query').setDescription('رابط أو اسم الأغنية').setRequired(true)),
  new SlashCommandBuilder().setName('playfile').setDescription('شغّل صوت من مكتبتك')
    .addStringOption(o => o.setName('name').setDescription('اسم الملف').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('panel').setDescription('أرسل لوحة أزرار التحكم'),
  new SlashCommandBuilder().setName('skip').setDescription('تخطي'),
  new SlashCommandBuilder().setName('pause').setDescription('إيقاف مؤقت'),
  new SlashCommandBuilder().setName('resume').setDescription('استئناف'),
  new SlashCommandBuilder().setName('stop').setDescription('إيقاف ومسح القائمة'),
  new SlashCommandBuilder().setName('leave').setDescription('اخرج من القناة'),
  new SlashCommandBuilder().setName('queue').setDescription('عرض القائمة'),
  new SlashCommandBuilder().setName('shuffle').setDescription('خلط القائمة'),
  new SlashCommandBuilder().setName('volume').setDescription('مستوى الصوت')
    .addIntegerOption(o => o.setName('percent').setDescription('0-150').setMinValue(0).setMaxValue(150).setRequired(true)),
  new SlashCommandBuilder().setName('loop').setDescription('تكرار')
    .addStringOption(o => o.setName('mode').setDescription('الوضع').setRequired(true)
      .addChoices({ name: 'إيقاف', value: 'off' }, { name: 'المقطع', value: 'track' }, { name: 'القائمة', value: 'queue' })),
  new SlashCommandBuilder().setName('sounds').setDescription('سحب أصوات السيرفر (Soundboard) كملفات'),
].map(c => c.toJSON());

client.once('clientReady', async () => {
  console.log(`البوت شغال: ${client.user.tag}`);
  await client.application.commands.set(commands);
  startWeb(client);
  readyResolve(client.user.tag);
});

const fmt = t => (t.kind === 'file' ? '📁 ' : '') + t.title;

// ---- لوحة الأزرار تحت رسالة "يشتغل الآن"
const LOOP_ICON = { off: '➡️ بدون تكرار', track: '🔂 المقطع', queue: '🔁 القائمة' };
function panel(q) {
  const s = q.state();
  const e = new EmbedBuilder().setColor(0x5865f2).setTitle(s.current ? `🎵 ${fmt(s.current)}` : 'ما فيه شيء يشتغل')
    .setDescription(`🔊 ${Math.round(s.volume * 100)}% · ${LOOP_ICON[s.loop]} · في الانتظار: ${s.tracks.length}` +
      (s.current?.by ? `\nطلب: ${s.current.by}` : ''));
  if (s.current?.thumbnail) e.setThumbnail(s.current.thumbnail);
  const b = (id, label, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId('m:' + id).setLabel(label).setStyle(style);
  return {
    embeds: [e],
    components: [
      new ActionRowBuilder().addComponents(
        b('toggle', s.paused ? '▶️ استئناف' : '⏸️ إيقاف مؤقت', ButtonStyle.Primary),
        b('skip', '⏭️ تخطي'), b('stop', '⏹️ إيقاف', ButtonStyle.Danger),
        b('loop', '🔁 تكرار'), b('shuffle', '🔀 خلط')),
      new ActionRowBuilder().addComponents(
        b('vdown', '🔉 -10'), b('vup', '🔊 +10'), b('queue', '📜 القائمة'), b('leave', '👋 اخرج', ButtonStyle.Danger)),
    ],
  };
}

async function sendPanel(q) {
  try { await q.panelMsg?.delete(); } catch {}
  q.panelMsg = null;
  if (!q.current || !q.textChannel) return;
  try { q.panelMsg = await q.textChannel.send(panel(q)); } catch {}
}

function bind(q, i) {
  q.textChannel = i.channel;
  q.onTrack = () => sendPanel(q);
}

async function handleButton(i) {
  const q = getQueue(i.guild);
  if (!q.channelId || i.member.voice.channelId !== q.channelId)
    return i.reply({ content: '❌ لازم تكون معي في نفس القناة الصوتية', ephemeral: true });
  const id = i.customId.slice(2);
  const ACT = {
    toggle: () => (q.state().paused ? q.resume() : q.pause()),
    loop: () => q.setLoop({ off: 'track', track: 'queue', queue: 'off' }[q.loop]),
    shuffle: () => q.shuffle(),
    vdown: () => q.setVolume(q.volume - 0.1),
    vup: () => q.setVolume(q.volume + 0.1),
  };
  if (ACT[id]) { ACT[id](); return i.update(panel(q)); }
  if (id === 'queue') {
    const s = q.state();
    return i.reply({
      ephemeral: true,
      content: s.tracks.length ? s.tracks.slice(0, 15).map((t, n) => `${n + 1}. ${fmt(t)}`).join('\n') : 'القائمة فاضية',
    });
  }
  await i.deferUpdate();
  if (id === 'skip') q.skip();
  else if (id === 'stop') { q.stop(); await i.message.delete().catch(() => {}); }
  else if (id === 'leave') { await i.message.delete().catch(() => {}); q.destroy(); }
}

client.on('interactionCreate', async i => {
  try {
    if (i.isAutocomplete()) {
      const v = i.options.getFocused().toLowerCase();
      return i.respond(listLibrary().filter(f => f.file.toLowerCase().includes(v))
        .slice(0, 25).map(f => ({ name: f.file.slice(0, 100), value: f.file.slice(0, 100) })));
    }
    if (i.isButton() && i.customId.startsWith('m:')) return handleButton(i);
    if (!i.isChatInputCommand()) return;
    const q = getQueue(i.guild);
    bind(q, i);
    const need = () => {
      const vc = i.member.voice.channelId;
      if (!vc) throw new Error('ادخل قناة صوتية أول');
      return vc;
    };

    switch (i.commandName) {
      case 'play': {
        const vc = need();
        await i.deferReply();
        await q.join(vc);
        const items = await q.add(i.options.getString('query'), i.user.tag);
        return i.editReply(items.length > 1 ? `➕ أضفت ${items.length} مقطع` : `➕ **${items[0].title}**`);
      }
      case 'playfile': {
        const vc = need();
        await q.join(vc);
        const t = q.addFile(i.options.getString('name'), i.user.tag);
        return i.reply(`📁 **${t.title}**`);
      }
      case 'panel': await i.reply({ content: '🎛️', ephemeral: true }); return sendPanel(q);
      case 'skip': q.skip(); return i.reply('⏭️');
      case 'pause': q.pause(); return i.reply('⏸️');
      case 'resume': q.resume(); return i.reply('▶️');
      case 'stop': q.stop(); return i.reply('⏹️');
      case 'leave': q.destroy(); return i.reply('👋');
      case 'shuffle': q.shuffle(); return i.reply('🔀');
      case 'volume': q.setVolume(i.options.getInteger('percent') / 100); return i.reply(`🔊 ${i.options.getInteger('percent')}%`);
      case 'loop': q.setLoop(i.options.getString('mode')); return i.reply(`🔁 ${i.options.getString('mode')}`);
      case 'queue': {
        const s = q.state();
        const e = new EmbedBuilder().setTitle('القائمة').setDescription(
          (s.current ? `▶️ **${fmt(s.current)}**\n\n` : 'لا شيء يشتغل\n\n') +
          s.tracks.slice(0, 15).map((t, n) => `${n + 1}. ${fmt(t)}`).join('\n') +
          (s.tracks.length > 15 ? `\n... و ${s.tracks.length - 15} أخرى` : ''));
        return i.reply({ embeds: [e] });
      }
      case 'sounds': {
        await i.deferReply();
        const list = await listGuildSounds(client, i.guild.id);
        if (!list.length) return i.editReply('ما فيه أصوات في هذا السيرفر');
        const files = [];
        for (const s of list.slice(0, 10)) {
          const { buf, ext } = await fetchSound(s.id);
          files.push(new AttachmentBuilder(buf, { name: `${s.name}${ext}` }));
        }
        return i.editReply({ content: `🔊 ${files.length}/${list.length} صوت (الباقي من لوحة التحكم)`, files });
      }
    }
  } catch (e) {
    const msg = '❌ ' + e.message;
    if (i.deferred || i.replied) i.editReply(msg).catch(() => {});
    else i.reply({ content: msg, ephemeral: true }).catch(() => {});
  }
});

process.on('unhandledRejection', e => console.error('unhandled:', e));
export const startBot = token => client.login(token);

// تشغيل مباشر بدون واجهة: node src/index.js
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())
    && !process.versions.electron) {
  if (!process.env.DISCORD_TOKEN) { console.error('حط DISCORD_TOKEN في .env'); process.exit(1); }
  startBot(process.env.DISCORD_TOKEN);
}
export { shutdown } from './music.js';
