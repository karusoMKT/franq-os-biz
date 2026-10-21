import { describe, expect, test } from "bun:test";
import { requirePayableUnit } from "./payable-unit";

describe("payable unit selection for manual and AI entry", () => {
  const units = [{ id: "store-a" }, { id: "store-b" }];
  test("unit selection is mandatory", () => {
    expect(() => requirePayableUnit("", units)).toThrow("Selecione a unidade");
  });
  test("the selected store is preserved instead of the profile store", () => {
    expect(requirePayableUnit("store-b", units)).toBe("store-b");
  });
  test("stores outside the company cannot be selected", () => {
    expect(() => requirePayableUnit("other-company-store", units)).toThrow("Selecione uma unidade da sua empresa");
  });
});