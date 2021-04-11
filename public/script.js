const socket = io('/')
const peer = new Peer()

let myId
let users
let battleState = 0
const calls = {}

const boxes = document.getElementById('boxes').children

let username = prompt('Enter your username', '')
if (username === null || username === '') username = 'anonymous'
setUsernameText(username, 0)

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

        battleState = 1
        setUsernameText(otherUser.username, 1)
        setTimerText('00.00', 0)
        setTimerText('00.00', 1)
      }
    })
  })

socket.on('user-disconnected', (userId) => {
  if (calls[userId]) {
    calls[userId].close()

    battleState = 0
    setUsernameText('', 1)
    setTimerText('', 0)
    setTimerText('', 1)
  }
})

// on connection to peerserver
peer.on('open', (id) => {
  myId = id
  socket.emit('join', ROOM_ID, myId, username)
})

socket.on('update-scramble', (scramble) => {
  console.log(`Update scramble: ${scramble}`)
  document.getElementById('scramble').textContent = scramble
})

socket.on('update-timer', (timerText) => {
  console.log(timerText)
  boxes[1].getElementsByClassName('timer')[0].textContent = timerText
})

socket.on('new-round', () => {
  battleState = 1

  timerButton.textContent = 'start'
  setTimerText('00.00', 0)
  setTimerText('00.00', 1)
})

function connectToNewUser(user, stream) {
  const call = peer.call(user.userId, stream)
  const video = boxes[1].getElementsByTagName('video')[0]

  // get user video stream
  call.on('stream', (userStream) => {
    connectVideoStream(video, userStream)

    battleState = 1
    newScramble()
    setUsernameText(user.username, 1)
    setTimerText('00.00', 0)
    setTimerText('00.00', 1)
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

function setUsernameText(username, userNo) {
  boxes[userNo].getElementsByClassName('username')[0].textContent = username
}

function setTimerText(time, userNo) {
  boxes[userNo].getElementsByClassName('timer')[0].textContent = time
}

function solveStarted() {
  socket.emit('solve-started')
}

function solveFinished() {
  const solveTime = timerText.textContent
  socket.emit('solve-finished', solveTime)
}

function userReady() {
  socket.emit('user-ready')
}

function newScramble() {
  socket.emit('new-scramble')
}

// ---------
// Timer
// ---------

const timerText = boxes[0].getElementsByClassName('timer')[0]
const timerButton = document.getElementById('timerButton')

let timerInterval = null
let timerState = 0

let spaceDownTime = 0
let spaceUpTime = 0
let keyUpCount = 0

let minutes = 0
let seconds = 0
let centiseconds = 0

timerButton.addEventListener('click', (event) => {
  if (battleState === 1) {
    timer()
  }
})

document.addEventListener('keydown', (event) => {
  if (battleState === 1) {
    if (event.code === 'Space') {
      if (spaceDownTime === 0) {
        if (timerState == 0) {
          spaceDownTime = Date.now()
          spaceUpTime = 0
        } else if (timerState == 1) {
          timer()
        }
      }
    }
  }
})

document.addEventListener('keyup', (event) => {
  if (battleState === 1) {
    if (event.code === 'Space') {
      if (timerState === 0) {
        spaceUpTime = Date.now()
        let spaceTimePressed = spaceUpTime - spaceDownTime
        spaceDownTime = 0

        if (spaceTimePressed > 300) {
          timer()
        }
      } else if (timerState === 2) {
        if (keyUpCount === 0) {
          keyUpCount++
        } else {
          keyUpCount = 0
          timer()
        }
      }
    }
  }
})

function timer() {
  // Remove focus from all buttons
  document.querySelectorAll('button').forEach(function (button) {
    button.blur()
  })

  switch (timerState) {
    case 0:
      timerState = 1
      timerText.classList.add('active')
      timerButton.textContent = 'stop'

      solveStarted()

      timerInterval = window.setInterval(updateTimer, 10)
      break
    case 1:
      timerState = 2
      timerButton.textContent = 'ready'

      solveFinished()

      minutes = 0
      seconds = 0
      centiseconds = 0

      window.clearInterval(timerInterval)
      break
    case 2:
      timerText.classList.remove('active')

      timerState = 0
      battleState = 0
      userReady()

      break
  }
}

function updateTimer() {
  centiseconds++
  if (centiseconds > 100) {
    centiseconds = 0
    seconds++
  }
  if (seconds > 60) {
    seconds = 0
    minutes++

    timerText.textContent =
      ('00' + minutes).substr(-2, 2) + '.' + ('00' + seconds).substr(-2, 2) + '.' + ('00' + centiseconds).substr(-2, 2)
  } else {
    timerText.textContent = ('00' + seconds).substr(-2, 2) + '.' + ('00' + centiseconds).substr(-2, 2)
  }
}
