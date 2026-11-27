// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Cấu hình Swagger UI cho trang tài liệu API của lõi (/docs/ ở cổng APISIX).
// Đặc tả: dịch vụ lõi (viết tay, core-services.yaml), API dữ liệu do PostgREST tự sinh (rest-openapi.json) và đặc tả
// riêng của các gói đang bật (modules.json).
// Token lấy ở mục Authorize của đặc tả dịch vụ lõi được tự gắn vào lời gọi của cả hai đặc tả.
window.onload = async function () {
  document.title = 'CommuneOS – Tài liệu API lõi'

  // Swagger UI lưu token đã lấy (persistAuthorization) trong localStorage, theo tên cơ chế xác thực.
  function savedToken() {
    try {
      var auth = JSON.parse(localStorage.getItem('authorized') || '{}')
      return (auth.keycloak && auth.keycloak.token && auth.keycloak.token.access_token) ||
        (auth.bearer && auth.bearer.value) || ''
    } catch (e) {
      return ''
    }
  }

  // Đặc tả riêng của các gói đang bật (50-communeos.sh ghi modules.json khi container khởi động).
  var modules = []
  try {
    modules = await (await fetch('./modules.json', { cache: 'no-store' })).json()
  } catch (e) {
    modules = []
  }

  window.ui = SwaggerUIBundle({
    urls: [
      { url: './core-services.yaml', name: 'Dịch vụ lõi: quy trình, tệp, tài khoản, AI, công khai' },
      { url: './rest-openapi.json', name: 'Dữ liệu – PostgREST (/rest)' },
    ].concat(modules),
    'urls.primaryName': 'Dịch vụ lõi: quy trình, tệp, tài khoản, AI, công khai',
    dom_id: '#swagger-ui',
    deepLinking: true,
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    defaultModelsExpandDepth: 0,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    plugins: [SwaggerUIBundle.plugins.DownloadUrl],
    layout: 'StandaloneLayout',
    requestInterceptor: function (req) {
      // Không gắn token vào lời gọi tải đặc tả và lấy token (đường dẫn /docs/).
      var path = new URL(req.url, window.location.href).pathname
      if (path.indexOf('/docs/') !== 0 && !req.headers.Authorization) {
        var token = savedToken()
        if (token) req.headers.Authorization = 'Bearer ' + token
      }
      return req
    },
  })

  window.ui.initOAuth({ clientId: 'commune-app', appName: 'CommuneOS' })
}
