const express = require('express')
const app = express()
const http = require('http')
const server = http.createServer(app)
const { Server } = require('socket.io')
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 20000,
  pingInterval: 1000
})
const connections = []

app.use(express.static('public'))

// enums
const GameState = Object.freeze({
  Selecting: 0,
  Playing: 1,
  GameOver: 2
})

const game = {
  secrets: {},
  state: GameState.Selecting,
  players: [],
  maxPlayers: 32,
  speed: 1,
  admin: null,
  web: null,
  availableCards: [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23
  ]
}

const VIDEOS = [
  '/videos/Abstract - 1372.mp4',
  '/videos/Art - 26312.mp4',
  '/videos/Art - 27075.mp4',
  '/videos/Corridor - 68457.mp4',
  '/videos/Energy Field - 74933.mp4',
  '/videos/Future - 26045.mp4',
  '/videos/Futuristic - 27248.mp4',
  '/videos/Golden - 38432.mp4',
  '/videos/Grid - 82515.mp4',
  '/videos/Holy - 26847.mp4',
  '/videos/Neon - 34999.mp4',
  '/videos/Neon - 36027.mp4',
  '/videos/Neon - 56368.mp4',
  '/videos/Reflection - 48516.mp4',
  '/videos/Science Fiction - 53725.mp4',
  '/videos/Scifi - 26038.mp4',
  '/videos/Sci-Fi - 26542.mp4',
  '/videos/Scifi - 26743.mp4',
  '/videos/Space - 35008.mp4',
  '/videos/Space Ship - 53601.mp4',
  '/videos/Star - 38429.mp4',
  '/videos/Tunnel - 34168.mp4',
  '/videos/Tunnel - 65493.mp4',
  '/videos/Tunnel - 79764.mp4'
]
const CARDS = [
  '1,_,2,_,10,_,20,_,23,_,30,_,40,_,46,_,56,_,64,_,68,76,79,_,_,82,87',
  '1,_,3,_,11,_,25,_,26,_,31,_,40,_,42,_,59,_,61,_,64,75,78,_,_,85,88',
  '2,_,5,_,12,_,20,_,23,_,32,_,43,_,49,_,53,_,60,_,69,74,79,_,_,80,84',
  '3,_,6,_,13,_,22,_,27,_,31,_,42,_,47,_,52,_,65,_,61,72,79,_,_,83,90',
  '5,_,7,_,14,_,26,_,29,_,34,_,43,_,45,_,59,_,63,_,68,73,77,_,_,85,86',
  '4,_,8,_,11,_,25,_,28,_,33,_,41,_,47,_,51,_,62,_,67,75,77,_,_,82,89',
  '3,_,8,_,16,_,27,_,28,_,36,_,47,_,48,_,57,_,66,_,68,77,78,_,_,87,88',
  '1,_,6,_,17,_,21,_,25,_,38,_,42,_,44,_,55,_,66,_,67,70,75,_,_,81,83',
  '7,_,9,12,19,_,_,24,26,34,_,35,_,44,_,54,_,59,_,66,_,70,_,73,_,84,_',
  '2,_,8,13,18,_,_,22,27,38,_,41,_,47,_,52,_,58,_,67,_,74,_,79,_,89,_',
  '6,_,8,11,15,_,_,27,28,35,_,37,_,44,_,50,_,59,_,63,_,72,_,77,_,82,_',
  '2,_,8,10,15,_,_,21,26,36,_,39,_,40,_,50,_,56,_,60,_,71,_,74,_,83,_',
  '3,_,6,_,18,_,22,_,29,_,38,_,45,_,48,_,51,_,60,_,66,72,79,_,_,81,86',
  '7,_,9,_,16,_,23,_,24,_,37,_,44,_,46,_,54,_,61,_,67,73,79,_,_,83,90',
  '5,_,9,_,10,_,21,_,24,_,30,_,40,_,41,_,51,_,65,_,68,71,77,_,_,82,89',
  '4,_,9,14,17,_,_,25,29,32,_,38,_,42,_,55,_,58,_,64,_,71,_,76,_,86,_',
  '1,_,4,_,17,_,21,_,28,_,39,_,45,_,48,_,50,_,62,_,65,70,73,_,_,81,90',
  '3,_,9,12,16,_,_,21,24,30,_,35,_,41,_,53,_,57,_,61,_,70,_,73,_,87,_',
  '2,_,8,13,19,_,_,22,27,36,_,38,_,47,_,52,_,58,_,67,_,74,_,79,_,89,_',
  '1,_,7,11,18,_,_,20,28,31,_,39,_,43,_,51,_,55,_,63,_,75,_,78,_,88,_',
  '1,_,4,_,14,_,24,_,29,_,33,_,43,_,45,_,54,_,62,_,69,70,75,_,_,81,85',
  '6,_,8,13,18,_,_,22,29,33,_,37,_,41,_,52,_,57,_,65,_,72,_,76,_,85,_',
  '5,_,7,_,15,_,22,_,26,_,34,_,46,_,48,_,56,_,62,_,63,72,76,_,_,86,89',
  '2,_,5,_,18,_,23,_,25,_,32,_,45,_,49,_,58,_,64,_,69,71,78,_,_,80,86'
]
const CARD_WIDTH = 9
const CARD_HEIGHT = 3
const CARD_PER_VIDEO = 1

