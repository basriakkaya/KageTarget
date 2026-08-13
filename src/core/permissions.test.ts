import { beforeEach,describe,expect,it,vi } from "vitest";
import { ALL_SITE_ORIGINS,hasAllSiteAccess,requestFirstRunAccess,requestHostAccess } from "./permissions";
import { parseTarget } from "./target";
const contains=vi.fn(),request=vi.fn();
beforeEach(()=>{contains.mockReset();request.mockReset();vi.stubGlobal("chrome",{permissions:{contains,request}})});
describe("permission service",()=>{
  it("uses actual Chrome permission state as source of truth",async()=>{contains.mockResolvedValue(true);await expect(hasAllSiteAccess()).resolves.toBe(true);expect(contains).toHaveBeenCalledWith({origins:[...ALL_SITE_ORIGINS]})});
  it("requests all-site optional access only through an explicit service call",async()=>{request.mockResolvedValue(true);await expect(requestFirstRunAccess()).resolves.toBe(true);expect(request).toHaveBeenCalledOnce()});
  it("does not re-request existing target access",async()=>{contains.mockResolvedValue(true);await expect(requestHostAccess(parseTarget("https://example.com"))).resolves.toBe(true);expect(request).not.toHaveBeenCalled()});
  it("supports denied contextual recovery",async()=>{contains.mockResolvedValue(false);request.mockResolvedValue(false);await expect(requestHostAccess(parseTarget("https://example.com"))).resolves.toBe(false)});
});
