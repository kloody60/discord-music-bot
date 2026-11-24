import {
  joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus,
  VoiceConnectionStatus, entersState, StreamType, NoSubscriberBehavior,
  getVoiceConnection,
} from '@discordjs/voice';
import fs from 'node:fs';
import { resolve as resolveQuery, streamAudio } from './ytdlp.js';
import { libraryPath } from './library.js';

export const queues = new Map();
export const events = new EventTarget();
const emit = gid => events.dispatchEvent(new CustomEvent('change', { detail: gid }));

class GuildQueue {
  constructor(guild) {
    this.guild = guild;
    this.tracks = [];      // المنتظرة
    this.current = null;
    this.loop = 'off';     // off | track | queue
    this.volume = 0.8;
    this.channelId = null;
    this.startedAt = 0;
    this.pausedAt = 0;
    this.error = null;
    this.proc = null;
    this.resource = null;
    this.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    this.player.on(AudioPlayerStatus.Idle, () => this.onIdle());
    this.player.on('error', e => {
      this.error = e.message;
      console.error('player error:', e.message);
    });
  }

  async join(channelId) {
    const ch = this.guild.channels.cache.get(channelId);
    if (!ch?.isVoiceBased()) throw new Error('قناة صوتية غير صالحة');
    if (this.connection && this.channelId === channelId &&
        this.connection.state.status !== VoiceConnectionStatus.Destroyed) return;
    this.connection?.destroy();
    this.channelId = channelId;
    this.connection = joinVoiceChannel({
      channelId, guildId: this.guild.id, adapterCreator: this.guild.voiceAdapterCreator,
      selfDeaf: true,
    });
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
      } catch { this.destroy(); }
    });
    this.connection.subscribe(this.player);
    await entersState(this.connection, VoiceConnectionStatus.Ready, 20000);
    emit(this.guild.id);
  }

  async add(query, requestedBy = 'dashboard') {
    const items = await resolveQuery(query);
    items.forEach(t => (t.by = requestedBy));
    this.tracks.push(...items);
    if (!this.current) await this.next();
    emit(this.guild.id);
    return items;
  }

  addFile(file, requestedBy = 'dashboard') {
    libraryPath(file); // يتحقق
    const t = { kind: 'file', title: file.replace(/\.[^.]+$/, ''), file, by: requestedBy, duration: 0 };
    this.tracks.push(t);
    if (!this.current) this.next();
    emit(this.guild.id);
    return t;
  }

  /** يشغل الصوت فوراً (من المكتبة) بدون ما يمس القائمة */
  async next() {
    this.cleanupProc();
    const t = this.tracks.shift();
    this.current = t || null;
    this.error = null;
    if (!t) { this.player.stop(true); emit(this.guild.id); this.onTrack?.(); return; }
    this.play(t);
  }

  play(t) {
    try {
      let input;
      if (t.kind === 'file') {
        input = fs.createReadStream(libraryPath(t.file));
      } else {
        this.proc = streamAudio(t.url);
        input = this.proc.stdout;
      }
      this.resource = createAudioResource(input, { inputType: StreamType.Arbitrary, inlineVolume: true });
      this.resource.volume.setVolume(this.volume);
      this.player.play(this.resource);
      this.startedAt = Date.now();
      this.pausedAt = 0;
    } catch (e) {
      this.error = e.message;
      this.next();
      return;
    }
    emit(this.guild.id);
    this.onTrack?.();
  }

  onIdle() {
    const done = this.current;
    if (done && this.loop === 'track') this.tracks.unshift(done);
    else if (done && this.loop === 'queue') this.tracks.push(done);
    this.next();
  }

  skip() {
    if (this.loop === 'track') this.current = null; // ما نعيد نفس المقطع
    if (this.player.state.status === AudioPlayerStatus.Idle) this.next();
    else this.player.stop(true); // حدث Idle يكمل للتالي
  }
  pause() { if (this.player.pause()) { this.pausedAt = Date.now(); emit(this.guild.id); } }
  resume() {
    if (this.player.unpause()) {
      this.startedAt += Date.now() - this.pausedAt; this.pausedAt = 0; emit(this.guild.id);
    }
  }
  stop() {
    this.tracks = []; this.loop = 'off'; this.current = null;
    this.cleanupProc(); this.player.stop(true); emit(this.guild.id);
  }
  setVolume(v) {
    this.volume = Math.min(1.5, Math.max(0, v));
    this.resource?.volume?.setVolume(this.volume); emit(this.guild.id);
  }
  setLoop(m) { this.loop = m; emit(this.guild.id); }
  remove(i) { this.tracks.splice(i, 1); emit(this.guild.id); }
  shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
    emit(this.guild.id);
  }

  cleanupProc() { try { this.proc?.kill(); } catch {} this.proc = null; }

  destroy() {
    this.stop();
    try { this.connection?.destroy(); } catch {}
    this.connection = null; this.channelId = null;
    queues.delete(this.guild.id);
    emit(this.guild.id);
  }

  state() {
    const elapsed = this.current
      ? Math.floor(((this.pausedAt || Date.now()) - this.startedAt) / 1000) : 0;
    return {
      guildId: this.guild.id, channelId: this.channelId, current: this.current,
      tracks: this.tracks, loop: this.loop, volume: this.volume, error: this.error,
      paused: this.player.state.status === AudioPlayerStatus.Paused, elapsed,
    };
  }
}

export function getQueue(guild) {
  let q = queues.get(guild.id);
  if (!q) { q = new GuildQueue(guild); queues.set(guild.id, q); }
  return q;
}

export function emptyState(guildId) {
  return { guildId, channelId: null, current: null, tracks: [], loop: 'off', volume: 0.8, paused: false, elapsed: 0 };
}

export { getVoiceConnection };
