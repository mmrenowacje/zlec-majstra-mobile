import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isWithinContractorServiceArea } from "./service-area";

describe("contractor service area", () => {
  it("includes the same locality despite casing and district suffixes", () => {
    assert.equal(
      isWithinContractorServiceArea("Warszawa, Mokotów", "warszawa"),
      true,
    );
  });

  it("includes a locality within 50 km", () => {
    assert.equal(
      isWithinContractorServiceArea("Pruszków", "Warszawa"),
      true,
    );
  });

  it("excludes a locality farther than 50 km", () => {
    assert.equal(
      isWithinContractorServiceArea("Poznań", "Warszawa"),
      false,
    );
  });

  it("uses exact matching for localities outside the coordinate catalogue", () => {
    assert.equal(
      isWithinContractorServiceArea("Mała Wieś", "Mała Wieś"),
      true,
    );
    assert.equal(
      isWithinContractorServiceArea("Inna Wieś", "Mała Wieś"),
      false,
    );
  });
});