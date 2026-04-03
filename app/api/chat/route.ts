import { google } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText, tool } from "ai";
import { z } from "zod";

const FLIPLET_ORG_ID = process.env.FLIPLET_ORG_ID ?? "";
const FLIPLET_APP_ID = process.env.FLIPLET_APP_ID ?? "";

function getBaseUrl() {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

async function flipletFetch(path: string, options?: RequestInit) {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/fliplet/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  return response.json();
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: `You are a helpful assistant that can query Fliplet data sources.
When a user asks about their data, use the available tools to look up data sources and query records.
Present the results in a clear, readable format.
The default organization ID is ${FLIPLET_ORG_ID} and the default app ID is ${FLIPLET_APP_ID}. Use the organization ID when listing data sources unless the user specifies a different one. Only pass an appId if the user explicitly provides one.`,
    messages: await convertToModelMessages(messages),
    tools: {
      listDataSources: tool({
        description:
          "List all data sources belonging to an organization or app on Fliplet",
        inputSchema: z.object({
          organizationId: z
            .number()
            .optional()
            .describe("The organization ID to list data sources for"),
          appId: z
            .number()
            .optional()
            .describe("The app ID to list data sources for"),
        }),
        execute: async ({ organizationId, appId }) => {
          const params = new URLSearchParams();
          if (appId) {
            params.set("appId", String(appId));
          } else {
            params.set(
              "organizationId",
              String(organizationId ?? FLIPLET_ORG_ID)
            );
          }
          const query = params.toString();
          return await flipletFetch(`data-sources${query ? `?${query}` : ""}`);
        },
      }),
      getDataSource: tool({
        description: "Get metadata about a specific Fliplet data source by ID",
        inputSchema: z.object({
          dataSourceId: z.number().describe("The ID of the data source"),
        }),
        execute: async ({ dataSourceId }) => {
          return await flipletFetch(`data-sources/${dataSourceId}`);
        },
      }),
      queryDataSource: tool({
        description:
          "Query records from a Fliplet data source with optional filtering",
        inputSchema: z.object({
          dataSourceId: z
            .number()
            .describe("The ID of the data source to query"),
          where: z
            .record(z.string(), z.unknown())
            .optional()
            .describe(
              "Filter conditions as key-value pairs, e.g. { 'Status': 'Active' }"
            ),
          limit: z
            .number()
            .optional()
            .describe("Maximum number of records to return"),
        }),
        execute: async ({ dataSourceId, where, limit }) => {
          const body: Record<string, unknown> = {};
          if (where) {
            body.where = where;
          }
          if (limit) {
            body.limit = limit;
          }
          return await flipletFetch(`data-sources/${dataSourceId}/data/query`, {
            method: "POST",
            body: JSON.stringify(body),
          });
        },
      }),
    },
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
