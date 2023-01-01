var socket = io()

const GameState = Object.freeze({
  Selecting: 0,
  Playing: 1,
  GameOver: 2
})

socket.on('connect', function () {
  console.log('Connected!')
  const name = Math.floor(Math.random() * 1000)
  socket.emit('join', { name, type: 'web' })
})

socket.on('screen', function (command) {
  console.log('screen', command)
  parseCommand(command)
})

const STEP_LENGTH = 1
const CELL_SIZE = 10
const BORDER_WIDTH = 3
const MAX_FONT_SIZE = 500
const MAX_ELECTRONS = 100
const CELL_DISTANCE = CELL_SIZE + BORDER_WIDTH

// shorter for brighter paint
// be careful of performance issue
const CELL_REPAINT_INTERVAL = [
  200, // from
  400 // to
]

const BG_COLOR = '#000000'
const BORDER_COLOR = '#040313'
const CELL_HIGHLIGHT = '#00b07c'
const ELECTRON_COLOR = '#00b07c'
const FONT_COLOR = '#ff5722'

const FONT_FAMILY =
  'Helvetica, Arial, "Hiragino Sans GB", "Microsoft YaHei", "WenQuan Yi Micro Hei", sans-serif'

const DPR = window.devicePixelRatio || 1

const ACTIVE_ELECTRONS = []
const PINNED_CELLS = []

const MOVE_TRAILS = [
  [0, 1], // down
  [0, -1], // up
  [1, 0], // right
  [-1, 0] // left
].map(([x, y]) => [x * CELL_DISTANCE, y * CELL_DISTANCE])

const END_POINTS_OFFSET = [
  [0, 0], // left top
  [0, 1], // left bottom
  [1, 0], // right top
  [1, 1] // right bottom
].map(([x, y]) => [
  x * CELL_DISTANCE - BORDER_WIDTH / 2,
  y * CELL_DISTANCE - BORDER_WIDTH / 2
])

class FullscreenCanvas {
  constructor(disableScale = false) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    this.canvas = canvas
    this.context = context
    this.disableScale = disableScale

    this.resizeHandlers = []
    this.handleResize = _.debounce(this.handleResize.bind(this), 100)

    this.adjust()

    window.addEventListener('resize', this.handleResize)
  }

  adjust() {
    const { canvas, context, disableScale } = this

    const { innerWidth, innerHeight } = window

    this.width = innerWidth
    this.height = innerHeight

    const scale = disableScale ? 1 : DPR

    this.realWidth = canvas.width = innerWidth * scale
    this.realHeight = canvas.height = innerHeight * scale
    canvas.style.width = `${innerWidth}px`
    canvas.style.height = `${innerHeight}px`

    context.scale(scale, scale)
  }

  clear() {
    const { context } = this

    context.clearRect(0, 0, this.width, this.height)
  }

  makeCallback(fn) {
    fn(this.context, this)
  }

  blendBackground(background, opacity = 0.05) {
    return this.paint((ctx, { realWidth, realHeight, width, height }) => {
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = opacity

      ctx.drawImage(
        background,
        0,
        0,
        realWidth,
        realHeight,
        0,
        0,
        width,
        height
      )
    })
  }

  paint(fn) {
    if (!_.isFunction(fn)) return

    const { context } = this

    context.save()

    this.makeCallback(fn)

    context.restore()

    return this
  }

  repaint(fn) {
    if (!_.isFunction(fn)) return

    this.clear()

    return this.paint(fn)
  }

  onResize(fn) {
    if (!_.isFunction(fn)) return

    this.resizeHandlers.push(fn)
  }

  handleResize() {
    const { resizeHandlers } = this

    if (!resizeHandlers.length) return

    this.adjust()

    resizeHandlers.forEach(this.makeCallback.bind(this))
  }

  renderIntoView(target = document.body) {
    const { canvas } = this

    this.container = target

    canvas.style.position = 'absolute'
    canvas.style.left = '0px'
    canvas.style.top = '0px'

    target.appendChild(canvas)
  }

  remove() {
    if (!this.container) return

    try {
      window.removeEventListener('resize', this.handleResize)
      this.container.removeChild(this.canvas)
    } catch (e) {}
  }
}

class Electron {
  constructor(
    x = 0,
    y = 0,
    { lifeTime = 3 * 1e3, speed = STEP_LENGTH, color = ELECTRON_COLOR } = {}
  ) {
    this.lifeTime = lifeTime
    this.expireAt = Date.now() + lifeTime

    this.speed = speed
    this.color = color

    this.radius = BORDER_WIDTH / 2
    this.current = [x, y]
    this.visited = {}
    this.setDest(this.randomPath())
  }

