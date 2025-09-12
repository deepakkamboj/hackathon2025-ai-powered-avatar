var recognizer;
var isRecording = false;
// Set API base URL for all backend requests
const API_BASE_URL = "http://localhost:7071/api";
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

function getSystemPrompt(assistantName) {
  return `
You are ${assistantName}, a friendly AI assistant developed by CoffeeCorp LLC for Microsoft Hackathon 2025.
You represent CoffeeCorp LLC's Agentic RAG technology, which combines Retrieval-Augmented Generation with function calling.
You help attendees with coffee orders, provide information about CoffeeCorp LLC, information about Deepak Kamboj, and answer questions about the weather.

When taking coffee orders:
1. Get the customer's name
2. Ask what coffee(s) they want to order
3. For each coffee item:
  a. Get their coffee preference (Cafe Mocha, Macchiato, Latte, Cappuccino, or Espresso)
  b. Get their size preference (Small, Medium, or Large)
  c. Ask if they want any syrups (Vanilla, Chocolate, Caramel, Hazelnut, or None)
  d. Ask about shot type (Single or Double)
  e. Ask about milk preference (2% Milk, Oat Milk, or None)
4. Ask if they want to add another coffee to their order
5. Confirm all items in the order before placing it
6. ALWAYS provide a summary of the order at the end
7. ALWAYS provide an order ID for the order
8. If quantity not provided, assume 1 item

You can also help customers check their order status or cancel an order by asking for:
1. Their name
2. The order ID they want to check or cancel

When providing company information:
- Always refer to the company as "CoffeeCorp LLC"
- Be enthusiastic about CoffeeCorp LLC's services and mission

When you don't know the answer to a question:
- Always respond promptly with "I don't have information about that specific topic."
- Offer to help with something you do know about instead
- Suggest they speak with a human representative for more assistance
- Never get stuck in a loop or remain silent

Remember to:
- Be friendly and conversational
- Keep responses clear and concise
- Always provide some response, even if it's to acknowledge you can't help with that specific request
- Don't use markdown or special formatting
- Handle complex coffee orders with multiple different items gracefully
- If a query is ambiguous, ask a clarifying question instead of guessing
`;
}

var TalkingAvatarCharacter = "Meg";
var system_prompt = getSystemPrompt(TalkingAvatarCharacter);

var TTSVoice = "en-US-AvaMultilingualNeural"; // Update this value if you want to use a different voices
const CogSvcRegion = "westus2"; // Fill your Azure cognitive services region here, e.g. westus2
// TalkingAvatarCharacter is set above and updated on login
var TalkingAvatarStyle = "formal";
const continuousRecording = false;

supported_languages = ["en-US", "de-DE", "zh-CN", "fr-FR"]; // The language detection engine supports a maximum of 4 languages

const speechSynthesisConfig = SpeechSDK.SpeechConfig.fromEndpoint(
  new URL(
    "wss://{region}.tts.speech.microsoft.com/cognitiveservices/websocket/v1?enableTalkingAvatar=true".replace(
      "{region}",
      CogSvcRegion
    )
  )
);

// Global objects
var speechSynthesizer;
var avatarSynthesizer;
var peerConnection;
var previousAnimationFrameTimestamp = 0;
var messages = [{ role: "system", content: system_prompt }];
var sentenceLevelPunctuations = [
  ".",
  "?",
  "!",
  ":",
  ";",
  "。",
  "？",
  "！",
  "：",
  "；",
];
var isSpeaking = false;
var spokenTextQueue = [];
var lastSpeakTime;
let token;

// Microphone selection
let availableMics = [];
let selectedMicId = null;

