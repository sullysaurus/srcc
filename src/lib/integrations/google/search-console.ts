import { z } from "zod";
import type { SearchConsoleProvider, SearchConsoleRow, SearchConsoleSitemap } from "./contracts";
import { providerFetch } from "./http";

const analyticsSchema=z.object({rows:z.array(z.object({keys:z.array(z.string()),clicks:z.number(),impressions:z.number(),ctr:z.number(),position:z.number()})).default([])});
const sitemapSchema=z.object({sitemap:z.array(z.object({path:z.string(),lastSubmitted:z.string().optional(),lastDownloaded:z.string().optional(),errors:z.union([z.string(),z.number()]).optional(),warnings:z.union([z.string(),z.number()]).optional()})).default([])});
const sitesSchema=z.object({siteEntry:z.array(z.object({siteUrl:z.string(),permissionLevel:z.string()})).default([])});

export class SearchConsoleRestProvider implements SearchConsoleProvider {
  constructor(private readonly config:{accessToken:string;propertyUri:string}){}
  async getSites(){const response=await providerFetch("https://searchconsole.googleapis.com/webmasters/v3/sites",{headers:{authorization:`Bearer ${this.config.accessToken}`}},"search_console");return sitesSchema.parse(await response.json()).siteEntry;}
  async getDaily({startDate,endDate}:{startDate:string;endDate:string}):Promise<SearchConsoleRow[]> {
    const endpoint=`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.config.propertyUri)}/searchAnalytics/query`;
    const query=async(dimensions:string[],range={startDate,endDate})=>{
      const response=await providerFetch(endpoint,{method:"POST",headers:{authorization:`Bearer ${this.config.accessToken}`,"content-type":"application/json"},body:JSON.stringify({...range,dimensions,rowLimit:25000,dataState:"final"})},"search_console");
      return analyticsSchema.parse(await response.json()).rows;
    };
    // Google does not allow searchAppearance to be grouped with any other
    // dimension. Keep the detailed query/page rows and appearance totals as
    // separate series so both are retained without inventing relationships.
    const dates:string[]=[];
    for(let cursor=new Date(`${startDate}T00:00:00Z`);cursor<=new Date(`${endDate}T00:00:00Z`);cursor=new Date(cursor.getTime()+86_400_000))dates.push(cursor.toISOString().slice(0,10));
    const[detailed,appearanceDays]=await Promise.all([
      query(["date","query","page","country","device"]),
      Promise.all(dates.map(async date=>({date,rows:await query(["searchAppearance"],{startDate:date,endDate:date})}))),
    ]);
    return [
      ...detailed.map(row=>({date:row.keys[0]??"",query:row.keys[1]??"",page:row.keys[2]??"",country:row.keys[3]??"",device:row.keys[4]??"",searchAppearance:"",clicks:row.clicks,impressions:row.impressions,ctr:row.ctr,averagePosition:row.position})),
      ...appearanceDays.flatMap(day=>day.rows.map(row=>({date:day.date,query:"",page:"",country:"",device:"",searchAppearance:row.keys[0]??"",clicks:row.clicks,impressions:row.impressions,ctr:row.ctr,averagePosition:row.position}))),
    ];
  }
  async getSitemaps():Promise<SearchConsoleSitemap[]> {
    const response=await providerFetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.config.propertyUri)}/sitemaps`,{headers:{authorization:`Bearer ${this.config.accessToken}`}},"search_console");
    return sitemapSchema.parse(await response.json()).sitemap.map(item=>({path:item.path,submittedAt:item.lastSubmitted??null,lastDownloadedAt:item.lastDownloaded??null,errors:Number(item.errors??0),warnings:Number(item.warnings??0)}));
  }
}
