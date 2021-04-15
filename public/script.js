const socket = io('/')
const peer = new Peer()

let myId
let users
let battleState = 0
const calls = {}

let username = prompt('Enter your username', '')
if (username === null || username === '') username = 'anonymous'
setUsernameText(username, 0)

const [myTimer, otherTimer] = document.getElementsByClassName('timer')
const timerButton = document.getElementById('timerButton')
myTimer.style.display = 'none'
timerButton.style.display = 'none'

const [myVideo, otherVideo] = document.getElementsByTagName('video')
myVideo.muted = true
otherVideo.style.visibility = 'hidden'

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
      call.on('stream', (userStream) => {
        connectVideoStream(otherVideo, userStream)
      })
    })

    // on another user connection to room
    socket.on('user-connected', (user) => {
      connectToNewUser(user, stream)
    })
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
    myTimer.style.display = 'block'
    timerButton.style.display = 'block'
    setTimerText('00.00', 0)
    setTimerText('00.00', 1)
  }
})

socket.on('user-disconnected', (userId) => {
  if (calls[userId]) {
    calls[userId].close()

    battleState = 0
    myTimer.style.display = 'none'
    timerButton.style.display = 'none'
    setUsernameText('', 1)
    setTimerText('00.00', 0)
    setTimerText('00.00', 1)
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
  console.log(`Update timer text: ${timerText}`)
  document.getElementsByClassName('timer')[1].textContent = timerText
})

socket.on('new-round', () => {
  battleState = 1

  timerButton.textContent = 'start'
  myTimer.classList.remove('finished')
  setTimerText('00.00', 0)
  setTimerText('00.00', 1)
})

function connectToNewUser(newUser, stream) {
  const call = peer.call(newUser.userId, stream)

  // get user video stream
  call.on('stream', (userStream) => {
    connectVideoStream(otherVideo, userStream)

    battleState = 1
    newScramble()
    myTimer.style.display = 'block'
    timerButton.style.display = 'block'
    setUsernameText(newUser.username, 1)
    setTimerText('00.00', 0)
    setTimerText('00.00', 1)
  })
  // remove user video stream after disconnection
  call.on('close', () => {
    otherVideo.style.visibility = 'hidden'
  })

  calls[newUser.userId] = call
}

function connectVideoStream(video, stream) {
  video.style.visibility = 'visible'
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
}

function setUsernameText(username, userNo) {
  document.getElementsByClassName('username')[userNo].textContent = username
}

function setTimerText(time, userNo) {
  document.getElementsByClassName('timer')[userNo].textContent = time
}

function solveStarted() {
  socket.emit('solve-started')
}

function solveFinished() {
  const solveTime = myTimer.textContent
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
      myTimer.classList.add('active')
      timerButton.textContent = 'stop'

      solveStarted()

      timerInterval = window.setInterval(updateTimer, 10)
      break
    case 1:
      timerState = 2
      myTimer.classList.remove('active')
      myTimer.classList.add('finished')
      timerButton.textContent = 'ready'

      solveFinished()

      minutes = 0
      seconds = 0
      centiseconds = 0

      window.clearInterval(timerInterval)
      break
    case 2:
      timerState = 0
      battleState = 0
      userReady()

      break
  }
}

function updateTimer() {
  centiseconds++

  if (centiseconds >= 100) {
    centiseconds = 0
    seconds++
  }

  if (seconds >= 60) {
    seconds = 0
    minutes++
  }

  myTimer.textContent = ('00' + seconds).substr(-2, 2) + '.' + ('00' + centiseconds).substr(-2, 2)
  if (minutes >= 1) {
    myTimer.textContent = ('00' + minutes).substr(-2, 2) + '.' + myTimer.textContent
  }
}
