const socket = io('/')
const peer = new Peer()

// ----
// Variables
// ----

let myId
let battleState = 0
let calls = {}

let username = prompt('Enter your username', '')
if (username === null || username === '') username = 'cuber'
setUsernameText(username, 0)
let otherUsername = ''

// ----
// HTML elements
// ----

let heading = document.getElementById('heading')
const waitingText = 'Waiting for opponent to join... 🕒'
const roundText = 'Compete for the fastest solve!'
heading.textContent = waitingText
let scramble = document.getElementById('scramble')

const [myBox, otherBox] = document.getElementsByClassName('box')
otherBox.style.display = 'none'
const [myTimer, otherTimer] = document.getElementsByClassName('timer')
const timerButton = document.getElementById('timerButton')
myTimer.style.display = 'none'
otherTimer.style.display = 'none'
timerButton.style.display = 'none'

let videoAllowed = false
let myStream

const [myVideo, otherVideo] = document.getElementsByTagName('video')
const [myPlaceholder, otherPlaceholder] = document.getElementsByClassName('placeholder')
myVideo.muted = true

// ----
// Video stream
// ----

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    videoAllowed = true
    myStream = stream
    connectVideoStream(myVideo, myStream)
  })
  .catch((error) => {
    videoAllowed = false
    showPlaceholder(!videoAllowed, 0)
    console.log(error)
  })

// ----
// Listeners: peerjs
// ----

peer.on('open', (id) => {
  myId = id
  socket.emit('join', ROOM_ID, myId, username)
})

peer.on('call', (call) => {
  if (videoAllowed) {
    call.answer(myStream)

    // get user video stream
    call.on('stream', (otherStream) => {
      connectVideoStream(otherVideo, otherStream)
    })
  } else {
    call.close()
    showPlaceholder(true, 0)
    showPlaceholder(true, 1)
  }
})

peer.on('error', (error) => {
  console.log(error)
})

// ----
// Listeners: socket.io
// ----

socket.on('user-connected', (newUser) => {
  otherUsername = newUser.username
  connectToNewUser(newUser)

  battleState = 1
  startInfo()
  newScramble()
})

socket.on('get-users', (usersList) => {
  console.log('Get current users in this room')
  console.log(usersList)
  let otherUsers = usersList.filter((user) => user.userId !== myId)
  if (otherUsers.length > 0) {
    let otherUser = otherUsers[0]

    otherUsername = otherUser.username

    battleState = 1
    startInfo()

    showPlaceholder(!videoAllowed, 1)
  }
})

socket.on('user-disconnected', (userId) => {
  if (calls[userId]) calls[userId].close()

  battleState = 0
  resetInfo()
})

socket.on('update-scramble', (scrambleText) => {
  console.log(`Update scramble: ${scrambleText}`)
  setScrambleText(scrambleText)
})

socket.on('update-timer', (timerText) => {
  console.log(`Update timer text: ${timerText}`)
  otherTimer.classList.add('active')
  setTimerText(timerText, 1)
})

socket.on('user-ready', (user) => {
  otherTimer.classList.remove('active')
  otherTimer.classList.add('ready')
})

socket.on('new-round', () => {
  battleState = 1
  roundInfo()
})

// ----
// Functions: connection
// ----

function connectToNewUser(newUser) {
  let call
  if (videoAllowed) {
    call = peer.call(newUser.userId, myStream)
    // get user video stream
    call.on('stream', (otherStream) => {
      connectVideoStream(otherVideo, otherStream)
    })

    // call declined
    call.on('close', () => {
      showPlaceholder(true, 1)
    })

    calls[newUser.userId] = call
  }

  showPlaceholder(!videoAllowed, 0)
  showPlaceholder(!videoAllowed, 1)
}

function connectVideoStream(video, stream) {
  video.style.display = 'block'
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
}

function showPlaceholder(show, userNo) {
  document.getElementsByClassName('placeholder')[userNo].style.display = show ? 'block' : 'none'
  document.getElementsByTagName('video')[userNo].style.display = show ? 'none' : 'block'
}

// ----
// Functions: update text
// ----

function startInfo() {
  scramble.style.display = 'block'
  otherBox.style.display = 'flex'
  myTimer.style.display = 'block'
  otherTimer.style.display = 'block'
  timerButton.style.display = 'block'
  setUsernameText(otherUsername, 1)

  roundInfo()
}

function roundInfo() {
  setHeadingText(roundText)
  timerButton.textContent = 'start'
  myTimer.classList.remove('ready')
  otherTimer.classList.remove('active')
  otherTimer.classList.remove('ready')
  setTimerText('00.00', 0)
  setTimerText('00.00', 1)
}

function resetInfo() {
  otherBox.style.display = 'none'
  otherVideo.style.display = 'none'
  otherPlaceholder.style.display = 'none'
  heading.textContent = waitingText
  scramble.style.display = 'none'
  myTimer.style.display = 'none'
  otherTimer.style.display = 'none'
  timerButton.style.display = 'none'
  setUsernameText('', 1)
}

function setHeadingText(headingText) {
  heading.textContent = headingText
}

function setScrambleText(scrambleText) {
  scramble.textContent = scrambleText
}

function setUsernameText(username, userNo) {
  document.getElementsByClassName('username')[userNo].textContent = username
}

function setTimerText(time, userNo) {
  document.getElementsByClassName('timer')[userNo].textContent = time
}

// ----
// Functions: socket emit
// ----

function newScramble() {
  socket.emit('new-scramble')
}

function solveStarted() {
  myTimer.classList.add('active')
  timerButton.textContent = 'stop'
  socket.emit('solve-started')
}

function solveFinished() {
  timerButton.textContent = 'ready'
  const solveTime = myTimer.textContent
  socket.emit('solve-finished', solveTime)
}

function userReady() {
  myTimer.classList.remove('active')
  myTimer.classList.add('ready')
  socket.emit('user-ready')
}

// ----
// Timer logic
// ----

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

      solveStarted()

      timerInterval = window.setInterval(updateTimer, 10)
      break
    case 1:
      timerState = 2

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
