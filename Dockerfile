FROM node:lts-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN CI=true bash -c "$(curl -fsSL https://vite.plus)"
ENV PATH="/root/.vite-plus/bin:${PATH}"

COPY package*.json ./
RUN vp install
