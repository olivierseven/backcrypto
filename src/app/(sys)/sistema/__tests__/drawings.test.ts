/**
 * Testes unitários da lógica de desenhos (chave de storage, constantes).
 * Rodar: npm test
 */
import { describe, it, expect } from "vitest";
import { getDrawStorageKey } from "../KlinesChartConstants";
import {
  FIB_STROKE_WIDTH_VALUES,
  FIB_STROKE_WIDTH_OPTIONS,
  TEXT_SIZE_FACTOR,
  type DrawSegment,
} from "../KlinesChartDrawing";

describe("getDrawStorageKey", () => {
  it("retorna símbolo|intervalo quando há símbolo", () => {
    expect(getDrawStorageKey("BTCUSDT", 60)).toBe("BTCUSDT|60");
    expect(getDrawStorageKey("ETHUSDT", 240)).toBe("ETHUSDT|240");
  });

  it("retorna só intervalo quando símbolo é null ou undefined", () => {
    expect(getDrawStorageKey(null, 60)).toBe("60");
    expect(getDrawStorageKey(undefined, 240)).toBe("240");
  });

  it("retorna só intervalo quando símbolo é string vazia (falsy)", () => {
    expect(getDrawStorageKey("", 60)).toBe("60");
  });
});

describe("KlinesChartDrawing constants", () => {
  it("FIB_STROKE_WIDTH_OPTIONS contém thin, medium, thick", () => {
    expect(FIB_STROKE_WIDTH_OPTIONS).toEqual(["thin", "medium", "thick"]);
  });

  it("FIB_STROKE_WIDTH_VALUES mapeia para números", () => {
    expect(FIB_STROKE_WIDTH_VALUES.thin).toBe(1);
    expect(FIB_STROKE_WIDTH_VALUES.medium).toBe(2);
    expect(FIB_STROKE_WIDTH_VALUES.thick).toBe(3);
  });

  it("TEXT_SIZE_FACTOR tem small, medium, large", () => {
    expect(TEXT_SIZE_FACTOR.small).toBeGreaterThan(0);
    expect(TEXT_SIZE_FACTOR.medium).toBeGreaterThan(TEXT_SIZE_FACTOR.small);
    expect(TEXT_SIZE_FACTOR.large).toBeGreaterThan(TEXT_SIZE_FACTOR.medium);
  });
});

describe("DrawSegment shape (serialização)", () => {
  it("segmento mínimo é serializável e tem index1, price1, index2, price2", () => {
    const seg: DrawSegment = {
      index1: 0,
      price1: 100,
      index2: 10,
      price2: 105,
    };
    const parsed = JSON.parse(JSON.stringify(seg)) as DrawSegment;
    expect(parsed.index1).toBe(0);
    expect(parsed.price1).toBe(100);
    expect(parsed.index2).toBe(10);
    expect(parsed.price2).toBe(105);
  });

  it("segmento Fibonacci com opções extra round-trip", () => {
    const seg: DrawSegment = {
      index1: 0,
      price1: 50000,
      index2: 20,
      price2: 48000,
      type: "fibonacci",
      color: "#0000ff",
      showPercent: true,
      fibLevel618Color: "#ff0000",
    };
    const str = JSON.stringify(seg);
    const parsed = JSON.parse(str) as DrawSegment;
    expect(parsed.type).toBe("fibonacci");
    expect(parsed.showPercent).toBe(true);
    expect(parsed.fibLevel618Color).toBe("#ff0000");
  });

  it("segmento reta horizontal com todas as opções round-trip", () => {
    const seg: DrawSegment = {
      index1: 5,
      price1: 50100,
      index2: 5,
      price2: 50100,
      type: "horizontalLine",
      color: "#0066cc",
      horizontalLineStrokeWidth: "thick",
      horizontalLineStrokeStyle: "dashed",
      horizontalLineShowValue: true,
      horizontalLineExtendToEnd: true,
      horizontalLineShowOnYAxis: true,
    };
    const parsed = JSON.parse(JSON.stringify(seg)) as DrawSegment;
    expect(parsed.type).toBe("horizontalLine");
    expect(parsed.color).toBe("#0066cc");
    expect(parsed.horizontalLineStrokeWidth).toBe("thick");
    expect(parsed.horizontalLineStrokeStyle).toBe("dashed");
    expect(parsed.horizontalLineShowValue).toBe(true);
    expect(parsed.horizontalLineExtendToEnd).toBe(true);
    expect(parsed.horizontalLineShowOnYAxis).toBe(true);
  });
});
