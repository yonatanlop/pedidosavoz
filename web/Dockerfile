FROM node:20-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm install

FROM nginx:1.27-alpine

COPY --from=deps /app/node_modules/socket.io-client/dist/socket.io.min.js /usr/share/nginx/html/vendor/socket.io.min.js
COPY public/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