function showMicSettingsDialog() {
  // Create dialog if not exists
  let dlg = document.getElementById("micSettingsDialog");
  if (!dlg) {
    dlg = document.createElement("div");
    dlg.id = "micSettingsDialog";
    dlg.style.position = "fixed";
    dlg.style.top = "20%";
    dlg.style.left = "50%";
    dlg.style.transform = "translate(-50%, 0)";
    dlg.style.background = "#fff";
    dlg.style.border = "1px solid #ccc";
    dlg.style.padding = "24px";
    dlg.style.zIndex = 10000;
    dlg.innerHTML = `
      <h3>Select Microphone</h3>
      <select id="micSelect"></select>
      <button id="testMicBtn">Test Mic</button>
      <span id="micTestResult" style="margin-left:10px;"></span>
      <br><br>
      <button id="closeMicDlg">Close</button>
    `;
    document.body.appendChild(dlg);
    document.getElementById("closeMicDlg").onclick = () => dlg.remove();
    document.getElementById("testMicBtn").onclick = testSelectedMic;
    document.getElementById("micSelect").onchange = function () {
      selectedMicId = this.value;
      updateMicStatusFooter();
    };
  }
  // Populate mic list
  navigator.mediaDevices.enumerateDevices().then((devices) => {
    availableMics = devices.filter((d) => d.kind === "audioinput");
    let sel = document.getElementById("micSelect");
    sel.innerHTML = "";
    availableMics.forEach((d) => {
      let opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || `Microphone (${d.deviceId.substr(0, 6)})`;
      sel.appendChild(opt);
    });
    if (availableMics.length > 0) {
      sel.value = selectedMicId || availableMics[0].deviceId;
      selectedMicId = sel.value;
      updateMicStatusFooter();
    }
  });
  dlg.style.display = "block";
}

function testSelectedMic() {
  let micId = document.getElementById("micSelect").value;
  let resultSpan = document.getElementById("micTestResult");
  if (!micId) {
    resultSpan.textContent = "No mic selected";
    updateMicStatusFooter("No mic selected");
    return;
  }
  navigator.mediaDevices
    .getUserMedia({ audio: { deviceId: micId } })
    .then((stream) => {
      resultSpan.textContent = "Mic is working!";
      updateMicStatusFooter("Mic is working!");
      setTimeout(() => (resultSpan.textContent = ""), 2000);
      stream.getTracks().forEach((t) => t.stop());
    })
    .catch((err) => {
      resultSpan.textContent = "Mic error: " + err.name;
      updateMicStatusFooter("Mic error: " + err.name);
    });
}
// Update mic status in the footer
function updateMicStatusFooter(statusOverride) {
  let footerDiv = document.getElementById("micStatusFooter");
  if (!footerDiv) return;

  if (statusOverride) {
    footerDiv.textContent = `Mic: Default microphone — ${statusOverride}`;
  } else {
    footerDiv.textContent = "Mic: Default microphone is selected";
  }
}

// Setup WebRTC
function setupWebRTC() {
  // Create WebRTC peer connection
  fetch(`${API_BASE_URL}/get-ice-server-token`, {
    method: "POST",
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(
          `/get-ice-server-token failed: ${res.status} ${res.statusText}`
        );
      }
      const reponseJson = await res.json();
      console.log("/get-ice-server-token response:", reponseJson);
      try {
        peerConnection = new RTCPeerConnection({
          iceServers: [
            {
              urls: reponseJson["Urls"],
              username: reponseJson["Username"],
              credential: reponseJson["Password"],
            },
          ],
        });
      } catch (err) {
        console.error("Error creating RTCPeerConnection:", err);
        alert("WebRTC connection failed: " + err.message);
        return;
      }

      // Fetch WebRTC video stream and mount it to an HTML video element
      peerConnection.ontrack = function (event) {
        console.log("peerconnection.ontrack", event);
        // Clean up existing video element if there is any
        remoteVideoDiv = document.getElementById("remoteVideo");
        for (var i = 0; i < remoteVideoDiv.childNodes.length; i++) {
          if (remoteVideoDiv.childNodes[i].localName === event.track.kind) {
            remoteVideoDiv.removeChild(remoteVideoDiv.childNodes[i]);
          }
        }

        const videoElement = document.createElement(event.track.kind);
        videoElement.id = event.track.kind;
        videoElement.srcObject = event.streams[0];
        videoElement.autoplay = true;
        videoElement.controls = false;
        document.getElementById("remoteVideo").appendChild(videoElement);

        canvas = document.getElementById("canvas");
        remoteVideoDiv.hidden = true;
        canvas.hidden = false;

        videoElement.addEventListener("play", () => {
          remoteVideoDiv.style.width = videoElement.videoWidth / 2 + "px";
          window.requestAnimationFrame(makeBackgroundTransparent);
        });
      };

      // Make necessary update to the web page when the connection state changes
      peerConnection.oniceconnectionstatechange = (e) => {
        console.log("WebRTC status: " + peerConnection.iceConnectionState);

        if (peerConnection.iceConnectionState === "connected") {
          document.getElementById("loginOverlay").classList.add("hidden");
        }

        if (peerConnection.iceConnectionState === "disconnected") {
        }
      };

      // Offer to receive 1 audio, and 1 video track
      peerConnection.addTransceiver("video", { direction: "sendrecv" });
      peerConnection.addTransceiver("audio", { direction: "sendrecv" });

      // start avatar, establish WebRTC connection
      avatarSynthesizer
        .startAvatarAsync(peerConnection)
        .then((r) => {
          if (r.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            console.log(
              "[" +
                new Date().toISOString() +
                "] Avatar started. Result ID: " +
                r.resultId
            );
            greeting();
          } else {
            console.log(
              "[" +
                new Date().toISOString() +
                "] Unable to start avatar. Result ID: " +
                r.resultId
            );
            if (r.reason === SpeechSDK.ResultReason.Canceled) {
              let cancellationDetails =
                SpeechSDK.CancellationDetails.fromResult(r);
              if (
                cancellationDetails.reason ===
                SpeechSDK.CancellationReason.Error
              ) {
                console.log(cancellationDetails.errorDetails);
              }
              console.log(
                "Unable to start avatar: " + cancellationDetails.errorDetails
              );
            }
          }
        })
        .catch((error) => {
          console.log(
            "[" +
              new Date().toISOString() +
              "] Avatar failed to start. Error: " +
              error
          );
          document.getElementById("startSession").disabled = false;
          document.getElementById("configuration").hidden = false;
          alert("Avatar start failed: " + error.message);
        });
    })
    .catch((err) => {
      console.error(
        "Error in setupWebRTC (get-ice-server-token or setup):",
        err
      );
      alert("WebRTC setup failed: " + err.message);
    });
}

