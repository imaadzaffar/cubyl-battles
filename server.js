const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const { v4: uuidV4 } = require('uuid')
const Scrambo = require('scrambo')
const PORT = process.env.PORT || 3000

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.get('/', (req, res) => {
  res.render('home')
})

app.get('/new', (req, res) => {
  res.redirect(`/${uuidV4()}`)
})

app.get('/:roomId', (req, res) => {
  res.render('room', { roomId: req.params.roomId })
})

let users = []

io.on('connection', (socket) => {
  socket.on('join', (roomId, userId, username) => {
    socket.join(roomId)

    const user = { id: userId, username: username, ready: false, timerEnd: false }
    users.push(user)

    socket.to(roomId).emit('user-connected', user)

    io.in(roomId).emit('get-users', users)

    socket.on('clicked-start', (userId) => {
      io.in(roomId).emit('timer-start', userId)
    })

    socket.on('clicked-end', (userId) => {
      let user = users.find((user) => user.id === userId)
      user.timerEnd = true
      io.in(roomId).emit('timer-end', userId)
    })

    socket.on('clicked-ready', (userId) => {
      let user = users.find((user) => user.id === userId)
      user.ready = true
      io.in(roomId).emit('user-ready', userId)

      // TODO: Check if both users are ready => reset timers, new scramble
    })

    socket.on('clicked-new-scramble', (userId) => {
      let scrambo = new Scrambo()
      io.in(roomId).emit('new-scramble', scrambo.get()[0])
    })

    socket.on('disconnect', () => {
      users = users.filter((user) => user.id !== userId)
      socket.to(roomId).emit('user-disconnected', userId)
    })
  })
})

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
