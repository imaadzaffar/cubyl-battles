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

    const user = { userId: userId, roomId: roomId, username: username, ready: false, solveTime: '00.00' }
    users.push(user)

    socket.to(roomId).emit('user-connected', user)

    io.in(roomId).emit(
      'get-users',
      users.filter((user) => user.roomId === roomId),
    )

    socket.on('solve-started', () => {
      socket.to(roomId).emit('update-timer', 'solving...')
    })

    socket.on('solve-finished', (solveTime) => {
      let user = users.find((user) => user.userId === userId)
      user.timerEnd = true
      user.solveTime = solveTime
      socket.to(roomId).emit('update-timer', solveTime)
    })

    socket.on('user-ready', () => {
      let usersInRoom = users.filter((user) => user.roomId === roomId)
      users.find((user) => user.userId === userId).ready = true

      // TODO: Check if both users are ready => reset timers, new scramble
      let allReady = true
      usersInRoom.forEach((user) => {
        if (!user.ready) allReady = false
      })
      if (allReady) {
        let scrambo = new Scrambo()
        io.in(roomId).emit('update-scramble', scrambo.get()[0])
        io.in(roomId).emit('new-round')

        usersInRoom.forEach((user) => {
          user.ready = false
          user.solveTime = '00.00'
        })
      }
    })

    socket.on('new-scramble', () => {
      let scrambo = new Scrambo()
      io.in(roomId).emit('update-scramble', scrambo.get()[0])
    })

    socket.on('disconnect', () => {
      users = users.filter((user) => user.userId !== userId)
      socket.to(roomId).emit('user-disconnected', userId)
    })
  })
})

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
