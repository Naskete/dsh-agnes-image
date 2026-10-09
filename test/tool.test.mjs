/**
 * 工具行为测试：注册契约、请求体形状、落盘流程、错误信息。
 *
 * 全部离线：用假 `fetch` 顶掉网络，唯一的「外部数据」是内存里的 1×1 PNG 字节。
 */

import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

// 必须在 import 之前：KEY_FILE 于模块加载时解析。这里指向一个不存在的文件，
// 「缺 Key」这一分支才是确定性的，也不会碰到开发者机器上的真实密钥。
const MISSING_KEY_FILE = join(tmpdir(), 'dsh-agnes-image-tests', 'no-such-key.json')
process.env.AGNES_API_KEY_FILE = MISSING_KEY_FILE
delete process.env.AGNES_API_KEY

const { apply } = await import('../index.js')

/** 一张真实的 1×1 PNG，足够让魔数与扩展名判定走通。 */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/**
 * 用一个假的 Cordis 上下文挂载插件，取回它注册的工具。
 *
 * @param {object} [config] - Loader 行配置。
 * @param {object} [services] - 额外注入的服务（attachments / workspaceRegistry / logger）。
 * @returns {object} 注册到 `ctx.tools.register` 的工具定义。
 */
function mountPlugin(config = {}, services = {}) {
  let tool
  const ctx = {
    effect(factory) {
      factory()
      return () => {}
    },
    tools: {
      register(definition) {
        tool = definition
        return () => {}
      },
    },
    logger: { warn() {} },
    ...services,
  }
  apply(ctx, config)
  assert.ok(tool, '插件必须注册一个工具')
  return tool
}

/**
 * 换掉全局 fetch 并记录每次调用。
 *
 * @param {object} t - node:test 的测试上下文，用于在结束时还原。
 * @param {(url: string, init: object, seq: number) => Promise<object>} handler - 假响应工厂。
 * @returns {Array<{url: string, init: object}>} 调用记录。
 */
function mockFetch(t, handler) {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init })
    return handler(String(url), init, calls.length)
  }
  t.after(() => {
    globalThis.fetch = original
  })
  return calls
}

/**
 * 构造一个 JSON 响应替身。
 *
 * @param {unknown} body - 响应体；字符串按原文返回，其余序列化。
 * @param {number} [status] - HTTP 状态码。
 * @returns {object} fetch 响应替身。
 */
function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    arrayBuffer: async () => new ArrayBuffer(0),
  }
}

/**
 * 构造一个图片字节响应替身。
 *
 * @param {Buffer} bytes - 图片字节。
 * @param {string} [mediaType] - 声明的 Content-Type。
 * @returns {object} fetch 响应替身。
 */
function bytesResponse(bytes, mediaType = 'image/png') {
  const copy = Uint8Array.from(bytes)
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': mediaType }),
    text: async () => '',
    arrayBuffer: async () => copy.buffer,
  }
}

/** 一个「先返回 URL、再返回图片字节」的正常服务端。 */
const happyHandler = (url) =>
  url.includes('/images/generations')
    ? jsonResponse({ created: 1, data: [{ url: 'https://cdn.example.test/out.png', b64_json: null }] })
    : bytesResponse(PNG_1X1)

/**
 * 准备一个隔离的测试场景：临时工作区 + 插件实例 + exec 上下文。
 *
 * @param {object} t - 测试上下文，用于清理临时目录。
 * @param {object} [options] - 覆盖 Loader 行配置或会话 id。
 * @returns {Promise<{tool: object, dir: string, exec: object}>} 场景句柄。
 */
async function scenario(t, options = {}) {
  const sessionId = options.sessionId ?? 'session-1'
  const dir = await mkdtemp(join(tmpdir(), 'dsh-agnes-image-ws-'))
  t.after(() => rm(dir, { recursive: true, force: true }))

  const services = options.withoutRegistry
    ? {}
    : { workspaceRegistry: { list: () => [{ path: dir, sessionIds: [sessionId] }] } }
  const tool = mountPlugin({ apiKey: 'sk-test', ...options.config }, { ...services, ...options.services })

  return { tool, dir, exec: { agent: { id: sessionId } } }
}

