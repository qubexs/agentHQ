# Build from the repo root:  docker compose up --build
FROM node:22-alpine
WORKDIR /app/apps/server
COPY apps/server/package*.json ./
RUN npm install --omit=dev
COPY apps/server ./
COPY apps/web ../web
RUN mkdir -p /data
ENV DB_PATH=/data/agenthq.db
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
