# The production image: Node 22 on Alpine, with production dependencies only.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Dependencies first: Docker reuses this layer until package.json or the lock file changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Run as the unprivileged user the node image ships with, not as root.
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]