function handleUserQuery(userQuery, userQueryHTML) {
  let contentMessage = userQuery;
  console.log("handleUserQuery", contentMessage);

  let chatMessage = {
    role: "user",
    content: contentMessage,
  };

  messages.push(chatMessage);
  addToConversationHistory(contentMessage, "dark");
  if (isSpeaking) {
    stopSpeaking();
  }

  let body = JSON.stringify({
    messages: messages,
  });

  let assistantReply = "";
  let spokenSentence = "";
  let displaySentence = "";
  let sentenceCount = 0; // Track number of sentences for speaking strategy
  let hasSpokenDuringStream = false; // Track if we've already spoken during streaming

  fetch(`${API_BASE_URL}/get-oai-response`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body,
  }).then(async (res) => {
    if (!res.body) {
      throw new Error("No response body from /get-oai-response");
    }
    const reader = res.body.getReader();
    let buffer = "";
    function read() {
      return reader.read().then(({ value, done }) => {
        if (done) {
          // Speak any remaining text at the end of stream only if we haven't spoken yet
          if (spokenSentence.trim() !== "" && !hasSpokenDuringStream) {
            console.log(
              "[TTS] Speaking (end of stream):",
              spokenSentence.trim()
            );
            speak(spokenSentence.trim());
          }
          // Add final assistant message
          if (assistantReply.trim() !== "") {
            messages.push({
              role: "assistant",
              content: assistantReply.trim(),
            });
            // Speak the full assistant reply only if nothing was spoken during streaming
            if (!hasSpokenDuringStream && assistantReply.trim()) {
              console.log(
                "[TTS] Speaking (full reply - no streaming speech):",
                assistantReply.trim()
              );
              speak(assistantReply.trim());
            }
          }
          return;
        }
        buffer += new TextDecoder().decode(value, { stream: true });
        let lines = buffer.split("\n");
        buffer = lines.pop(); // last line may be incomplete
        for (const line of lines) {
          if (!line.trim()) continue;
          let parsed;
          try {
            parsed = JSON.parse(line);
          } catch (e) {
            console.log("Error parsing chunk:", e, line);
            continue;
          }
          console.log("[OAI Stream Chunk]", parsed);
          // Handle product card if detected
          if (parsed && parsed.image_url) {
            console.log("[ProductCard]", parsed);
            addProductToChatHistory(parsed);
            continue;
          }
          // Handle assistant text
          if (
            parsed &&
            parsed.choices &&
            parsed.choices[0] &&
            parsed.choices[0].delta &&
            parsed.choices[0].delta.content
          ) {
            const text = parsed.choices[0].delta.content;
            console.log("[AssistantDelta]", text);
            assistantReply += text;
            spokenSentence += text;
            displaySentence += text;
            // Speak after collecting more substantial content (multiple sentences or longer text)
            if (sentenceLevelPunctuations.some((p) => text.endsWith(p))) {
              sentenceCount++;
              // Only speak after accumulating 2+ sentences or if we have substantial content
              if (sentenceCount >= 2 || spokenSentence.trim().length > 100) {
                console.log(
                  "[TTS] Speaking (accumulated sentences):",
                  spokenSentence.trim()
                );
                speak(spokenSentence.trim());
                hasSpokenDuringStream = true; // Mark that we've spoken during streaming
                spokenSentence = "";
                sentenceCount = 0; // Reset for next batch
              }
            }
          }
        }
        if (displaySentence !== "") {
          console.log("[AssistantDisplay]", displaySentence);
          addToConversationHistory(displaySentence, "light");
          displaySentence = "";
        }
        return read();
      });
    }
    return read();
  });
}

