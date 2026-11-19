import { onRequest } from "./functions/api/content.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/content") {
      return onRequest({ request, env });
    }
    return env.ASSETS.fetch(request);
  },
};
