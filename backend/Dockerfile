# Multi-stage build for smaller image
FROM node:20-alpine AS base
RUN apk add --no-cache openssl

# Development stage
FROM base AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
# 8D Excel şablonu (git'te backend/assets/ssh-8d-template.xlsx olarak bulunmalı)
RUN test -f assets/ssh-8d-template.xlsx || (echo "MISSING: assets/ssh-8d-template.xlsx" && exit 1)
EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push && npm start"]
