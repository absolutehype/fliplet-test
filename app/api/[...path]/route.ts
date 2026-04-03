import { IncomingMessage, type ServerResponse } from "node:http";
import { Socket } from "node:net";
import type { NextRequest } from "next/server";
import app from "@/lib/express-app";

function nextRequestToNodeRequest(req: NextRequest): IncomingMessage {
  const url = new URL(req.url);
  const socket = new Socket();
  const incoming = new IncomingMessage(socket);

  incoming.method = req.method;
  incoming.url = url.pathname + url.search;

  for (const [key, value] of req.headers.entries()) {
    incoming.headers[key.toLowerCase()] = value;
  }

  return incoming;
}

async function handler(req: NextRequest) {
  const body =
    req.method !== "GET" && req.method !== "HEAD"
      ? await req.json().catch(() => undefined)
      : undefined;

  return new Promise<Response>((resolve) => {
    const nodeReq = nextRequestToNodeRequest(req);

    if (body) {
      (nodeReq as IncomingMessage & { body: unknown }).body = body;
    }

    const chunks: Buffer[] = [];
    let statusCode = 200;
    const responseHeaders: Record<string, string> = {};

    const nodeRes = {
      statusCode: 200,
      setHeader(name: string, value: string) {
        responseHeaders[name.toLowerCase()] = value;
      },
      getHeader(name: string) {
        return responseHeaders[name.toLowerCase()];
      },
      writeHead(code: number, headers?: Record<string, string>) {
        statusCode = code;
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            responseHeaders[key.toLowerCase()] = value;
          }
        }
        return nodeRes;
      },
      write(chunk: string | Buffer) {
        chunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf-8")
        );
        return true;
      },
      end(chunk?: string | Buffer) {
        if (chunk) {
          chunks.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf-8")
          );
        }
        statusCode = nodeRes.statusCode;
        const responseBody = Buffer.concat(chunks);
        resolve(
          new Response(responseBody, {
            status: statusCode,
            headers: responseHeaders,
          })
        );
      },
      status(code: number) {
        nodeRes.statusCode = code;
        return nodeRes;
      },
      json(data: unknown) {
        responseHeaders["content-type"] = "application/json";
        const jsonBody = JSON.stringify(data);
        nodeRes.statusCode = statusCode;
        resolve(
          new Response(jsonBody, {
            status: nodeRes.statusCode,
            headers: responseHeaders,
          })
        );
      },
    } as unknown as ServerResponse;

    app(nodeReq, nodeRes);
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
