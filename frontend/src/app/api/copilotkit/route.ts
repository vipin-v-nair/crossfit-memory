import {
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
  ExperimentalEmptyAdapter,
} from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";
import { NextRequest } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export const POST = async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id") || "demo_athlete";

  const runtime = new CopilotRuntime({
    agents: {
      crossfit_coach: new HttpAgent({
        url: `${BACKEND_URL}/agent`,
        headers: {
          "x-user-id": userId,
        },
      }),
    },
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};

