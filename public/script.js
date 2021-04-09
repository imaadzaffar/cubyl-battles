const socket = io('/')
const myPeer = new Peer(undefined, {
  host: '/',
  port: '3001',
})
const videoGrid = document.getElementById('video-grid')
const myVideo = document.createElement('video')
myVideo.muted = true

const peers = []

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    addVideoStream(myVideo, stream)

    myPeer.on('call', (call) => {
      call.answer(stream)

      // get user video stream
      const video = document.createElement('video')
      call.on('stream', (userStream) => {
        addVideoStream(video, userStream)
      })
    })

    // on another user connection to room
    socket.on('user-connected', (userId) => {
      connectToNewUser(userId, stream)
    })
  })

socket.on('user-disconnected', (userId) => {
  if (peers[userId]) peers[userId].close()
})

// on connection to peerserver
myPeer.on('open', (id) => {
  socket.emit('join-room', ROOM_ID, id)
})

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream)
  const video = document.createElement('video')

  // get user video stream
  call.on('stream', (userStream) => {
    addVideoStream(video, userStream)
  })
  // remove user video stream after disconnection
  call.on('close', () => {
    video.remove()
  })

  peers[userId] = call
}

function addVideoStream(video, stream) {
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
  videoGrid.append(video)
}
