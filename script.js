let publicKey, privateKey;

function generateKeys() {
  const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  publicKey = forge.pki.publicKeyToPem(keypair.publicKey);
  privateKey = forge.pki.privateKeyToPem(keypair.privateKey);
  document.getElementById("publicKey").value = publicKey;
  document.getElementById("privateKey").value = privateKey;
}

function encryptAndGenerateQR() {
  if (!publicKey) generateKeys();
  const msg = document.getElementById("message").value;
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

function downloadKeys() {
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
      if (code) decryptMessage(code.data);
      else alert("No QR code detected in uploaded image.");
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function decryptMessage(base64) {
  if (!privateKey) return;
  const priv = forge.pki.privateKeyFromPem(privateKey);
  const encryptedBytes = forge.util.decode64(base64);
  const decrypted = priv.decrypt(encryptedBytes, "RSA-OAEP");
  document.getElementById("decrypted").value = decrypted;
}

let activeStream = null;

function startScanner() {
  const video = document.getElementById("video");
  const stopBtn = document.getElementById("stopScanBtn");

  if (!privateKey) {
    alert("Private key not loaded. Please import or generate your private key before scanning.");
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } })
    .then((stream) => {
      activeStream = stream;
      video.srcObject = stream;

      // Mobile compatibility
      video.setAttribute("playsinline", true);
      video.setAttribute("autoplay", true);
      video.setAttribute("muted", true);
      video.play();

      stopBtn.style.display = "inline-block";

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      let scanAttempts = 0;

      const scan = () => {
        scanAttempts++;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, canvas.width, canvas.height);

          if (code) {
            decryptMessage(code.data);
            stopScanner();
          } else if (scanAttempts > 20) {
            alert("No QR code detected. Try adjusting the camera or lighting.");
            stopScanner();
          } else {
            setTimeout(() => requestAnimationFrame(scan), 500);
          }
        } else {
          requestAnimationFrame(scan);
        }
      };

      // Only start scanning after video metadata is loaded
      video.addEventListener('loadedmetadata', () => {
        requestAnimationFrame(scan);
      }, { once: true });
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

document.getElementById("modeToggle").addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
});

document.getElementById("stopScanBtn").addEventListener("click", stopScanner);

window.onload = generateKeys;
