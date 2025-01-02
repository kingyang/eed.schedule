type Method = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'

export interface RequestConfig {
  data?: ArrayBuffer | Blob | FormData | Record<string, any> | string
  headers?: Record<string, string>
  method?: Method
  signal?: AbortSignal
  url: string
}

export default function request(config: RequestConfig): Promise<any> {
  const {
    data = null,
    headers = {},
    method = 'GET',
    signal = null,
    url,
  } = config

  // 判断请求头的 Content-Type
  const contentType = headers['Content-Type'] || 'application/json'

  let body: FormData | null | string = null

  if (method !== 'GET' && method !== 'DELETE') {
    if (contentType.includes('application/json')) {
      body = JSON.stringify(data)
    }
    else if (contentType.includes('application/x-www-form-urlencoded')) {
      body = new URLSearchParams(data as Record<string, string>).toString()
    }
    else if (contentType.includes('multipart/form-data')) {
      body = data as FormData
    }
    else if (contentType.includes('text/plain')) {
      body = data as string
    }
    else {
      body = JSON.stringify(data)
    }
  }

  const options: RequestInit = {
    body,
    headers: {
      'Content-Type': contentType,
      ...headers,
    },
    method,
  }

  options.signal = signal

  // 使用 fetch 发起请求
  return fetch(url, options)
    .then((response) => {
      if (!response.ok) {
        return Promise.reject(new Error(`HTTP error! Status: ${response.status}`))
      }
      const contentType = response.headers.get('Content-Type') || ''
      if (contentType.includes('application/json')) {
        try {
          return response.json()
        }
        catch {
          return response.text()
        }
      }
      else {
        return response.text()
      }
    })
    .catch((error) => {
      if (error.name === 'AbortError') {
        return Promise.reject(new Error('Request canceled'))
      }
      return Promise.reject(error)
    })
}
