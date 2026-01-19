import type { ActionFunctionArgs } from "react-router";

export async function action({ request }: ActionFunctionArgs) {
  if (request.headers.get("content-type") !== "application/json") {
    return new Response("Unsupported Media Type", { status: 415 });
  }

  const body = await request.json();
  const { timestamp } = body;

  // logica server-side
  return Response.json({ timestamp });
}