  randomPath() {
    const {
      current: [x, y]
    } = this

    const { length } = MOVE_TRAILS

    const [deltaX, deltaY] = MOVE_TRAILS[_.random(length - 1)]

    return [x + deltaX, y + deltaY]
  }

  composeCoord(coord) {
    return coord.join(',')
  }

  hasVisited(dest) {
    const key = this.composeCoord(dest)

    return this.visited[key]
  }

  setDest(dest) {
    this.destination = dest
    this.visited[this.composeCoord(dest)] = true
  }

  next() {
    let { speed, current, destination } = this

    if (
      Math.abs(current[0] - destination[0]) <= speed / 2 &&
      Math.abs(current[1] - destination[1]) <= speed / 2
    ) {
      destination = this.randomPath()

      let tryCnt = 1
      const maxAttempt = 4

      while (this.hasVisited(destination) && tryCnt <= maxAttempt) {
        tryCnt++
        destination = this.randomPath()
      }

      this.setDest(destination)
    }

    const deltaX = destination[0] - current[0]
    const deltaY = destination[1] - current[1]

    if (deltaX) {
      current[0] += (deltaX / Math.abs(deltaX)) * speed
    }

    if (deltaY) {
      current[1] += (deltaY / Math.abs(deltaY)) * speed
    }

    return [...this.current]
  }

  paintNextTo(layer = new FullscreenCanvas()) {
    const { radius, color, expireAt, lifeTime } = this

    const [x, y] = this.next()

    layer.paint((ctx) => {
      ctx.globalAlpha = Math.max(0, expireAt - Date.now()) / lifeTime
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = radius * 5
      ctx.globalCompositeOperation = 'lighter'

      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.closePath()

      ctx.fill()
    })
  }
}

class Cell {
  constructor(
    row = 0,
    col = 0,
    {
      electronCount = _.random(1, 4),
      background = ELECTRON_COLOR,
      forceElectrons = false,
      electronOptions = {}
    } = {}
  ) {
    this.background = background
    this.electronOptions = electronOptions
    this.forceElectrons = forceElectrons
    this.electronCount = Math.min(electronCount, 4)

    this.startY = row * CELL_DISTANCE
    this.startX = col * CELL_DISTANCE
  }

  delay(ms = 0) {
    this.pin(ms * 1.5)
    this.nextUpdate = Date.now() + ms
  }

  pin(lifeTime = -1 >>> 1) {
    this.expireAt = Date.now() + lifeTime

    PINNED_CELLS.push(this)
  }

  scheduleUpdate(t1 = CELL_REPAINT_INTERVAL[0], t2 = CELL_REPAINT_INTERVAL[1]) {
    this.nextUpdate = Date.now() + _.random(t1, t2)
  }

  paintNextTo(layer = new FullscreenCanvas()) {
    const { startX, startY, background, nextUpdate } = this

    if (nextUpdate && Date.now() < nextUpdate) return

    this.scheduleUpdate()
    this.createElectrons()

    layer.paint((ctx) => {
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = background
      ctx.fillRect(startX, startY, CELL_SIZE, CELL_SIZE)
    })
  }

  popRandom(arr = []) {
    const ramIdx = _.random(arr.length - 1)

    return arr.splice(ramIdx, 1)[0]
  }

  createElectrons() {
    const { startX, startY, electronCount, electronOptions, forceElectrons } =
      this

    if (!electronCount) return

    const endpoints = [...END_POINTS_OFFSET]

    const max = forceElectrons
      ? electronCount
      : Math.min(electronCount, MAX_ELECTRONS - ACTIVE_ELECTRONS.length)

    for (let i = 0; i < max; i++) {
      const [offsetX, offsetY] = this.popRandom(endpoints)

      ACTIVE_ELECTRONS.push(
        new Electron(startX + offsetX, startY + offsetY, electronOptions)
      )
    }
  }
}

const bgLayer = new FullscreenCanvas()
const mainLayer = new FullscreenCanvas()
const shapeLayer = new FullscreenCanvas(true)

function stripOld(limit = 1000) {
  const now = Date.now()

  for (let i = 0, max = ACTIVE_ELECTRONS.length; i < max; i++) {
    const e = ACTIVE_ELECTRONS[i]

    if (e.expireAt - now < limit) {
      ACTIVE_ELECTRONS.splice(i, 1)

      i--
      max--
    }
  }
}