// Speak the given text
function speak(text, endingSilenceMs = 0) {
  if (isSpeaking) {
    spokenTextQueue.push(text);
    return;
  }

  speakNext(text, endingSilenceMs);
}

function speakNext(text, endingSilenceMs = 0) {
  // Add leading silence to prevent cutting off start of speech
  let ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'><voice name='${TTSVoice}'><mstts:leadingsilence-exact value='500ms'/>${text}</voice></speak>`;
  if (endingSilenceMs > 0) {
    ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'><voice name='${TTSVoice}'><mstts:leadingsilence-exact value='500ms'/>${text}<break time='${endingSilenceMs}ms' /></voice></speak>`;
  }

  lastSpeakTime = new Date();
  isSpeaking = true;
  avatarSynthesizer
    .speakSsmlAsync(ssml)
    .then((result) => {
      if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
        console.log(
          `Speech synthesized to speaker for text [ ${text} ]. Result ID: ${result.resultId}`
        );

        lastSpeakTime = new Date();
      } else {
        console.log(
          `Error occurred while speaking the SSML. Result ID: ${result.resultId}`
        );
      }

      if (spokenTextQueue.length > 0) {
        speakNext(spokenTextQueue.shift());
      } else {
        isSpeaking = false;
        // Automatically start recording when avatar finishes speaking
        setTimeout(() => {
          if (!isRecording) {
            console.log(
              "[Auto] Starting recording after avatar finished speaking"
            );
            window.startRecording();
          }
        }, 500); // Small delay to ensure speech has fully completed
      }
    })
    .catch((error) => {
      console.log(`Error occurred while speaking the SSML: [ ${error} ]`);

      if (spokenTextQueue.length > 0) {
        speakNext(spokenTextQueue.shift());
      } else {
        isSpeaking = false;
        // Automatically start recording when avatar finishes speaking (even on error)
        setTimeout(() => {
          if (!isRecording) {
            console.log(
              "[Auto] Starting recording after avatar finished speaking (error case)"
            );
            window.startRecording();
          }
        }, 500);
      }
    });
}

function stopSpeaking() {
  spokenTextQueue = [];
  avatarSynthesizer
    .stopSpeakingAsync()
    .then(() => {
      isSpeaking = false;
      console.log(
        "[" + new Date().toISOString() + "] Stop speaking request sent."
      );
      // Automatically start recording when avatar is manually stopped
      setTimeout(() => {
        if (!isRecording) {
          console.log("[Auto] Starting recording after manual stop speaking");
          window.startRecording();
        }
      }, 500);
    })
    .catch((error) => {
      console.log("Error occurred while stopping speaking: " + error);
    });
}

