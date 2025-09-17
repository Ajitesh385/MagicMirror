const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const debugBox = document.getElementById("debug");

const userForm = document.getElementById("userForm");
const userNameInput = document.getElementById("userName");
const userDOBInput = document.getElementById("userDOB");
const submitUserBtn = document.getElementById("submitUser");

let currentUser = null; // Stores the current detected user

function logDebug(msg) {
  console.log(msg);
  debugBox.textContent = msg;
}

// --- Load face-api models ---
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights'),
  faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights'),
  faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights'),
  faceapi.nets.faceExpressionNet.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights')
])
.then(() => logDebug("Models loaded ✅"))
.then(startVideo)
.catch(err => logDebug("❌ Model load failed: " + err));

// --- Start webcam ---
function startVideo() {
  navigator.mediaDevices.getUserMedia({ video: {} })
    .then(stream => {
      video.srcObject = stream;
      logDebug("Camera started 🎥");
    })
    .catch(err => logDebug("❌ Webcam error: " + err));
}

// --- Zodiac helper ---
function getZodiacSign(dob) {
  const [year, month, day] = dob.split("-").map(Number);
  const zodiac = [
    { sign: "capricorn", start: [12, 22], end: [1, 19] },
    { sign: "aquarius", start: [1, 20], end: [2, 18] },
    { sign: "pisces", start: [2, 19], end: [3, 20] },
    { sign: "aries", start: [3, 21], end: [4, 19] },
    { sign: "taurus", start: [4, 20], end: [5, 20] },
    { sign: "gemini", start: [5, 21], end: [6, 20] },
    { sign: "cancer", start: [6, 21], end: [7, 22] },
    { sign: "leo", start: [7, 23], end: [8, 22] },
    { sign: "virgo", start: [8, 23], end: [9, 22] },
    { sign: "libra", start: [9, 23], end: [10, 22] },
    { sign: "scorpio", start: [10, 23], end: [11, 21] },
    { sign: "sagittarius", start: [11, 22], end: [12, 21] },
  ];
  for (const z of zodiac) {
    if ((month === z.start[0] && day >= z.start[1]) || (month === z.end[0] && day <= z.end[1])) return z.sign;
  }
  return "capricorn";
}

// --- Local storage helpers ---
function getUser(name) {
  const users = JSON.parse(localStorage.getItem("users") || "{}");
  return users[name];
}

function saveUser(name, dob) {
  const users = JSON.parse(localStorage.getItem("users") || "{}");
  users[name] = { dob };
  localStorage.setItem("users", JSON.stringify(users));
}

// --- Fetch horoscope ---
async function fetchHoroscope(sign) {
  try {
    const proxy = "https://api.allorigins.win/get?url=";
    const url = encodeURIComponent(`https://aztro.sameerkumar.website/?sign=${sign}&day=today`);
    const res = await fetch(proxy + url, { method: "POST" }); // wrap in proxy
    const data = await res.json();
    return JSON.parse(data.contents); // the actual JSON from Aztro
  } catch (err) {
    console.error("Horoscope fetch failed", err);
    return {
      mood: "Happy",
      lucky_number: "7",
      color: "Blue",
      description: "Have a wonderful day!"
    }; // fallback dummy horoscope
  }
}


// --- Draw info card ---
function drawInfoCard(ctx, x, y, lines) {
  const w = 250, h = lines.length * 22 + 20;
  ctx.fillStyle = "rgba(40,40,40,0.7)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "white";
  ctx.font = "14px Segoe UI";
  lines.forEach((line, i) => ctx.fillText(line, x + 10, y + 20 + i*20));
}

// --- Handle form submit ---
submitUserBtn.addEventListener("click", () => {
  const name = userNameInput.value.trim();
  const dob = userDOBInput.value;
  if (name && dob) {
    saveUser(name, dob);
    currentUser = { name, dob };
    userForm.classList.add("hidden");
  }
});

// --- Main detection loop ---
video.addEventListener("play", async () => {
  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);
  const ctx = canvas.getContext("2d");

  setInterval(async () => {
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions();

    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    faceapi.draw.drawDetections(canvas, resizedDetections);
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

    for (const det of resizedDetections) {
      const box = det.detection.box;

      // If we don't have a current user, show the form
      if (!currentUser) {
        userForm.classList.remove("hidden");
        return;
      }

      const name = currentUser.name;
      const sign = getZodiacSign(currentUser.dob);
      const horoscope = await fetchHoroscope(sign);

      if (horoscope) {
        const lines = [
          `Good Morning ${name}!`,
          `Sign: ${sign}`,
          `Mood: ${horoscope.mood}`,
          `Lucky #: ${horoscope.lucky_number}`,
          `Color: ${horoscope.color}`,
          `"${horoscope.description}"`
        ];
        drawInfoCard(ctx, box.right + 10, box.top, lines);
      }
    }
  }, 1500);
});