function createRandomCell(options = {}) {
  if (ACTIVE_ELECTRONS.length >= MAX_ELECTRONS) return

  const { width, height } = mainLayer

  const cell = new Cell(
    _.random(height / CELL_DISTANCE),
    _.random(width / CELL_DISTANCE),
    options
  )

  cell.paintNextTo(mainLayer)
}

function drawGrid() {
  bgLayer.paint((ctx, { width, height }) => {
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = BORDER_COLOR

    // horizontal lines
    for (let h = CELL_SIZE; h < height; h += CELL_DISTANCE) {
      ctx.fillRect(0, h, width, BORDER_WIDTH)
    }

    // vertical lines
    for (let w = CELL_SIZE; w < width; w += CELL_DISTANCE) {
      ctx.fillRect(w, 0, BORDER_WIDTH, height)
    }
  })
}

function iterateItemsIn(list) {
  const now = Date.now()

  for (let i = 0, max = list.length; i < max; i++) {
    const item = list[i]

    if (now >= item.expireAt) {
      list.splice(i, 1)
      i--
      max--
    } else {
      item.paintNextTo(mainLayer)
    }
  }
}

function drawItems() {
  iterateItemsIn(PINNED_CELLS)
  iterateItemsIn(ACTIVE_ELECTRONS)
}

let nextRandomAt

function activateRandom() {
  const now = Date.now()

  if (now < nextRandomAt) {
    return
  }

  nextRandomAt = now + _.random(300, 1000)

  createRandomCell()
}

function handlePointer() {
  let lastCell = []
  let touchRecords = {}

  function isSameCell(i, j) {
    const [li, lj] = lastCell

    lastCell = [i, j]

    return i === li && j === lj
  }

  function print(isMove, { clientX, clientY }) {
    const i = Math.floor(clientY / CELL_DISTANCE)
    const j = Math.floor(clientX / CELL_DISTANCE)

    if (isMove && isSameCell(i, j)) {
      return
    }

    const cell = new Cell(i, j, {
      background: CELL_HIGHLIGHT,
      forceElectrons: true,
      electronCount: isMove ? 2 : 4,
      electronOptions: {
        speed: 3,
        lifeTime: isMove ? 500 : 1000,
        color: CELL_HIGHLIGHT
      }
    })

    cell.paintNextTo(mainLayer)
  }

  const handlers = {
    touchend({ changedTouches }) {
      if (changedTouches) {
        Array.from(changedTouches).forEach(({ identifier }) => {
          delete touchRecords[identifier]
        })
      } else {
        touchRecords = {}
      }
    }
  }

  function filterTouches(touchList) {
    return Array.from(touchList).filter(({ identifier, clientX, clientY }) => {
      const rec = touchRecords[identifier]
      touchRecords[identifier] = { clientX, clientY }

      return !rec || clientX !== rec.clientX || clientY !== rec.clientY
    })
  }

  ;['mousedown', 'touchstart', 'mousemove', 'touchmove'].forEach((name) => {
    const isMove = /move/.test(name)
    const isTouch = /touch/.test(name)

    const fn = print.bind(null, isMove)

    handlers[name] = function handler(evt) {
      if (isTouch) {
        filterTouches(evt.touches).forEach(fn)
      } else {
        fn(evt)
      }
    }
  })

  const events = Object.keys(handlers)

  events.forEach((name) => {
    document.addEventListener(name, handlers[name])
  })

  return function unbind() {
    events.forEach((name) => {
      document.removeEventListener(name, handlers[name])
    })
  }
}

function prepaint() {
  drawGrid()

  mainLayer.paint((ctx, { width, height }) => {
    // composite with rgba(255,255,255,255) to clear trails
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
  })

  mainLayer.blendBackground(bgLayer.canvas, 0.9)
}

function render() {
  mainLayer.blendBackground(bgLayer.canvas)

  drawItems()
  activateRandom()

  shape.renderID = requestAnimationFrame(render)
}

