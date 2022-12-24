# stage 1 
FROM node:18-alpine as builder

ENV HOME=/home
ENV PLT_HOME=$HOME/platformatic/
ENV PNPM_HOME=$HOME/pnpm
ENV APP_HOME=$HOME/app
ENV PATH=/home/pnpm:$PATH

RUN mkdir $PNPM_HOME

# Install Platformatic in the $PLT_HOME folder
WORKDIR $PLT_HOME

# Install required packages
RUN apk update && apk add --no-cache dumb-init python3 libc-dev make g++

# Install pnpm
RUN npm i pnpm --location=global

# Copy lock files
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./


# Fetch all dependencies
RUN pnpm fetch --prod --frozen-lockfile

# Copy files
COPY . .

# Install all the deps in the source code
RUN pnpm install --prod --offline

# Add platformatic to path
RUN cd packages/cli && pnpm link --global

# Move to the app directory
WORKDIR $APP_HOME

# Reduce our permissions from root to a normal user
RUN chown node:node . 
USER node

# stage 2 
FROM node:18-buster-slim

USER node

# Copy files
COPY . .

# Move to the app directory
WORKDIR $APP_HOME

ENTRYPOINT ["dumb-init"]
CMD ["platformatic"]
