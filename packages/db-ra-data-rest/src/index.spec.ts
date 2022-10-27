import { fetchUtils } from "ra-core";

fetchUtils.fetchJson = jest.fn(() => {
  return null;
});

jest.fn();

describe("Platformatic data provider", () => {
  describe("getList", () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it("", () => {});
  });
});
