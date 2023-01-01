var socket = io()

const GameState = Object.freeze({
  Selecting: 0,
  Playing: 1,
  GameOver: 2
})

// set new secret
sessionStorage.setItem(
  'secret',
  Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
)
let secret = sessionStorage.getItem('secret')

let isReady = false
let hasGameOver = false
let shouldShowCard = false

function sendInput(x, y) {
  console.log(x, y)
  socket.emit('toggle', x, y)
}

function newCard() {
  socket.emit('rejoin', true)
}

function sameCard() {
  socket.emit('rejoin', false)
}

socket.on('rejoined', function ({ name, card }) {
  isReady = true

  console.log('readyForNewGame', name, card)

  // hide join screen
  document.querySelector('.modal').style.display = 'none'
  document.querySelector('.new-game-modal').style.display = 'none'

  // set name
  document.querySelector('.left .name').innerHTML = name
  document.querySelector('.left .score').innerHTML = ' '

  // activate left panel
  document.querySelector('.left').style.display = 'flex'

  const cards = document.querySelector('.cards')
  cards.innerHTML = ''
  cards.appendChild(createCard(card))
})

socket.on('connect', function () {
  console.log('Connected!')
})

socket.io.on('reconnect', () => {
  join()
})

socket.on('update', function (game) {
  console.log('update', game)

  if (game.state === GameState.Selecting && !isReady && hasGameOver) {
    document.querySelector('.new-game-modal').style.display = 'flex'
  }

  if (game.state === GameState.Playing && isReady) {
    isReady = true
    shouldShowCard = true
    // show card if not already shown
    if (document.querySelector('.card').style.display === 'none') {
      document.querySelector('.card').style.display = 'flex'
    }
  }

  if (game.state === GameState.GameOver && isReady) {
    isReady = false
    hasGameOver = true
  }
})

socket.on('add', function (x, y, score) {
  console.log('add', x, y)
  document
    .querySelector(`.card__cell--${x}-${y}`)
    .classList.add('card__cell--selected')

  document.querySelector('.left .score').innerHTML = scoreToText(score)
})

socket.on('remove', function (x, y, score) {
  console.log('remove', x, y)
  document
    .querySelector(`.card__cell--${x}-${y}`)
    .classList.remove('card__cell--selected')

  document.querySelector('.left .score').innerHTML = scoreToText(score)
})

socket.on('init', function ({ name, card }) {
  isReady = true
  console.log('init', name, card)
  // hide join screen
  document.querySelector('.modal').style.display = 'none'
  createCard(card)
  // set name
  document.querySelector('.left .name').innerHTML = name
  document.querySelector('.left .score').innerHTML = ' '
  // activate left panel
  document.querySelector('.left').style.display = 'flex'
  const cards = document.querySelector('.cards')
  cards.appendChild(createCard(card))
})

function scoreToText(score) {
  switch (score) {
    case 0:
      return ''
    case 1:
      return 'Birinci Çinko'
    case 2:
      return 'İkinci Çinko'
    case 3:
      return 'TOOMBALA'
    default:
      return ''
  }
}

function join() {
  const name = document.querySelector('.name').value
  socket.emit('join', { name, type: 'player', secret })
}

function createCard({ cardNo, video, content }) {
  const card = document.createElement('div')
  card.classList.add('card')
  card.style.display = 'none'
  card.innerHTML = `<div class="card__number">${cardNo}</div>`
  content.forEach((row, y) => {
    const rowEl = document.createElement('div')
    rowEl.classList.add('card__row')
    row.forEach((cell, x) => {
      const cellEl = document.createElement('div')
      cellEl.classList.add('card__cell')
      cellEl.classList.add(cell ? 'card__cell--filled' : 'card__cell--empty')
      cellEl.classList.add(`card__cell--${x}-${y}`)

      if (cell) {
        cellEl.addEventListener('click', () => {
          sendInput(x, y)
        })
      }

      cellEl.innerHTML = cell
      rowEl.appendChild(cellEl)
    })
    card.appendChild(rowEl)
  })
  var background = document.createElement('video')
  background.classList.add('card__background')
  background.setAttribute('autoplay', true)
  background.setAttribute('loop', true)
  background.setAttribute('muted', true)
  background.defaultPlaybackRate = 0.5
  background.playbackRate = 0.5
  card.appendChild(background)
  // remove current video
  background.innerHTML = ''
  // set video src
  var source = document.createElement('source')
  source.setAttribute('src', video)
  source.setAttribute('type', 'video/mp4')
  background.appendChild(source)
  // load video
  background.load()
  // play video
  background.play()
  return card
}
