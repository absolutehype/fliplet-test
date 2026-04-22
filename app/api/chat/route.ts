import { google } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText, tool } from "ai";
import { z } from "zod";

function getBaseUrl() {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

async function flipletFetch(
  path: string,
  apiKey: string,
  options?: RequestInit
) {
  const baseUrl = getBaseUrl();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/fliplet/${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Fliplet-Token": apiKey,
        ...options?.headers,
      },
    });
  } catch (err) {
    throw new Error(
      `Failed to reach Fliplet API: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Fliplet API returned an unexpected response (HTTP ${response.status})`
    );
  }

  if (!response.ok) {
    const message =
      (data as Record<string, unknown>)?.message ??
      (data as Record<string, unknown>)?.error ??
      `HTTP ${response.status}`;
    throw new Error(`Fliplet API error (${response.status}): ${message}`);
  }

  return data;
}

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "AI service is not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // biome-ignore lint/suspicious/noExplicitAny: request body is untyped
  let messages: any;
  let apiKey = "";
  let orgId = "";
  let appId = "";

  try {
    const body = await req.json();
    messages = body.messages;
    apiKey = body.apiKey ?? "";
    orgId = body.orgId ?? "";
    appId = body.appId ?? "";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const hasCredentials = apiKey.length > 0;

  try {
    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: `You are a helpful assistant that can query Fliplet data sources.

${
  hasCredentials
    ? `The user has provided their credentials. The default organization ID is ${orgId} and the default app ID is ${appId}. Always use the app ID when listing data sources. Only add the organization ID if the user explicitly provides one.
When a user asks about their data, use the available tools to look up data sources and query records. Present the results in a clear, readable format.`
    : `The user has not yet provided their Fliplet credentials. Before you can help them with data sources, you need to collect their credentials.

Greet the user warmly, then ask them to provide the following:
1. Their Fliplet API Key (required)
2. Their Fliplet App ID (required)
3. Their Fliplet Organisation ID (optional)

Once the user provides these details, call the storeCredentials tool with the values. Do NOT attempt to use any other Fliplet tools until credentials have been stored.`
}`,
      messages: await convertToModelMessages(messages),
      tools: {
        storeCredentials: tool({
          description:
            "Store the user's Fliplet credentials for this chat session. Call this after the user provides their API key and App ID.",
          inputSchema: z.object({
            apiKey: z.string().describe("The user's Fliplet API key"),
            appId: z.string().describe("The user's Fliplet App ID"),
            orgId: z
              .string()
              .optional()
              .describe("The user's Fliplet Organisation ID (optional)"),
          }),
          // No execute — handled client-side via onToolCall
        }),
        listDataSources: tool({
          description:
            "List all data sources belonging to an organization or app on Fliplet. Requires credentials to be stored first.",
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
          execute: async ({ organizationId, appId: toolAppId }) => {
            if (!apiKey) {
              return {
                error:
                  "Credentials not configured. Please provide your Fliplet credentials first.",
              };
            }
            const params = new URLSearchParams();
            params.set("appId", String(toolAppId ?? appId));
            if (organizationId) {
              params.set("organizationId", String(organizationId));
            }
            const query = params.toString();
            return await flipletFetch(
              `data-sources${query ? `?${query}` : ""}`,
              apiKey
            );
          },
        }),
        getDataSource: tool({
          description:
            "Get metadata about a specific Fliplet data source by ID. Requires credentials to be stored first.",
          inputSchema: z.object({
            dataSourceId: z.number().describe("The ID of the data source"),
          }),
          execute: async ({ dataSourceId }) => {
            if (!apiKey) {
              return {
                error:
                  "Credentials not configured. Please provide your Fliplet credentials first.",
              };
            }
            return await flipletFetch(`data-sources/${dataSourceId}`, apiKey);
          },
        }),
        queryDataSource: tool({
          description:
            "Query records from a Fliplet data source with optional filtering. Requires credentials to be stored first.",
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
            if (!apiKey) {
              return {
                error:
                  "Credentials not configured. Please provide your Fliplet credentials first.",
              };
            }
            const body: Record<string, unknown> = {};
            if (where) {
              body.where = where;
            }
            if (limit) {
              body.limit = limit;
            }
            return await flipletFetch(
              `data-sources/${dataSourceId}/data/query`,
              apiKey,
              {
                method: "POST",
                body: JSON.stringify(body),
              }
            );
          },
        }),
      },
      stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";
    const isOverloaded =
      message.includes("429") ||
      message.includes("503") ||
      message.toLowerCase().includes("high demand");
    const status = isOverloaded ? 429 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
