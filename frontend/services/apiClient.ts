import { getApiBaseUrl } from "@/lib/apiBase"
import { supabase } from "@/lib/supabase/client"
import { ApiRequestError, toApiRequestError } from "@/services/apiErrors"

/** Timeout default — curto, para a maioria das chamadas (blueprint §3.3). */
const DEFAULT_TIMEOUT_MS = 15_000
/** Override para endpoints lentos (geração por LLM, sync). Passe em `{ timeoutMs }`. */
export const LONG_RUNNING_TIMEOUT_MS = 120_000

interface RequestOptions {
  /** Headers extras por chamada, quando necessário. */
  headers?: Record<string, string>
  /**
   * Timeout desta chamada em ms. Default {@link DEFAULT_TIMEOUT_MS} (~15s);
   * use {@link LONG_RUNNING_TIMEOUT_MS} para endpoints lentos (blueprint §3.3).
   */
  timeoutMs?: number
}

/**
 * Auth SEM cache (blueprint §3.2): lê a sessão do Supabase a cada request. O client
 * de auth já serve da memória e só vai à rede quando o token expira.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function readString(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === "object" && key in obj) {
    const value = (obj as Record<string, unknown>)[key]
    return typeof value === "string" ? value : undefined
  }
  return undefined
}

/**
 * Extrai message/code do corpo de erro. Forma canônica: `{ error: { message, code } }`
 * (envelope wrapped). Tolera também `{ error: "msg" }` e `{ message }` no topo, para
 * erros que não venham do nosso backend (proxy, gateway).
 */
function readError(payload: unknown): { message?: string; code?: string } {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error: unknown }).error
    if (typeof error === "string") return { message: error }
    if (error && typeof error === "object") {
      return {
        message: readString(error, "message"),
        code: readString(error, "code"),
      }
    }
  }
  return { message: readString(payload, "message") }
}

/**
 * Backend padronizado no envelope WRAPPED (blueprint §4): `ApiResponse<T>`. O
 * `apiClient` desembrulha aqui UMA vez — os services recebem `T` limpo, sem cast.
 * Em erro (HTTP fora de 2xx ou `success:false`), levanta o erro canônico com status+code.
 */
async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const payload = text ? safeJsonParse(text) : undefined

  if (!res.ok) {
    const { message, code } = readError(payload)
    throw new ApiRequestError(res.status, message ?? res.statusText, code)
  }

  // Envelope: desembrulha `data`. Um `success:false` mesmo em 2xx também vira erro.
  if (payload && typeof payload === "object" && "success" in payload) {
    const envelope = payload as { success: unknown; data?: unknown }
    if (envelope.success === false) {
      const { message, code } = readError(payload)
      throw new ApiRequestError(res.status, message ?? "Erro na API", code)
    }
    return envelope.data as T
  }

  // Sem envelope (ex.: 2xx com corpo vazio ou não-padrão) — retorna como veio.
  return payload as T
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "AbortError"
  )
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  // FormData (upload): não serializa e deixa o browser pôr o Content-Type com boundary.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(await getAuthHeaders()),
      ...options?.headers,
    }
    // Timeout por chamada via AbortController (blueprint §3.3): sem isso um
    // `fetch` cru trava pra sempre quando o backend não responde.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    let res = await doFetch()
    // Refresh + retry no 401 mora aqui, não num cache de token (blueprint §3.2).
    if (res.status === 401) {
      const { data } = await supabase.auth.refreshSession()
      if (data.session) {
        res = await doFetch()
      }
    }
    return await parse<T>(res)
  } catch (err) {
    if (isAbortError(err)) {
      throw new ApiRequestError(
        408,
        `Tempo limite de ${timeoutMs}ms excedido em ${method} ${path}`,
        "TIMEOUT",
      )
    }
    throw toApiRequestError(err, "Falha ao chamar a API")
  }
}

/**
 * ÚNICO transporte da aplicação (blueprint §1). Toda função que fala com a rede
 * passa por aqui — nunca um `fetch` cru espalhado.
 */
export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, undefined, options),
  /**
   * Upload dedicado para `FormData` (blueprint §3.4) — não force isso pelo `post`
   * JSON. O Content-Type (com boundary multipart) é definido pelo browser.
   */
  upload: <T>(path: string, formData: FormData, options?: RequestOptions) =>
    request<T>("POST", path, formData, options),
}
