/* ════════════════════════════════════════════════════════════
 * fluid.js —— Hero 交互式水波扭曲（WebGL）
 * ------------------------------------------------------------
 * 设计要点（对应规格）：
 *   1. <video> 作为纹理源：opacity 0 + 绝对定位 + pointer-events:none，
 *      不参与显示但仍解码（不用 display:none，否则解码停止、纹理不再更新）
 *   2. 纹理上传节流：requestVideoFrameCallback 只在"新帧到达"时上传一次
 *      （视频约 30fps → 上传 ≤30 次/秒）；rVFC 不可用降级为 33ms 节流。
 *      绘制仍可按屏幕刷新率跑，用缓存纹理做涟漪动画。
 *   3. 画布分辨率 = clientWidth × min(devicePixelRatio, 1.5)，绝对上限 1440px。
 *   4. 涟漪 = 鼠标位置/轨迹采样点，每点一个环形波：
 *      disp = sin(dist × 频率 − 年龄 × 速度) × 强度 × 时间衰减 × 空间衰减
 *      多涟漪求和后 clamp 到强度上限；UV 越界钳制，边缘不撕裂。
 *   5. 空闲跳帧：涟漪链表为空且纹理无新帧 → 本帧直接返回 false（不绘制）。
 *      返回 true 表示"还有活要干"，由 fx.js 的单一循环决定是否继续。
 *   6. 降级：WebGL 不可用 / 低端设备 / reduced-motion → 返回 null，
 *      画布保持透明，视频照常直出（其余一切不变）。
 * 约束：不写任何 React state；每帧只 clear 一次；涟漪链表预分配、零分配采样。
 * ════════════════════════════════════════════════════════════ */

const MAX_RIPPLES = 8        // 同时活跃的涟漪上限（超出丢弃最旧）
const MAX_CANVAS_W = 1440    // 画布宽度上限（规格）
const DPR_CAP = 1.5          // devicePixelRatio 上限（规格）
const UPLOAD_THROTTLE_MS = 33 // rVFC 不可用时的上传节流

/* 顶点着色器：一个铺满屏幕的四边形（-1..1），UV 直接由位置映射 */
const VERT_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

/* 片元着色器：对视频纹理做多涟漪环形位移采样
   u_ripples[i] = vec3(u, v, age)，u_count 为活跃数（循环边界必须是常量，
   因此用 if (i >= u_count) break 控制） */
const FRAG_SRC = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec3 u_ripples[${MAX_RIPPLES}];
uniform int u_count;
uniform float u_strength;
uniform float u_freq;
uniform float u_speed;
uniform float u_decay;
uniform float u_life;
uniform float u_aspect;

