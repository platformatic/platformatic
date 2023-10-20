FROM node:21-alpine as base

ENV HOME=/home
ENV PLT_HOME=$HOME/platformatic/
ENV PNPM_HOME=$HOME/pnpm
ENV APP_HOME=$HOME/app
ENV PATH=/home/pnpm:$PATH

RUN mkdir $PNPM_HOME

# Install Platformatic in the $PLT_HOME folder
WORKDIR $PLT_HOME

# Install required packages
RUN apk update && apk add --no-cache python3 libc-dev make g++

# Install pnpm
RUN npm i pnpm@8 --location=global

# Copy lock files
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# Fetch all dependencies
RUN pnpm fetch --prod --frozen-lockfile

# Copy files
COPY . .

# Install all the deps in the source code
RUN pnpm install --prod --offline --node-linker=hoisted

# Add platformatic to path
RUN cd packages/cli && pnpm link --global

# No pnpm/build tools install here, we just copy the files from the previous stage
FROM node:21-alpine

# We don't need the build tools anymore
RUN apk update && apk add --no-cache dumb-init

ENV HOME=/home
ENV APP_HOME=$HOME/app
ENV PLT_HOME=$HOME/platformatic/

COPY --from=base $PLT_HOME $PLT_HOME

# Add platformatic to path
RUN cd $PLT_HOME/packages/cli && npm link

# Move to the app directory
WORKDIR $APP_HOME

# Reduce our permissions from root to a normal user
RUN chown node:node .
USER node

ENTRYPOINT ["dumb-init"]
CMD ["platformatic"]
