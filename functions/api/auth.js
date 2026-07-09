export async function onRequest(context) {
  const { request, env } = context;
  const clientId = env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return new Response("Missing GITHUB_CLIENT_ID", { status: 500 });
  }

  try {
    const url = new URL(request.url);
    const redirectUrl = new URL("https://github.com/login/oauth/authorize");
    redirectUrl.searchParams.set("client_id", clientId);
    redirectUrl.searchParams.set("redirect_uri", `${url.origin}/api/callback`);
    redirectUrl.searchParams.set("scope", "public_repo");
    redirectUrl.searchParams.set(
      "state",
      crypto.getRandomValues(new Uint8Array(12)).join("")
    );

    return Response.redirect(redirectUrl.href, 302);
  } catch (error) {
    console.error(error);
    return new Response(error.message, { status: 500 });
  }
}
