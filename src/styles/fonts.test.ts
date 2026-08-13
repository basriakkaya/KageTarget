import { describe,expect,it } from "vitest";
import { CHAKRA_PETCH_SUBSETS,CHAKRA_PETCH_WEIGHTS,UI_FONT_FAMILY } from "./fonts";
describe("local Chakra Petch typography",()=>{
  it("packages all required weights and Latin Extended glyphs",()=>{expect(CHAKRA_PETCH_WEIGHTS).toEqual([400,500,600,700]);expect(CHAKRA_PETCH_SUBSETS).toEqual(["latin","latin-ext"])});
  it("uses Chakra Petch as the primary UI family",()=>expect(UI_FONT_FAMILY).toBe("Chakra Petch"));
});
