FROM node:lts-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install
