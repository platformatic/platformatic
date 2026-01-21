FROM node:22-slim as base

ENV HOME=/home
ENV PLT_HOME=$HOME/platformatic/
ENV PNPM_HOME=$HOME/pnpm
ENV APP_HOME=$HOME/app
ENV PATH=/home/pnpm:$PATH

RUN mkdir $PNPM_HOME

# Install Platformatic in the $PLT_HOME folder
WORKDIR $PLT_HOME

# Install required packages
RUN apt-get update && apt-get install -y --no-install-recommends python3 libc-dev make g++ && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm i pnpm@9 --location=global

# Copy lock files
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# Fetch all dependencies
RUN pnpm fetch --prod --frozen-lockfile

# Copy files
COPY . .

# Install all the deps in the source code
RUN pnpm install --prod --offline --node-linker=hoisted --shamefully-hoist --force

# Add platformatic to path
RUN cd packages/cli && pnpm link --global

# Add wattpm to path
RUN cd packages/wattpm && pnpm link --global

# No pnpm/build tools install here, we just copy the files from the previous stage
FROM node:22-slim

# Make pnpm available
RUN npm install -g pnpm@9

# We don't need the build tools anymore
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && rm -rf /var/lib/apt/lists/*

ENV HOME=/home
ENV APP_HOME=$HOME/app
ENV PLT_HOME=$HOME/platformatic/
ENV PNPM_HOME=$HOME/pnpm
ENV PATH=$PNPM_HOME:$PATH

COPY --from=base $PLT_HOME $PLT_HOME
COPY --from=base $PNPM_HOME $PNPM_HOME

# Add platformatic to path
RUN cd $PLT_HOME/packages/cli && pnpm link --global

# Move to the app directory
WORKDIR $APP_HOME

# Reduce our permissions from root to a normal user
RUN chown node:node .
USER node

ENTRYPOINT ["dumb-init"]
CMD ["platformatic"]
