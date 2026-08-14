export type AdsDailyRow = {
  date:string; campaignId:string; campaignName:string; campaignStatus:string; budgetCents:number|null;
  impressions:number; clicks:number; costCents:number; conversions:number; conversionValueCents:number; impressionShare:number|null;
};
export type AdsConversionAction = { providerId:string; name:string; category:string|null; status:string; primaryForGoal:boolean; enhancedConversionsEnabled:boolean };
export type AdsConversionDaily = { date:string; actionId:string; actionName:string; conversions:number; conversionValueCents:number };
export type AdsConversionSettings = { enhancedConversionsForLeadsEnabled:boolean; acceptedCustomerDataTerms:boolean };
export type SearchConsoleRow = { date:string; query:string; page:string; country:string; device:string; searchAppearance:string; clicks:number; impressions:number; ctr:number; averagePosition:number };
export type SearchConsoleSitemap = { path:string; submittedAt:string|null; lastDownloadedAt:string|null; warnings:number; errors:number };

export interface GoogleAdsProvider {
  getCampaignDaily(input:{startDate:string;endDate:string}):Promise<AdsDailyRow[]>;
  getConversionActions():Promise<AdsConversionAction[]>;
  getConversionActionDaily(input:{startDate:string;endDate:string}):Promise<AdsConversionDaily[]>;
  getConversionSettings():Promise<AdsConversionSettings>;
}
export interface SearchConsoleProvider {
  getSites():Promise<Array<{siteUrl:string;permissionLevel:string}>>;
  getDaily(input:{startDate:string;endDate:string}):Promise<SearchConsoleRow[]>;
  getSitemaps():Promise<SearchConsoleSitemap[]>;
}
