import { describe, it, expect } from "vitest";
import {
  diaMes,
  diaMesCurto,
  fimDeYmd,
  fimDoDia,
  inicioDeYmd,
  inicioDoAno,
  inicioDoDia,
  inicioDoMes,
  meiaNoiteSP,
  mesIndiceSP,
  partesSP,
  ymdSP,
} from "./fuso";

// São Paulo = UTC-3 (sem horário de verão desde 2019)
const utc = (s: string) => Date.parse(s);

describe("fuso da loja (America/Sao_Paulo)", () => {
  it("venda das 22h de 31/10 em SP é de outubro, mesmo já sendo 01/11 em UTC", () => {
    const venda = utc("2026-11-01T01:00:00Z"); // 31/10 22:00 em SP
    expect(ymdSP(venda)).toBe("2026-10-31");
    expect(mesIndiceSP(venda)).toBe(9);
    expect(venda).toBeLessThan(inicioDoMes(utc("2026-11-15T12:00:00Z")));
  });

  it("meia-noite de SP = 03:00 UTC", () => {
    expect(meiaNoiteSP(2026, 11, 1)).toBe(utc("2026-11-01T03:00:00Z"));
    expect(inicioDoDia(utc("2026-11-02T02:59:59Z"))).toBe(utc("2026-11-01T03:00:00Z"));
    expect(inicioDoDia(utc("2026-11-02T03:00:00Z"))).toBe(utc("2026-11-02T03:00:00Z"));
  });

  it("início/fim do dia com deslocamento", () => {
    const agora = utc("2026-11-02T15:00:00Z");
    expect(inicioDoDia(agora, -6)).toBe(utc("2026-10-27T03:00:00Z"));
    expect(fimDoDia(agora)).toBe(utc("2026-11-03T02:59:59.999Z"));
  });

  it("início do mês e mês anterior, inclusive virando o ano", () => {
    const jan = utc("2027-01-10T12:00:00Z");
    expect(inicioDoMes(jan)).toBe(utc("2027-01-01T03:00:00Z"));
    expect(inicioDoMes(jan, -1)).toBe(utc("2026-12-01T03:00:00Z"));
    expect(inicioDoMes(jan, -13)).toBe(utc("2025-12-01T03:00:00Z"));
    // 1º/jan 01:00 UTC ainda é 31/12 em SP
    expect(inicioDoMes(utc("2027-01-01T01:00:00Z"))).toBe(utc("2026-12-01T03:00:00Z"));
    expect(inicioDoAno(utc("2027-01-01T01:00:00Z"))).toBe(utc("2026-01-01T03:00:00Z"));
  });

  it("YYYY-MM-DD de <input type=date> vira o dia inteiro em SP", () => {
    expect(inicioDeYmd("2026-10-31")).toBe(utc("2026-10-31T03:00:00Z"));
    expect(fimDeYmd("2026-10-31")).toBe(utc("2026-11-01T02:59:59.999Z"));
    expect(fimDeYmd("2026-12-31")).toBe(utc("2027-01-01T02:59:59.999Z"));
    expect(inicioDeYmd("")).toBeNaN();
    expect(fimDeYmd("31/10/2026")).toBeNaN();
  });

  it("rótulos do gráfico e do fluxo usam o dia de SP", () => {
    const t = utc("2026-11-01T01:00:00Z");
    expect(diaMesCurto(t)).toBe("31/10");
    expect(diaMes(utc("2026-03-05T12:00:00Z"))).toBe("05/03");
  });

  it("partesSP devolve hora 0-23 (meia-noite não vira 24)", () => {
    expect(partesSP(utc("2026-11-02T03:00:00Z")).hora).toBe(0);
  });

  it("acompanha horário de verão antigo (2018: SP era UTC-2 em dezembro)", () => {
    expect(meiaNoiteSP(2018, 12, 1)).toBe(utc("2018-12-01T02:00:00Z"));
  });
});
