import { vi } from "vitest";
import restClient from ".";

describe("Data Simple REST Client", () => {
  describe("getList", () => {
    it("should compose the right URL", async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          headers: new Headers({
            "x-total-count": "42",
          }),
        })
      );
      const client = restClient("http://localhost:3000", httpClient);

      await client.getList("posts", {
        filter: {
          username: "jack",
        },
        pagination: {
          page: 1,
          perPage: 10,
        },
        sort: {
          field: "title",
          order: "desc",
        },
      });

      expect(httpClient).toHaveBeenCalledWith(
        "http://localhost:3000/posts?limit=10&offset=0&orderby.title=desc&totalCount=true&where.username.eq=jack"
      );
    });

    it("should return 'total' and 'data' fields", async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          headers: new Headers({
            "x-total-count": "42",
          }),
          json: {
            test: "prop",
          },
        })
      );
      const client = restClient("http://localhost:3000", httpClient);

      const response = await client.getList("posts", {
        filter: {},
        pagination: {
          page: 1,
          perPage: 10,
        },
        sort: {},
      });

      expect(response).toMatchObject({
        total: 42,
        data: {
          test: "prop",
        },
      });
    });

    it("should throw an error if the response doesn't contain the 'x-total-count' header", async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          headers: new Headers({}),
          json: [{ id: 1 }],
          status: 200,
        })
      );
      const client = restClient("http://localhost:3000", httpClient);

      try {
        await client.getList("posts", {
          filter: {},
          pagination: {
            page: 1,
            perPage: 10,
          },
          sort: {
            field: "title",
            order: "desc",
          },
        });
      } catch (e) {
        expect(e.message).toBe(
          "The X-Total-Count header is missing in the HTTP Response. The jsonServer Data Provider expects responses for lists of resources to contain this header with the total number of results to build the pagination. If you are using CORS, did you declare X-Total-Count in the Access-Control-Expose-Headers header?"
        );
      }
    });

    it("should throw if the request throws", async () => {
      const httpClient = vi.fn(() => Promise.reject(new Error("error")));
      const client = restClient("http://localhost:3000", httpClient);

      try {
        await client.getList("posts", {
          filter: {},
          pagination: {
            page: 1,
            perPage: 10,
          },
          sort: {
            field: "title",
            order: "desc",
          },
        });
      } catch (e) {
        expect(e.message).toBe("error");
      }
    });
  });

  describe("getOne", () => {
    it("should compose the right URL", async () => {
      const httpClient = vi.fn(() => Promise.resolve({}));
      const client = restClient("http://localhost:3000", httpClient);

      await client.getOne("post", { id: 1 });
      expect(httpClient).toHaveBeenCalledWith("http://localhost:3000/post/1");
    });

    it("should return the data field", async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          json: {
            userId: 1,
          },
        })
      );
      const client = restClient("http://localhost:3000", httpClient);

      const response = await client.getOne("post", { id: 1 });
      expect(response).toMatchObject({ data: { userId: 1 } });
    });

    it("should throw if the request throws", async () => {
      const httpClient = vi.fn(() => Promise.reject(new Error("error")));
      const client = restClient("http://localhost:3000", httpClient);

      try {
        await client.getOne("post", { id: 1 });
      } catch (e) {
        expect(e.message).toBe("error");
      }
    });
  });
});
