import { describe, expect, it } from "vitest";
import { detectTechnologies } from "./engine";

const snapshot=(generator:string|null)=>({url:"https://fixture.test/",title:"Fixture",canonical:null,robots:null,generator,links:0,scripts:0,forms:0,iframes:0});
const resources=(...urls:string[])=>urls.map(url=>({kind:"script" as const,url,details:""}));
describe("TechnologyEngine",()=>{
  it("aggregates evidence, extracts versions and deduplicates WordPress",()=>{const result=detectTechnologies({snapshot:snapshot("WordPress 6.8"),resources:resources("https://fixture.test/wp-content/a.js","https://fixture.test/wp-includes/b.css")});expect(result.filter(x=>x.name==="WordPress")).toHaveLength(1);expect(result[0]).toMatchObject({name:"WordPress",version:"6.8",confidence:"High"});expect(result[0].evidence.length).toBeGreaterThan(1)});
  it("detects Next.js from strong combined evidence",()=>expect(detectTechnologies({snapshot:snapshot(null),resources:resources("https://x.test/_next/static/app.js"),markers:["__NEXT_DATA__"]})).toContainEqual(expect.objectContaining({name:"Next.js",confidence:"High"})));
  it("detects Cloudflare and nginx from exact headers",()=>{const http={status:200,statusText:"OK",finalUrl:"https://x.test",headers:[["server","cloudflare"],["cf-ray","abc"]] as [string,string][]};expect(detectTechnologies({http}).find(x=>x.name==="Cloudflare")?.confidence).toBe("High");const nginx={...http,headers:[["server","nginx/1.27.0"]] as [string,string][]};expect(detectTechnologies({http:nginx})).toContainEqual(expect.objectContaining({name:"nginx",version:"1.27.0",confidence:"High"}))});
  it("does not detect React from a generic root id",()=>expect(detectTechnologies({snapshot:snapshot(null),markers:["id:root"]})).toEqual([]));
  it("returns a true empty result when no supported evidence exists",()=>expect(detectTechnologies({snapshot:snapshot(null),resources:[],markers:[]})).toEqual([]));
  it("recognizes modern Next.js and Vue root markers",()=>{expect(detectTechnologies({markers:["id:__next"]})).toContainEqual(expect.objectContaining({name:"Next.js"}));expect(detectTechnologies({markers:["data-v-app"]})).toContainEqual(expect.objectContaining({name:"Vue"}))});
});
