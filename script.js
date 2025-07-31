let publicKey, privateKey;
let memoryGameInProgress = false;

/**
 * Loads RSA keys from localStorage. If no keys are found,
 * it generates a new pair and saves them.
 */
function initializeKeys() {
  publicKey = localStorage.getItem('rsaPublicKey');
  privateKey = localStorage.getItem('rsaPrivateKey');

  if (!publicKey || !privateKey) {
    console.log("No keys found in storage. Generating new ones.");
    generateKeys();
  } else {
    console.log("Keys loaded from storage.");
    document.getElementById("publicKey").value = publicKey;
    document.getElementById("privateKey").value = privateKey;
  }
}

/**
 * Generates a new 2048-bit RSA key pair and saves it
 * to both the application state and localStorage.
 */
function generateKeys() {
  const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  publicKey = forge.pki.publicKeyToPem(keypair.publicKey);
  privateKey = forge.pki.privateKeyToPem(keypair.privateKey);

  // Save the new keys to localStorage for persistence
  localStorage.setItem('rsaPublicKey', publicKey);
  localStorage.setItem('rsaPrivateKey', privateKey);

  document.getElementById("publicKey").value = publicKey;
  document.getElementById("privateKey").value = privateKey;
  alert("New RSA key pair generated and saved to your browser!");
}

/**
 * Removes the stored RSA keys from localStorage after user confirmation.
 * This will prevent decryption of previously created QR codes.
 */
function clearKeys() {
    if (confirm("Are you sure you want to clear the stored RSA keys?\nYou will NOT be able to decrypt old QR codes with these keys.")) {
        localStorage.removeItem('rsaPublicKey');
        localStorage.removeItem('rsaPrivateKey');
        publicKey = null;
        privateKey = null;
        document.getElementById("publicKey").value = '';
        document.getElementById("privateKey").value = '';
        alert("RSA keys cleared from browser storage.");
    }
}

/**
 * Initiates the memory game as a prerequisite for generating a QR code.
 */
function encryptAndGenerateQR() {
  if (!memoryGameInProgress) {
    showMemoryGameModal();
    return;
  }
}

function showMemoryGameModal() {
  memoryGameInProgress = true;
  document.getElementById('memory-game-section').classList.add('active');
  startMemoryGame();
}

// --- Memory Game Implementation ---
function startMemoryGame() {
  const grid = document.getElementById('memoryGameGrid');
  const emojis = ['🐱','🐶','🦁','🐸','🐵','🐼','🦊','🐮'];
  let cards = [...emojis, ...emojis].sort(() => Math.random() - 0.5);

  grid.innerHTML = '';
  let first = null, second = null, lock = false, matched = 0;
  cards.forEach((emoji, i) => {
    const btn = document.createElement('button');
    btn.className = 'memory-card';
    btn.dataset.emoji = emoji;
    btn.dataset.index = i;
    btn.textContent = '';
    btn.onclick = function() {
      if (lock || btn.textContent) return;
      btn.textContent = emoji;
      if (!first) {
        first = btn;
      } else {
        second = btn;
        lock = true;
        setTimeout(() => {
          if (first.dataset.emoji === second.dataset.emoji) {
            matched += 2;
            if (matched === cards.length) {
              setTimeout(() => {
                document.getElementById('memory-game-section').classList.remove('active');
                memoryGameInProgress = false; // Mark game as not in progress
                // --- DIRECTLY generate QR here ---
                generateQRAfterGame();
              }, 300);
            }
          } else {
            first.textContent = '';
            second.textContent = '';
          }
          first = second = null;
          lock = false;
        }, 700);
      }
    };
    grid.appendChild(btn);
  });
}

/**
 * Generates the encrypted QR code after the memory game is successfully completed.
 */
function generateQRAfterGame() {
  if (!publicKey) generateKeys(); // Failsafe in case keys were cleared
  const msg = document.getElementById("message").value;
  if (!msg) {
      alert("Please enter a message to encrypt.");
      return;
  }
  const pub = forge.pki.publicKeyFromPem(publicKey);
  const encrypted = pub.encrypt(msg, "RSA-OAEP");
  const base64 = forge.util.encode64(encrypted);
  new QRious({
    element: document.getElementById("qrCanvas"),
    value: base64,
    size: 250,
  });
  const link = document.getElementById("downloadQR");
  link.href = document.getElementById("qrCanvas").toDataURL();
  link.style.display = "inline-block";
}

// --- Key/QR Management & Decryption ---

function downloadKeys() {
  if (!publicKey || !privateKey) {
      alert("No keys to download. Please generate a pair first.");
      return;
  }
  const blob = new Blob([
    `Public Key:\n${publicKey}\n\nPrivate Key:\n${privateKey}`
  ], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "RSA_Keys.txt";
  a.click();
  URL.revokeObjectURL(url);
}

function handleQRUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);
      if (code) {
          decryptMessage(code.data);
      } else {
          alert("No QR code detected in the uploaded image.");
      }
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function decryptMessage(base64) {
  if (!privateKey) {
      alert("Cannot decrypt. Private key is not available.");
      return;
  }
  try {
    const priv = forge.pki.privateKeyFromPem(privateKey);
    const encryptedBytes = forge.util.decode64(base64);
    const decrypted = priv.decrypt(encryptedBytes, "RSA-OAEP");
    document.getElementById("decrypted").value = decrypted;
  } catch (e) {
      alert("Decryption failed. The private key used does not match the key that encrypted this QR code.");
      console.error("Decryption error:", e);
  }
}

// --- Unused Scanner Functions (for reference) ---
/*
let activeStream = null;

function startScanner() {
  const video = document.getElementById("video");
  const stopBtn = document.getElementById("stopScanBtn");

  if (!privateKey) {
    alert("Private key not loaded. Please generate or import your private key before scanning.");
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } })
    .then((stream) => {
      activeStream = stream;
      video.srcObject = stream;
      video.setAttribute("playsinline", true);
      video.setAttribute("autoplay", true);
      video.setAttribute("muted", true);
      video.play();
      stopBtn.style.display = "inline-block";

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const scan = () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, canvas.width, canvas.height);

          if (code) {
            decryptMessage(code.data);
            stopScanner();
          } else {
            requestAnimationFrame(scan);
          }
        } else {
          requestAnimationFrame(scan);
        }
      };
      requestAnimationFrame(scan);
    })
    .catch((err) => {
      console.error("Camera access error:", err);
      alert("Unable to access camera. Please allow permission and try again.");
    });
}

function stopScanner() {
  const stopBtn = document.getElementById("stopScanBtn");
  stopBtn.style.display = "none";
  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }
  document.getElementById("video").srcObject = null;
}
*/

// --- Event Listeners ---

document.getElementById("modeToggle").addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
});

// Initialize the keys when the page loads.
window.onload = initializeKeys;