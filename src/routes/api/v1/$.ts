import { createFileRoute } from "@tanstack/react-router";
import { dispatch } from "@/server/api";

const handle = ({ request }: { request: Request }) => dispatch(request, "/api/v1");

/** Single entry point for the JSON API: /api/v1/* (see src/server/api). */
export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: { GET: handle, POST: handle, PATCH: handle, PUT: handle, DELETE: handle },
  },
});
