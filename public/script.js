const socket = io('/')
const peer = new Peer()

let myId
const calls = {}

const username = prompt('Enter your username', '')
document.getElementById('username-1').textContent = username

const videoGrid = document.getElementById('video-grid')
const myVideo = document.createElement('video')
myVideo.muted = true

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    addVideoStream(myVideo, stream)

    peer.on('call', (call) => {
      call.answer(stream)

      // get user video stream
      const video = document.createElement('video')
      call.on('stream', (userStream) => {
        addVideoStream(video, userStream)
      })
    })

    // on another user connection to room
    socket.on('user-connected', (user) => {
      connectToNewUser(user, stream)
    })

    // get list of users
    socket.on('get-users', (users) => {
      console.log('Get current users in this room')
      console.log(users)
      let otherUsers = users.filter((user) => user.id !== myId)
      if (otherUsers.length > 0) {
        let otherUser = otherUsers[0]
        updateInfo(otherUser)
      }
    })
  })

socket.on('user-disconnected', (userId) => {
  if (calls[userId]) calls[userId].close()
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

function connectToNewUser(user, stream) {
  const call = peer.call(user.id, stream)
  const video = document.createElement('video')

  // get user video stream
  call.on('stream', (userStream) => {
    addVideoStream(video, userStream)
    updateInfo(user)
  })
  // remove user video stream after disconnection
  call.on('close', () => {
    video.remove()
  })

  calls[user.id] = call
}

function addVideoStream(video, stream) {
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
  videoGrid.append(video)
}

function updateInfo(user) {
  document.getElementById('username-2').textContent = user.username
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
