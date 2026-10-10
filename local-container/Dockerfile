# syntax=docker/dockerfile:1
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS tested
WORKDIR /data/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY api/app.js ./
COPY api/utils/ ./utils/
COPY local-container/tests/ /data/tests/
RUN mkdir -p /data/api/data && chown -R node:node /data
USER node
RUN node /data/tests/smoke.cjs

FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
LABEL org.opencontainers.image.title="CookieCloud local patch" \
      org.opencontainers.image.version="217612dd675d-p1" \
      org.opencontainers.image.source="https://github.com/billxc/CookieCloud" \
      org.opencontainers.image.revision="217612dd675d194db8036bc22e632173dc7ace34" \
      org.opencontainers.image.licenses="GPL-3.0-only"
ENV NODE_ENV=production
WORKDIR /data/api
COPY --from=tested --chown=node:node /data/api/ ./
COPY LICENSE /usr/share/licenses/cookiecloud/LICENSE
USER node
EXPOSE 8088
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e 'fetch("http://127.0.0.1:"+(process.env.PORT||8088)+(process.env.API_ROOT||"").trim().replace(/\/+$/, "")+"/health").then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))'
CMD ["node", "app.js"]
