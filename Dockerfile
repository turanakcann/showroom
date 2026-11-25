FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node public ./public
COPY --chown=node:node data ./data
COPY --chown=node:node scripts ./scripts
RUN mkdir /app/var && chown node:node /app/var
USER node
ENV HOST=0.0.0.0 PORT=3000 SHOWROOM_DATA_DIR=/app/var
EXPOSE 3000
CMD ["node","scripts/serve.mjs"]
