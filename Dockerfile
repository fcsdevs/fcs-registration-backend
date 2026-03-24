FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev && \
    npx prisma generate

COPY . .

EXPOSE 5005

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
