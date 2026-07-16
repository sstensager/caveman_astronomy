import { describe, expect, it } from "vitest";
import { classifyLandCoverColor } from "./landMask";

describe("classifyLandCoverColor", () => {
  it("classifies real ocean-blue samples from earth1.png as ocean", () => {
    expect(classifyLandCoverColor(9, 86, 151)).toBe("ocean");
    expect(classifyLandCoverColor(12, 88, 154)).toBe("ocean");
    expect(classifyLandCoverColor(11, 84, 149)).toBe("ocean");
  });

  it("classifies real land (olive/khaki) samples from earth1.png as land", () => {
    expect(classifyLandCoverColor(158, 184, 75)).toBe("land");
    expect(classifyLandCoverColor(180, 194, 79)).toBe("land");
    expect(classifyLandCoverColor(133, 171, 69)).toBe("land");
  });

  it("classifies real ice/snow samples from earth1.png as ice", () => {
    expect(classifyLandCoverColor(212, 227, 236)).toBe("ice");
    expect(classifyLandCoverColor(246, 245, 240)).toBe("ice");
  });

  it("does not misclassify a bright land color as ice (brightness alone is not enough)", () => {
    // Pale desert/sand-like color - bright, but with a much bigger r/b gap
    // than real ice ever shows.
    expect(classifyLandCoverColor(210, 200, 120)).toBe("land");
  });
});
