# The store-verification sidecar (zero-dependency Node, see README).
# Credentials (PLAY_*/APPLE_*/GOOGLE_*) are container env — never in the repo.
FROM node:22-alpine
WORKDIR /app
COPY server.js verify.js ./
# Container defaults; the host-loopback default (127.0.0.1) is wrong inside
# a network, so bind all interfaces on the internal-only compose network.
ENV MDOOM_SIDECAR_HOST=0.0.0.0 \
    MDOOM_SIDECAR_PORT=8180
EXPOSE 8180
USER node
CMD ["node", "server.js"]
