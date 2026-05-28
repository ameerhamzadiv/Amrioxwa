FROM node:20-alpine3.21

# Apply latest OS security patches, then install build tools + curl for healthcheck
RUN apk upgrade --no-cache && \
    apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    git

WORKDIR /app

# Install production dependencies (--omit=dev replaces deprecated --only=production)
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy application code
COPY . .

# Create required directories
RUN mkdir -p sessions logs && \
    chown -R node:node /app && \
    chmod -R 775 sessions logs

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "src/app.js"]
