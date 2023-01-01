var socket = io()

const GameState = Object.freeze({
  Selecting: 0,
  Playing: 1,
  GameOver: 2
})

var number = ''

function setTab(tab) {
  document.querySelectorAll('.tab').forEach((t) => (t.style.display = 'none'))
  document.querySelector('.tab.' + tab).style.display = 'block'
}

function sendNumber() {
  sendCommand(number)
  clearNumber()
}

function addNumber(n) {
  number += n.toString()
  document.querySelector('.number').innerHTML = number
}

function clearNumber() {
  number = ''
  document.querySelector('.number').innerHTML = number
}

socket.on('connect', function () {
  console.log('Connected!')
  const name = Math.floor(Math.random() * 1000)
  socket.emit('join', { name, type: 'admin' })
})

socket.on('update', function (game) {
  console.log('update', game)
  document.querySelector('.players').innerHTML = JSON.stringify(game, null, 2)
})

function sendCommand(command) {
  socket.emit('command', command)
}

function nextState() {
  socket.emit('nextState')
}

function randomNumber() {
  // between 1 and 90
  sendCommand(Math.floor(Math.random() * 90) + 1)
}
