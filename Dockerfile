
FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --production

COPY . .

ENV NODE_ENV=production

EXPOSE 3005

CMD ["npm", "run", "start:all"]