// Connect to TTS Avatar API
function connectToAvatarService() {
  // Construct TTS Avatar service request
  let videoCropTopLeftX = 600;
  let videoCropBottomRightX = 1320;
  let backgroundColor = "#00FF00FF";

  const videoFormat = new SpeechSDK.AvatarVideoFormat();
  videoFormat.setCropRange(
    new SpeechSDK.Coordinate(videoCropTopLeftX, 0),
    new SpeechSDK.Coordinate(videoCropBottomRightX, 1080)
  );

  TalkingAvatarCharacter = document.getElementById("avatar-name").value;
  switch (TalkingAvatarCharacter) {
    case "Lisa":
      TalkingAvatarStyle = "casual-sitting";
      break;
    case "Meg":
      TalkingAvatarStyle = "casual";
      break;
    case "Mark":
      TalkingAvatarStyle = "formal";
      break;
  }

  const avatarConfig = new SpeechSDK.AvatarConfig(
    TalkingAvatarCharacter,
    TalkingAvatarStyle,
    videoFormat
  );
  avatarConfig.backgroundColor = backgroundColor;

  try {
    avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(
      speechSynthesisConfig,
      avatarConfig
    );
    avatarSynthesizer.avatarEventReceived = function (s, e) {
      var offsetMessage =
        ", offset from session start: " + e.offset / 10000 + "ms.";
      if (e.offset === 0) {
        offsetMessage = "";
      }
      console.log("Event received: " + e.description + offsetMessage);
    };
  } catch (err) {
    console.error("Error in connectToAvatarService:", err);
    alert("Avatar service connection failed: " + err.message);
  }
}

window.startSession = () => {
  // Update system prompt and messages with selected assistant name
  TalkingAvatarCharacter = document.getElementById("avatar-name").value;
  system_prompt = getSystemPrompt(TalkingAvatarCharacter);
  messages = [{ role: "system", content: system_prompt }];
  var iconElement = document.createElement("i");
  iconElement.className = "fa fa-spinner fa-spin";
  iconElement.id = "loadingIcon";
  var parentElement = document.getElementById("playVideo");
  parentElement.prepend(iconElement);

  TTSVoice = document.getElementById("avatar-voice").value;

  speechSynthesisConfig.speechSynthesisVoiceName = TTSVoice;
  document.getElementById("playVideo").className = "round-button-hide";

  fetch(`${API_BASE_URL}/get-speech-token`, {
    method: "GET",
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(
          `/get-speech-token failed: ${res.status} ${res.statusText}`
        );
      }
      const responseJson = await res.json();
      console.log("/get-speech-token response:", responseJson); // Log output from server
      speechSynthesisConfig.authorizationToken = responseJson.token;
      token = responseJson.token;
    })
    .then(() => {
      speechSynthesizer = new SpeechSDK.SpeechSynthesizer(
        speechSynthesisConfig,
        null
      );
      connectToAvatarService();
      setupWebRTC();
    })
    .catch((err) => {
      console.error("Error in startSession (get-speech-token or setup):", err);
      alert("Login failed: " + err.message);
    });
};

async function greeting() {
  text = `Hi, my name is ${TalkingAvatarCharacter}. How can I help you?`;
  addToConversationHistory(text, "light");

  // Add leading silence to prevent cutting off start of greeting
  var spokenText = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'><voice name='${TTSVoice}'><mstts:leadingsilence-exact value='500ms'/>${text}</voice></speak>`;

  console.log("spokenText", spokenText);
  avatarSynthesizer.speakSsmlAsync(spokenText, (result) => {
    if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
      console.log(
        "Speech synthesized to speaker for text [ " +
          spokenText +
          " ]. Result ID: " +
          result.resultId
      );
      // Automatically start recording after greeting
      setTimeout(() => {
        if (!isRecording) {
          console.log("[Auto] Starting recording after greeting");
          window.startRecording();
        }
      }, 1000); // Longer delay for greeting to ensure it's fully processed
    } else {
      console.log("Unable to speak text. Result ID: " + result.resultId);
      if (result.reason === SpeechSDK.ResultReason.Canceled) {
        let cancellationDetails =
          SpeechSDK.CancellationDetails.fromResult(result);
        console.log(cancellationDetails.reason);
        if (cancellationDetails.reason === SpeechSDK.CancellationReason.Error) {
          console.log(cancellationDetails.errorDetails);
        }
      }
    }
  });
}

window.stopSession = () => {
  speechSynthesizer.close();
};

window.toggleRecording = () => {
  if (isRecording) {
    window.stopRecording();
  } else {
    window.startRecording();
  }
};

