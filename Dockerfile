FROM node:20-alpine

WORKDIR /app

# Prevent the development-only memory MongoDB package from downloading MongoDB.
ENV MONGOMS_DISABLE_POSTINSTALL=1

COPY package*.json ./

# Tailwind/PostCSS are required during build and concurrently is currently used
# by the production start script, so include development dependencies.
RUN npm ci --include=dev

COPY . .

# This value is compiled into the Next.js browser bundle.
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_GOOGLE_ENABLED

ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_GOOGLE_ENABLED=$NEXT_PUBLIC_GOOGLE_ENABLED

RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000 5001

CMD ["npm", "start"]
