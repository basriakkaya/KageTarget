import { describe,expect,it } from "vitest";
import { targetPanelTransition } from "./state";
describe("Target Focus Mode state",()=>{
  it("starts expanded by contract",()=>expect(targetPanelTransition("expanded","TARGET_CHANGED")).toBe("expanded"));
  it("collapses only after success",()=>{expect(targetPanelTransition("expanded","ANALYSIS_SUCCEEDED")).toBe("collapsed");expect(targetPanelTransition("expanded","ANALYSIS_FAILED")).toBe("expanded");expect(targetPanelTransition("expanded","ANALYSIS_CANCELLED")).toBe("expanded")});
  it("expands manually and on target change",()=>{expect(targetPanelTransition("collapsed","EXPAND")).toBe("expanded");expect(targetPanelTransition("collapsed","TARGET_CHANGED")).toBe("expanded")});
  it("enters and leaves peek without expanding",()=>{expect(targetPanelTransition("collapsed","PEEK_START")).toBe("peek");expect(targetPanelTransition("peek","PEEK_END")).toBe("collapsed")});
});
