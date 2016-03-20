/**
 * Created by cmcquay on 2016-03-17.
 */

    var namespace = "/"
    var socket = io.connect('http://' + document.domain + ':' + location.port + namespace);

    // a bit of a hack to avoid emissions
    var isUpdating = false

    function emit(message, data) {
        if (!isUpdating) {
            socket.emit(message, data);
        }
    }

    function ChannelViewModel(data) {
        ko.mapping.fromJS(data, {}, this);
        this.gain.subscribe(function (val) {
            emit('update_channel', ko.mapping.toJS(this))
        }, this);

        this.enabled.subscribe(function (val) {
            emit('update_channel', ko.mapping.toJS(this))
        }, this);
    }

    function MixerViewModel(data) {
        var self = this;

        // mapping for object model binding
        var mapping = {
            'channels': {
                key: function (data) {
                    console.log("Channel", data)
                    return ko.utils.unwrapObservable(data.id)
                }
                , create: function (options) {
                    return new ChannelViewModel(options.data);
                }
            }
        }

        self.apply = function (data) {
            ko.mapping.fromJS(data, mapping, self);
        }

        // Need to apply before subscribing to isPlaying
        self.apply(data);

        this.isPlaying.subscribe(function (val) {
            if (val) {
                emit("start_audio");
            } else {
                emit("stop_audio");
            }
        });

        socket.on("model_changed", function (data) {
            isUpdating = true;
            self.apply(data);
            isUpdating = false;
        });
    }

    function RxMotion(samplingInterval) {
        self = this;
        this.isSupported = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && window.DeviceOrientationEvent;
        if (!samplingInterval) {
            // default value
            samplingInterval = 100;
        }

        var motionSubject = new Rx.Subject();
        var orientationSubject = new Rx.Subject();

        // Device Motion
        this.motion = motionSubject.asObservable();
        this.acceleration = this.motion.pluck("acceleration").timestamp()
        this.accelerationIncludingGravity = this.motion.pluck("accelerationIncludingGravity").timestamp();
        this.rotationRate = this.motion.pluck("rotationRate").timestamp();

        // Device Orientation
        this.orientation = orientationSubject.asObservable();
        this.gamma = this.orientation.pluck("gamma").timestamp();
        this.beta = this.orientation.pluck("beta").timestamp();
        this.alpha = this.orientation.pluck("alpha").timestamp();
        this.compassHeading = this.orientation.pluck("webkitCompassHeading").timestamp();

        if (!this.isSupported) {
            console.warn("Motion API not supported on this device");
        } else {
            Rx.Observable.fromEvent(window, "devicemotion").sample(samplingInterval).subscribe(motionSubject)
            Rx.Observable.fromEvent(window, "deviceorientation").sample(samplingInterval).subscribe(orientationSubject);
        }
    }

    function ObservableMotion() {
        var self = this;

        var motionSchema = {
            acceleration: {x: 0.0, y: 0.0, z: 0.0},
            accelerationIncludingGravity: {x: 0.0, y: 0.0, z: 0.0},
            rotationRate: {gamma: 0.0, alpha: 0.0, beta: 0.0},
            interval: 0.0,
            timestamp: 0
        }

        self.apply = function (event) {
            var motionObj = {
                acceleration: event.acceleration,
                accelerationIncludingGravity: event.accelerationIncludingGravity,
                rotationRate: event.rotationRate,
                interval: event.interval,
                timestamp: event.timestamp
            }

            ko.mapping.fromJS(motionObj, {}, self);
        }

        self.apply(motionSchema);

        // Computed properties

        var throttleMs = 100;

        var _lastAccel = {x: 0.0, y: 0.0, z: 0.0};
        var _velocity = {x: 0.0, y: 0.0, z: 0.0};
        this.velocity = {
            x: ko.computed(function () {
                // ( Ax(t) - Ax(t-1) ) / 2 * interval = delta_acceleration
                var current = self.acceleration.x();
                var last = _lastAccel.x;
                _lastAccel.x = current;
                _velocity.x = _velocity.x + (current - last) / 2.0 * self.interval();
                return _velocity.x;
            }).extend({rateLimit: throttleMs}),
            y: ko.computed(function () {
                var current = self.acceleration.y();
                var last = _lastAccel.y;
                _lastAccel.y = current;
                return (current - last) / 2.0 * self.interval();
            }).extend({rateLimit: throttleMs}),
            z: ko.computed(function () {
                var current = self.acceleration.z();
                var last = _lastAccel.z;
                _lastAccel.z = current;
                return (current - last) / 2.0 * self.interval();
            }).extend({rateLimit: throttleMs})
        }


        var _lastVelocity = {x: 0.0, y: 0.0, z: 0.0};
        var _position = {x: 0.0, y: 0.0, z: 0.0};
        this.position = {
            x: ko.computed(function () {
                // ( Ax(t) - Ax(t-1) ) / 2 * interval = delta_acceleration
                var current = self.velocity.x();
                var last = _lastVelocity.x;
                _lastVelocity.x = current;
                _position.x = _position.x + (current - last) / 2.0 * self.interval();
                return _position.x;
            }).extend({rateLimit: throttleMs}),
            y: ko.computed(function () {
                var current = self.velocity.y();
                var last = _lastVelocity.y;
                _lastVelocity.y = current;
                return (current - last) / 2.0 * self.interval();
            }).extend({rateLimit: throttleMs}),
            z: ko.computed(function () {
                var current = self.velocity.z();
                var last = _lastVelocity.z;
                _lastVelocity.z = current;
                return (current - last) / 2.0 * self.interval();
            }).extend({rateLimit: throttleMs})
        }


    }

    function DeviceMotionAdapter(updateInterval) {
        var self = this;

        this.isSupported = new ko.observable(false);
        this.isTracking = new ko.observable(false);
        this.motion = new ObservableMotion();


        // Check if mobile
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && window.DeviceOrientationEvent) {
            this.isSupported(true);
        }

        var deviceInfo = {
            motion: {},
            orientation: {}
        }

        var pushDeviceInfo = function () {
            if (self.isTracking()) {
                deviceSocket.emit("changed", deviceInfo);
            }
        }

        var handleMotionEvent = function (event) {
            deviceInfo.motion = event;
            self.motion.apply(event);
        }

        var handleOrientationEvent = function (event) {
            deviceInfo.orientation = event;
        }

        if (this.isSupported()) {
            var deviceSocket = io("/device")
            deviceSocket.on('connect', function (evt) {
                deviceInfo.id = deviceSocket.id;
            });
        }

        var subscription = -1;
        this.isTracking.subscribe(function (val) {
            // todo: check if we're already subscribed?
            if (val) {
                console.log("Subscribing to device motion");
                window.addEventListener("devicemotion", handleMotionEvent, true);
                window.addEventListener("deviceorientation", handleOrientationEvent, true);

                if (!updateInterval) {
                    updateInterval = 10000;
                }
                subscription = setInterval(pushDeviceInfo, updateInterval)
            } else {
                window.removeEventListener("devicemotion", handleMotionEvent, true);
                window.removeEventListener("deviceorientation", handleOrientationEvent, true)
                clearInterval(subscription);
            }
        })
    }

    function FullScreenViewModel(targetElement) {
        self = this;
        this.isSupported = new ko.observable(
                document.fullscreenEnabled ||
                document.webkitFullscreenEnabled ||
                document.mozFullScreenEnabled ||
                document.msFullscreenEnabled);

        this.isFullScreen = new ko.observable(false);

        var element = targetElement;

        this.enterFullScreen = function () {
            // go full-screen
            if (element.requestFullscreen) {
                element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                element.mozRequestFullScreen();
            } else if (element.msRequestFullscreen) {
                element.msRequestFullscreen();
            }
        }

        document.addEventListener("fullscreenchange", function(evt){
            console.log(evt);
        });
    }
