FROM node:20-alpine

WORKDIR /app

ARG APP_ENV=development
ENV NODE_ENV={$APP_ENV}

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["node", "index.js"]