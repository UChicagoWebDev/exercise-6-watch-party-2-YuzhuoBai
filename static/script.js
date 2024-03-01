// Constants to easily refer to pages
const SPLASH = document.querySelector(".splash");
const PROFILE = document.querySelector(".profile");
const LOGIN = document.querySelector(".login");
const ROOM = document.querySelector(".room");

// Custom validation on the password reset fields
const passwordField = document.querySelector(".profile input[name=password]");
const repeatPasswordField = document.querySelector(".profile input[name=repeatPassword]");

// Function to check if the repeated password matches the original password
const checkPasswordRepeat = () => {
  const passwordField = document.querySelector(".profile input[name=password]");
  if (passwordField.value == repeatPasswordField.value) {
    repeatPasswordField.setCustomValidity("");
    return;
  } else {
    repeatPasswordField.setCustomValidity("Password doesn't match");
  }
}

// Event listeners for password fields
passwordField.addEventListener("input", checkPasswordRepeat);
repeatPasswordField.addEventListener("input", checkPasswordRepeat);

//---------------------------------------
// Event listeners for page load and popstate events
window.addEventListener('load', () => {
  router();
});

window.addEventListener('popstate', () => {
  router();
});

// Global variables
let CURRENT_ROOM = 0;
let USER_NAME = "";
let USER_ID = 0;
let TIMER_ID = null;

// Function to check if the user is logged in
function isLoggedIn() {
  return localStorage.getItem('api_key') != null;
}

// Function to display only the specified element and hide others
let showOnly = (element) => {
  CURRENT_ROOM = 0;
  [SPLASH, PROFILE, LOGIN, ROOM].forEach(el => el.classList.add("hide"));
  element.classList.remove("hide");
}

// Function to route to different pages based on the URL path
let router = () => {
  let path = window.location.pathname;
  if (!isLoggedIn() && !['/', '/login'].includes(path)) {
    localStorage.setItem('redirectAfterLogin', path);
    showOnly(LOGIN);
    stopMessagePolling();
  } else {
    switch (path) {
      case "/":
        if (isLoggedIn()) {
          showOnly(SPLASH);
          stopMessagePolling();
        } else {
          showOnly(LOGIN);
          stopMessagePolling();
        }
        break;
      case "/login":
        if (isLoggedIn()) {
          window.location.pathname = "/";
        } else {
          showOnly(LOGIN);
          stopMessagePolling();
        }
        break;
      case "/profile":
        if (isLoggedIn()) {
          showOnly(PROFILE);
          stopMessagePolling();
        } else {
          localStorage.setItem('redirectAfterLogin', path);
          showOnly(LOGIN);
          stopMessagePolling();
        }
        break;
      default:
        if (path.startsWith("/room/") && isLoggedIn()) {
          let parts = path.split('/');
          CURRENT_ROOM = parseInt(parts[2]);
          localStorage.setItem('current_room', CURRENT_ROOM.toString());
          showOnly(ROOM);
          enterRoom();
        } else {
          localStorage.setItem('redirectAfterLogin', path);
          showOnly(LOGIN);
          stopMessagePolling();
        }
    }
  }

  if (!window.history.state || window.history.state.path !== path) {
    window.history.pushState({ path: path }, "", path);
  }
};

// Event listener for DOMContentLoaded event to check login status and setup event listeners
document.addEventListener('DOMContentLoaded', function() {
  checkLoginStatus();
  setupEventListeners();
});

// Function to check login status and update UI accordingly
function checkLoginStatus() {
  const loggedIn = isLoggedIn();
  const loggedInClass = document.querySelector(".loggedIn");
  const loggedOutClass = document.querySelector(".loggedOut");
  const createClass = document.querySelector(".create");
  const signupClass = document.querySelector(".signup");
  const usernameDisplay = document.querySelector(".username");

  if (loggedIn) {
    loggedInClass.classList.remove("hide");
    loggedOutClass.classList.add("hide");
    createClass.classList.remove("hide");
    signupClass.classList.add("hide");
    USER_NAME = localStorage.getItem('user_name');
    usernameDisplay.textContent = `Welcome back, ${USER_NAME}!`;
    fetchRooms();
  } else {
    loggedInClass.classList.add("hide");
    loggedOutClass.classList.remove("hide");
    createClass.classList.add("hide");
    signupClass.classList.remove("hide");
    document.querySelector(".rooms").classList.add("hide");
  }
}

// Function to set up event listeners
function setupEventListeners() {
  document.querySelector(".create").addEventListener("click", createRoom);
  document.querySelector(".signup").addEventListener("click", signUp);
  document.querySelector(".loggedOut a").addEventListener("click", function() {
    window.location.pathname = "/login";
  });
  document.querySelector(".loggedIn a").addEventListener("click", function() {
    window.location.pathname = "/profile";
  });
}

