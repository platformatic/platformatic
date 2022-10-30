import { vi } from 'vitest';
import restClient from ".";

describe("Data Simple REST Client", () => {
  describe("getList", () => {
    it("should compose the url correctly", async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          headers: new Headers({
            "x-total-count": "42",
          }),
        })
      );
      const client = restClient("http://localhost:3000", httpClient);

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

      expect(httpClient).toHaveBeenCalledWith(
        "http://localhost:3000/posts?limit=10&offset=0&orderby.title=desc&totalCount=true"
      );
    });

    it("should throw an error if the response doesn't contain the 'x-total-count' header", async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          headers: new Headers({}),
          json: [{ id: 1 }],
          status: 200,
          body: "", 
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
  });
});