test('工具契约：名称、必填参数、输出渲染', () => {
  const tool = mountPlugin()
  assert.equal(tool.name, 'agnes_generate_image')
  assert.match(tool.description, /Agnes AI/)
  assert.deepEqual(tool.parameters.required, ['prompt'])
  assert.deepEqual(
    Object.keys(tool.parameters.properties).sort(),
    ['image', 'model', 'outputName', 'prompt', 'ratio', 'size'],
  )
  assert.equal(tool.parameters.additionalProperties, false)

  const blocks = tool.output.render({}, {
    model: 'agnes-image-2.5-flash',
    saved: [{ path: 'D:/shots/a.png', attachment: { attachmentId: 'a1' } }, { path: 'D:/shots/b.png' }],
  })
  assert.equal(blocks[0].type, 'text')
  assert.match(blocks[0].text, /D:\/shots\/a\.png/)
  assert.equal(blocks.filter((block) => block.type === 'image').length, 1)
})

test('缺少 API Key 时报错并给出获取方式', async (t) => {
  const { tool, exec } = await scenario(t, { config: { apiKey: '' } })
  const calls = mockFetch(t, happyHandler)

  await assert.rejects(
    () => tool.execute({ prompt: 'a cat' }, exec),
    (error) => {
      assert.match(error.message, /API key is missing/)
      assert.ok(error.message.includes(MISSING_KEY_FILE), '报错里要写清去哪里放 Key')
      return true
    },
  )
  assert.equal(calls.length, 0, '缺 Key 时不应发起任何请求')
})

test('文生图：请求体走 extra_body，图片落盘到会话工作区', async (t) => {
  const { tool, dir, exec } = await scenario(t)
  const calls = mockFetch(t, happyHandler)

  const result = await tool.execute(
    { prompt: 'a cheerful pelican on a bicycle', size: '2K', ratio: '16:9', outputName: 'pelican' },
    exec,
  )

  // 请求本身
  assert.equal(calls.length, 2, '一次生成请求 + 一次下载请求')
  assert.equal(calls[0].url, 'https://apihub.agnes-ai.com/v1/images/generations')
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer sk-test')
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    model: 'agnes-image-2.5-flash',
    prompt: 'a cheerful pelican on a bicycle',
    size: '2K',
    ratio: '16:9',
    extra_body: { response_format: 'url' },
  })
  assert.ok(
    !('response_format' in JSON.parse(calls[0].init.body)),
    'response_format 出现在请求体顶层会被 Agnes 拒绝',
  )

  // 落盘
  const [dateDir] = await readdir(join(dir, 'generated-images'))
  assert.match(dateDir, /^\d{4}-\d{2}-\d{2}$/)
  const [file] = await readdir(join(dir, 'generated-images', dateDir))
  assert.equal(file, 'pelican.png')

  const saved = result.saved[0]
  assert.equal(saved.bytes, PNG_1X1.byteLength)
  assert.equal((await readFile(saved.path)).byteLength, PNG_1X1.byteLength)
  assert.equal(result.model, 'agnes-image-2.5-flash')
})

test('默认参数：1K / 1:1 / 默认模型 / 无参考图', async (t) => {
  const { tool, exec } = await scenario(t)
  const calls = mockFetch(t, happyHandler)

  await tool.execute({ prompt: 'a lighthouse' }, exec)

  assert.deepEqual(JSON.parse(calls[0].init.body), {
    model: 'agnes-image-2.5-flash',
    prompt: 'a lighthouse',
    size: '1K',
    ratio: '1:1',
    extra_body: { response_format: 'url' },
  })
})

test('显式 WxH 尺寸不携带 ratio', async (t) => {
  const { tool, exec } = await scenario(t)
  const calls = mockFetch(t, happyHandler)

  await tool.execute({ prompt: 'a lighthouse', size: '1024x768', ratio: '16:9' }, exec)

  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.size, '1024x768')
  assert.ok(!('ratio' in body), 'WxH 已固定形状，再带 ratio 会让意图含混')
})