window.startRecording = () => {
  if (isRecording) return;

  console.log("[Speech] Starting recording with default microphone");

  const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
    token,
    "westus2"
  );
  speechConfig.authorizationToken = token;
  speechConfig.SpeechServiceConnection_LanguageIdMode = "Continuous";
  var autoDetectSourceLanguageConfig =
    SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(supported_languages);

  document.getElementById("buttonIcon").className = "fas fa-stop";
  document.getElementById("startRecording").disabled = false;

  // Use the old working pattern from backup file - no audio config needed
  recognizer = SpeechSDK.SpeechRecognizer.FromConfig(
    speechConfig,
    autoDetectSourceLanguageConfig
  );

  recognizer.recognized = function (s, e) {
    console.log("[SpeechRecognizer] recognized event:", e);
    if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
      let userQuery = e.result.text.trim();
      if (userQuery === "") {
        return;
      }
      console.log("Recognized:", e.result.text);
      if (!continuousRecording) {
        window.stopRecording();
      }
      handleUserQuery(e.result.text, "", "");
    } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
      console.log("[SpeechRecognizer] NoMatch:", e.result);
    }
  };

  recognizer.canceled = function (s, e) {
    console.error("[SpeechRecognizer] canceled event:", e);
  };

  recognizer.sessionStarted = function (s, e) {
    console.log("[SpeechRecognizer] sessionStarted:", e);
  };
  recognizer.sessionStopped = function (s, e) {
    console.log("[SpeechRecognizer] sessionStopped:", e);
  };
  recognizer.speechStartDetected = function (s, e) {
    console.log("[SpeechRecognizer] speechStartDetected:", e);
  };
  recognizer.speechEndDetected = function (s, e) {
    console.log("[SpeechRecognizer] speechEndDetected:", e);
  };

  recognizer.startContinuousRecognitionAsync(
    function () {
      isRecording = true;
      document.getElementById("buttonIcon").className = "fas fa-stop";
      document.getElementById("startRecording").disabled = false;
      console.log("Recording started.");
    },
    function (err) {
      isRecording = false;
      document.getElementById("buttonIcon").className = "fas fa-microphone";
      document.getElementById("startRecording").disabled = false;
      console.error("Error starting recording:", err);
    }
  );
};

window.stopRecording = () => {
  if (!isRecording) return;
  if (recognizer) {
    recognizer.stopContinuousRecognitionAsync(
      function () {
        recognizer.close();
        recognizer = undefined;
        isRecording = false;
        document.getElementById("buttonIcon").className = "fas fa-microphone";
        document.getElementById("startRecording").disabled = false;
        console.log("Recording stopped.");
      },
      function (err) {
        isRecording = false;
        document.getElementById("buttonIcon").className = "fas fa-microphone";
        document.getElementById("startRecording").disabled = false;
        console.error("Error stopping recording:", err);
      }
    );
  }
};
// Attach toggleRecording to mic button
window.addEventListener("DOMContentLoaded", () => {
  const micBtn = document.getElementById("startRecording");
  if (micBtn) {
    micBtn.onclick = window.toggleRecording;
  }
  // Add persistent settings button for mic (top right corner)
  let settingsBtn = document.getElementById("micSettingsBtn");
  if (!settingsBtn) {
    settingsBtn = document.createElement("button");
    settingsBtn.id = "micSettingsBtn";
    settingsBtn.textContent = "Mic Settings";
    settingsBtn.style.position = "fixed";
    settingsBtn.style.top = "16px";
    settingsBtn.style.right = "16px";
    settingsBtn.style.zIndex = 10001;
    settingsBtn.style.background = "#fff";
    settingsBtn.style.border = "1px solid #ccc";
    settingsBtn.style.padding = "8px 16px";
    settingsBtn.style.borderRadius = "6px";
    settingsBtn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
    settingsBtn.style.cursor = "pointer";
    document.body.appendChild(settingsBtn);
    settingsBtn.onclick = showMicSettingsDialog;
  }
  // Initialize mic status footer with default mic
  navigator.mediaDevices.enumerateDevices().then((devices) => {
    availableMics = devices.filter((d) => d.kind === "audioinput");
    if (availableMics.length > 0) {
      selectedMicId = availableMics[0].deviceId;
      updateMicStatusFooter();
    } else {
      updateMicStatusFooter("No microphone detected");
    }
  });
});

