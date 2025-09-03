"use strict";

const { join } = require("node:path");
const { readFile } = require("node:fs/promises");
const { request } = require("undici");

module.exports = async function (fastify) {
  fastify.get("/example", async () => {
    return { hello: "world" };
  });

  fastify.get("/config", async () => {
    return fastify.platformatic.config;
  });

  fastify.get("/preprocess", async () => {
    return {
      base: "~PLT_BASE_PATH",
      leadingSlash: "/~PLT_BASE_PATH",
      withPrefix: "~PLT_BASE_PATH/foo",
      externalUrl: "~PLT_EXTERNAL_APP_URL",
    };
  });

  fastify.get("/custom-ext-file", async () => {
    const customExtFilePath = join(__dirname, "..", "file.custom");
    const customExtFile = await readFile(customExtFilePath, "utf8");
    return { data: customExtFile };
  });

  fastify.get("/env", async () => {
    return { env: process.env };
  });

  fastify.post("/request", async (req) => {
    const { method, url } = req.body;

    const { statusCode, headers, body } = await request(url, {
      method: method ?? "GET",
      headers: {
        "content-type": "application/json",
      },
    });
    const data = await body.text();

    return { statusCode, headers, data };
  });
};