test('尺寸、宽高比、提示词非法时在本地就被拦下', async (t) => {
  const { tool, exec } = await scenario(t)
  const calls = mockFetch(t, happyHandler)

  await assert.rejects(() => tool.execute({ prompt: 'x', size: 'huge' }, exec), /Invalid size/)
  await assert.rejects(() => tool.execute({ prompt: 'x', ratio: '5:4' }, exec), /Invalid ratio/)
  await assert.rejects(() => tool.execute({ prompt: '   ' }, exec), /must not be empty/)
  assert.equal(calls.length, 0, '参数校验失败不应发起请求')
})

test('自定义模型与 baseUrl 生效', async (t) => {
  const { tool, exec } = await scenario(t, {
    config: { model: 'agnes-image-2.0-flash', baseUrl: 'https://apihub.agnes-ai.cn/v1/' },
  })
  const calls = mockFetch(t, happyHandler)

  await tool.execute({ prompt: 'a teapot', model: 'agnes-image-2.1-flash' }, exec)

  assert.equal(calls[0].url, 'https://apihub.agnes-ai.cn/v1/images/generations', '末尾斜杠要被去掉')
  assert.equal(JSON.parse(calls[0].init.body).model, 'agnes-image-2.1-flash', '调用参数优先于行配置')
})

test('本地参考图被内联为 Data URI 并放进 extra_body.image', async (t) => {
  const { tool, dir, exec } = await scenario(t)
  const reference = join(dir, 'input.png')
  await writeFile(reference, PNG_1X1)
  const calls = mockFetch(t, happyHandler)

  await tool.execute({ prompt: 'make it cyberpunk', image: [reference], size: '1K' }, exec)

  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.extra_body.image.length, 1)
  assert.ok(body.extra_body.image[0].startsWith('data:image/png;base64,'))
  assert.ok(!('image' in body), '参考图必须走 extra_body.image')
})

test('公网 URL 参考图原样透传，且支持多图顺序', async (t) => {
  const { tool, exec } = await scenario(t)
  const calls = mockFetch(t, happyHandler)

  await tool.execute(
    { prompt: 'combine them', image: ['https://example.test/a.png', 'https://example.test/b.png'] },
    exec,
  )

  assert.deepEqual(JSON.parse(calls[0].init.body).extra_body.image, [
    'https://example.test/a.png',
    'https://example.test/b.png',
  ])
})

test('空字符串参考图被忽略，不产生空的 image 数组', async (t) => {
  const { tool, exec } = await scenario(t)
  const calls = mockFetch(t, happyHandler)

  await tool.execute({ prompt: 'a boat', image: ['', '   '] }, exec)

  assert.ok(!('image' in JSON.parse(calls[0].init.body).extra_body))
})

test('不存在的参考图给出清晰报错', async (t) => {
  const { tool, dir, exec } = await scenario(t)
  const calls = mockFetch(t, happyHandler)

  await assert.rejects(
    () => tool.execute({ prompt: 'restyle', image: [join(dir, 'nope.png')] }, exec),
    /Cannot read the reference image/,
  )
  assert.equal(calls.length, 0)
})

test('b64_json 响应同样落盘，且不需要再下载', async (t) => {
  const { tool, exec } = await scenario(t)
  const calls = mockFetch(t, (url) =>
    url.includes('/images/generations')
      ? jsonResponse({ created: 1, data: [{ url: null, b64_json: PNG_1X1.toString('base64') }] })
      : bytesResponse(PNG_1X1),
  )

  const result = await tool.execute({ prompt: 'a moon', outputName: 'moon' }, exec)

  assert.equal(calls.length, 1)
  assert.equal(result.saved[0].bytes, PNG_1X1.byteLength)
  assert.match(result.saved[0].path, /moon\.png$/)
})

test('attachment 服务可用时返回可内联的引用', async (t) => {
  const { tool, exec } = await scenario(t, {
    services: {
      attachments: {
        saveImage: async (input) => ({
          attachmentId: 'att-1',
          mediaType: input.mediaType,
          bytes: input.data.byteLength,
          width: 1,
          height: 1,
        }),
      },
    },
  })
  mockFetch(t, happyHandler)

  const result = await tool.execute({ prompt: 'a duck' }, exec)

  assert.equal(result.saved[0].attachment.attachmentId, 'att-1')
  assert.equal(result.saved[0].width, 1)
})

