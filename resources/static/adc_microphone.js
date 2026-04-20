var audioRecorder;

/*
* Helper: return a supported audio mime type for this browser
*/
function getSupportedAudioMimeType() {
    if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
        return "";
    }

    var mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/ogg"
    ];

    for (var i = 0; i < mimeTypes.length; i++) {
        if (MediaRecorder.isTypeSupported(mimeTypes[i])) {
            return mimeTypes[i];
        }
    }

    return "";
}

/*
* Helper: map mime type to file extension
*/
function getAudioFileExtension(blob) {
    if (!blob || !blob.type) {
        return "webm";
    }

    var mimeType = blob.type.toLowerCase();

    if (mimeType.indexOf("webm") > -1) {
        return "webm";
    }
    if (mimeType.indexOf("mp4") > -1 || mimeType.indexOf("aac") > -1 || mimeType.indexOf("mpeg") > -1) {
        return "mp4";
    }
    if (mimeType.indexOf("ogg") > -1) {
        return "ogg";
    }
    if (mimeType.indexOf("wav") > -1) {
        return "wav";
    }

    return "webm";
}

/*
* Helper: return a filename for the current audio blob
*/
function getAudioFileName(blob, baseName) {
    return (baseName || "my_audio") + "." + getAudioFileExtension(blob);
}

/*
* Helper: safely set srcObject for media elements
*/
function setSrcObject(stream, element) {
    if ("srcObject" in element) {
        element.srcObject = stream;
    } else {
        element.src = window.URL.createObjectURL(stream);
    }
}

/*
* Helper: safely clear live stream / source from player
*/
function clearPlayerSource(player) {
    try {
        player.pause();
    } catch (e) {}

    if ("srcObject" in player && player.srcObject) {
        player.srcObject = null;
    }

    player.removeAttribute("src");

    try {
        player.load();
    } catch (e) {}
}

/*
* Helper: stop all tracks on a stream
*/
function stopStreamTracks(stream) {
    if (!stream || !stream.getTracks) {
        return;
    }

    var tracks = stream.getTracks();
    for (var i = 0; i < tracks.length; i++) {
        try {
            tracks[i].stop();
        } catch (e) {}
    }
}

function showOverlay(instanceId){
    removeClass(getElementByDynamicId("overlay_loader", instanceId), 'hidden');
}

function hideOverlay(instanceId){
    addClass(getElementByDynamicId("overlay_loader", instanceId), 'hidden');
}

/*
* Upload the captured audio on the server
* @param {Integer} instanceId ID of the current adc
*/
function uploadAudio(instanceId){
    hideErrorMessage(instanceId);
    hideSuccessMessage(instanceId);

    if (!uploadConfig(instanceId).apiKey || !uploadConfig(instanceId).secretKey) {
        displayErrorMessage(uploadConfig(instanceId).ErrMsgInvalidApiSecretKeys, instanceId);
        return;
    }

    if (audioRecorder != undefined && audioRecorder.blob) {
        var audioBlob = audioRecorder.blob;
        if (validFileSize(instanceId, audioBlob)) {
            generateNewToken(function(token){
                uploadConfig(instanceId).token = token;
                sendFileTransferCall(instanceId, audioBlob);
            }, instanceId);
        } else {
            displayErrorMessage(uploadConfig(instanceId).ErrMsgFileSizeExceeded, instanceId);
        }
    } else {
        displayErrorMessage(uploadConfig(instanceId).ErrMsgSelectFile, instanceId);
    }
}

/*
* Checks if the current file has a valid size
* @param {Integer} instanceId ID of the current adc
* @param {Data} fileData Data from the current file
*/
function validFileSize(instanceId, fileData){
    var filesize = 0;
    var maxsize = uploadConfig(instanceId).maxfilesize;

    if (fileData) {
        filesize = fileData.size / 1024;
    }

    if (fileData && filesize > maxsize) {
        return false;
    }
    return true;
}

/*
* Generates tokens for the post call
* @param {function} callback Function to execute
* @param {Integer} instanceId ID of the current adc
*/
function generateNewToken(callback, instanceId) {
    var data = {
        ApiKey: uploadConfig(instanceId).apiKey,
        SecretKey: uploadConfig(instanceId).secretKey
    };

    var url = uploadConfig(instanceId).authenticationUrl;

    var generateTokenSuccess = function (token) {
        callback(token);
    };

    var generateTokenError = function () {
        hideOverlay(instanceId);
        displayErrorMessage(uploadConfig(instanceId).ErrMsgInvalidApiSecretKeys, instanceId);
    };

    var generateTokenBeforeSend = function(){
        showOverlay(instanceId);
    };

    sendAjaxPostCall(url, data, true, generateTokenSuccess, generateTokenError, generateTokenBeforeSend);
}

