/// <reference types="vite/client" />

declare module '@vercel/node' {
  interface VercelRequest {
    query: {
      [key: string]: string | string[] | undefined;
    };
    body: unknown;
    headers: {
      [key: string]: string | undefined;
    };
    method: string;
  }

  interface VercelResponse {
    status(code: number): VercelResponse;
    json(body: unknown): VercelResponse;
    setHeader(key: string, value: string): VercelResponse;
    end(): void;
  }

  export function handler(req: VercelRequest, res: VercelResponse): Promise<void> | void;
}
