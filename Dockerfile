FROM node:lts-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci
