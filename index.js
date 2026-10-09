/**
 * Agnes image generation tool for DSH.
 *
 * Registers one Host tool that calls the Agnes AI image API, which speaks the
 * OpenAI `POST /images/generations` dialect with two Agnes-specific quirks:
 *
 * 1. `response_format` must NOT sit at the top level of the request body; it
 *    belongs in `extra_body.response_format` (the API rejects the top-level
 *    spelling), so every request is built through `extra_body`.
 * 2. Image-to-image and multi-image composition take their inputs from
 *    `extra_body.image`, as an array of public HTTPS URLs or Data URIs.
 *
 * Two further behaviours are deliberate:
 *
 * 1. Provider URLs are not guaranteed to live forever, so every successful
 *    generation is downloaded and written into the workspace immediately (or
 *    decoded from `b64_json` when the API returned base64).
 * 2. The tool has no package dependencies: it uses only Node built-ins and the
 *    injected `tools` / `attachments` / `workspaceRegistry` services, so it
 *    resolves no matter which DSH installation the profile is pinned to.
 *
 * @module dsh-agnes-image
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { extname, isAbsolute, join, resolve } from 'node:path'

/** Tool name as the model sees it. */
const TOOL_NAME = 'agnes_generate_image'

/** Agnes accepts either a size tier or an explicit `WxH`. */
const SIZE_PATTERN = /^(1K|2K|3K|4K|\d{3,5}x\d{3,5})$/i

/** Aspect ratios the image models document as supported. */
const RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16', '2:3', '3:2', '21:9']

const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const EXTENSION_MEDIA_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

/**
 * Agnes image model ids, newest first.
 *
 * 2.5 Flash is the current generation and shares 2.1's request/response shape,
 * sizes and pricing; 2.0 Flash takes explicit `WxH` sizes but answers the same
 * endpoint.
 */
const MODELS = ['agnes-image-2.5-flash', 'agnes-image-2.1-flash', 'agnes-image-2.0-flash']

/** Model used when neither the call nor the row config names one. */
const DEFAULT_MODEL = 'agnes-image-2.5-flash'

/** Default API base URL, without a trailing slash. */
const DEFAULT_BASE_URL = 'https://apihub.agnes-ai.com/v1'

/**
 * Where a key written for this plugin alone is looked up when nothing else has one.
 *
 * `AGNES_API_KEY_FILE` overrides the path (the test suite uses it, and so can
 * anyone who keeps secrets elsewhere). The file is re-read on every call, so
 * replacing the key never requires restarting Harness.
 */
const KEY_FILE = process.env.AGNES_API_KEY_FILE ?? join(homedir(), '.dsh', 'agnes-image.config.json')

/** Refuse to inline enormous local reference images: the whole file becomes base64 in one request. */
const MAX_REFERENCE_BYTES = 12 * 1024 * 1024

export const name = 'agnes-image'

/**
 * Services this plugin reads.
 *
 * Cordis gates every `ctx.<name>` access on this declaration, so a service that
 * is used but not declared throws at the point of use rather than at load. The
 * declaration must be an array of names (a nested `{required, optional}` object
 * would register services literally named "required" and "optional"), and the
 * code degrades gracefully when `attachments` or `workspaceRegistry` is absent.
 */
export const inject = ['tools', 'attachments', 'workspaceRegistry']

/**
 * Configuration shape and defaults.
 *
 * Cordis reads `Config["~standard"].validate(...)` -- the Standard Schema
 * contract -- and rejects anything without that member. This hand-written
 * schema implements the contract directly instead of importing zod, which keeps
 * the plugin dependency-free.
 */
const CONFIG_FIELDS = {
  apiKey: {
    kind: 'string',
    description:
      'Agnes API key. When omitted, AGNES_API_KEY from the environment is used, then ~/.dsh/agnes-image.config.json.',
  },
  baseUrl: {
    kind: 'string',
    default: DEFAULT_BASE_URL,
    description: 'Agnes API base URL, without a trailing slash.',
  },
  model: {
    kind: 'string',
    default: DEFAULT_MODEL,
    description: 'Default model id used when a call omits `model`.',
  },
  outputDir: {
    kind: 'string',
    default: 'generated-images',
    description:
      'Directory for saved images, relative to the session working directory unless absolute.',
  },
  timeoutMs: {
    kind: 'number',
    default: 300000,
    description: 'Per-request timeout in milliseconds. Agnes advises 60s-360s.',
  },
}

/**
 * Validate one config candidate, applying defaults.
 *
 * @param {unknown} candidate - Raw config from the loader row.
 * @returns {{value: Record<string, unknown>} | {issues: Array<{message: string, path?: string[]}>}} Validation outcome.
 */
function validateConfig(candidate) {
  const input = candidate === null || candidate === undefined ? {} : candidate
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { issues: [{ message: 'config must be an object' }] }
  }

  const source = /** @type {Record<string, unknown>} */ (input)
  const value = {}
  const issues = []

  for (const [key, spec] of Object.entries(CONFIG_FIELDS)) {
    const raw = source[key]
    if (raw === undefined || raw === null) {
      if ('default' in spec) value[key] = spec.default
      continue
    }
    if (spec.kind === 'string') {
      if (typeof raw !== 'string') {
        issues.push({ message: `\`${key}\` must be a string`, path: [key] })
        continue
      }
      value[key] = raw
      continue
    }
    if (spec.kind === 'number') {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        issues.push({ message: `\`${key}\` must be a finite number`, path: [key] })
        continue
      }
      value[key] = raw
      continue
    }
    value[key] = raw
  }

  for (const key of Object.keys(source)) {
    if (!(key in CONFIG_FIELDS)) {
      issues.push({ message: `unknown config field \`${key}\``, path: [key] })
    }
  }

  if (issues.length > 0) return { issues }
  return { value }
}

export const Config = {
  '~standard': {
    version: 1,
    vendor: 'dsh-agnes-image',
    /** @param {unknown} value - Candidate config. */
    validate: validateConfig,
  },
  /** JSON Schema view of the same shape, for tooling that renders it. */
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    properties: Object.fromEntries(
      Object.entries(CONFIG_FIELDS).map(([key, spec]) => [
        key,
        {
          type: spec.kind,
          ...('default' in spec ? { default: spec.default } : {}),
          description: spec.description,
        },
      ]),
    ),
  },
}

/**
 * Read an API key from the plugin's own key file, if one exists.
 *
 * The file is re-read on every call so a key can be replaced without restarting
 * Harness. Any failure (missing file, bad JSON, wrong shape) means "no key
 * here" rather than an error: the caller falls through to its own message.
 *
 * @returns {string | undefined} The key, or undefined when the file has none.
 */
function keyFromFile() {
  try {
    const parsed = JSON.parse(readFileSync(KEY_FILE, 'utf8'))
    const value = parsed?.apiKey
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  } catch {
    // No key file, or it is unreadable: not an error on its own.
  }
  return undefined
}

/**
 * Pick a file extension from a media type, falling back to the magic bytes.
 *
 * @param {string | null} mediaType - `Content-Type` reported by the provider or the fetch.
 * @param {Uint8Array} bytes - Encoded image bytes.
 * @returns {string} A bare extension without the dot.
 */
function extensionFor(mediaType, bytes) {
  const normalized = (mediaType ?? '').split(';')[0].trim().toLowerCase()
  if (EXTENSIONS[normalized] !== undefined) return EXTENSIONS[normalized]
  if (bytes.length >= 8) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'png'
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg'
    if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'webp'
    if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'gif'
  }
  return 'png'
}

/**
 * Narrow a caller- or provider-reported media type to one the attachment service accepts.
 *
 * @param {string | null} mediaType - Candidate media type.
 * @param {Uint8Array} bytes - Encoded image bytes used as the fallback signal.
 * @returns {'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'} Accepted media type.
 */
function imageMediaType(mediaType, bytes) {
  const normalized = (mediaType ?? '').split(';')[0].trim().toLowerCase()
  if (Object.hasOwn(EXTENSIONS, normalized)) return /** @type {any} */ (normalized)
  const extension = extensionFor(normalized, bytes)
  if (extension === 'jpg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'gif') return 'image/gif'
  return 'image/png'
}

/**
 * Windows refuses to create files whose base name is a reserved device name,
 * however the extension is spelled: `con.png`, `NUL.png`, `lpt1.jpg` all fail.
 */
const RESERVED_NAMES = new Set([
  'con', 'prn', 'aux', 'nul', 'clock$',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
])

/**
 * Build a filesystem-safe basename fragment from a prompt.
 *
 * @param {string} prompt - The generation prompt.
 * @returns {string} At most 40 characters of slug, or `image` when nothing survives.
 */
function slug(prompt) {
  const cleaned = prompt
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  if (cleaned.length === 0) return 'image'
  return RESERVED_NAMES.has(cleaned) ? `${cleaned}-image` : cleaned
}

/**
 * Sanitize a caller-supplied base filename.
 *
 * @param {string} name - Raw `outputName` argument.
 * @returns {string | null} A safe base name, or null when it supplied no usable characters.
 */
function safeBaseName(name) {
  const cleaned = String(name).trim().replace(/[^\p{Letter}\p{Number}._-]+/gu, '-')
  if (cleaned.length === 0) return null
  // A name of only dots would resolve to a directory reference.
  if (/^\.+$/.test(cleaned)) return null
  return RESERVED_NAMES.has(cleaned.replace(/\..*$/, '').toLowerCase())
    ? `${cleaned}-image`
    : cleaned
}

/**
 * Find the directory the session that triggered this call is working in.
 *
 * `process.cwd()` is the wrong answer: the Host inherits the directory of the
 * launcher that started it, not the session's workspace. Everything here is
 * best-effort and falls back to `process.cwd()`.
 *
 * @param {any} registry - `ctx.workspaceRegistry`, possibly undefined.
 * @param {string | undefined} sessionId - The calling agent's session id.
 * @returns {string | null} A directory path, or null when none could be found.
 */
function workspaceRootFor(registry, sessionId) {
  if (registry === undefined || registry === null) return null
  if (typeof sessionId !== 'string' || sessionId.length === 0) return null
  try {
    const workspaces = registry.list()
    if (!Array.isArray(workspaces)) return null
    for (const workspace of workspaces) {
      const ids = workspace?.sessionIds
      if (Array.isArray(ids) && ids.includes(sessionId) && typeof workspace.path === 'string') {
        return workspace.path
      }
    }
  } catch {
    return null
  }
  return null
}

/**
 * Resolve the directory images are written into.
 *
 * A flat `generated-images/` becomes a junk drawer within a few hundred images,
 * so the date is appended as a subdirectory: `generated-images/2026-09-30/`.
 *
 * @param {string} outputDir - Configured directory, possibly relative.
 * @param {string} cwd - Session working directory.
 * @param {Date} now - Clock, injected so the result is testable.
 * @returns {string} An absolute directory path including the date folder.
 */
function resolveOutputDir(outputDir, cwd, now = new Date()) {
  const root = isAbsolute(outputDir) ? outputDir : resolve(cwd, outputDir)
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return join(root, `${year}-${month}-${day}`)
}

/**
 * Turn an Agnes HTTP failure into a message that says what to fix.
 *
 * @param {number} status - HTTP status returned by Agnes.
 * @param {string} body - Response body, already read as text.
 * @param {string} model - Model id the failed request asked for.
 * @returns {string} An actionable error message.
 */
function describeHttpFailure(status, body, model) {
  const detail = body.slice(0, 600)
  if (status === 401 || status === 403) {
    return `Agnes rejected the API key (HTTP ${status}). Check that the key holds the full value, not a display name.\n`
      + `Agnes 拒绝了 API Key（HTTP ${status}）。请确认填的是 Key 本身（sk- 开头的一长串），而不是你给它起的名字。\n`
      + `Agnes said / 服务端返回：${detail}`
  }
  if (status === 404) {
    return `Agnes does not recognise model "${model}" (HTTP 404). Pass a different \`model\` (agnes-image-2.5-flash / 2.1-flash / 2.0-flash).\n`
      + `Agnes 不认识模型 "${model}"（HTTP 404）。请换一个模型（agnes-image-2.5-flash / 2.1-flash / 2.0-flash）。\n`
      + `Agnes said / 服务端返回：${detail}`
  }
  if (status === 429) {
    return `Agnes rate limited the request (HTTP 429). Wait and retry, or lower the request rate.\n`
      + `请求过于频繁（HTTP 429）。等一会儿再试，或降低调用频率。\n`
      + `Agnes said / 服务端返回：${detail}`
  }
  return `Agnes returned HTTP ${status} / Agnes 返回 HTTP ${status}：${detail}`
}

/**
 * Register the Agnes image tool.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - Plugin context.
 * @param {Record<string, unknown>} config - Validated row config.
 * @returns {void}
 */
export function apply(ctx, config) {
  const baseUrl = String(config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
  const defaultModel = String(config.model ?? DEFAULT_MODEL)
  const outputDir = String(config.outputDir ?? 'generated-images')
  const timeoutMs = Number(config.timeoutMs ?? 300000)
  const configuredKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''

  /**
   * Read the Agnes API key from the row config, then the environment, then the key file.
   *
   * @returns {string | undefined} The key, or undefined when unset.
   */
  function apiKey() {
    if (configuredKey.length > 0) return configuredKey
    const fromEnv = process.env.AGNES_API_KEY
    if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv.trim()
    return keyFromFile()
  }

  /**
   * Turn a caller-supplied image reference into something Agnes accepts.
   *
   * Public HTTPS URLs and Data URIs pass through untouched; a local path is read
   * from disk and inlined as a Data URI, because the API fetches images over the
   * network and cannot see this machine's filesystem.
   *
   * @param {string} reference - URL, Data URI, or local file path.
   * @param {string} cwd - Session working directory for relative paths.
   * @returns {Promise<string>} A public URL or Data URI.
   */
  async function toImageReference(reference, cwd) {
    const trimmed = reference.trim()
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed

    const absolute = isAbsolute(trimmed) ? trimmed : resolve(cwd, trimmed)
    let bytes
    try {
      bytes = await readFile(absolute)
    } catch (error) {
      throw new Error(
        `Cannot read the reference image "${reference}" / 读不到参考图 "${reference}"：${String(error)}`,
      )
    }
    if (bytes.byteLength > MAX_REFERENCE_BYTES) {
      throw new Error(
        `Reference image "${reference}" is ${Math.round(bytes.byteLength / 1024 / 1024)} MB; the limit is ${MAX_REFERENCE_BYTES / 1024 / 1024} MB because local files are inlined as base64.\n`
        + `参考图 "${reference}" 有 ${Math.round(bytes.byteLength / 1024 / 1024)} MB，超过 ${MAX_REFERENCE_BYTES / 1024 / 1024} MB 上限——本地文件需以 base64 内联，请先压缩或改用公网 URL。`,
      )
    }
    const byExtension = EXTENSION_MEDIA_TYPES[extname(absolute).toLowerCase()]
    const mediaType = byExtension ?? imageMediaType(null, new Uint8Array(bytes))
    return `data:${mediaType};base64,${bytes.toString('base64')}`
  }

  ctx.effect(() =>
    ctx.tools.register({
      name: TOOL_NAME,
      description: [
        'Generate or edit an image with Agnes AI (agnes-image-2.5-flash and friends).',
        'Supports text-to-image, image-to-image editing, and multi-image composition.',
        'The generated image is downloaded immediately and saved into the session working directory,',
        'so the returned path stays valid after the provider URL expires.',
        'Use it whenever the user asks for a picture, illustration, poster, icon, wallpaper, product shot,',
        'or wants an existing image restyled or edited.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: [
              'What to draw or how to edit. Write a detailed visual description.',
              'A strong text-to-image prompt reads: [subject] + [scene/environment] + [style] + [lighting] + [composition] + [quality].',
              'For image-to-image, state what to change, the new style or scene, elements to add or remove, and what must be preserved.',
            ].join(' '),
          },
          model: {
            type: 'string',
            enum: MODELS,
            description:
              'Override the model. 2.5 Flash is the newest and strongest; 2.1 Flash is the previous generation; 2.0 Flash takes explicit WxH sizes.',
          },
          size: {
            type: 'string',
            description:
              'Output size tier (1K, 2K, 3K, 4K) or an explicit WxH such as 1024x1024. Defaults to 1K. Non-native WxH values may be snapped to the nearest tier.',
          },
          ratio: {
            type: 'string',
            enum: RATIOS,
            description: 'Aspect ratio paired with a tier size, e.g. "16:9". Defaults to 1:1.',
          },
          image: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Reference images for image-to-image or multi-image composition: public HTTPS URLs, Data URIs, or local file paths (which are inlined automatically). Order matters when the prompt refers to "the first image".',
          },
          outputName: {
            type: 'string',
            description:
              'Optional base filename without an extension. Defaults to a slug derived from the prompt plus a timestamp.',
          },
        },
        required: ['prompt'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            saved: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  bytes: { type: 'integer' },
                  // Present only when the attachment service accepted the image;
                  // `render` uses it to show the picture inline.
                  attachment: { type: 'object' },
                  width: { type: 'integer' },
                  height: { type: 'integer' },
                },
                required: ['path'],
                additionalProperties: false,
              },
            },
          },
          required: ['model', 'saved'],
          additionalProperties: false,
        },
        /**
         * Render the saved images plus their paths as tool content.
         *
         * @param {unknown} _args - Original tool arguments (unused).
         * @param {any} value - The tool's returned value.
         * @returns {any[]} Text and image content blocks.
         */
        render(_args, value) {
          const saved = Array.isArray(value?.saved) ? value.saved : []
          const lines = [`model: ${value?.model ?? '(unknown)'}`]
          for (const entry of saved) {
            lines.push(`saved: ${entry.path}${entry.width ? ` (${entry.width}x${entry.height})` : ''}`)
          }
          const blocks = [{ type: 'text', text: lines.join('\n') }]
          for (const entry of saved) {
            if (entry.attachment) blocks.push({ type: 'image', attachment: entry.attachment })
          }
          return blocks
        },
      },
      async execute(args, exec) {
        const key = apiKey()
        if (key === undefined) {
          throw new Error(
            'Agnes API key is missing. Put `apiKey` in the agnes-image row config, set the AGNES_API_KEY environment variable, or write {"apiKey": "sk-..."} into ' + KEY_FILE + '.\n'
            + '缺少 Agnes API Key。请在 agnes-image 这一行的 config 里填 `apiKey`，或设置环境变量 AGNES_API_KEY，或把 {"apiKey": "sk-..."} 写进 ' + KEY_FILE + '。\n'
            + '\n'
            + 'How to get one / 怎么获取：\n'
            + '  1. https://agnes-ai.com - sign in to the console (登录 Agnes AI 控制台)\n'
            + '  2. API Key management - create a key and copy the value starting with "sk-" (API Key 管理 - 创建并复制 sk- 开头的那串)\n'
            + '  3. Image models (agnes-image-2.5-flash / 2.1-flash / 2.0-flash) are currently free (图像模型当前免费)\n'
            + '\n'
            + 'Note: the key VALUE is what is needed, not the key NAME you gave it. (要的是 Key 本身，不是你给它起的名字。)',
          )
        }

        const prompt = String(args.prompt ?? '').trim()
        if (prompt.length === 0) {
          throw new Error('`prompt` must not be empty. / `prompt` 不能为空。')
        }

        const model = typeof args.model === 'string' && args.model.length > 0 ? args.model : defaultModel
        const size = args.size === undefined ? '1K' : String(args.size).trim()
        if (!SIZE_PATTERN.test(size)) {
          throw new Error(
            `Invalid size "${size}". Use a tier label (1K, 2K, 3K, 4K) or WxH such as 1024x1024.\n`
            + `尺寸 "${size}" 无效。请用档位（1K / 2K / 3K / 4K），或具体尺寸如 1024x1024。`,
          )
        }
        const ratio = args.ratio === undefined ? '1:1' : String(args.ratio).trim()
        if (!RATIOS.includes(ratio)) {
          throw new Error(
            `Invalid ratio "${ratio}". Supported values: ${RATIOS.join(', ')}.\n`
            + `宽高比 "${ratio}" 无效。支持：${RATIOS.join('、')}。`,
          )
        }

        const sessionId = exec.agent?.id
        const cwd = workspaceRootFor(ctx.workspaceRegistry, sessionId) ?? process.cwd()

        // Agnes is told about inputs through `extra_body`, and rejects a
        // top-level `response_format`, so every optional parameter lives here.
        const extraBody = { response_format: 'url' }
        const references = Array.isArray(args.image)
          ? args.image.map((entry) => String(entry ?? '').trim()).filter((entry) => entry.length > 0)
          : []
        if (references.length > 0) {
          const resolved = []
          for (const reference of references) {
            resolved.push(await toImageReference(reference, cwd))
          }
          extraBody.image = resolved
        }

        // Only a tier size pairs with `ratio`; an explicit WxH already fixes the
        // shape and Agnes rejects the combination's intent as ambiguous.
        const tiered = /^(1K|2K|3K|4K)$/i.test(size)
        const body = {
          model,
          prompt,
          size,
          ...(tiered ? { ratio } : {}),
          extra_body: extraBody,
        }

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        const onAbort = () => controller.abort()
        exec.signal?.addEventListener('abort', onAbort, { once: true })

        let payload
        try {
          const response = await fetch(`${baseUrl}/images/generations`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          })
          const text = await response.text()
          if (!response.ok) {
            throw new Error(describeHttpFailure(response.status, text, model))
          }
          try {
            payload = JSON.parse(text)
          } catch {
            throw new Error(`Agnes returned a non-JSON body / Agnes 返回了非 JSON 内容：${text.slice(0, 300)}`)
          }
        } finally {
          clearTimeout(timer)
          exec.signal?.removeEventListener('abort', onAbort)
        }

        const entries = Array.isArray(payload?.data) ? payload.data : []
        if (entries.length === 0) {
          throw new Error(
            `Agnes returned no image / Agnes 没有返回图片。Raw response / 原始响应：${JSON.stringify(payload).slice(0, 600)}`,
          )
        }

        const generatedAt = new Date()
        const directory = resolveOutputDir(outputDir, cwd, generatedAt)
        await mkdir(directory, { recursive: true })

        // The date now lives in the directory, so the filename carries the time
        // to the second; a prompt-only name would collide on a second request.
        const stamp = generatedAt.toISOString().slice(11, 19).replace(/:/g, '')
        const requested = typeof args.outputName === 'string' ? safeBaseName(args.outputName) : null
        const base = requested ?? `${slug(prompt)}-${stamp}`

        const saved = []
        for (const [index, entry] of entries.entries()) {
          let bytes
          let reportedType = null

          if (typeof entry?.b64_json === 'string' && entry.b64_json.length > 0) {
            bytes = new Uint8Array(Buffer.from(entry.b64_json, 'base64'))
          } else if (typeof entry?.url === 'string' && entry.url.length > 0) {
            const imageResponse = await fetch(entry.url, { signal: controller.signal })
            if (!imageResponse.ok) {
              throw new Error(`Failed to download the generated image / 下载生成的图片失败：HTTP ${imageResponse.status}`)
            }
            reportedType = imageResponse.headers.get('content-type')
            bytes = new Uint8Array(await imageResponse.arrayBuffer())
          } else {
            continue
          }

          const mediaType = imageMediaType(reportedType, bytes)
          const extension = EXTENSIONS[mediaType] ?? 'png'
          const suffix = entries.length > 1 ? `-${index + 1}` : ''
          const path = join(directory, `${base}${suffix}.${extension}`)
          await writeFile(path, bytes)

          const record = { path, bytes: bytes.byteLength }
          if (typeof ctx.attachments?.saveImage === 'function') {
            try {
              const ref = await ctx.attachments.saveImage({
                data: bytes,
                mediaType,
                name: `${base}${suffix}.${extension}`,
              })
              record.attachment = ref
              record.width = ref.width
              record.height = ref.height
            } catch (error) {
              ctx.logger?.warn?.(`agnes-image: attachment save failed: ${String(error)}`)
            }
          }
          saved.push(record)
        }

        if (saved.length === 0) {
          throw new Error(
            'Agnes reported images but none carried a `url` or `b64_json` field. / Agnes 报告有图片，但都没有 `url` 或 `b64_json` 字段。',
          )
        }

        return { model, saved }
      },
    }),
  )
}
