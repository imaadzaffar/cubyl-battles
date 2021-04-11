const socket = io('/')
const peer = new Peer()

let myId
let users
const calls = {}

const boxes = document.getElementById('boxes').children

let username = prompt('Enter your username', '')
if (username === null || username === '') username = 'anonymous'
updateUsername(username, 0)

const myVideo = boxes[0].getElementsByTagName('video')[0]
boxes[1].getElementsByTagName('video')[0].style.visibility = 'hidden'
myVideo.muted = true

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    connectVideoStream(myVideo, stream)

    peer.on('call', (call) => {
      call.answer(stream)

      // get user video stream
      const video = boxes[1].getElementsByTagName('video')[0]
      call.on('stream', (userStream) => {
        connectVideoStream(video, userStream)
      })
    })

    // on another user connection to room
    socket.on('user-connected', (user) => {
      connectToNewUser(user, stream)
    })

    // get list of users
    socket.on('get-users', (usersList) => {
      console.log('Get current users in this room')
      console.log(usersList)
      users = usersList
      let otherUsers = users.filter((user) => user.userId !== myId)
      if (otherUsers.length > 0) {
        let otherUser = otherUsers[0]
        updateUsername(otherUser.username, 1)
        updateTimer('0.00', 0)
        updateTimer('0.00', 1)
      }
    })
  })

socket.on('user-disconnected', (userId) => {
  if (calls[userId]) {
    calls[userId].close()
    updateUsername('', 1)
    updateTimer('', 0)
    updateTimer('', 1)
  }
})

// on connection to peerserver
peer.on('open', (id) => {
  myId = id
  socket.emit('join', ROOM_ID, myId, username)
})

socket.on('timer-start', (userId) => {
  console.log(`Timer started: ${userId}`)
})

socket.on('timer-end', (userId) => {
  console.log(`Timer ended: ${userId}`)
})

socket.on('user-ready', (userId) => {
  console.log(`User ready: ${userId}`)
})

socket.on('new-scramble', (scramble) => {
  console.log(`New scramble: ${scramble}`)
  document.getElementById('scramble').textContent = scramble
})

function connectToNewUser(user, stream) {
  const call = peer.call(user.userId, stream)
  const video = boxes[1].getElementsByTagName('video')[0]

  // get user video stream
  call.on('stream', (userStream) => {
    connectVideoStream(video, userStream)
    updateUsername(user.username, 1)
    updateTimer('0.00', 0)
    updateTimer('0.00', 1)
  })
  // remove user video stream after disconnection
  call.on('close', () => {
    video.style.visibility = 'hidden'
  })

  calls[user.userId] = call
}

function connectVideoStream(video, stream) {
  video.style.visibility = 'visible'
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
}

function updateUsername(username, userNo) {
  boxes[userNo].getElementsByClassName('username')[0].textContent = username
}

function updateTimer(time, userNo) {
  boxes[userNo].getElementsByClassName('timer')[0].textContent = time
}

function start() {
  console.log('button clicked: start')
  socket.emit('clicked-start', myId)
}

function end() {
  console.log('button clicked: end')
  socket.emit('clicked-end', myId)
}

function ready() {
  console.log('button clicked: ready')
  socket.emit('clicked-ready', myId)
}

function newScramble() {
  console.log('button clicked: new scramble')
  socket.emit('clicked-new-scramble', myId)
}