/*
* Generates right url, success and error callbacks and transfers it to sendAjaxPostCall function
* @param {Integer} instanceId ID of the current adc
* @param {Data} fileData Data from the current file
*/
function sendFileTransferCall(instanceId, fileData) {
    if (!uploadConfig(instanceId).token) {
        displayErrorMessage(uploadConfig(instanceId).ErrMsgToken, instanceId);
        return;
    }

    var projectName = uploadConfig(instanceId).ausProjectName;
    var fileDataName = getAudioFileName(fileData, "file-name");
    var shortcut = uploadConfig(instanceId).shortcut;
    var seed = uploadConfig(instanceId).seedvalue;
    var guid = uploadConfig(instanceId).guidstring;

    // clean up guid of curly braces
    if (guid.charAt(0) == "{") guid = guid.substr(1);
    if (guid.charAt(guid.length - 1) == "}") guid = guid.substr(0, guid.length - 1);

    var url = uploadConfig(instanceId).uploadUrl +
        "?tokenkey=" + encodeURIComponent(uploadConfig(instanceId).token) +
        "&filename=" + encodeURIComponent(fileDataName) +
        "&projectname=" + encodeURIComponent(projectName) +
        "&shortcut=" + encodeURIComponent(shortcut) +
        "&seed=" + encodeURIComponent(seed) +
        "&guid=" + encodeURIComponent(guid);

    var uploadSuccessCallback = function (response) {
        getElementByDynamicId("HidResult", instanceId).value = response.DestinationFileName;
        displaySuccessMessage(uploadConfig(instanceId).SuccessMsgUpload, uploadConfig(instanceId).SuccessMsgColor, instanceId);
        hideOverlay(instanceId);

        if (uploadConfig(instanceId).disabledUploadBtn == 1) {
            disableUploadBtn(instanceId);
        }

        if (uploadConfig(instanceId).AutoSubmitAfterUpload == 1) {
            document.getElementsByTagName("form")[0].submit();
        } else if (uploadConfig(instanceId).EnabledNextAfterUpload == 1) {
            document.getElementsByName("Next")[0].hidden = false;
        }
    };

    var uploadErrorCallback = function () {
        getElementByDynamicId("HidResult", instanceId).value = '';
        displayErrorMessage(uploadConfig(instanceId).ErrMsgErrorAtUpload, instanceId);
        hideOverlay(instanceId);
    };

    sendAjaxPostCall(url, fileData, false, uploadSuccessCallback, uploadErrorCallback);
}

/*
* Send the request and execute the callbacks
* @param {String} url URL for the request
* @param {Data} data Data from the current file
* @param {Boolean} isJsonRequest Specifies if it is a JSON request or not
* @param {Function} successCallback Function to execute after successful request
* @param {Function} errorCallback Function to execute after unsuccessful request
* @param {Function} beforeSend Function to execute before sending request (optional)
*/
function sendAjaxPostCall(url, data, isJsonRequest, successCallback, errorCallback, beforeSend) {
    var http = new XMLHttpRequest();
    http.open("POST", url, true);

    if (isJsonRequest) {
        http.setRequestHeader("Content-type", "application/json");
        data = JSON.stringify(data);
    }

    http.onreadystatechange = function () {
        if (http.readyState == 4) {
            var response = null;

            try {
                response = JSON.parse(http.responseText);
            } catch (e) {
                response = http.responseText;
            }

            if (http.status == 200) {
                successCallback(response);
            } else {
                errorCallback(response);
            }
        }
    };

    if (beforeSend) {
        beforeSend();
    }

    http.send(data);
}

/*
* Returns a boolean depending on the element ele having the class cls or not
* @param {HTMLElement} ele Element from the HTML
* @param {String} cls A class
*/
function hasClass(ele, cls) {
    return ele.className.match(new RegExp('(\\s|^)' + cls + '(\\s|$)'));
}

/*
* Removes the class cls from element ele, if ele has the class cls
* @param {HTML Element} ele Element from the HTML
* @param {String} cls A class
*/
function removeClass(ele, cls) {
    if (hasClass(ele, cls)) {
        var reg = new RegExp('(\\s|^)' + cls + '(\\s|$)');
        ele.className = ele.className.replace(reg, ' ');
    }
}

/*
* Add the class cls to the element ele, if ele has not the class cls already
* @param {HTML Element} ele Element from the HTML
* @param {String} cls A class
*/
function addClass(ele, cls) {
    if (!hasClass(ele, cls)) {
        ele.className += ' ' + cls;
    }
}

