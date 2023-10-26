FROM node:18 As Production

ENV NODE_ENV=production

WORKDIR /user/src/app

COPY package.json .
COPY package-lock.json .

COPY . .

RUN npm install 
RUN npm install typescript -g
RUN npm run build

# Expose the port that your application is running on
EXPOSE 8000


CMD ["npm","run","prod"]