function getCard(cardId) {
  const card = CARDS[cardId]
  const cells = card.split(',')
  const getContent = (cell) => (cell === '_' ? 0 : parseInt(cell))
  const getCell = (x, y) => getContent(cells[x * CARD_HEIGHT + y])
  const getRow = (y) =>
    Array.from({ length: CARD_WIDTH }, (_, x) => getCell(x, y))
  const getCard = () => Array.from({ length: CARD_HEIGHT }, (_, y) => getRow(y))
  return {
    id: cardId,
    cardNo: cardId + 1,
    video: VIDEOS[Math.floor(cardId / CARD_PER_VIDEO)],
    content: getCard(),
    numbers: cells.map((cell) => getContent(cell)).filter(Boolean)
  }
}

function randomCard() {
  const randomIndex = Math.floor(Math.random() * game.availableCards.length)
  const cardId = game.availableCards[randomIndex]
  game.availableCards.splice(randomIndex, 1)
  return getCard(cardId)
}

function generateNewPlayer(playerIndex, withDifferentCard = false) {
  const player = game.players[playerIndex]
  const newData = {
    id: player.id,
    name: player.name,
    card: player.card,
    score: 0,
    selected: []
  }

  if (withDifferentCard) {
    const tempCard = newData.card.id
    newData.card = randomCard()
    // put back the old card
    game.availableCards.push(tempCard)
  }

  // set player data
  game.players[playerIndex] = newData
}

function sendData() {
  game.players.forEach((player) => {
    io.to(player.id).emit('update', {
      state: game.state,
      players: game.players.map(({ id, name, card, score }) => ({
        id,
        name,
        card: id === player.id ? card : null,
        score
      }))
    })
  })
  if (game.admin) {
    io.to(game.admin).emit('update', { game })
  }
}

function gameLoop() {
  sendData()
}

function createPlayer({ id, name, card, score, selected }) {
  const player = {
    id,
    name,
    card,
    score: score || 0,
    selected: selected || []
  }
  return player
}

function findPlayer(id) {
  return game.players.find((player) => player.id === id)
}

function findScore(id) {
  const player = findPlayer(id)
  // check player card, for each row
  const card = player.card.content
  const selected = player.selected

  const score = card
    .map((row, y) => {
      const selectedNumbers = row.filter(
        (cell, x) => !!selected.find((s) => s.x === x && s.y === y)
      )
      return selectedNumbers
    })
    .map((row) => row.length)
    .filter((row) => row === 5).length

  return score
}

