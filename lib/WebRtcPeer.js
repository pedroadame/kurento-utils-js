function defaultOnerror(error) {
	console.error(error);
}

function WebRtcPeer(mode, localVideo, remoteVideo, onsdpoffer, onerror, videoStream) {

	Object.defineProperty(this, 'onsdpoffer', { writable: true});

	Object.defineProperty(this, 'onerror', { writable: true});

	Object.defineProperty(this, 'localVideo', { writable: true});

	Object.defineProperty(this, 'remoteVideo', { writable: true});

	Object.defineProperty(this, 'stream',  { writable: true});

	Object.defineProperty(this, 'pc', { writable: true});

	Object.defineProperty(this, 'mode', { writable: true});

	this.localVideo = localVideo;
	this.remoteVideo = remoteVideo;
	this.onerror = (!onerror) ? defaultOnerror : onerror;
	this.stream = videoStream;
	this.mode = mode;
	this.onsdpoffer = onsdpoffer;
}

WebRtcPeer.prototype.start = function() {

	var self = this;

	if (!this.pc) {
		this.pc = new RTCPeerConnection(this.server, this.options);
	}

	var pc = this.pc;

	if (this.stream && this.localVideo) {
		this.localVideo.src = URL.createObjectURL(this.stream);
		this.localVideo.muted = true;
	}

	if (this.stream) {
		pc.addStream(this.stream);
	}

	var constraints = {
			mandatory: {
				OfferToReceiveAudio: (this.remoteVideo !== undefined),
				OfferToReceiveVideo: (this.remoteVideo !== undefined)
			}
	};

	pc.createOffer(function(offer) {
		console.log('Created SDP offer');
		pc.setLocalDescription(offer, function() {
			console.log('Local description set');
		}, this.onerror);

	}, this.onerror, constraints);

	pc.onicecandidate = function (e) {
		// candidate exists in e.candidate
		if (e.candidate) return;

		var offerSdp = pc.localDescription.sdp;
		console.log('ICE negotiation completed');
		if (self.onsdpoffer) {
			console.log('Invokin SDP offer callback function');
			self.onsdpoffer(offerSdp, self);
		}
	};

}

WebRtcPeer.prototype.dispose = function() {
	console.log('Disposing WebRtcPeer');
	//TODO don't know if we have to do this
	if (this.stream) this.pc.removeStream(this.stream);
	this.pc.close();
};


WebRtcPeer.prototype.processSdpAnswer = function(sdpAnswer) {
	var answer = new RTCSessionDescription({
		type : 'answer',
		sdp : sdpAnswer,
	});

	console.log('SDP answer received, setting remote description');
	var self = this;
	self.pc.setRemoteDescription(answer, function() {
		if (self.remoteVideo) {
			var stream = self.pc.getRemoteStreams()[0];
			self.remoteVideo.src = URL.createObjectURL(stream);
		}
	}, this.onerror);
}

WebRtcPeer.prototype.server = {
		iceServers : [ {
			url : 'stun:stun.l.google.com:19302'
		} ]
};

WebRtcPeer.prototype.options = {
		optional : [ {
			DtlsSrtpKeyAgreement : true
		} ]
};

WebRtcPeer.start = function(mode, localVideo, remoteVideo, onSdp, onerror, videoStream) {
	var wp = new WebRtcPeer(mode, localVideo, remoteVideo, onSdp, onerror, videoStream);

	if (wp.mode !== 'recv' && !wp.stream) {
		getUserMedia({
			'audio' : true,
			'video' : true
		}, function(userStream) {
			wp.stream = userStream;
			wp.start();
		}, wp.onerror);
	} else {
		wp.start();
	}

	return wp;
};

WebRtcPeer.startRecvOnly = function (remoteVideo, onSdp, onError) {
	return WebRtcPeer.start('recv', null, remoteVideo, onSdp, onError);
};

WebRtcPeer.startSendOnly = function (localVideo, onSdp, onError) {
	return WebRtcPeer.start('send', localVideo, null, onSdp, onError);
};

WebRtcPeer.startSendRecv = function (localVideo, remoteVideo, onSdp, onError) {
	return WebRtcPeer.start('sendRecv', localVideo, remoteVideo, onSdp, onError);
};

module.exports = WebRtcPeer;