test('attachment 失败不影响图片落盘', async (t) => {
  const { tool, exec } = await scenario(t, {
    services: {
      attachments: {
        saveImage: async () => {
          throw new Error('storage offline')
        },
      },
    },
  })
  mockFetch(t, happyHandler)

  const result = await tool.execute({ prompt: 'a duck', outputName: 'duck' }, exec)

  assert.equal(result.saved.length, 1)
  assert.equal(result.saved[0].attachment, undefined)
})

test('Windows 保留设备名被改写，避免写文件失败', async (t) => {
  const { tool, exec } = await scenario(t)
  mockFetch(t, happyHandler)

  const result = await tool.execute({ prompt: 'anything', outputName: 'CON' }, exec)

  // 原样保留调用方的大小写，只在撞上保留名时补后缀。
  assert.match(result.saved[0].path, /CON-image\.png$/i)
  assert.ok(!/^CON\.png$/i.test(result.saved[0].path))
})

test('文件名安全的 outputName 原样保留扩展语义', async (t) => {
  const { tool, exec } = await scenario(t)
  mockFetch(t, happyHandler)

  const result = await tool.execute({ prompt: 'anything', outputName: 'poster 01' }, exec)

  assert.match(result.saved[0].path, /poster-01\.png$/)
})

test('HTTP 401 提示检查 Key，429 提示降低频率，404 提示模型', async (t) => {
  const { tool, exec } = await scenario(t)

  mockFetch(t, () => jsonResponse({ error: { message: 'invalid api key' } }, 401))
  await assert.rejects(() => tool.execute({ prompt: 'x' }, exec), /rejected the API key/)

  mockFetch(t, () => jsonResponse({ error: { message: 'slow down' } }, 429))
  await assert.rejects(() => tool.execute({ prompt: 'x' }, exec), /rate limited/)

  mockFetch(t, () => jsonResponse({ error: { message: 'no such model' } }, 404))
  await assert.rejects(() => tool.execute({ prompt: 'x' }, exec), /does not recognise model/)
})

test('空 data、非 JSON、下载失败都被明确报出', async (t) => {
  const { tool, exec } = await scenario(t)

  mockFetch(t, () => jsonResponse({ created: 1, data: [] }))
  await assert.rejects(() => tool.execute({ prompt: 'x' }, exec), /returned no image/)

  mockFetch(t, () => jsonResponse('<html>gateway timeout</html>'))
  await assert.rejects(() => tool.execute({ prompt: 'x' }, exec), /non-JSON body/)

  mockFetch(t, (url) =>
    url.includes('/images/generations')
      ? jsonResponse({ created: 1, data: [{ url: 'https://cdn.example.test/gone.png' }] })
      : { ok: false, status: 404, headers: new Headers(), text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) },
  )
  await assert.rejects(() => tool.execute({ prompt: 'x' }, exec), /Failed to download/)
})

test('单张响应里同时有多张图时逐张落盘并加序号', async (t) => {
  const { tool, exec } = await scenario(t)
  mockFetch(t, (url) =>
    url.includes('/images/generations')
      ? jsonResponse({
        created: 1,
        data: [
          { url: 'https://cdn.example.test/1.png' },
          { url: 'https://cdn.example.test/2.png' },
        ],
      })
      : bytesResponse(PNG_1X1),
  )

  const result = await tool.execute({ prompt: 'two birds', outputName: 'birds' }, exec)

  assert.equal(result.saved.length, 2)
  assert.match(result.saved[0].path, /birds-1\.png$/)
  assert.match(result.saved[1].path, /birds-2\.png$/)
})

test('拿不到 workspaceRegistry 时回退到进程目录（并留下可读路径）', async (t) => {
  const { tool, exec } = await scenario(t, { withoutRegistry: true })
  mockFetch(t, happyHandler)

  const result = await tool.execute({ prompt: 'fallback case', outputName: 'fallback-test' }, exec)

  const saved = result.saved[0]
  assert.ok(saved.path.includes('generated-images'))
  assert.match(saved.path, /fallback-test\.png$/)

  // 只删掉本用例自己写出的文件，绝不动同目录下别人的图片。
  await rm(saved.path, { force: true })
})