/*
* Displays an error message
* @param {String} message The message to display
* @param {Integer} instanceId ID of the current adc
*/
function displayErrorMessage(message, instanceId){
    hideOverlay(instanceId);
    var div = getElementByDynamicId("adc-errdiv", instanceId);
    addClass(div, "askia-errors-summary");
    div.style.marginBottom = "50px";

    var ul = getElementByDynamicId("ulErrorMessages", instanceId);
    ul.innerHTML = "";

    var li = document.createElement("li");
    li.appendChild(document.createTextNode(message));
    ul.appendChild(li);
}

/*
* Displays a success message
* @param {String} message The message to display
* @param {String} colorcode Background color of the message - ex: xxx,xxx,xxx
* @param {Integer} instanceId ID of the current adc
*/
function displaySuccessMessage(message, colorcode, instanceId){
    hideOverlay(instanceId);
    var div = getElementByDynamicId("adc-succdiv", instanceId);
    div.style.backgroundColor = 'rgb(' + colorcode + ')';
    div.style.color = 'white';
    div.style.width = '100%';
    div.style.paddingTop = '15px';
    div.style.paddingBottom = '15px';
    div.style.marginBottom = '50px';
    div.style.borderRadius = '3px';

    var span = getElementByDynamicId("spanSuccessMessage", instanceId);
    span.innerHTML = message;
}

/*
* Disable the upload button
* @param {Integer} instanceId ID of the current adc
*/
function disableUploadBtn(instanceId) {
    var btn = getElementByDynamicId("btnUpload", instanceId);

    if (btn.hasAttribute("disabled")) {
        btn.setAttribute("disabled", "disabled");
    } else {
        var att = document.createAttribute("disabled");
        att.value = "disabled";
        btn.setAttributeNode(att);
    }

    addClass(btn, "disabled");
    btn.style.cursor = "not-allowed";
}

/*
* Enable the upload button
* @param {Integer} instanceId ID of the current adc
*/
function enableUploadBtn(instanceId) {
    var btn = getElementByDynamicId("btnUpload", instanceId);

    if (btn.hasAttribute("disabled")) {
        btn.removeAttribute("disabled");
    }

    removeClass(btn, "disabled");
    btn.style.cursor = "pointer";
}

/*
* Hides success message
* @param {Integer} instanceId ID of the current adc
*/
function hideSuccessMessage(instanceId) {
    var div = getElementByDynamicId("adc-succdiv", instanceId);
    div.removeAttribute("style");

    var span = getElementByDynamicId("spanSuccessMessage", instanceId);
    span.innerHTML = "";
}

/*
* Hides error message
* @param {Integer} instanceId ID of the current adc
*/
function hideErrorMessage(instanceId){
    var div = getElementByDynamicId("adc-errdiv", instanceId);
    removeClass(div, "askia-errors-summary");
    div.removeAttribute("style");

    var ul = getElementByDynamicId("ulErrorMessages", instanceId);
    ul.innerHTML = "";
}

/*
* Return the DOM element of the current adc
* @param {Integer} instanceId ID of the current adc
*/
function getElementByDynamicId(elementId, instanceId) {
    return document.getElementById(elementId + "_" + instanceId);
}

/*
* Return the uploadConfig variable containing properties of the current adc
* @param {Integer} instanceId ID of the current adc
*/
function uploadConfig(instanceId) {
    return eval('uploadConfig_' + instanceId);
}

/*
* Enable the upload button
* @param {Integer} instanceId ID of the current adc
*/
function activateBtnUpload(instanceId) {
    if (uploadConfig(instanceId).allowUploadFileChange == 1) {
        enableUploadBtn(instanceId);
    }
}

