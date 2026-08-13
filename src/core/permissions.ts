import type { TargetContext } from "../types";
import { permissionPattern } from "./target";

export const ALL_SITE_ORIGINS = ["http://*/*", "https://*/*"] as const;
export type PermissionState = "checking" | "ready" | "needs-activation" | "requesting" | "denied" | "limited" | "error";

export async function hasAllSiteAccess():Promise<boolean>{
  return chrome.permissions.contains({origins:[...ALL_SITE_ORIGINS]});
}
export async function requestFirstRunAccess():Promise<boolean>{
  return chrome.permissions.request({origins:[...ALL_SITE_ORIGINS]});
}
export async function hasHostAccess(target:TargetContext):Promise<boolean>{
  return chrome.permissions.contains({origins:[permissionPattern(target)]});
}
export async function requestHostAccess(target:TargetContext):Promise<boolean>{
  return (await hasHostAccess(target)) || chrome.permissions.request({origins:[permissionPattern(target)]});
}
