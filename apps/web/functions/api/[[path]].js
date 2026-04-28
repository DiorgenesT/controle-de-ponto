export async function onRequest(context) {
  const { request } = context
  const url = new URL(request.url)

  const targetPath = url.pathname.replace(/^\/api/, '') || '/'
  const targetUrl = `https://controle-ponto-api.dgtssk8.workers.dev${targetPath}${url.search}`

  const headers = new Headers(request.headers)

  const init = { method: request.method, headers }
  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = request.body
  }

  return fetch(targetUrl, init)
}
