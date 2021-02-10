import { v4 } from 'uuid'
import { Page, Response } from 'playwright'
import { headersToObject } from 'headers-utils'
import { ServerApi } from 'src/createServer'

export type RequestHelperFn = (
  url: string,
  init?: RequestInit,
  predicate?: (res: Response, url: string) => boolean,
) => Promise<Response>

export function createRequestUtil(
  page: Page,
  server: ServerApi,
): RequestHelperFn {
  return (url, init, predicate) => {
    const requestId = v4()
    const resolvedUrl = url.startsWith('/')
      ? new URL(url, server.url).toString()
      : url

    const fetchOptions = init || {}
    const initialHeaders = fetchOptions.headers || {}
    const requestHeaders =
      initialHeaders instanceof Headers
        ? initialHeaders
        : new Headers(initialHeaders)

    const identityHeaderName = 'accept-language'
    requestHeaders.set(identityHeaderName, requestId)

    const resolvedInit = Object.assign({}, fetchOptions, {
      headers: headersToObject(requestHeaders),
    })

    page.evaluate(([url, init]) => fetch(url, init), [
      resolvedUrl,
      resolvedInit,
    ] as [string, RequestInit])

    const defaultResponsePredicate = (res: Response) => {
      const requestHeaders = res.request().headers()
      return requestHeaders[identityHeaderName] === requestId
    }

    return page.waitForResponse((res) => {
      return predicate
        ? predicate(res, resolvedUrl)
        : defaultResponsePredicate(res)
    })
  }
}