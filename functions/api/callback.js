function renderBody(status, content) {
  const html = `
    <script>
      const receiveMessage = (message) => {
        window.opener.postMessage(
          'authorization:github:${status}:${JSON.stringify(content)}',
          message.origin
        );
        window.removeEventListener("message", receiveMessage, false);
      };
      window.addEventListener("message", receiveMessage, false);
      window.opener.postMessage("authorizing:github", "*");
    </script>
  `;
  return new Blob([html]);
}

export async function onRequest(context) {
  const { request, env } = context;
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response("Missing GitHub OAuth environment variables", {
      headers: { "content-type": "text/html;charset=UTF-8" },
      status: 500
    });
  }

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "fukushi-sharyo-alert-decap-oauth",
        accept: "application/json"
      },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
    });

    const result = await response.json();
    if (result.error) {
      return new Response(renderBody("error", result), {
        headers: { "content-type": "text/html;charset=UTF-8" },
        status: 401
      });
    }

    return new Response(
      renderBody("success", {
        token: result.access_token,
        provider: "github"
      }),
      {
        headers: { "content-type": "text/html;charset=UTF-8" },
        status: 200
      }
    );
  } catch (error) {
    console.error(error);
    return new Response(error.message, {
      headers: { "content-type": "text/html;charset=UTF-8" },
      status: 500
    });
  }
}
