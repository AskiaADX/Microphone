function showOverlay(instanceId){
    removeClass(getElementByDynamicId("overlay_loader", instanceId),'hidden');
}

function hideOverlay(instanceId){
    addClass(getElementByDynamicId("overlay_loader", instanceId),'hidden');
}

/*
* Upload the captured photo on the server
* @param {Integer} instanceId ID of the current adc
*/
function uploadAudio(instanceId){
	hideErrorMessage(instanceId);
    hideSuccessMessage(instanceId);

    if (!uploadConfig(instanceId).apiKey || !uploadConfig(instanceId).secretKey) {
		displayErrorMessage(uploadConfig(instanceId).ErrMsgInvalidApiSecretKeys, instanceId);
        return;
    }

    if(audioRecorder != undefined){ // if audio has been recorded
        var audioBlob;
        audioBlob = audioRecorder.blob;
        if(validFileSize(instanceId, audioBlob)){
            generateNewToken(function(token){
                uploadConfig(instanceId).token=token;
                sendFileTransferCall(instanceId, audioBlob);
            }, instanceId);
        }
        else{
            displayErrorMessage(uploadConfig(instanceId).ErrMsgFileSizeExceeded, instanceId);
        }
    }
    else{
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
    var generateTokenError = function (error) {
        hideOverlay(instanceId);
        displayErrorMessage(uploadConfig(instanceId).ErrMsgInvalidApiSecretKeys, instanceId);
    };
    var generateTokenBeforeSend=function(){
        showOverlay(instanceId);
    };

    sendAjaxPostCall(url, data, true, generateTokenSuccess, generateTokenError,generateTokenBeforeSend);

}

/*
* Generates right url, success and error callbacks and transfers it to sendAjaxPostCall function
* @param {Integer} instanceId ID of the current adc
* @param {Data} fileData Data from the current file
* @param {String} type Type of file (video or photo)
*/
function sendFileTransferCall(instanceId, fileData) {
    if(!uploadConfig(instanceId).token){
        displayErrorMessage(uploadConfig(instanceId).ErrMsgToken, instanceId);
        return;
    }

    var projectName = uploadConfig(instanceId).ausProjectName;
    //var fileData = getElementByDynamicId("adc_uploader", instanceId).files[0];
    var fileDataName = "file-name.mpeg";
    var shortcut = uploadConfig(instanceId).shortcut;
    var seed = uploadConfig(instanceId).seedvalue;
    var guid = uploadConfig(instanceId).guidstring;

    // clean up guid of curly braces
    if (guid.charAt(0) == "{") guid = guid.substr(1);
    if (guid.charAt(guid.length - 1) == "}") guid = guid.substr(0, guid.length - 1);

    var url=uploadConfig(instanceId).uploadUrl + "?tokenkey=" + uploadConfig(instanceId).token + "&filename=" + fileDataName
    + "&projectname=" + projectName + "&shortcut=" + shortcut + "&seed=" + seed + "&guid=" + guid;

    var uploadSuccessCallback = function (response) {
        getElementByDynamicId("HidResult", instanceId).value=response.DestinationFileName;
        displaySuccessMessage(uploadConfig(instanceId).SuccessMsgUpload, uploadConfig(instanceId).SuccessMsgColor, instanceId);
        hideOverlay(instanceId);
        if (uploadConfig(instanceId).disabledUploadBtn == 1) {
	    	disableUploadBtn(instanceId);
        }
        if (uploadConfig(instanceId).AutoSubmitAfterUpload == 1) {
            document.getElementsByTagName("form")[0].submit();
        } else {
            if (uploadConfig(instanceId).EnabledNextAfterUpload == 1) {
                document.getElementsByName("Next")[0].hidden = false;
            }
        }
    };
    var uploadErrorCallback = function (error) {
        getElementByDynamicId("HidResult", instanceId).value='';
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
function sendAjaxPostCall(url, data, isJsonRequest, successCallback, errorCallback,beforeSend) {
    var http = new XMLHttpRequest();
    http.open("POST", url, true);
    if (isJsonRequest) {
        http.setRequestHeader("Content-type", "application/json");
        data = JSON.stringify(data);
    }

    http.onreadystatechange = function () {
        if (http.readyState == 4) {
            if (http.status == 200) {
                var response = JSON.parse(http.responseText);
                successCallback(response);
            } else {
                var response = JSON.parse(http.responseText);
                errorCallback(response);
            }
        }
    }
    if(beforeSend){
        beforeSend();
    }
    http.send(data);
}

/*
* Returns a boolean depending on the element ele having the class cls or not
* @param {HTMLElement} ele Element from the HTML
* @param {String} cls A class
*/
function hasClass(ele,cls) {
    return ele.className.match(new RegExp('(\\s|^)'+cls+'(\\s|$)'));
}

/*
* Removes the class cls from element ele, if ele has the class cls
* @param {HTML Element} ele Element from the HTML
* @param {String} cls A class
*/
function removeClass(ele,cls) {
    if (hasClass(ele,cls)) {
        var reg = new RegExp('(\\s|^)'+cls+'(\\s|$)');
        ele.className=ele.className.replace(reg,' ');
    }
}

/*
* Add the class cls to the element ele, if ele has not the class cls already
* @param {HTML Element} ele Element from the HTML
* @param {String} cls A class
*/
function addClass(ele,cls) {
    if (!hasClass(ele,cls)) {
        ele.className += ' '+ cls;
    }
}

/*
* Displays an error message
* @param {String} message The message to display
* @parem {Integer} instanceId ID of the current adc
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
    div.style.backgroundColor= 'rgb(' + colorcode + ')';
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
        btn.setAttribute("disabled","disabled");
    } else {
        var att = document.createAttribute("disabled");
        att.value = "disabled";
        btn.setAttributeNode(att);
    }
    addClass(btn,"disabled");
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
    removeClass(btn,"disabled");
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
* Start the record of audio, displays the stream on screen, storing the stream in audioRecorder variable
* @param {Integer} instanceId ID of the current adc
*/
function startRecordingAudio(instanceId) {
    document.getElementById('btn-start-recording').disabled = true;
    var player = document.getElementById('player');
    if (uploadConfig(instanceId).allowUploadFileChange == 1) {
        enableUploadBtn(instanceId);
    }
    navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
    }).then(function(stream) {
        setSrcObject(stream, player);
        if (!navigator.userAgent.toUpperCase().includes("IPAD")) {
                player.play();
                player.muted = true;
            audioRecorder = new RecordRTCPromisesHandler(stream, {
                mimeType: 'audio/mpeg',
                type: 'audio',
                audioBitsPerSecond: 128000
            });
            audioRecorder.startRecording().then(function() {
                console.info('Recording audio ...');
            }).catch(function(error) {
                displayErrorMessage(uploadConfig(instanceId).ErrMsgStartRec, instanceId);
                console.error('Cannot start audio recording: ', error);
            });
            audioRecorder.stream = stream;
        }
        document.getElementById('btn-stop-recording').disabled = false;
    }).catch(function(error) {
        displayErrorMessage(uploadConfig(instanceId).ErrMsgUserMediaAccess, instanceId);
        console.error("Cannot access media devices: ", error);
    });
    removeClass(document.getElementById("label-start"), "primary");
    addClass(document.getElementById("label-stop"), "primary");
    removeClass(player, "saved");
    getElementByDynamicId("btnSave",instanceId).disabled = false;
}

/*
* Stop the audio recording, diplays the recorded audio on screen and stores the audio in audioRecorder variable
* @param {Integer} instanceId ID of the current adc
*/
function stopRecordingAudio(instanceId) {
    removeClass(document.getElementById("label-stop"), "primary");
    addClass(document.getElementById("label-start"), "primary");
    document.getElementById('btn-stop-recording').disabled = true;
    var player = document.getElementById('player');
    audioRecorder.stopRecording().then(function() {
        console.info('stopRecording success');

        // Now RecordRTCPromisesHandler function returns a promise with a blob as the promise value.
        player.src = URL.createObjectURL(audioRecorder.blob);

        if (!navigator.userAgent.toUpperCase().includes("IPAD")) {
            player.play();
            player.muted = false;
        }
        audioRecorder.stream.stop();
        document.getElementById('btn-start-recording').disabled = false;
    }).catch(function(error) {
        displayErrorMessage(uploadConfig(instanceId).ErrMsgStopRec, instanceId);
        console.log("Stop recording error:", error);
    });
}

/*
* Save the recorded audio on the user's disk
* @param {Integer} instanceId ID of the current adc
*/
function saveAudio(instanceId) {
    hideErrorMessage(instanceId);
    hideSuccessMessage(instanceId);
    var player = document.getElementById("player");
    if (!hasClass(player, "saved")) {
        if(audioRecorder != undefined){ // if audio has been recorded
            if (window.navigator.msSaveOrOpenBlob) { // Edge
               window.navigator.msSaveOrOpenBlob(audioRecorder.blob, "my_audio.mpeg");
            } else { // Others
                var a = document.createElement("a");
                a.href = player.src;
                a.download = "my_audio.mpeg";
                document.body.appendChild(a);
                a.click();
                setTimeout(function() {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(player.src);
                }, 0);
            }
            addClass(player, "saved");
            getElementByDynamicId("btnSave", instanceId).disabled = true;
            displaySuccessMessage(uploadConfig(instanceId).SuccessMsgSave, uploadConfig(instanceId).SuccessMsgColor, instanceId);
        } else{
            displayErrorMessage(uploadConfig(instanceId).ErrMsgSave, instanceId);
        }
    }
}
