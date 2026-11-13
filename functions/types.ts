export interface CFEnv {
  ASSETS: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  };
  TMDB_API_KEY?: string;
  SITE_URL?: string;
  CF_PAGES_URL?: string;
}

export interface CFContext {
  request: Request;
  env: CFEnv;
  params: Record<string, string | string[]>;
  next: () => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
}
