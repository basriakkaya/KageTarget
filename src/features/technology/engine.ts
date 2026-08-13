import type { HttpResult, PageResource, PageSnapshot } from "../../types";

export type TechnologyCategory =
  | "CMS" | "Web Framework" | "JavaScript Framework" | "JavaScript Library"
  | "Web Server" | "CDN" | "Hosting / Platform" | "Analytics" | "Tag Manager"
  | "E-commerce" | "Programming Language" | "UI Framework" | "Security / Proxy";
export type TechnologyConfidence = "High" | "Medium" | "Low";
export interface TechnologyInput { snapshot?: PageSnapshot; resources?: PageResource[]; http?: HttpResult; markers?: string[] }
export interface TechnologyMatch { id:string; name:string; category:TechnologyCategory; confidence:TechnologyConfidence; score:number; evidence:string[]; version?:string }
type Rule = { source:"header"|"generator"|"resource"|"marker"; pattern:RegExp; weight:number; label:string; version?:RegExp };
interface TechnologySignature { id:string; name:string; category:TechnologyCategory; rules:Rule[]; strong?:boolean }

export const TECHNOLOGY_SIGNATURES: TechnologySignature[] = [
  {id:"wordpress",name:"WordPress",category:"CMS",strong:true,rules:[{source:"generator",pattern:/wordpress/i,weight:5,label:"generator",version:/wordpress\s*([\d.]+)/i},{source:"resource",pattern:/\/(?:wp-content|wp-includes)\//i,weight:4,label:"WordPress asset path"}]},
  {id:"drupal",name:"Drupal",category:"CMS",strong:true,rules:[{source:"generator",pattern:/drupal/i,weight:5,label:"generator",version:/drupal\s*([\d.]+)/i},{source:"resource",pattern:/\/sites\/(?:default|all)\//i,weight:3,label:"Drupal asset path"},{source:"header",pattern:/x-generator:\s*drupal/i,weight:5,label:"X-Generator header"}]},
  {id:"joomla",name:"Joomla",category:"CMS",strong:true,rules:[{source:"generator",pattern:/joomla/i,weight:5,label:"generator",version:/joomla!?\s*([\d.]+)/i},{source:"resource",pattern:/\/media\/system\/js\//i,weight:3,label:"Joomla system asset"}]},
  {id:"ghost",name:"Ghost",category:"CMS",rules:[{source:"generator",pattern:/ghost/i,weight:5,label:"generator",version:/ghost\s*([\d.]+)/i},{source:"resource",pattern:/\/ghost\/assets\//i,weight:4,label:"Ghost asset path"}]},
  {id:"next",name:"Next.js",category:"Web Framework",strong:true,rules:[{source:"resource",pattern:/\/_next\/(?:static|image)\//i,weight:4,label:"/_next/ asset"},{source:"marker",pattern:/(?:__NEXT_DATA__|id:__next)/i,weight:5,label:"Next.js root marker"}]},
  {id:"nuxt",name:"Nuxt",category:"Web Framework",strong:true,rules:[{source:"resource",pattern:/\/_nuxt\//i,weight:4,label:"/_nuxt/ asset"},{source:"marker",pattern:/__NUXT__/i,weight:5,label:"__NUXT__ marker"}]},
  {id:"sveltekit",name:"SvelteKit",category:"Web Framework",rules:[{source:"resource",pattern:/\/_app\/immutable\//i,weight:4,label:"SvelteKit immutable asset"}]},
  {id:"angular",name:"Angular",category:"JavaScript Framework",rules:[{source:"marker",pattern:/ng-version:/i,weight:5,label:"ng-version attribute",version:/ng-version:([\d.]+)/i}]},
  {id:"vue",name:"Vue",category:"JavaScript Framework",rules:[{source:"resource",pattern:/(?:vue(?:\.runtime)?(?:\.global)?|vue-router)[.-](?:min\.)?js/i,weight:3,label:"Vue script"},{source:"marker",pattern:/data-v-(?:app|[\da-f]+)/i,weight:3,label:"Vue application marker"}]},
  {id:"react",name:"React",category:"JavaScript Framework",rules:[{source:"resource",pattern:/(?:react-dom|react\.production\.min)\.js/i,weight:4,label:"React runtime script"},{source:"marker",pattern:/data-reactroot/i,weight:4,label:"React root marker"}]},
  {id:"jquery",name:"jQuery",category:"JavaScript Library",rules:[{source:"resource",pattern:/jquery(?:-|\.)([\d.]+)(?:\.min)?\.js/i,weight:4,label:"jQuery script",version:/jquery(?:-|\.)([\d.]+)/i}]},
  {id:"alpine",name:"Alpine.js",category:"JavaScript Library",rules:[{source:"resource",pattern:/alpinejs|alpine(?:\.min)?\.js/i,weight:4,label:"Alpine.js script"}]},
  {id:"htmx",name:"HTMX",category:"JavaScript Library",rules:[{source:"resource",pattern:/htmx(?:\.min)?\.js/i,weight:4,label:"HTMX script"}]},
  {id:"nginx",name:"nginx",category:"Web Server",strong:true,rules:[{source:"header",pattern:/server:\s*nginx(?:\/([\d.]+))?/i,weight:5,label:"Server header",version:/nginx\/([\d.]+)/i}]},
  {id:"apache",name:"Apache",category:"Web Server",strong:true,rules:[{source:"header",pattern:/server:\s*apache(?:\/([\d.]+))?/i,weight:5,label:"Server header",version:/apache\/([\d.]+)/i}]},
  {id:"iis",name:"Microsoft IIS",category:"Web Server",strong:true,rules:[{source:"header",pattern:/server:\s*microsoft-iis(?:\/([\d.]+))?/i,weight:5,label:"Server header",version:/microsoft-iis\/([\d.]+)/i}]},
  {id:"cloudflare",name:"Cloudflare",category:"CDN",strong:true,rules:[{source:"header",pattern:/(?:server:\s*cloudflare|cf-ray:)/i,weight:5,label:"Cloudflare response header"}]},
  {id:"vercel",name:"Vercel",category:"Hosting / Platform",strong:true,rules:[{source:"header",pattern:/(?:x-vercel-id:|server:\s*vercel)/i,weight:5,label:"Vercel response header"}]},
  {id:"netlify",name:"Netlify",category:"Hosting / Platform",rules:[{source:"header",pattern:/x-nf-request-id:/i,weight:5,label:"Netlify response header"}]},
  {id:"fastly",name:"Fastly",category:"CDN",rules:[{source:"header",pattern:/(?:x-served-by:.*cache-|x-fastly-request-id:)/i,weight:5,label:"Fastly response header"}]},
  {id:"bootstrap",name:"Bootstrap",category:"UI Framework",rules:[{source:"resource",pattern:/bootstrap(?:\.bundle)?(?:\.min)?\.(?:css|js)/i,weight:3,label:"Bootstrap asset"}]},
  {id:"tailwind",name:"Tailwind CSS",category:"UI Framework",rules:[{source:"resource",pattern:/tailwind(?:\.min)?\.css/i,weight:3,label:"Tailwind stylesheet"}]},
  {id:"ga",name:"Google Analytics",category:"Analytics",rules:[{source:"resource",pattern:/(?:google-analytics\.com\/analytics\.js|googletagmanager\.com\/gtag\/js)/i,weight:4,label:"Google Analytics script"}]},
  {id:"gtm",name:"Google Tag Manager",category:"Tag Manager",rules:[{source:"resource",pattern:/googletagmanager\.com\/gtm\.js/i,weight:4,label:"Google Tag Manager script"}]},
  {id:"shopify",name:"Shopify",category:"E-commerce",rules:[{source:"resource",pattern:/cdn\.shopify\.com/i,weight:4,label:"Shopify CDN asset"},{source:"header",pattern:/x-shopify-/i,weight:5,label:"Shopify response header"}]},
  {id:"woocommerce",name:"WooCommerce",category:"E-commerce",rules:[{source:"resource",pattern:/\/wp-content\/plugins\/woocommerce\//i,weight:5,label:"WooCommerce plugin asset"}]},
];

export function detectTechnologies(input:TechnologyInput):TechnologyMatch[]{
  const headers=(input.http?.headers??[]).map(([k,v])=>`${k}: ${v}`);
  const sources={header:headers,generator:input.snapshot?.generator?[input.snapshot.generator]:[],resource:(input.resources??[]).map(x=>x.url),marker:input.markers??[]};
  return TECHNOLOGY_SIGNATURES.flatMap(signature=>{
    let score=0; const evidence:string[]=[]; let version:string|undefined;
    for(const rule of signature.rules) for(const value of sources[rule.source]) if(rule.pattern.test(value)){
      score+=rule.weight; const item=`${rule.label}: ${value}`; if(!evidence.includes(item)) evidence.push(item);
      const match=rule.version?.exec(value); if(match?.[1]) version=match[1];
    }
    if(score<2)return [];
    const confidence:TechnologyConfidence=score>=7||(signature.strong&&score>=5)?"High":score>=4?"Medium":"Low";
    return [{id:signature.id,name:signature.name,category:signature.category,confidence,score,evidence,version}];
  }).sort((a,b)=>b.score-a.score||a.category.localeCompare(b.category)||a.name.localeCompare(b.name));
}
