export class ProviderHttpError extends Error {
  constructor(public readonly provider: string, public readonly status: number, public readonly retryable: boolean) {
    super(`${provider} request failed (${status})`);
  }
}

export async function providerFetch(url: string, init: RequestInit, provider: string, attempts = 4) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url,{ ...init,cache:"no-store",signal:AbortSignal.timeout(25_000) });
    if (response.ok) return response;
    const retryable = response.status===408 || response.status===429 || response.status>=500;
    if (!retryable || attempt===attempts-1) throw new ProviderHttpError(provider,response.status,retryable);
    await new Promise(resolve=>setTimeout(resolve,Math.min(250*2**attempt,2000)));
  }
  throw new ProviderHttpError(provider,500,false);
}
