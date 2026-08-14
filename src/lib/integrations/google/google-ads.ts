import { z } from "zod";
import type { AdsConversionAction, AdsConversionDaily, AdsConversionSettings, AdsDailyRow, GoogleAdsProvider } from "./contracts";
import { providerFetch } from "./http";

const streamSchema = z.array(z.object({ results:z.array(z.record(z.string(),z.unknown())).default([]) }));
const numberValue = (value:unknown)=>Number(value ?? 0);
const centsFromMicros = (value:unknown)=>Math.round(numberValue(value)/10_000);

export class GoogleAdsRestProvider implements GoogleAdsProvider {
  constructor(private readonly config:{ accessToken:string;developerToken:string;customerId:string;managerCustomerId?:string;apiVersion:string }) {
    if (!/^v\d+$/.test(config.apiVersion)) throw new Error("GOOGLE_ADS_API_VERSION must look like vNN");
  }
  private async query(query:string) {
    const customerId=this.config.customerId.replace(/\D/g,"");
    const headers:Record<string,string>={ authorization:`Bearer ${this.config.accessToken}`,"developer-token":this.config.developerToken,"content-type":"application/json" };
    if(this.config.managerCustomerId) headers["login-customer-id"]=this.config.managerCustomerId.replace(/\D/g,"");
    const response=await providerFetch(`https://googleads.googleapis.com/${this.config.apiVersion}/customers/${customerId}/googleAds:searchStream`,{method:"POST",headers,body:JSON.stringify({query})},"google_ads");
    return streamSchema.parse(await response.json()).flatMap(batch=>batch.results);
  }
  async getCampaignDaily({startDate,endDate}:{startDate:string;endDate:string}):Promise<AdsDailyRow[]> {
    const rows=await this.query(`SELECT segments.date, campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.search_impression_share FROM campaign WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`);
    return rows.map(row=>{const campaign=(row.campaign??{}) as Record<string,unknown>;const budget=(row.campaignBudget??{}) as Record<string,unknown>;const metrics=(row.metrics??{}) as Record<string,unknown>;const segments=(row.segments??{}) as Record<string,unknown>;return {date:String(segments.date),campaignId:String(campaign.id),campaignName:String(campaign.name),campaignStatus:String(campaign.status),budgetCents:budget.amountMicros==null?null:centsFromMicros(budget.amountMicros),impressions:numberValue(metrics.impressions),clicks:numberValue(metrics.clicks),costCents:centsFromMicros(metrics.costMicros),conversions:numberValue(metrics.conversions),conversionValueCents:Math.round(numberValue(metrics.conversionsValue)*100),impressionShare:metrics.searchImpressionShare==null?null:numberValue(metrics.searchImpressionShare)};});
  }
  async getConversionActions():Promise<AdsConversionAction[]> {
    const rows=await this.query("SELECT conversion_action.id, conversion_action.name, conversion_action.category, conversion_action.status, conversion_action.primary_for_goal, conversion_action.type FROM conversion_action");
    return rows.map(row=>{const action=(row.conversionAction??{}) as Record<string,unknown>;return {providerId:String(action.id),name:String(action.name),category:action.category?String(action.category):null,status:String(action.status),primaryForGoal:Boolean(action.primaryForGoal),enhancedConversionsEnabled:String(action.type).includes("UPLOAD_CLICKS")};});
  }
  async getConversionActionDaily({startDate,endDate}:{startDate:string;endDate:string}):Promise<AdsConversionDaily[]> {
    const rows=await this.query(`SELECT segments.date, segments.conversion_action, segments.conversion_action_name, metrics.all_conversions, metrics.all_conversions_value FROM customer WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`);
    return rows.map(row=>{const segments=(row.segments??{})as Record<string,unknown>;const metrics=(row.metrics??{})as Record<string,unknown>;const resource=String(segments.conversionAction??"");return{date:String(segments.date),actionId:resource.split("/").at(-1)??resource,actionName:String(segments.conversionActionName??"Unknown conversion"),conversions:numberValue(metrics.allConversions),conversionValueCents:Math.round(numberValue(metrics.allConversionsValue)*100)};});
  }
  async getConversionSettings():Promise<AdsConversionSettings> {
    const rows=await this.query("SELECT customer.conversion_tracking_setting.enhanced_conversions_for_leads_enabled, customer.conversion_tracking_setting.accepted_customer_data_terms FROM customer LIMIT 1");
    const customer=(rows[0]?.customer??{})as Record<string,unknown>;const settings=(customer.conversionTrackingSetting??{})as Record<string,unknown>;
    return{enhancedConversionsForLeadsEnabled:Boolean(settings.enhancedConversionsForLeadsEnabled),acceptedCustomerDataTerms:Boolean(settings.acceptedCustomerDataTerms)};
  }
}
