FROM node:lts-alpine3.9

WORKDIR /home/node

COPY . .

RUN npm install

EXPOSE 3000

CMD node index.js