void main() {
  // ── 唯一 UV 约定：v 向上（屏幕顶部 = 1），与 JS 的 screenToUv() 完全一致 ──
  // v_uv 由全屏四边形位置映射而来，本身就是"v 向上"，涟漪计算全程只用它。
  // 纹理采样空间单独翻转一次（上传期未设 flipY → 避免软渲染每帧全帧拷贝），
  // 两种坐标严禁混用：之前把涟漪中心放到采样空间比较，导致涟漪镜像到指针对面。
  vec2 uv = v_uv;
  vec2 texUv = vec2(uv.x, 1.0 - uv.y);
  // 无活跃涟漪：直接采样，不进循环（空闲/刚消散那一帧也省算力）
  if (u_count == 0) { gl_FragColor = texture2D(u_tex, texUv); return; }
  vec2 disp = vec2(0.0);
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    if (i >= u_count) break;
    vec3 r = u_ripples[i];
    vec2 d = uv - r.xy;
    d.x *= u_aspect;                       // 校正宽高比 → 波是正圆
    float dist = length(d);
    float age = r.z;
    // 衰减用平方曲线替代两次 exp：观感同为"2~3s 内平滑归零"，
    // 但在软件渲染/集显上每像素省两条超越函数（实测为逐像素瓶颈）
    float timeFall = 1.0 - clamp(age / u_life, 0.0, 1.0);
    timeFall *= timeFall;
    float spaceFall = 1.0 - clamp(dist * 5.0, 0.0, 1.0);
    spaceFall *= spaceFall;
    float atten = timeFall * spaceFall * u_decay;
    float wave = sin(dist * u_freq - age * u_speed * 6.2831853);
    disp += (d / max(dist, 1e-5)) * wave * atten;         // 沿径向位移
  }
  disp = clamp(disp, -1.0, 1.0) * u_strength;             // 叠加后限幅，避免撕裂
  vec2 s = clamp(uv + disp, 0.0, 1.0);                    // 在 v-up 空间位移 + 边缘钳制
  gl_FragColor = texture2D(u_tex, vec2(s.x, 1.0 - s.y));  // 采样时翻回纹理空间
}`

function compile(gl, type, src) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh)
    return null
  }
  return sh
}

/**
 * 初始化水波层。
 * @param {object} opts
 * @param {HTMLElement} opts.hero   #top
 * @param {HTMLVideoElement} opts.video
 * @param {HTMLCanvasElement} opts.canvas
 * @param {object} opts.config      { enabled, strength, frequency, speed, decay, life }
 * @param {Function} opts.wake      唤醒单一循环（fx.js 的 heroLoop.wake）
 * @returns {{tick:Function,setPaused:Function,destroy:Function}|null}
 */
export default function initFluidHero({ hero, video, canvas, config, wake } = {}) {
  if (!hero || !video || !canvas || !config || !config.enabled) return null
  if (typeof wake !== 'function') return null
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null

  // —— 低端设备降级：纯视频无水波（规格 §四.5） ——
  const cores = navigator.hardwareConcurrency || 8
  const mem = navigator.deviceMemory || 8
  if (cores < 4 || mem < 4) return null

  // —— WebGL 上下文（失败静默降级：画布保持透明，视频直出） ——
  let gl = null
  try {
    const opts = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false }
    gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts)
  } catch (e) { gl = null }
  if (!gl) return null

  const media = hero.querySelector('.hero-media') || hero

  /* —— 渲染预算档 ——
     软件渲染（SwiftShader / llvmpipe / Microsoft Basic 等无真实 GPU 的环境）
     的逐像素开销是真实 GPU 的百倍量级：此时把画布降到 720px 宽、
     活跃涟漪限 3 个，保证"能用、不卡"；有 GPU 时走全量（1440px / 8 个）。 */
  const rendererName = (() => {
    try {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      return String((dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '')
    } catch (e) { return '' }
  })()
  const softGL = /swiftshader|llvmpipe|software|basic render/i.test(rendererName)
  // 实测：软渲染下瓶颈 100% 在"每帧上传 1080p 视频纹理"（纯绘制 51fps vs 播放 12fps）。
  // 软渲染档先把视频降采样到画布尺寸再上传（数据量≈1/7），配合 720px 画布 + 3 个涟漪。
  const budget = softGL ? { capW: 720, maxActive: 3 } : { capW: MAX_CANVAS_W, maxActive: MAX_RIPPLES }
  // 验证钩子：?fluid=force 可绕过软渲染降级（用于无 GPU 环境的自动化验收）
  const forceOn = typeof location !== 'undefined' && /[?&]fluid=force/.test(location.search)
  let scratch = null
  let scratchCtx = null
  if (softGL && !forceOn) {
    scratch = document.createElement('canvas')
    scratchCtx = scratch.getContext('2d', { alpha: false })
  }

  // —— 着色器与程序 ——
  const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC)
  if (!vs || !fs) { if (vs) gl.deleteShader(vs); if (fs) gl.deleteShader(fs); return null }
  const prog = gl.createProgram()
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)

  // 全屏四边形
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(prog, 'a_pos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const uTex = gl.getUniformLocation(prog, 'u_tex')
  const uRipples = gl.getUniformLocation(prog, 'u_ripples')
  const uCount = gl.getUniformLocation(prog, 'u_count')
  const uStrength = gl.getUniformLocation(prog, 'u_strength')
  const uFreq = gl.getUniformLocation(prog, 'u_freq')
  const uSpeed = gl.getUniformLocation(prog, 'u_speed')
  const uDecay = gl.getUniformLocation(prog, 'u_decay')
  const uLife = gl.getUniformLocation(prog, 'u_life')
  const uAspect = gl.getUniformLocation(prog, 'u_aspect')

  /* 所有可调常量都以 uniform 传入（规格要求）；
     strength 单位是像素，需按当前画布宽度换算成 UV 位移 → 每次 resize 后重算 */
  function syncUniforms() {
    gl.uniform1f(uStrength, config.strength / Math.max(1, canvas.width))
    gl.uniform1f(uFreq, config.frequency)
    gl.uniform1f(uSpeed, config.speed)
    gl.uniform1f(uDecay, config.decay)
    gl.uniform1f(uLife, config.life)
    gl.uniform1f(uAspect, canvas.width / Math.max(1, canvas.height))
  }

  // 纹理：LINEAR 过滤、不生成 mipmap、边缘钳制
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)                     // 翻转改在着色器内做（省掉每帧全帧 CPU 拷贝）
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)    // 不做色彩空间转换，观感与 <video> 一致
  // 1×1 黑像素占位：纹理未就绪时采样不产生未定义内容
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
  gl.uniform1i(uTex, 0)

  // —— 状态（全部预分配，热路径零分配） ——
  const ripplePool = Array.from({ length: MAX_RIPPLES }, () => ({ u: 0, v: 0, t: 0 }))
  const uniformData = new Float32Array(MAX_RIPPLES * 3)
  const lastPt = { x: -1e9, y: -1e9, t: 0 }
  let rippleCount = 0
  let needsUpload = false
  let uploaded = false
  let needClean = false        // 涟漪全部消散后补画一帧"干净"画面
  let firstFrameShown = false
  let paused = false
  let lastThrottleAt = 0
  let destroyed = false

  const hasRVFC = typeof video.requestVideoFrameCallback === 'function'

  /* rVFC：只有新视频帧到达才标记上传（≤30 次/秒），随后递归排下一帧 */
  const onVideoFrame = () => {
    if (destroyed) return
    needsUpload = true
    wake()
    if (hasRVFC) video.requestVideoFrameCallback(onVideoFrame)
  }
  if (hasRVFC) video.requestVideoFrameCallback(onVideoFrame)

  function uploadTexture() {
    if (video.readyState < 2) return
    gl.bindTexture(gl.TEXTURE_2D, tex)
    try {
      if (scratch && scratchCtx) {
        // 软渲染档：先缩到画布尺寸再上传，上传数据量从 1080p 降到画布分辨率
        if (scratch.width !== canvas.width || scratch.height !== canvas.height) {
          scratch.width = canvas.width
          scratch.height = canvas.height
        }
        scratchCtx.drawImage(video, 0, 0, scratch.width, scratch.height)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scratch)
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
      }
      uploaded = true
    } catch (e) { /* 视频尚未就绪：保持旧纹理 */ }
  }

  /* 画布尺寸：clientWidth × min(dpr,1.5)，上限 1440（规格） */
  function resize() {
    const cw = media.clientWidth || hero.clientWidth
    const ch = media.clientHeight || hero.clientHeight
    if (!cw || !ch) return
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    const w = Math.min(budget.capW, Math.round(cw * dpr))
    const h = Math.max(1, Math.round(ch * (w / cw)))
    if (canvas.width === w && canvas.height === h) return
    canvas.width = w
    canvas.height = h
    gl.viewport(0, 0, w, h)
    syncUniforms()
    /* ⚠ 改 canvas.width/height 会【清空绘制缓冲】；本上下文是 alpha:false（不透明），
       空缓冲在合成器里就是纯黑。若等下一帧 rVFC 才重绘，画面上会出现一次黑屏
       （实测：加载屏解锁滚动条 → 视口窄 10px → 走到这里 resize → 黑帧亮度 11.7）。
       纹理内容不随画布尺寸失效，所以这里立刻用现有纹理补画一帧，把黑帧窗口压到 0。 */
    const hadFrame = uploaded
    uploaded = false
    needsUpload = true
    needClean = true
    if (hadFrame) render(prune(performance.now()), performance.now())
    if (window.__fluidDebug) { window.__fluidDebug.canvasW = w; window.__fluidDebug.canvasH = h }
    wake()
  }

  /* 清理过期涟漪（原地压缩，零分配） */
  function prune(now) {
    let w = 0
    for (let i = 0; i < rippleCount; i++) {
      const r = ripplePool[i]
      if ((now - r.t) / 1000 < config.life) {
        if (w !== i) { const d = ripplePool[w]; d.u = r.u; d.v = r.v; d.t = r.t }
        w++
      }
    }
    rippleCount = w
    return w
  }

  function render(n, now) {
    for (let i = 0; i < n; i++) {
      const r = ripplePool[i]
      uniformData[i * 3] = r.u
      uniformData[i * 3 + 1] = r.v
      uniformData[i * 3 + 2] = (now - r.t) / 1000
    }
    gl.uniform3fv(uRipples, uniformData)
    gl.uniform1i(uCount, n)
    gl.clear(gl.COLOR_BUFFER_BIT)   // 每帧只 clear 一次
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    if (!firstFrameShown) {
      firstFrameShown = true
      media.classList.add('is-fluid')   // canvas 淡入、video 淡出（CSS 交叉过渡）
    }
    if (window.__fluidDebug) { window.__fluidDebug.draws++; window.__fluidDebug.ripples = n }
  }

  /* ── 唯一的"屏幕坐标 → UV"换算（全链路只用这一个函数）──
     屏幕 Y 向下、UV Y 向上，翻转【只发生在这一处】；
     必须基于实时 getBoundingClientRect（视差 translate 与覆盖 scale 都反映在 rect 里），
     严禁缓存 rect 或用 offsetTop/offsetLeft。
     返回预分配对象（热路径零分配）；画布尺寸为 0 时返回 null。 */
  const uvTmp = { u: 0, v: 0 }
  function screenToUv(clientX, clientY, out = uvTmp) {
    const r = canvas.getBoundingClientRect()
    if (!r.width || !r.height) return null
    out.u = (clientX - r.left) / r.width
    out.v = 1 - (clientY - r.top) / r.height
    return out
  }

  /* 添加一个涟漪：坐标经 screenToUv 换算，
     自动包含视差 translate 与覆盖 scale，鼠标位置永远对得上 */
  function addRipple(clientX, clientY, now) {
    const uv = screenToUv(clientX, clientY)
    if (!uv) return
    const u = uv.u
    const v = uv.v
    if (u < -0.05 || u > 1.05 || v < -0.05 || v > 1.05) return
    if (rippleCount >= budget.maxActive) {   // 满了：丢弃最旧（字段拷贝，零分配）
      for (let i = 1; i < rippleCount; i++) {
        const d = ripplePool[i - 1]
        const s = ripplePool[i]
        d.u = s.u; d.v = s.v; d.t = s.t
      }
      rippleCount -= 1
    }
    const slot = ripplePool[rippleCount++]
    slot.u = u; slot.v = v; slot.t = now
    needClean = true
    if (window.__fluidDebug) { window.__fluidDebug.lastUv = { u, v } }
    wake()
  }

  // —— 指针：轨迹采样（抖动过滤，避免密集小移动刷爆链表） ——
  const onPointerMove = (e) => {
    const now = performance.now()
    const dx = e.clientX - lastPt.x
    const dy = e.clientY - lastPt.y
    if (now - lastPt.t < 40 && dx * dx + dy * dy < 100) return  // <10px 且 <40ms 不采样
    lastPt.x = e.clientX; lastPt.y = e.clientY; lastPt.t = now
    addRipple(e.clientX, e.clientY, now)
  }
  // 触屏无 hover 轨迹：点按产生单点涟漪（规格 §四.3）
  const onPointerDown = (e) => {
    if (e.pointerType === 'touch') addRipple(e.clientX, e.clientY, performance.now())
  }
  hero.addEventListener('pointermove', onPointerMove, { passive: true })
  hero.addEventListener('pointerdown', onPointerDown, { passive: true })

  // 上下文丢失：退回普通视频（移除 is-fluid，画布隐藏）
  const onCtxLost = (e) => { e.preventDefault(); media.classList.remove('is-fluid'); uploaded = false }

  // 尺寸变化
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null
  if (ro) ro.observe(media)
  window.addEventListener('resize', resize)

  resize()
  syncUniforms()

  /* 每帧入口：返回 true 表示"仍有工作"（涟漪未散或刚上传新帧），
     返回 false 时 fx.js 的单一循环会自行停转（不空转） */
  function tick() {
    // 注意：单一循环调用任务时不传参，时间必须在内部取（否则 now 为 undefined
    // 会让 prune 的年龄计算变成 NaN → 涟漪被误判过期，等于永远没有水波）
    const now = performance.now()
    if (destroyed || paused) return false
    // rVFC 不可用 → 33ms 节流上传
    if (!hasRVFC && video.readyState >= 2 && now - lastThrottleAt > UPLOAD_THROTTLE_MS) {
      lastThrottleAt = now
      needsUpload = true
    }
    let uploadedNow = false
    if (needsUpload) {
      uploadTexture()
      needsUpload = false
      uploadedNow = uploaded
    }
    if (!uploaded) return false
    const n = prune(now)
    if (n === 0 && !needClean && !uploadedNow) return false   // 空闲跳帧
    render(n, now)
    if (n === 0) needClean = false
    return n > 0
  }

  /* 读回整张画布（仅验收/调试调用） */
  function readFull() {
    const px = new Uint8Array(canvas.width * canvas.height * 4)
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px)
    return px
  }

  function readRegion() {
    const w = 128, h = 72
    const px = new Uint8Array(w * h * 4)
    gl.readPixels(
      Math.max(0, (canvas.width - w) >> 1), Math.max(0, (canvas.height - h) >> 1),
      w, h, gl.RGBA, gl.UNSIGNED_BYTE, px
    )
    return px
  }

  const debug = {
    ok: true, ripples: 0, lastUv: null, draws: 0, paused: false,
    canvasW: canvas.width, canvasH: canvas.height,
    softGL, renderer: rendererName.slice(0, 60), maxActive: budget.maxActive, capW: budget.capW, downscaled: !!scratch,
    /* 调试/验收用：立即绘制并读回中心区域像素（同一任务内读，缓冲区有效） */
    hash() {
      render(prune(performance.now()), performance.now())
      const px = readRegion()
      let sum = 0
      for (let i = 0; i < px.length; i += 16) sum = (sum + px[i]) % 1000000007
      return sum
    },
    /* 验收用（Bug1 唯一验收标准）：在指定屏幕坐标放一个涟漪，渲染后求
       "带涟漪 vs 不带涟漪"的像素差异质心，并换算回屏幕坐标。
       返回的 x/y 应精确等于传入的指针位置——逐点验证四角 + 中心。 */
    probe(clientX, clientY) {
      const uv = screenToUv(clientX, clientY)
      if (!uv) return null
      rippleCount = 0
      const slot = ripplePool[0]
      slot.u = uv.u
      slot.v = uv.v
      slot.t = performance.now() - 300   // 让波环成形（年龄 300ms）
      rippleCount = 1
      const now = performance.now()
      // 用确定性噪声纹理代替视频帧做测量：真实画面明暗不均会让 |像素差| 加权质心
      // 偏向高对比区域（实测偏差 ~30px）。噪声在任意位移下差异都只与位移量相关，
      // 质心才真正等于涟漪圆心。
      const N = 256
      const pat = document.createElement('canvas')
      pat.width = pat.height = N
      const pctx = pat.getContext('2d')
      const img = pctx.createImageData(N, N)
      let seed = 123456789
      for (let i = 0; i < img.data.length; i += 4) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        const v = (seed >> 16) & 255
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255
      }
      pctx.putImageData(img, 0, 0)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pat)
      render(1, now)
      const a = readFull()
      render(0, now)
      const b = readFull()
      // 测量结束：让下一帧从视频重新上传纹理
      uploaded = false
      needsUpload = true
      wake()
      const w = canvas.width
      const h = canvas.height
      let sx = 0, sy = 0, sw = 0
      for (let i = 0, p = 0; i < a.length; i += 4, p++) {
        const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
        if (d > 8) { const px = p % w; const py = (p / w) | 0; sx += px * d; sy += py * d; sw += d }
      }
      rippleCount = 0
      if (!sw) return null
      const rect = canvas.getBoundingClientRect()
      return {
        // GL 读回原点在左下 → 换算屏幕坐标时 Y 再翻一次
        x: rect.left + (sx / sw / w) * rect.width,
        y: rect.top + (1 - (sy / sw) / h) * rect.height,
        expectX: clientX,
        expectY: clientY,
        uv: { u: uv.u, v: uv.v },
        weight: sw,
      }
    },
    /* 同一帧渲染两次（带涟漪 / 不带涟漪）求像素差：
       差值 > 0 才证明"扭曲真的作用到了画面上"，而不只是状态在跑 */
    diff() {
      const now = performance.now()
      const n = prune(now)
      if (n === 0) return -1
      render(n, now)
      const a = readRegion()
      render(0, now)
      const b = readRegion()
      let d = 0
      for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i])
      return d
    },
  }
  window.__fluidDebug = debug

  return {
    tick,
    setPaused(v) { paused = !!v; debug.paused = paused; if (!paused) wake() },
    destroy() {
      destroyed = true
      hero.removeEventListener('pointermove', onPointerMove)
      hero.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('resize', resize)
      if (ro) ro.disconnect()
      canvas.removeEventListener('webglcontextlost', onCtxLost)
      media.classList.remove('is-fluid')
      gl.deleteTexture(tex)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
      if (window.__fluidDebug === debug) window.__fluidDebug = null
    },
  }
}