window.submitText = () => {
  document.getElementById("spokenText").textContent =
    document.getElementById("textinput").currentValue;
  document.getElementById("textinput").currentValue = "";
  window.speak(document.getElementById("textinput").currentValue);
};

function formatChatContent(text) {
  // First, split into paragraphs and process each one
  let paragraphs = text.split(/\n\s*\n/);

  let formattedText = paragraphs
    .map((paragraph) => {
      // Convert numbered lists (1. 2. 3. etc.) - add line breaks before numbers
      paragraph = paragraph.replace(/(\d+\.\s+)/g, "<br/>$1");

      // Convert bullet points (- or * at start of line)
      paragraph = paragraph.replace(/^[\-\*]\s+/gm, "<br/>• ");

      // Convert single line breaks to <br/>
      paragraph = paragraph.replace(/\n/g, "<br/>");

      return paragraph;
    })
    .join("<br/><br/>");

  // Remove extra breaks at the beginning
  formattedText = formattedText.replace(/^(<br\/>)+/, "");

  // Clean up multiple consecutive breaks
  formattedText = formattedText.replace(/(<br\/>){3,}/g, "<br/><br/>");

  return formattedText;
}

function addToConversationHistory(item, historytype) {
  const list = document.getElementById("chathistory");
  if (list.children.length !== 0) {
    const lastItem = list.lastChild;
    if (lastItem.classList.contains(`message--${historytype}`)) {
      // Format the new content and append it
      const formattedItem = formatChatContent(item);
      lastItem.innerHTML += formattedItem;
      return;
    }
  }
  const newItem = document.createElement("li");
  newItem.classList.add("message");
  newItem.classList.add(`message--${historytype}`);

  // Format the content before setting it
  const formattedItem = formatChatContent(item);
  newItem.innerHTML = formattedItem;

  list.appendChild(newItem);
}

function addProductToChatHistory(product) {
  const list = document.getElementById("chathistory");
  const listItem = document.createElement("li");
  listItem.classList.add("product");
  listItem.innerHTML = `
    <fluent-card class="product-card">
      <div class="product-card__header">
        <img src="${product.image_url}" alt="tent" width="100%">
      </div>
      <div class="product-card__content">
        <div><span class="product-card__price">$${product.special_offer}</span> <span class="product-card__old-price">$${product.original_price}</span></div>
        <div>${product.tagline}</div>
      </div>
    </fluent-card>
  `;
  list.appendChild(listItem);
}

// Make video background transparent by matting
function makeBackgroundTransparent(timestamp) {
  // Throttle the frame rate to 30 FPS to reduce CPU usage
  if (timestamp - previousAnimationFrameTimestamp > 30) {
    video = document.getElementById("video");
    tmpCanvas = document.getElementById("tmpCanvas");
    tmpCanvasContext = tmpCanvas.getContext("2d", { willReadFrequently: true });
    tmpCanvasContext.drawImage(
      video,
      0,
      0,
      video.videoWidth,
      video.videoHeight
    );
    if (video.videoWidth > 0) {
      let frame = tmpCanvasContext.getImageData(
        0,
        0,
        video.videoWidth,
        video.videoHeight
      );
      for (let i = 0; i < frame.data.length / 4; i++) {
        let r = frame.data[i * 4 + 0];
        let g = frame.data[i * 4 + 1];
        let b = frame.data[i * 4 + 2];

        if (g - 150 > r + b) {
          // Set alpha to 0 for pixels that are close to green
          frame.data[i * 4 + 3] = 0;
        } else if (g + g > r + b) {
          // Reduce green part of the green pixels to avoid green edge issue
          adjustment = (g - (r + b) / 2) / 3;
          r += adjustment;
          g -= adjustment * 2;
          b += adjustment;
          frame.data[i * 4 + 0] = r;
          frame.data[i * 4 + 1] = g;
          frame.data[i * 4 + 2] = b;
          // Reduce alpha part for green pixels to make the edge smoother
          a = Math.max(0, 255 - adjustment * 4);
          frame.data[i * 4 + 3] = a;
        }
      }

      canvas = document.getElementById("canvas");
      canvasContext = canvas.getContext("2d");
      canvasContext.putImageData(frame, 0, 0);
    }

    previousAnimationFrameTimestamp = timestamp;
  }

  window.requestAnimationFrame(makeBackgroundTransparent);
}