const shape = {
  lastText: '',
  lastMatrix: null,
  renderID: undefined,
  isAlive: false,

  get electronOptions() {
    return {
      speed: 2,
      color: FONT_COLOR,
      lifeTime: _.random(300, 500)
    }
  },

  get cellOptions() {
    return {
      background: FONT_COLOR,
      electronCount: _.random(1, 4),
      electronOptions: this.electronOptions
    }
  },

  get explodeOptions() {
    return Object.assign(this.cellOptions, {
      electronOptions: Object.assign(this.electronOptions, {
        lifeTime: _.random(500, 1500)
      })
    })
  },

  init(container = document.body) {
    if (this.isAlive) {
      return
    }

    bgLayer.onResize(drawGrid)
    mainLayer.onResize(prepaint)

    mainLayer.renderIntoView(container)

    shapeLayer.onResize(() => {
      if (this.lastText) {
        this.print(this.lastText)
      }
    })

    prepaint()
    render()

    this.unbindEvents = handlePointer()
    this.isAlive = true
  },

  clear() {
    const { lastMatrix } = this

    this.lastText = ''
    this.lastMatrix = null
    PINNED_CELLS.length = 0

    if (lastMatrix) {
      this.explode(lastMatrix)
    }
  },

  destroy() {
    if (!this.isAlive) {
      return
    }

    bgLayer.remove()
    mainLayer.remove()
    shapeLayer.remove()

    this.unbindEvents()

    cancelAnimationFrame(this.renderID)

    ACTIVE_ELECTRONS.length = PINNED_CELLS.length = 0
    this.lastMatrix = null
    this.lastText = ''
    this.isAlive = false
  },

  getMatrix() {
    const { width, height } = shapeLayer

    const pixels = shapeLayer.context.getImageData(0, 0, width, height).data
    const matrix = []

    for (let i = 0; i < height; i += CELL_DISTANCE) {
      for (let j = 0; j < width; j += CELL_DISTANCE) {
        const alpha = pixels[(j + i * width) * 4 + 3]

        if (alpha > 0) {
          matrix.push([
            Math.floor(i / CELL_DISTANCE),
            Math.floor(j / CELL_DISTANCE)
          ])
        }
      }
    }

    return matrix
  },

  drawImage(image) {
    const { naturalWidth: width, naturalHeight: height } = image

    const scaleRatio = Math.min(
      (shapeLayer.width * 0.8) / width,
      (shapeLayer.height * 0.8) / height
    )

    this.clear()
    this.spiral()

    this.lastText = ''
    this.lastImage = image

    shapeLayer.repaint((ctx) => {
      ctx.drawImage(
        image,
        (shapeLayer.width - width * scaleRatio) / 2,
        (shapeLayer.height - height * scaleRatio) / 2,
        width * scaleRatio,
        height * scaleRatio
      )

      this.render()
    })
  },

  render() {
    const matrix = (this.lastMatrix = _.shuffle(this.getMatrix()))

    matrix.forEach(([i, j]) => {
      const cell = new Cell(i, j, this.cellOptions)

      cell.scheduleUpdate(200)
      cell.pin()
    })
  },

  getTextMatrix(text, { fontWeight = 'bold', fontFamily = FONT_FAMILY } = {}) {
    const { width, height } = shapeLayer

    shapeLayer.repaint((ctx) => {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `${fontWeight} ${MAX_FONT_SIZE}px ${fontFamily}`

      const scale = width / ctx.measureText(text).width
      const fontSize = Math.min(MAX_FONT_SIZE, MAX_FONT_SIZE * scale * 0.8)

      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`

      ctx.fillText(text, width / 2, height / 2)
    })

    const pixels = shapeLayer.context.getImageData(0, 0, width, height).data

    const matrix = []

    for (let i = 0; i < height; i += CELL_DISTANCE) {
      for (let j = 0; j < width; j += CELL_DISTANCE) {
        const alpha = pixels[(j + i * width) * 4 + 3]

        if (alpha > 0) {
          matrix.push([
            Math.floor(i / CELL_DISTANCE),
            Math.floor(j / CELL_DISTANCE)
          ])
        }
      }
    }

    return matrix
  },

  print(text, options) {
    const isBlank = !!this.lastText

    this.clear()

    if (text !== 0 && !text) {
      if (isBlank) {
        // release
        this.spiral({
          reverse: true,
          lifeTime: 500,
          electronCount: 2
        })
      }

      return
    }

    this.spiral({
      reverse: true,
      lifeTime: 1000,
      electronCount: 2
    })

    this.lastText = text

    const matrix = (this.lastMatrix = _.shuffle(
      this.getTextMatrix(text, options)
    ))

    matrix.forEach(([i, j]) => {
      const cell = new Cell(i, j, this.cellOptions)

      cell.scheduleUpdate(200)
      cell.pin()
    })
  },

  spiral({
    radius,
    increment = 0,
    reverse = false,
    lifeTime = 250,
    electronCount = 1,
    forceElectrons = true
  } = {}) {
    const { width, height } = mainLayer

    const cols = Math.floor(width / CELL_DISTANCE)
    const rows = Math.floor(height / CELL_DISTANCE)

    const ox = Math.floor(cols / 2)
    const oy = Math.floor(rows / 2)

    let cnt = 1
    let deg = _.random(360)
    let r = radius === undefined ? Math.floor(Math.min(cols, rows) / 3) : radius

    const step = reverse ? 15 : -15
    const max = Math.abs(360 / step)

    while (cnt <= max) {
      const i = oy + Math.floor(r * Math.sin((deg / 180) * Math.PI))
      const j = ox + Math.floor(r * Math.cos((deg / 180) * Math.PI))

      const cell = new Cell(i, j, {
        electronCount,
        forceElectrons,
        background: CELL_HIGHLIGHT,
        electronOptions: {
          lifeTime,
          speed: 3,
          color: CELL_HIGHLIGHT
        }
      })

      cell.delay(cnt * 16)

      cnt++
      deg += step
      r += increment
    }
  },

  explode(matrix) {
    stripOld()

    if (matrix) {
      const { length } = matrix

      const max = Math.min(
        50,
        _.random(Math.floor(length / 20), Math.floor(length / 10))
      )

      for (let idx = 0; idx < max; idx++) {
        const [i, j] = matrix[idx]

        const cell = new Cell(i, j, this.explodeOptions)

        cell.paintNextTo(mainLayer)
      }
    } else {
      const max = _.random(10, 20)

      for (let idx = 0; idx < max; idx++) {
        createRandomCell(this.explodeOptions)
      }
    }
  }
}

let timer

function queue() {
  const text = 'PRATIS'

  let i = 0
  const max = text.length

  const run = () => {
    if (i >= max) return

    shape.print(text.slice(0, ++i))
    timer = setTimeout(run, 500 + i)
  }

  run()
}

function countdown() {
  const arr = _.range(3, 0, -1)

  let i = 0
  const max = arr.length

  const run = () => {
    if (i >= max) {
      shape.clear()
      return galaxy()
    }

    shape.print(arr[i++])
    setTimeout(run, 1e3 + i)
  }

  run()
}

function galaxy() {
  shape.spiral({
    radius: 0,
    increment: 1,
    lifeTime: 100,
    electronCount: 1
  })

  timer = setTimeout(galaxy, 16)
}

function ring() {
  shape.spiral()

  timer = setTimeout(ring, 16)
}

function processImage(src) {
  const image = new Image()

  image.onload = () => {
    shape.drawImage(image)
  }
  image.onerror = () => {
    shape.fillText('naïve')
  }

  image.src = src
}

function parseCommand(value) {
  clearTimeout(timer)

  switch (value) {
    case '#destroy':
      return shape.destroy()

    case '#init':
      return shape.init()

    case '#explode':
      return shape.explode()

    case '#clear':
      return shape.clear()

    case '#queue':
      return queue()

    case '#countdown':
      return countdown()

    case '#galaxy':
      shape.clear()
      return galaxy()

    case '#ring':
      shape.clear()
      return ring()

    case '#heart':
      return shape.print('❤')

    case '#pratis':
      return processImage(
        'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDI3LjAuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCA2OTQuMDEgMTUzLjg2IiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCA2OTQuMDEgMTUzLjg2OyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+CjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+Cgkuc3Qwe2ZpbGw6IzIzMDg3MTt9Cgkuc3Qxe2ZpbGw6IzkwRDVBQzt9Cgkuc3Qye2ZpbGw6dXJsKCNTVkdJRF8xXyk7fQoJLnN0M3tmaWxsOnVybCgjU1ZHSURfMDAwMDAwNDI3MDI5NTQ2NDk0OTI1NTM1NDAwMDAwMDkyNTY5NzQzNTg4NTM3MjE3NzRfKTt9Cgkuc3Q0e2ZpbGw6dXJsKCNTVkdJRF8wMDAwMDAyMjU0NzQyMDc2MDk4ODE0NTk2MDAwMDAwMjcwMDA1MDQwNjU5MDQ2NjczNV8pO30KPC9zdHlsZT4KPGc+Cgk8Zz4KCQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMTUuODcsNDYuOTVsMzEuMzItMjguNjZ2MjcuMDRjMCw0LTEuNjQsNy44LTQuNDksMTAuNEwyNS40MSw3MS41NUwxMS4zOSw1Ny4yNgoJCQlDMTEuNDEsNTMuMywxMy4wNCw0OS41NCwxNS44Nyw0Ni45NSIvPgoJCTxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik0xMS4zOSw1Ny4yNmwxNC4wMywxNC4yOGwxNy4yOSwxNy42YzIuODUsMi42MSw0LjQ5LDYuNDEsNC40OSwxMC40MXYyNy4wM0wxNS44Nyw5NC43CgkJCWMtMi44My0yLjU5LTQuNDYtNi4zNS00LjQ4LTEwLjMxYzAtMC4wMy0wLjAxLTAuMDYtMC4wMS0wLjA5VjU3LjM2QzExLjM4LDU3LjMzLDExLjM5LDU3LjMsMTEuMzksNTcuMjYiLz4KCQk8cGF0aCBjbGFzcz0ic3QxIiBkPSJNOTEuMTMsNDYuOTVMNTkuODEsMTguMjl2MjcuMDRjMCw0LDEuNjQsNy44LDQuNDksMTAuNGwxNy4yOSwxNS44MmwxNC4wMy0xNC4yOAoJCQlDOTUuNTksNTMuMyw5My45Niw0OS41NCw5MS4xMyw0Ni45NSIvPgoJCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik05NS42Miw1Ny4yNkw4MS41OSw3MS41NUw2NC4zLDg5LjE1Yy0yLjg1LDIuNjEtNC40OSw2LjQxLTQuNDksMTAuNDF2MjcuMDNMOTEuMTMsOTQuNwoJCQljMi44My0yLjU5LDQuNDYtNi4zNSw0LjQ4LTEwLjMxYzAtMC4wMywwLjAxLTAuMDYsMC4wMS0wLjA5VjU3LjM2Qzk1LjYyLDU3LjMzLDk1LjYyLDU3LjMsOTUuNjIsNTcuMjYiLz4KCQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMTYzLjY2LDM0LjkzYy05LjAzLDAtMTcuMTgsMS45LTIzLjg4LDEwLjU0bC0xLjM0LTkuMTNoLTE4Ljc1djEwOC4zMWwxNi44OC0xNy4yCgkJCWMyLjcxLTIuNzEsNC4yMy02LjM4LDQuMjMtMTAuMjFWOTkuOGM2LjEyLDcuNjEsMTUsMTAuMjUsMjIuNTcsMTAuMjVjMjEuMTEsMCwzNS44Mi0xNC4yLDM1LjgyLTM3LjYzCgkJCUMxOTkuMTksNDkuODYsMTg0Ljc3LDM0LjkzLDE2My42NiwzNC45MyBNMTYwLjQ2LDkxLjAxYy05LjYxLDAtMTkuMzYtNi40NC0xOS4zNi0xOC42YzAtMTMuNzcsOS45LTE4LjYsMTkuMzYtMTguNgoJCQljMTEuMjEsMCwxNy42Miw4LjIsMTcuNjIsMTguNkMxNzguMDgsODMuMjUsMTcxLjIzLDkxLjAxLDE2MC40Niw5MS4wMSIvPgoJCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0yNDcuMzIsMzQuOTNjLTguMDEsMC0xNC40MiwyLjkxLTE5LjIyLDkuNjFsLTEuNjctOC4yaC0xOS40NHY3Mi4yaDIwLjk3di0zNy41CgkJCWMwLTEwLjc3LDcuNzItMTYuNiwxNi43NC0xNi42YzQuMzcsMCw4LjAxLDEuMTYsMTEuNSwzLjY0bDguNzQtMTYuNkMyNTkuODQsMzYuOTcsMjU0LjE2LDM0LjkzLDI0Ny4zMiwzNC45MyIvPgoJCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0zMjEuMzgsNDQuODNjLTMuNzktNi40MS0xMi4yMy05LjktMjEuMjYtOS45Yy0yMS4yNi0wLjI5LTM3LjcxLDEzLjY4LTM3LjcxLDM3LjU2CgkJCWMwLDIzLjczLDE1LjU4LDM3LjcxLDM3LjEzLDM3LjU3YzYuOTktMC4xNCwxNy4zMy0zLjA2LDIyLjEzLTEwLjYzbDEuMTgsOS4xaDE4Ljkydi03Mi4yaC0xOS42M0wzMjEuMzgsNDQuODN6IE0zMDIuMzEsOTEuNDMKCQkJYy0xMC40OCwwLTE4LjkzLTYuOTktMTguOTMtMTguOTNjMC0xMS45NCw4LjQ1LTE5LjA3LDE4LjkzLTE5LjA3YzEyLjUyLDAsMTkuMDcsOS40NywxOS4wNywxOS44CgkJCUMzMjEuMzgsODIuMjUsMzE0LjEsOTEuNDMsMzAyLjMxLDkxLjQzIi8+CgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTM5MS44Niw5MS4wOWMtMy45MywwLTguMTUtMi4wNC04LjE1LTkuNjF2LTI3LjdoMTguMzVWMzYuMzNoLTE4LjJWMTYuODhsLTIwLjk2LDIuMzN2MTcuMTJoLTEyLjgydjE3LjQ2CgkJCWgxMi44MnYyNy43YzAsMjIuNDEsMTEuNzksMjkuMjUsMjcuMzcsMjguNTJjNS42OC0wLjI5LDkuOS0xLjE2LDE1LjE0LTMuMmwtNC44LTE3LjQ2QzM5OC4yNyw5MC41MSwzOTQuMzMsOTEuMDksMzkxLjg2LDkxLjA5Ii8+CgkJPHJlY3QgeD0iNDEyLjM1IiB5PSIzNi4zNCIgY2xhc3M9InN0MCIgd2lkdGg9IjIwLjk3IiBoZWlnaHQ9IjcyLjIiLz4KCQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNDIyLjgzLDkuMjFjLTYuMTksMC0xMS4yMSw1LjAyLTExLjIxLDExLjIxYzAsNi4xOSw1LjAyLDExLjIsMTEuMjEsMTEuMmM2LjE5LDAsMTEuMjEtNS4wMSwxMS4yMS0xMS4yCgkJCUM0MzQuMDQsMTQuMjMsNDI5LjAyLDkuMjEsNDIyLjgzLDkuMjEiLz4KCQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNDczLjY5LDM0LjkzYy0xNS4yNSwwLTMwLjM3LDYuNy0zMC4zNywyMi42N2MwLDE2LjU0LDE2LjQsMjEuOTYsMjkuNTEsMjIuNTIKCQkJYzkuNTUsMC4yOSwxMS45OCwyLjk5LDExLjk4LDYuMjhjMC4xNCwzLjcxLTQuNTYsNi4xMy0xMC41NSw1Ljk5Yy02LjUyLTAuMTItMTMuOC0xLjM1LTIxLjM4LTYuNDlsLTExLjk3LDEyLjIKCQkJYzExLjk3LDkuOTcsMjIuNjUsMTEuOTYsMzMuMDYsMTEuOTZjMjIuMzgsMCwzMC45NC0xMi4yNiwzMC44LTIzLjY3Yy0wLjE0LTE5LjM5LTE2LjgyLTIyLjI0LTMwLjY1LTIyLjY3CgkJCWMtNi44NC0wLjE0LTEwLjQxLTIuMjgtMTAuNDEtNi4xM2MwLTMuNDIsMy40Mi01Ljg1LDEwLjEyLTUuODVjNS44LDAsMTAuNDMsMS4xOCwxNS4xNiw0LjE0bDExLjYyLTExLjg2CgkJCUM0OTMuMjEsMzcuNjMsNDg0LjUyLDM0LjkzLDQ3My42OSwzNC45MyIvPgoJPC9nPgoJPGc+CgkJPGxpbmVhckdyYWRpZW50IGlkPSJTVkdJRF8xXyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSI2MjMuODMxMSIgeTE9IjEzMy43MDYzIiB4Mj0iNjUxLjIwNDUiIHkyPSI1Ni4yMTI0Ij4KCQkJPHN0b3AgIG9mZnNldD0iMC4wNDMxIiBzdHlsZT0ic3RvcC1jb2xvcjojMjMwODcxIi8+CgkJCTxzdG9wICBvZmZzZXQ9IjEiIHN0eWxlPSJzdG9wLWNvbG9yOiM5MEQ1QUMiLz4KCQk8L2xpbmVhckdyYWRpZW50PgoJCTxwYXRoIGNsYXNzPSJzdDIiIGQ9Ik02ODIuNjMsNDUuMjJjMCwxNS4yNS0xMC40MiwyNy42LTI3LjYsMjcuNmMtMTcuMTksMC0yNy41LTEyLjM1LTI3LjUtMjcuNmMwLTE1LjE1LDEwLjUzLTI3LjYsMjcuMzktMjcuNgoJCQlDNjcxLjc4LDE3LjYxLDY4Mi42MywzMC4wNyw2ODIuNjMsNDUuMjJ6IE02NDAuNjMsNDUuMjJjMCw4LjA2LDQuODMsMTUuNTcsMTQuMzksMTUuNTdjOS41NiwwLDE0LjM5LTcuNTIsMTQuMzktMTUuNTcKCQkJYzAtNy45NS01LjU5LTE1LjY4LTE0LjM5LTE1LjY4QzY0NS41NywyOS41Myw2NDAuNjMsMzcuMjcsNjQwLjYzLDQ1LjIyeiIvPgoJCQoJCQk8bGluZWFyR3JhZGllbnQgaWQ9IlNWR0lEXzAwMDAwMTEyNTk0MTM3MzYxODgzMzE4ODMwMDAwMDA2OTI1NTc2NjM4NTU2NzY4OTM3XyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSI1MzUuMTg4NCIgeTE9IjEwMi4zOTQ3IiB4Mj0iNTYyLjU2MTgiIHkyPSIyNC45MDA5Ij4KCQkJPHN0b3AgIG9mZnNldD0iMC4wNDMxIiBzdHlsZT0ic3RvcC1jb2xvcjojMjMwODcxIi8+CgkJCTxzdG9wICBvZmZzZXQ9IjEiIHN0eWxlPSJzdG9wLWNvbG9yOiM5MEQ1QUMiLz4KCQk8L2xpbmVhckdyYWRpZW50PgoJCTxwYXRoIHN0eWxlPSJmaWxsOnVybCgjU1ZHSURfMDAwMDAxMTI1OTQxMzczNjE4ODMzMTg4MzAwMDAwMDY5MjU1NzY2Mzg1NTY3Njg5MzdfKTsiIGQ9Ik01NTUuMjEsMTcuNjEKCQkJYy0xNi44NiwwLTI3LjM5LDEyLjQ2LTI3LjM5LDI3LjZ2NDUuMTRoMy40YzUuMzYsMCw5LjctNC4zNCw5LjctOS43VjY5LjI2YzQsMi4yNiw4Ljg0LDMuNTYsMTQuMzksMy41NgoJCQljMTcuMTksMCwyNy42LTEyLjM1LDI3LjYtMjcuNkM1ODIuOTIsMzAuMDcsNTcyLjA3LDE3LjYxLDU1NS4yMSwxNy42MXogTTU1NS4zMiw2MC43OWMtOS41NiwwLTE0LjM5LTcuNTItMTQuMzktMTUuNTcKCQkJYzAtNy45NSw0Ljk0LTE1LjY4LDE0LjM5LTE1LjY4YzguODEsMCwxNC4zOSw3LjczLDE0LjM5LDE1LjY4QzU2OS43MSw1My4yNyw1NjQuODgsNjAuNzksNTU1LjMyLDYwLjc5eiIvPgoJCQoJCQk8bGluZWFyR3JhZGllbnQgaWQ9IlNWR0lEXzAwMDAwMDk4OTM0NzA0MjUyNTI1MjMzMzUwMDAwMDE3MDM1Mzk0NDQyNjMwNzgxNTkyXyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSI1NzguMzEyMiIgeTE9IjExNy42Mjc1IiB4Mj0iNjA1LjY4NTYiIHkyPSI0MC4xMzM2Ij4KCQkJPHN0b3AgIG9mZnNldD0iMC4wNDMxIiBzdHlsZT0ic3RvcC1jb2xvcjojMjMwODcxIi8+CgkJCTxzdG9wICBvZmZzZXQ9IjEiIHN0eWxlPSJzdG9wLWNvbG9yOiM5MEQ1QUMiLz4KCQk8L2xpbmVhckdyYWRpZW50PgoJCTxwYXRoIHN0eWxlPSJmaWxsOnVybCgjU1ZHSURfMDAwMDAwOTg5MzQ3MDQyNTI1MjUyMzMzNTAwMDAwMTcwMzUzOTQ0NDI2MzA3ODE1OTJfKTsiIGQ9Ik02MTUuMzQsMTcuNjEKCQkJYy0xNi41OCwwLTI3LjAzLDEyLjA1LTI3LjM3LDI2Ljg1djI3LjE4aDEzLjEyVjQ0LjQ2aDBjMC4zLTcuNjcsNS4yMS0xNC45MywxNC4zNi0xNC45M2MzLjI2LDAsNi4wNiwxLjA3LDguMzEsMi44MQoJCQljMi4wOS0zLjg3LDQuMTgtNy40Myw2LjI4LTEwLjc5bDAuMDUtMC4xQzYyNS45NywxOS4wMiw2MjEsMTcuNjEsNjE1LjM0LDE3LjYxeiIvPgoJPC9nPgo8L2c+Cjwvc3ZnPgo='
      )

    default:
      return shape.print(value)
  }
}

shape.init()