// Utility function to fetch API
function fetchAPI(url, method, body, onSuccess, onError) {
  fetch(url, {
    method: method,
    headers: {
      "Authorization": localStorage.getItem('api_key'),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  })
      .then(response => response.json())
      .then(data => onSuccess(data))
      .catch(error => onError(error));
}

// Setup event listeners for profile page
function setupProfilePageEventListeners() {
  if (isLoggedIn()) {
    const userInfo = localStorage.getItem('user_name');
    document.querySelector(".profile .username").textContent = userInfo;
    document.querySelector(".profile input[name='username']").value = userInfo;
  }

  document.querySelector(".profile [name='username'] + button").addEventListener("click", updateUsername);
  document.querySelector(".profile [name='password'] + button").addEventListener("click", updatePassword);
  document.querySelector(".profile .logout").addEventListener("click", logout);
  document.querySelector(".profile .goToSplash").addEventListener("click", () => window.location.pathname = "/");
}

// Setup event listeners for room and message functionalities
function setupRoomEventListeners() {
  document.querySelector(".editRoomName button").addEventListener("click", () => {
    const newRoomName = document.querySelector(".editRoomName input").value;
    fetchAPI("/api/rooms/name", "POST", { new_name: newRoomName, room_id: localStorage.getItem('current_room') },
        data => {
          alert("Room name updated successfully.");
          enterRoom();
        },
        error => console.error('Error updating room name:', error)
    );
  });

  document.querySelector(".comment_box button").addEventListener("click", () => {
    const messageBody = document.querySelector(".comment_box textarea").value;
    fetchAPI(`/api/rooms/${localStorage.getItem('current_room')}/messages`, "POST", { body: messageBody, user_id: localStorage.getItem('user_id') },
        data => {
          alert("Message posted successfully.");
          fetchMessages(localStorage.getItem('current_room'));
        },
        error => console.error('Error posting message:', error)
    );
  });
}

// Setup event listeners for login functionality
function setupLoginEventListeners() {
  document.querySelector(".login button").addEventListener("click", () => {
    const username = document.querySelector(".login input[name='username']").value;
    const password = document.querySelector(".login input[type='password']").value;

    fetchAPI('/api/login', 'POST', { password: password, userName: username },
        data => {
          if (data.error) {
            document.querySelector('.login .failed').style.display = 'flex';
          } else {
            localStorage.setItem('api_key', data.api_key);
            localStorage.setItem('user_name', data.user_name);
            localStorage.setItem('user_id', data.user_id);
            loginSuccess();
          }
        },
        error => {
          console.error('Error:', error);
          document.querySelector('.login .failed').style.display = 'flex';
        }
    );
  });

  document.querySelector(".login .failed button").addEventListener("click", signUp);
}

// Setup event listeners for miscellaneous UI interactions
function setupUIEventListeners() {
  document.querySelector('.header h2 a').addEventListener('click', () => window.location.pathname = "/");
  document.querySelector(".displayRoomName a").addEventListener("click", () => {
    document.querySelector(".displayRoomName").classList.add("hide");
    document.querySelector(".editRoomName").classList.remove("hide");
  });
}

// Combine all setup functions in a single DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
  setupProfilePageEventListeners();
  setupRoomEventListeners();
  setupLoginEventListeners();
  setupUIEventListeners();
});


//---------------------------------------
// functions

// Function to create a new room
function createRoom() {
  const api_key = localStorage.getItem('api_key');
  fetch('/api/rooms/new', {
    method: 'POST',
    headers: {
      'Authorization': api_key,
    }
  }).then(response => response.json())
      .then(data => {
        window.location.pathname = `/room/${data.id}`;
      }).catch(error => console.error('Error creating room:', error));
}

// Function to sign up
function signUp() {
  fetch('/api/signup', {
    method: 'POST'
  }).then(response => response.json())
      .then(data => {
        localStorage.setItem('user_name', data.user_name);
        localStorage.setItem('api_key', data.api_key);
        localStorage.setItem('user_id', data.user_id);
        USER_NAME = data.user_name;
        USER_ID = data.user_id;
        checkLoginStatus();
        window.location.pathname = "/";
      }).catch(error => console.error('Error signing up:', error));
}

// Function to fetch rooms
function fetchRooms() {
  const api_key = localStorage.getItem('api_key');
  fetch('/api/rooms', {
    headers: {
      'Authorization': api_key,
    }
  }).then(response => response.json())
      .then(data => {
        const roomsContainer = document.querySelector(".roomList");
        roomsContainer.innerHTML = "";
        if (data.length > 0) {
          document.querySelector(".rooms").classList.remove("hide");
          data.forEach(room => {
            const roomElement = document.createElement("a");
            roomElement.href = `/room/${room.room_id}`;
            roomElement.innerHTML = `${room.room_id}: <strong>${room.room_name}</strong>`;
            roomElement.addEventListener("click", (e) => {
              e.preventDefault();
              window.location.pathname = `/room/${room.room_id}`;
            });
            roomsContainer.appendChild(roomElement);
          });
          document.querySelector(".noRooms").classList.add("hide");
        } else {
          document.querySelector(".rooms").classList.remove("hide");
          document.querySelector(".noRooms").classList.remove("hide");
        }
      }).catch(error => console.error('Error fetching rooms:', error));
}