io.on('connection', (socket) => {
  console.log('New Connection', socket.id)
  if (connections.length >= game.maxPlayers) {
    socket.emit('error', 'Game is full')
    socket.disconnect()
    return
  }

  // add connection
  connections.push(socket.id)

  socket.on('join', ({ name, type, secret }) => {
    console.log('Join', name, type, secret)
    if (findPlayer(socket.id)) {
      socket.emit('error', 'Already created')
      return
    }

    // old player
    if (secret && game.secrets[secret]) {
      console.log('Old player', secret)
      // change player connection id
      const oldSocketId = game.secrets[secret]
      const player = findPlayer(oldSocketId)

      if (!player) {
        socket.emit('error', 'Invalid secret')
        return
      }

      console.log('oldplayer', oldSocketId, player)

      game.players.push(
        createPlayer({
          id: socket.id,
          name: player.name,
          card: player.card,
          selected: player.selected,
          score: player.score
        })
      )

      // remove old connection
      connections.splice(connections.indexOf(oldSocketId), 1)

      // update secret
      game.secrets[secret] = socket.id

      socket.emit('init', {
        state: game.state,
        name: player.name,
        card: player.card
      })

      return
    }

    // add secret
    game.secrets[secret] = socket.id

    if (game.availableCards.length === 0) {
      socket.emit('error', 'Game is full')
      return
    }

    // sanitize name
    name =
      name?.replace?.(/[^a-zA-Z0-9üğşiöçÜĞŞİÖÇ]/g, '').substring(0, 10) ||
      'Anonymous'

    if (type === 'player') {
      const card = randomCard()

      game.players.push(
        createPlayer({
          id: socket.id,
          name,
          card
        })
      )

      socket.emit('init', {
        state: game.state,
        name,
        card
      })
    } else if (type === 'admin') {
      game.admin = socket.id
    } else if (type === 'web') {
      game.web = socket.id
    }
  })

  socket.on('disconnect', (reason) => {
    connections.splice(connections.indexOf(socket.id), 1)
    const player = findPlayer(socket.id)
    if (player) {
      game.availableCards.push(player.card.id)
    }
    game.players = game.players.filter((player) => player.id !== socket.id)

    if (socket.id === game.admin) {
      game.admin = null
    }
    if (socket.id === game.web) {
      game.web = null
    }
  })

  socket.on('toggle', (x, y) => {
    if (game.state !== GameState.Playing) return
    if (!findPlayer(socket.id)) return

    // is already selected?
    const isSelected = findPlayer(socket.id).selected.find(
      ({ x: _x, y: _y }) => _x === x && _y === y
    )
    if (isSelected) {
      // remove selection
      findPlayer(socket.id).selected = findPlayer(socket.id).selected.filter(
        ({ x: _x, y: _y }) => _x !== x || _y !== y
      )

      const score = findScore(socket.id)

      // send to mobile
      io.to(socket.id).emit('remove', x, y, score)
      return
    } else {
      // add selection
      findPlayer(socket.id).selected.push({ x, y })

      const score = findScore(socket.id)

      // send to mobile
      io.to(socket.id).emit('add', x, y, score)
    }
  })

  socket.on('rejoin', (newCard) => {
    if (!findPlayer(socket.id)) return
    generateNewPlayer(
      game.players.findIndex((player) => player.id === socket.id),
      newCard
    )
    io.to(socket.id).emit('rejoined', {
      name: findPlayer(socket.id).name,
      card: findPlayer(socket.id).card
    })
  })

  socket.on('command', (command) => {
    io.to(game.web).emit('screen', command)
  })

  socket.on('nextState', () => {
    if (game.state === GameState.Selecting) {
      game.state = GameState.Playing
    } else if (game.state === GameState.Playing) {
      game.state = GameState.GameOver
    } else if (game.state === GameState.GameOver) {
      game.state = GameState.Selecting
    }
  })
})

setInterval(gameLoop, 1000 / game.speed)

server.listen(4000, () => {
  console.log('listening on *:4000')
})
