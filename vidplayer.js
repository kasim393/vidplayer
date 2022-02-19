var VIDEO = document.getElementById('video');
const hashArgs = new URLSearchParams(window.location.hash.substr(1));
const NODE = hashArgs.get("node")
const STREAMER = hashArgs.get("streamer")
const PASSWORD = hashArgs.get("password")
const ZOD58 = hashArgs.get("zod58")
const frame_queue = []
var playing = true;
var currentViewWebSocket;

var MAP = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
var to_b58 = function(term) {return (typeof term === 'string' || term instanceof String) ? to_b58_1(new TextEncoder().encode(term)) : to_b58_1(term)}
var to_b58_1 = function(B,A){if(!A){A=MAP};var d=[],s="",i,j,c,n;for(i in B){j=0,c=B[i];s+=c||s.length^i?"":1;while(j in d||c){n=d[j];n=n?n*256+c:c;c=n/58|0;d[j]=n%58;j++}}while(j--)s+=A[d[j]];return s};
var from_b58 = function(term) {return new TextDecoder().decode(from_b58_1(term))}
var from_b58_1 = function(S,A){if(!A){A=MAP};var d=[],b=[],i,j,c,n;for(i in S){j=0,c=A.indexOf(S[i]);if(c<0)return undefined;c||b.length^i?i:b.push(0);while(j in d||c){n=d[j];n=n?n*58+c:c;c=n>>8;d[j]=n%256;j++}}while(j--)b.push(d[j]);return new Uint8Array(b)};

function setVideoPlayer(element) {
    VIDEO = element;
}

function hasMediaSource() {
  try {
    MediaSource
    return true;
  } catch (err) {
    return false;
  }
}

function build_token() {
  var obj = {
    streamer: STREAMER,
    password: PASSWORD,
    zod58: ZOD58
  }
  obj = Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null));
  return to_b58(JSON.stringify(obj))
}

async function start_viewer() {
  if (!hasMediaSource()) {
    // IOS + SAFARI
    alert("IOS + Safari is not supported ATM, or your browser does not have MediaSource support")
    return
    //video.src = "https://${stream_host}/m3u8/${stream_name}.m3u8"
    //video.src = "https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8"
  } else {
    // All other browsers
    var mimeCodec = 'video/mp4; codecs="avc1.640016,mp4a.40.2"';
    if (!MediaSource.isTypeSupported(mimeCodec)) {
      alert(`Your browser does not support codec ${mimeCodec}, contact support.`)
      throw new Error("Something went badly wrong!");
    }

    var mediaSource = new MediaSource();
    VIDEO.src = URL.createObjectURL(mediaSource);
    mediaSource.addEventListener('sourceopen', handleSourceOpen);

    function handleSourceOpen() {
      var sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
      sourceBuffer.mode = "sequence";
      globalThis.sourceBuffer = sourceBuffer;
      sourceBuffer.addEventListener('updateend', handleUpdateEnd);
      VIDEO.addEventListener("pause", videoPause);
      VIDEO.addEventListener("play", videoPlay);
      joinView(`ws://${NODE}/view`, build_token());
    }
  }
}
start_viewer()

function handleUpdateEnd() {
  const queued_data = frame_queue.shift();
  if (!queued_data || globalThis.sourceBuffer.updating)
    return
  globalThis.sourceBuffer.appendBuffer(queued_data);
}

//TODO close websocket on pause
function videoPause() {
  playing = false;
}

function videoPlay() {
  playing = true;
}

function change_resolution(res) {
  currentViewWebSocket.send(JSON.stringify({
    op: "change_resolution",
    resolution: res
  }))
}

async function joinView(wsUrl, extraData) {
  let ws = new WebSocket(wsUrl, ["ExtraData", extraData]);
  ws.binaryType = "arraybuffer";

  let rejoined = false;
  let startTime = Date.now();

  let rejoin = async () => {
    if (!rejoined) {
      rejoined = true;
      currentViewWebSocket = null;

      let timeSinceLastJoin = Date.now() - startTime;
      if (timeSinceLastJoin < 10000) {
        await new Promise(resolve => setTimeout(resolve, 10000 - timeSinceLastJoin));
      }

      // OK, reconnect now!
      joinView(wsUrl, extraData);
    }
  }

  ws.addEventListener("open", event => {
    currentViewWebSocket = ws;
    postMessage({
      op: "viewOn"
    }, location.origin);
  });
  ws.addEventListener("close", event => {
    console.log("view closed, reconnecting:", event.code, event.reason, event);
    postMessage({
      op: "viewOff"
    }, location.origin);
    rejoin();
  });
  ws.addEventListener("error", event => {
    console.log("view error, reconnecting:", event);
    postMessage({
      op: "viewOff"
    }, location.origin);
    rejoin();
  });
  ws.addEventListener("message", event => {
    if (globalThis.sourceBuffer.error != undefined)
      console.log(globalThis.sourceBuffer.error)
    if (VIDEO.error != null)
      console.log(VIDEO.error)
    if (event.data instanceof ArrayBuffer) {
      if (globalThis.sourceBuffer.updating) {
        frame_queue.push(event.data)
        return
      }
      if (!playing && event.data.byteLength >= 3000)
        return
      globalThis.sourceBuffer.appendBuffer(event.data);

      //Pace the buffer, otherwise viewer falls behind
      if (globalThis.sourceBuffer.buffered.length >= 1) {
        var delta = VIDEO.buffered.end(0) - VIDEO.currentTime
        console.log(delta)
        if (delta <= 0.1) {
          VIDEO.playbackRate = 1
        } else if (delta >= 3) {
          VIDEO.currentTime = 4294967295;
          VIDEO.playbackRate = 1
        } else if (delta >= 0.8) {
          VIDEO.playbackRate = 1.05
        } else if (delta >= 0.4) {
          VIDEO.playbackRate = 1.03
        } else if (delta >= 0.2) {
          VIDEO.playbackRate = 1.02
        }
      }
    } else {
      var json = JSON.parse(event.data)
      console.log(json)
    }
  });
}