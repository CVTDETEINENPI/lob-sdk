import { getEloRangeByTime, MAX_ELO_RANGE } from "./matchmaking";

describe("getEloRangeByTime()", () => {
  it("should return 100 for a date less than 10 seconds ago", () => {
    const now = new Date("2025-04-20T12:00:00Z");
    const createdAt = new Date("2025-04-20T11:59:55Z"); // 5 seconds ago
    expect(getEloRangeByTime(createdAt.getTime(), now.getTime())).toBe(100);
  });

  it("should return for a date between 10 and 19 seconds ago", () => {
    const now = new Date("2025-04-20T12:00:00Z");
    const createdAt = new Date("2025-04-20T11:59:50Z"); // 10 seconds ago
    expect(getEloRangeByTime(createdAt.getTime(), now.getTime())).toBe(140);
  });

  it("should return for a date between 20 and 29 seconds ago", () => {
    const now = new Date("2025-04-20T12:00:00Z");
    const createdAt = new Date("2025-04-20T11:59:40Z"); // 20 seconds ago
    expect(getEloRangeByTime(createdAt.getTime(), now.getTime())).toBe(180);
  });

  it("should return for a date between 30 and 39 seconds ago", () => {
    const now = new Date("2025-04-20T12:00:00Z");
    const createdAt = new Date("2025-04-20T11:59:30Z"); // 30 seconds ago
    expect(getEloRangeByTime(createdAt.getTime(), now.getTime())).toBe(220);
  });

  it("should return for a date between 40 and 49 seconds ago", () => {
    const now = new Date("2025-04-20T12:00:00Z");
    const createdAt = new Date("2025-04-20T11:59:20Z"); // 40 seconds ago
    expect(getEloRangeByTime(createdAt.getTime(), now.getTime())).toBe(260);
  });

  it("should return for a date 50 or more seconds ago", () => {
    const now = new Date("2025-04-20T12:00:00Z");
    const createdAt = new Date("2025-04-20T11:59:10Z"); // 50 seconds ago
    expect(getEloRangeByTime(createdAt.getTime(), now.getTime())).toBe(300);
  });

  it("should return for a date far in the past", () => {
    const now = new Date("2025-04-20T12:00:00Z");
    const createdAt = new Date("2025-04-20T11:00:00Z"); // 1 hour ago
    expect(getEloRangeByTime(createdAt.getTime(), now.getTime())).toBe(
      MAX_ELO_RANGE
    );
  });
});
