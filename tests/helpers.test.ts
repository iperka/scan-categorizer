import { Helpers } from "../src/helpers";

describe("Helpers", () => {
  describe("populate()", () => {
    [
      { v: Helpers.populate("Test"), e: "Test" },
      { v: Helpers.populate("Test/$y"), e: "Test/2022" },
      { v: Helpers.populate("Test/$y/$m"), e: "Test/2022/03" },
      {
        v: Helpers.populate("Test/$y/$m/$name", new Date(), { name: "Test" }),
        e: "Test/2022/03/Test",
      },
    ].forEach((test) => {
      it(`should return '${test.e}' for populate(${test.v})`, () => {
        expect(test.v).toEqual(test.e);
      });
    });
  });
});