/*
* Start the recording of audio
* @param {Integer} instanceId ID of the current adc
*/
function startRecordingAudio(instanceId) {
    hideErrorMessage(instanceId);
    hideSuccessMessage(instanceId);

    var startBtn = getElementByDynamicId("btn-start-recording", instanceId);
    var stopBtn = getElementByDynamicId("btn-stop-recording", instanceId);
    var player = getElementByDynamicId("player", instanceId);
    var btnSave = getElementByDynamicId("btnSave", instanceId);

    startBtn.disabled = true;
    stopBtn.disabled = true;

    if (uploadConfig(instanceId).allowUploadFileChange == 1) {
        enableUploadBtn(instanceId);
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        displayErrorMessage(uploadConfig(instanceId).ErrMsgUserMediaAccess, instanceId);
        startBtn.disabled = false;
        return;
    }

    navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
    }).then(function(stream) {
        clearPlayerSource(player);
        setSrcObject(stream, player);
        player.muted = true;

        var recorderOptions = {
            type: "audio",
            audioBitsPerSecond: 128000
        };

        var supportedMimeType = getSupportedAudioMimeType();
        if (supportedMimeType) {
            recorderOptions.mimeType = supportedMimeType;
        }

        audioRecorder = new RecordRTCPromisesHandler(stream, recorderOptions);
        audioRecorder.stream = stream;

        var playPromise;
        try {
            playPromise = player.play();
        } catch (e) {}

        if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(function() {
                // ignore autoplay failures for live preview
            });
        }

        return audioRecorder.startRecording();
    }).then(function() {
        console.info("Recording audio ...");
        stopBtn.disabled = false;
        }).catch(function(error) {
            var debugMsg = "START FAILED\n";

            debugMsg += "Error: " + (error && error.message ? error.message : error) + "\n";

            debugMsg += "MediaRecorder: " + (typeof MediaRecorder !== "undefined") + "\n";

            if (typeof MediaRecorder !== "undefined") {
                debugMsg += "webm: " + MediaRecorder.isTypeSupported("audio/webm;codecs=opus") + "\n";
                debugMsg += "webm(no codec): " + MediaRecorder.isTypeSupported("audio/webm") + "\n";
                debugMsg += "mp4: " + MediaRecorder.isTypeSupported("audio/mp4") + "\n";
                debugMsg += "ogg: " + MediaRecorder.isTypeSupported("audio/ogg") + "\n";
            }

            // SHOW IT DIRECTLY IN THE UI
            displayErrorMessage(debugMsg, instanceId);

            console.error("Cannot start audio recording:", error);
        });

    removeClass(player, "saved");

    if (btnSave) {
        btnSave.disabled = false;
    }
}

/*
* Stop the audio recording, display the recorded audio, and free the stream
* @param {Integer} instanceId ID of the current adc
*/
function stopRecordingAudio(instanceId) {
    var startBtn = getElementByDynamicId("btn-start-recording", instanceId);
    var stopBtn = getElementByDynamicId("btn-stop-recording", instanceId);
    var player = getElementByDynamicId("player", instanceId);

    stopBtn.disabled = true;

    if (!audioRecorder) {
        displayErrorMessage(uploadConfig(instanceId).ErrMsgStopRec, instanceId);
        startBtn.disabled = false;
        return;
    }

    audioRecorder.stopRecording().then(function() {
        console.info("stopRecording success");

        clearPlayerSource(player);

        if (!audioRecorder.blob) {
            throw "Empty blob.";
        }

        player.src = URL.createObjectURL(audioRecorder.blob);
        player.muted = false;

        try {
            player.load();
        } catch (e) {}

        var playPromise;
        try {
            playPromise = player.play();
        } catch (e) {}

        if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(function() {
                // ignore autoplay failures on playback
            });
        }

        stopStreamTracks(audioRecorder.stream);
        startBtn.disabled = false;
    }).catch(function(error) {
        console.log("Stop recording error:", error);
        stopStreamTracks(audioRecorder && audioRecorder.stream ? audioRecorder.stream : null);
        startBtn.disabled = false;
        displayErrorMessage(uploadConfig(instanceId).ErrMsgStopRec, instanceId);
    });
}

/*
* Save the recorded audio on the user's disk
* @param {Integer} instanceId ID of the current adc
*/
function saveAudio(instanceId) {
    hideErrorMessage(instanceId);
    hideSuccessMessage(instanceId);

    var player = getElementByDynamicId("player", instanceId);

    if (!hasClass(player, "saved")) {
        if (audioRecorder != undefined && audioRecorder.blob) {
            var fileName = getAudioFileName(audioRecorder.blob, "my_audio");

            if (window.navigator.msSaveOrOpenBlob) {
                window.navigator.msSaveOrOpenBlob(audioRecorder.blob, fileName);
            } else {
                var a = document.createElement("a");
                var objectUrl = player.src;

                if (!objectUrl) {
                    objectUrl = URL.createObjectURL(audioRecorder.blob);
                }

                a.href = objectUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();

                setTimeout(function() {
                    document.body.removeChild(a);
                }, 0);
            }

            addClass(player, "saved");

            var saveBtn = getElementByDynamicId("btnSave", instanceId);
            if (saveBtn) {
                saveBtn.disabled = true;
            }

            displaySuccessMessage(uploadConfig(instanceId).SuccessMsgSave, uploadConfig(instanceId).SuccessMsgColor, instanceId);
        } else {
            displayErrorMessage(uploadConfig(instanceId).ErrMsgSave, instanceId);
        }
    }
}