// Function to start message polling
function startMessagePolling() {
  CURRENT_ROOM = localStorage.getItem("current_room")
  console.log("startMessagePolling, CURRENT_ROOM Id = " + CURRENT_ROOM);
  if (TIMER_ID){
    clearInterval(TIMER_ID);
    TIMER_ID = null;
  }
  fetchMessages(CURRENT_ROOM);
  TIMER_ID = setInterval(() => fetchMessages(CURRENT_ROOM), 500);
  console.log("success startMessagePolling");
}

// Function to stop message polling
function stopMessagePolling() {
  console.log("stopMessagePolling, CURRENT_ROOM Id = " + CURRENT_ROOM);
  clearInterval(TIMER_ID);
  TIMER_ID = null;
  console.log("success stopMessagePolling");
}

// Function to update username
function updateUsername() {
  const newUsername = document.querySelector(".profile input[name='username']").value;
  fetch("/api/user/name", {
    method: "POST",
    headers: {
      "Authorization": localStorage.getItem('api_key'),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({new_name: newUsername})
  })
      .then(response => response.json())
      .then(data => {
        alert("Username updated successfully.");
        localStorage.setItem('user_name', newUsername);
        location.reload();
      })
      .catch(error => console.error('Error updating username:', error));
}

// Function to update password
function updatePassword() {
  const newPassword = document.querySelector(".profile input[name='password']").value;
  const repeatPassword = document.querySelector(".profile input[name='repeatPassword']").value;
  if (newPassword !== repeatPassword) {
    alert("Passwords do not match.");
    return;
  }

  fetch("/api/user/password", {
    method: "POST",
    headers: {
      "Authorization": localStorage.getItem('api_key'),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({new_password: newPassword})
  })
      .then(response => response.json())
      .then(data => {
        alert("Password updated successfully.");
        location.reload();
      })
      .catch(error => console.error('Error updating password:', error));
}

// Function to log out
function logout() {
  localStorage.removeItem('api_key');
  localStorage.removeItem('user_name');
  localStorage.removeItem('user_id');
  USER_NAME = "";
  USER_ID = 0;
  window.location.pathname = "/";
}

// Function to handle login success
function loginSuccess() {
  const redirectPath = localStorage.getItem('redirectAfterLogin') || "/";
  localStorage.removeItem('redirectAfterLogin');
  window.location.pathname = redirectPath;
}

// Function to enter a room
function enterRoom() {
  document.querySelector(".displayRoomName").classList.remove("hide");
  document.querySelector(".editRoomName").classList.add("hide");
  const room_id = localStorage.getItem('current_room');
  fetch(`/api/rooms/${room_id}`, {
    method: 'GET',
    headers: {
      'Authorization': localStorage.getItem('api_key'),
    }
  })
      .then(response => response.json())
      .then(data => {
        document.querySelector(".displayRoomName strong").textContent = data.room_name;
        const inviteLinkElement = document.querySelector("#invite-link");
        inviteLinkElement.href = `/room/${data.room_id}`;
        inviteLinkElement.textContent = `/room/${data.room_id}`;
        document.querySelector(".editRoomName input").value = data.room_name;
        updateUsernameDisplay();
        console.log("userName:", USER_NAME);
        showOnly(ROOM);
        fetchMessages(room_id);
        startMessagePolling();
      })
      .catch(error => console.error('Error entering room:', error));
}


// Function to update username display
function updateUsernameDisplay() {
  const userName = localStorage.getItem('user_name');
  const usernameElements = document.querySelectorAll(".username");

  usernameElements.forEach((elem) => {
    elem.textContent = userName;
  });
}

// Function to fetch messages for a room
function fetchMessages(room_id) {
  fetch(`/api/rooms/${room_id}/messages`, {
    method: "GET",
    headers: {
      "Authorization": localStorage.getItem('api_key'),
    }
  })
      .then(response => response.json())
      .then(data => {
        const messagesContainer = document.querySelector(".messages");
        messagesContainer.innerHTML = ''
        data.forEach(msg => {
          const messageElement = document.createElement("div");
          messageElement.innerHTML = `<author>${msg.author}</author>: <content>${msg.body}</content>`;
          messagesContainer.appendChild(messageElement);
        });
        if(data.length === 0) {
          document.querySelector(".noMessages").classList.remove("hide");
        } else {
          document.querySelector(".noMessages").classList.add("hide");
        }
      })
      .catch(error => console.error('Error fetching messages:', error));
}
