FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# yt-dlp (نسخة مستقلة بدون بايثون)
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
      -o /usr/local/bin/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp

WORKDIR /app
COPY package.json package-lock.json ./
# بدون سكربتات التثبيت (ffmpeg-static ما نحتاجه، ffmpeg مثبّت من النظام)
RUN npm ci --omit=dev --ignore-scripts

COPY src ./src
COPY public ./public

ENV BOT_DATA_DIR=/data \
    HOST=0.0.0.0 \
    PORT=3737
VOLUME /data
EXPOSE 3737

# يحدّث yt-dlp كل ما يشتغل الحاوية، وبعدها يشغّل البوت
CMD ["sh", "-c", "yt-dlp -U >/dev/null 2>&1 || true; exec node src/index.js"]
